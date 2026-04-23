import { Injectable } from '@angular/core';
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  type QuerySnapshot,
  type Unsubscribe,
  where,
} from 'firebase/firestore';
import { getConfiguredFirestore } from 'src/app/config/firestore-instance';
import { CONTEST_GAME_MODE_BIO_BALL } from 'src/app/shared/models/contest.model';
import { WeeklyContestSlateService } from 'src/app/shared/services/weekly-contest-slate.service';
import {
  getPlaceAmountLines,
  getWinnerGetsPhrase,
} from '../shared/contest-payout-display';
import {
  initialLoadingResultsView,
  parseFinalResultsForViewer,
  type ParsedFinalResultsView,
} from '../shared/contest-results-closure';
import { formatDryRunCurrencyCaption, parseDryRunPayoutDocument } from '../lib/contests-panel-dry-run-payout';
import { parseEntryPaymentStatus } from '../lib/contests-panel-entry.util';
import {
  contestRowsByIdFromSnapshots,
  filterRowsForContestsPanel,
} from '../lib/contests-panel-list.util';
import {
  MAX_COMPLETED_CONTESTS,
  type ContestEntryRowState,
  type ContestListRow,
  type ContestPayoutView,
} from '../lib/contests-panel.types';

/**
 * Writable panel state updated from Firestore. The contests panel passes its
 * instance fields matching this shape.
 */
export interface ContestsPanelFirestoreUiState {
  rows: ContestListRow[];
  loading: boolean;
  listError: string | null;
  entryInfoByContestId: Record<string, ContestEntryRowState>;
  paidPayoutByContestId: Record<string, ContestPayoutView>;
  finalResultsByContestId: Record<string, ParsedFinalResultsView>;
  expandedContestId: string | null;
  rulesCheckbox: boolean;
  joinError: string | null;
  joinSuccess: string | null;
  checkoutAwaitPaymentContestId: string | null;
}

/**
 * Owns Firestore listeners for the contests panel: contest list queries,
 * per-contest entry docs, dry-run payouts, and final results.
 */
@Injectable()
export class ContestsPanelFirestoreSyncService {
  private listUnsubs: Unsubscribe[] = [];
  private loadedOpen = false;
  private loadedScheduled = false;
  private loadedPaid = false;
  private openSnap: QuerySnapshot | null = null;
  private scheduledSnap: QuerySnapshot | null = null;
  private paidSnap: QuerySnapshot | null = null;

  private entryRowUnsubs = new Map<string, Unsubscribe>();
  private paidPayoutUnsubs = new Map<string, Unsubscribe>();
  private finalResultsUnsubs = new Map<string, Unsubscribe>();

  constructor(
    private readonly weeklyContestSlate: WeeklyContestSlateService,
  ) {}

  /**
   * Subscribes to open / scheduled / paid contest lists. Clears any prior list
   * subscriptions and paid / final listeners (not entry row listeners).
   */
  attachContestList(
    ui: ContestsPanelFirestoreUiState,
    uid: string | null,
  ): void {
    this.stopContestListOnly(ui);
    ui.loading = true;
    ui.listError = null;
    this.loadedOpen = false;
    this.loadedScheduled = false;
    this.loadedPaid = false;
    this.openSnap = null;
    this.scheduledSnap = null;
    this.paidSnap = null;

    const db = getConfiguredFirestore();
    const qOpen = query(
      collection(db, 'contests'),
      where('status', '==', 'open'),
      orderBy('windowStart', 'desc'),
      limit(40),
    );
    const qScheduled = query(
      collection(db, 'contests'),
      where('status', '==', 'scheduled'),
      limit(40),
    );
    const qPaid = query(
      collection(db, 'contests'),
      where('status', '==', 'paid'),
      limit(40),
    );

    this.listUnsubs.push(
      onSnapshot(
        qOpen,
        (snap) => {
          this.openSnap = snap;
          this.loadedOpen = true;
          this.mergeList(ui, uid);
          this.updateLoadingFlag(ui);
        },
        (e: Error) => this.onListError(ui, e),
      ),
      onSnapshot(
        qScheduled,
        (snap) => {
          this.scheduledSnap = snap;
          this.loadedScheduled = true;
          this.mergeList(ui, uid);
          this.updateLoadingFlag(ui);
        },
        (e: Error) => this.onListError(ui, e),
      ),
      onSnapshot(
        qPaid,
        (snap) => {
          this.paidSnap = snap;
          this.loadedPaid = true;
          this.mergeList(ui, uid);
          this.updateLoadingFlag(ui);
        },
        (e: Error) => this.onListError(ui, e),
      ),
    );
  }

  /** List + paid / final listeners. Does not clear entry row listeners. */
  stopContestListOnly(ui: ContestsPanelFirestoreUiState): void {
    for (const u of this.listUnsubs) {
      u();
    }
    this.listUnsubs = [];
    this.detachAllPaidPayoutListeners(ui);
    this.detachAllFinalResultsListeners(ui);
  }

  /** All Firestore listeners including per-contest entry rows. */
  stopAll(ui: ContestsPanelFirestoreUiState): void {
    this.stopContestListOnly(ui);
    this.detachAllEntryRowListeners();
  }

  private onListError(ui: ContestsPanelFirestoreUiState, err: Error): void {
    ui.listError =
      typeof err?.message === 'string'
        ? err.message
        : 'Could not load contests.';
    ui.loading = false;
  }

  private updateLoadingFlag(ui: ContestsPanelFirestoreUiState): void {
    ui.loading = !(this.loadedOpen && this.loadedScheduled && this.loadedPaid);
  }

  private mergeList(
    ui: ContestsPanelFirestoreUiState,
    uid: string | null,
  ): void {
    const byId = contestRowsByIdFromSnapshots([
      this.openSnap,
      this.scheduledSnap,
      this.paidSnap,
    ]);

    const prevExpandedId = ui.expandedContestId;

    ui.rows = filterRowsForContestsPanel(byId, {
      gameMode: CONTEST_GAME_MODE_BIO_BALL,
      maxCompletedContests: MAX_COMPLETED_CONTESTS,
    });

    this.syncPaidListExtras(ui, uid);
    this.syncFinalResultsListeners(ui, uid);
    this.syncEntryRowListeners(ui, uid);

    if (prevExpandedId) {
      const updated = byId.get(prevExpandedId);
      if (!updated) {
        ui.expandedContestId = null;
        ui.rulesCheckbox = false;
        ui.joinError = null;
        ui.joinSuccess = null;
        if (ui.checkoutAwaitPaymentContestId === prevExpandedId) {
          ui.checkoutAwaitPaymentContestId = null;
        }
      }
    }
  }

  private detachAllEntryRowListeners(): void {
    for (const unsub of this.entryRowUnsubs.values()) {
      unsub();
    }
    this.entryRowUnsubs.clear();
  }

  private syncEntryRowListeners(
    ui: ContestsPanelFirestoreUiState,
    uid: string | null,
  ): void {
    if (!uid) {
      return;
    }
    const ids = new Set(ui.rows.map((r) => r.contestId));
    for (const [id, unsub] of [...this.entryRowUnsubs.entries()]) {
      if (!ids.has(id)) {
        unsub();
        this.entryRowUnsubs.delete(id);
        delete ui.entryInfoByContestId[id];
      }
    }

    const db = getConfiguredFirestore();
    for (const id of ids) {
      if (this.entryRowUnsubs.has(id)) {
        continue;
      }
      const ref = doc(db, 'contests', id, 'entries', uid);
      const unsub = onSnapshot(
        ref,
        (snap) => {
          if (!snap.exists()) {
            ui.entryInfoByContestId[id] = {
              loaded: true,
              entered: false,
              rulesAcceptedVersion: null,
              paymentStatus: null,
            };
            return;
          }
          const data = snap.data();
          const v = data['rulesAcceptedVersion'] as number | string | undefined;
          const ps = parseEntryPaymentStatus(data['paymentStatus']);
          ui.entryInfoByContestId[id] = {
            loaded: true,
            entered: true,
            rulesAcceptedVersion:
              v === undefined || v === null ? null : v,
            paymentStatus: ps,
          };
          if (ps === 'paid') {
            if (ui.checkoutAwaitPaymentContestId === id) {
              ui.checkoutAwaitPaymentContestId = null;
            }
            const row = ui.rows.find((r) => r.contestId === id);
            if (row?.gameMode === CONTEST_GAME_MODE_BIO_BALL) {
              this.weeklyContestSlate.refreshSlateAfterEntryChange();
            }
          }
        },
        () => {
          ui.entryInfoByContestId[id] = {
            loaded: true,
            entered: false,
            rulesAcceptedVersion: null,
            paymentStatus: null,
          };
        },
      );
      this.entryRowUnsubs.set(id, unsub);
    }
  }

  private detachAllPaidPayoutListeners(
    ui: ContestsPanelFirestoreUiState,
  ): void {
    for (const unsub of this.paidPayoutUnsubs.values()) {
      unsub();
    }
    this.paidPayoutUnsubs.clear();
    ui.paidPayoutByContestId = {};
  }

  private detachAllFinalResultsListeners(
    ui: ContestsPanelFirestoreUiState,
  ): void {
    for (const unsub of this.finalResultsUnsubs.values()) {
      unsub();
    }
    this.finalResultsUnsubs.clear();
    ui.finalResultsByContestId = {};
  }

  private syncFinalResultsListeners(
    ui: ContestsPanelFirestoreUiState,
    uid: string | null,
  ): void {
    if (!uid) {
      this.detachAllFinalResultsListeners(ui);
      return;
    }
    const paidIds = new Set(
      ui.rows.filter((r) => r.status === 'paid').map((r) => r.contestId),
    );
    for (const [id, unsub] of this.finalResultsUnsubs.entries()) {
      if (!paidIds.has(id)) {
        unsub();
        this.finalResultsUnsubs.delete(id);
        delete ui.finalResultsByContestId[id];
      }
    }

    const db = getConfiguredFirestore();
    const myUid = uid;
    for (const id of paidIds) {
      if (this.finalResultsUnsubs.has(id)) {
        continue;
      }
      ui.finalResultsByContestId[id] = initialLoadingResultsView();
      const ref = doc(db, 'contests', id, 'results', 'final');
      const unsub = onSnapshot(
        ref,
        (snap) => {
          const raw = snap.exists() ? snap.data() : null;
          ui.finalResultsByContestId[id] = parseFinalResultsForViewer(
            raw,
            myUid,
          );
        },
        () => {
          ui.finalResultsByContestId[id] = parseFinalResultsForViewer(
            null,
            myUid,
          );
        },
      );
      this.finalResultsUnsubs.set(id, unsub);
    }
  }

  private syncPaidListExtras(
    ui: ContestsPanelFirestoreUiState,
    uid: string | null,
  ): void {
    if (!uid) {
      this.detachAllPaidPayoutListeners(ui);
      return;
    }
    const paidIds = new Set(
      ui.rows.filter((r) => r.status === 'paid').map((r) => r.contestId),
    );
    for (const [id, unsub] of this.paidPayoutUnsubs.entries()) {
      if (!paidIds.has(id)) {
        unsub();
        this.paidPayoutUnsubs.delete(id);
        delete ui.paidPayoutByContestId[id];
      }
    }

    const db = getConfiguredFirestore();
    for (const id of paidIds) {
      if (this.paidPayoutUnsubs.has(id)) {
        continue;
      }
      ui.paidPayoutByContestId[id] = {
        loading: true,
        winnerText: null,
        otherLines: [],
        lineCount: 0,
        currencyLabel: '',
      };

      const payoutRef = doc(db, 'contests', id, 'payouts', 'dryRun');
      const unsub = onSnapshot(
        payoutRef,
        (snap) => {
          const st = ui.paidPayoutByContestId[id];
          if (!st) {
            return;
          }
          st.loading = false;
          if (!snap.exists()) {
            st.winnerText = null;
            st.otherLines = [];
            st.lineCount = 0;
            st.currencyLabel = '';
            return;
          }
          const parsed = parseDryRunPayoutDocument(snap.data());
          if (!parsed) {
            st.winnerText = null;
            st.otherLines = [];
            st.lineCount = 0;
            st.currencyLabel = '';
            return;
          }
          st.winnerText = getWinnerGetsPhrase(parsed);
          st.otherLines = getPlaceAmountLines(parsed);
          st.lineCount = parsed.lines.length;
          st.currencyLabel = formatDryRunCurrencyCaption(parsed);
        },
        () => {
          const st = ui.paidPayoutByContestId[id];
          if (st) {
            st.loading = false;
            st.winnerText = null;
            st.otherLines = [];
            st.lineCount = 0;
            st.currencyLabel = '';
          }
        },
      );
      this.paidPayoutUnsubs.set(id, unsub);
    }
  }
}
