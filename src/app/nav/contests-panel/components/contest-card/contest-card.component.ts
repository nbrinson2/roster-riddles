import {
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import {
  buildContestScheduleLine,
  type ContestCopyOptions,
  formatContestEntryFeeSegment,
  formatContestWindowBoundaryLabel,
  formatPayoutUsdLabel,
} from 'src/app/shared/contest/contest-value-prop';
import {
  CONTEST_FULL_RULES_HREF,
  getContestEligibilityBullets,
  getContestRulesNarrative,
  getContestRulesShortBullets,
} from '../../shared/contest-rules-copy';
import {
  isPlayWindowLockSoon,
  pipelineCaption,
  pipelineCurrentIndex,
  pipelineLabels,
  primaryCountdownLine,
} from '../../shared/contest-status-ui';
import {
  type PaidDelightView,
  openEnteredEngagementLine,
  paidResultDelight,
  scheduledWarmupLine,
} from '../../shared/contest-engagement-copy';
import {
  type ParsedFinalResultsView,
  formatOrdinalRank,
  formatYourPlaceCardLine,
} from '../../shared/contest-results-closure';
import {
  contestRowRequiresPayment,
  entryRowCountsAsConfirmedEntrant,
  formatContestEntryFeeUsd,
} from '../../lib/contests-panel-entry.util';
import {
  canAttemptJoinContest,
  joinDisabledReasonForContest,
} from '../../lib/contests-panel-join-window.util';
import {
  formatEnteredRulesAckLine,
  POST_JOIN_SLATE_GAMES_LINE,
  POST_JOIN_WHERE_PROGRESS_LINE,
} from '../../lib/contests-panel-join-messages';
import {
  contestClosureWhyBlockVisible,
  contestClosureWhyHeading,
  contestClosureWhyLines,
  contestSlateSummaryLine,
  contestStatusChipLabel,
  engagementCardIconName,
  formatContestWindowLocal,
  formatNonPaidContestCardMeta,
  formatPaidContestCardMeta,
  payoutDryRunTransparencyLine,
} from '../../lib/contests-panel-presenters';
import type {
  ContestEntryRowState,
  ContestJoinSuccessView,
  ContestListRow,
  ContestPayoutView,
} from '../../lib/contests-panel.types';
import type { ContestStatus } from 'src/app/shared/models/contest.model';

@Component({
  selector: 'app-contest-card',
  templateUrl: './contest-card.component.html',
  styleUrls: ['../../contests-panel-ui.scss'],
  standalone: false,
})
export class ContestCardComponent {
  protected readonly postJoinSlateGamesLine = POST_JOIN_SLATE_GAMES_LINE;
  protected readonly postJoinWhereProgressLine = POST_JOIN_WHERE_PROGRESS_LINE;

  @Input({ required: true }) row!: ContestListRow;
  @Input({ required: true }) expanded = false;
  @Input({ required: true }) nowMs!: number;
  @Input() payout: ContestPayoutView | undefined;
  @Input() finalResults: ParsedFinalResultsView | undefined;
  @Input() entryInfo: ContestEntryRowState | undefined;
  @Input({ required: true }) contestsPaymentsEnabled!: boolean;
  /** Dry-run / “simulated” copy vs live-oriented wording (`environment.simulatedContestsUiEnabled`). */
  @Input({ required: true }) simulatedContestsUiEnabled!: boolean;
  @Input() checkoutAwaitContestId: string | null = null;
  @Input() joinError: string | null = null;
  @Input() joinSuccess: ContestJoinSuccessView | null = null;
  @Input() rulesCheckbox = false;
  @Input() joinSubmitting = false;
  @Input() loggedIn = false;
  /** When false, join / paid checkout controls are hidden (server requires verified email). */
  @Input() emailVerified = false;
  /** Rules version banner when entered (from parent; scoped to expanded contest). */
  @Input() entryRulesVersion: number | string | null = null;
  @Input() fullRulesHref = CONTEST_FULL_RULES_HREF;

  @Output() readonly toggleExpand = new EventEmitter<void>();
  @Output() readonly rulesCheckboxChange = new EventEmitter<boolean>();
  @Output() readonly joinSubmit = new EventEmitter<void>();
  @Output() readonly paidCheckoutSubmit = new EventEmitter<void>();

  protected readonly pipelineStepLabels = pipelineLabels;

  protected formatWindowLocal(start: Date, end: Date): string {
    return formatContestWindowLocal(start, end);
  }

  protected statusLabel(status: ContestStatus): string {
    return contestStatusChipLabel(status);
  }

  protected ruleParagraphs(version: number | string): string[] {
    return getContestRulesNarrative(version)
      .split('\n\n')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  protected rulesShortBullets(version: number | string): string[] {
    return getContestRulesShortBullets(version);
  }

  protected eligibilityBullets(row: ContestListRow): string[] {
    return getContestEligibilityBullets(row.leagueGamesN, row.maxEntries);
  }

  protected contestScheduleLine(row: ContestListRow): string {
    return buildContestScheduleLine(
      {
        windowEnd: row.windowEnd,
        prizePoolCents: row.prizePoolCents,
        entryFeeCents: row.entryFeeCents,
        maxEntries: row.maxEntries,
      },
      this.nowMs,
      this.cardContestCopyOpts(),
    );
  }

  private cardContestCopyOpts(): ContestCopyOptions {
    return { simulatedLabels: this.simulatedContestsUiEnabled };
  }

  protected formatNonPaidCardMeta(row: ContestListRow): string {
    return formatNonPaidContestCardMeta(row);
  }

  protected formatPaidCardMeta(
    row: ContestListRow,
    po: ContestPayoutView,
  ): string {
    return formatPaidContestCardMeta(row, po);
  }

  protected onToggleExpand(): void {
    this.toggleExpand.emit();
  }

  protected canAttemptJoin(row: ContestListRow): boolean {
    return canAttemptJoinContest(row, Date.now());
  }

  protected joinDisabledReason(row: ContestListRow): string | null {
    return joinDisabledReasonForContest(row, Date.now());
  }

  /** Rules checkbox + join / checkout (not already entered, window allows join). */
  protected canOfferJoin(row: ContestListRow): boolean {
    return (
      this.loggedIn &&
      this.emailVerified &&
      this.canAttemptJoin(row) &&
      this.entryRulesVersion == null
    );
  }

  /** In-card reminder when signed in but email not verified. */
  protected showVerifyEmailJoinHint(row: ContestListRow): boolean {
    return (
      this.loggedIn &&
      !this.emailVerified &&
      this.expanded &&
      this.canAttemptJoin(row) &&
      this.entryRulesVersion == null
    );
  }

  protected contestRequiresPayment(row: ContestListRow): boolean {
    return contestRowRequiresPayment(row, this.contestsPaymentsEnabled);
  }

  protected entryCountsAsConfirmedEntrant(row: ContestListRow): boolean {
    return entryRowCountsAsConfirmedEntrant(
      row,
      this.entryInfo,
      this.contestsPaymentsEnabled,
    );
  }

  protected formatEntryFeeUsd(row: ContestListRow): string | null {
    return formatContestEntryFeeUsd(row);
  }

  protected confirmingPayment(row: ContestListRow): boolean {
    return (
      this.checkoutAwaitContestId === row.contestId &&
      !this.entryCountsAsConfirmedEntrant(row)
    );
  }

  /** Entered, paid or free — rules ack + slate + where to track (not while checkout still confirming). */
  protected showPostJoinBlock(row: ContestListRow): boolean {
    return (
      this.entryRulesVersion != null &&
      this.entryCountsAsConfirmedEntrant(row) &&
      !this.confirmingPayment(row)
    );
  }

  protected postJoinHeadline(): string {
    if (this.joinSuccess?.headline === 'already') {
      return 'You’re already in';
    }
    return 'You’re in';
  }

  protected postJoinRulesLine(row: ContestListRow): string {
    if (this.joinSuccess) {
      return this.joinSuccess.rulesLine;
    }
    if (this.entryRulesVersion != null) {
      return formatEnteredRulesAckLine(
        this.entryRulesVersion,
        row.rulesVersion,
      );
    }
    return '';
  }

  protected postJoinIcon(): string {
    return this.joinSuccess ? 'celebration' : 'check_circle';
  }

  protected onJoinClick(): void {
    if (this.contestRequiresPayment(this.row)) {
      this.paidCheckoutSubmit.emit();
    } else {
      this.joinSubmit.emit();
    }
  }

  protected onRulesCheckboxChange(checked: boolean): void {
    this.rulesCheckboxChange.emit(checked);
  }

  protected pipelineStepActiveIndex(status: ContestStatus): number {
    return pipelineCurrentIndex(status);
  }

  protected pipelineHelpText(row: ContestListRow): string {
    return pipelineCaption(
      row.status,
      row.windowStart.getTime(),
      row.windowEnd.getTime(),
      this.nowMs,
      this.simulatedContestsUiEnabled,
    );
  }

  protected countdownLine(row: ContestListRow): string | null {
    return primaryCountdownLine(
      row.status,
      row.windowStart.getTime(),
      row.windowEnd.getTime(),
      this.nowMs,
    );
  }

  protected lockSoon(row: ContestListRow): boolean {
    return isPlayWindowLockSoon(
      row.status,
      row.windowStart.getTime(),
      row.windowEnd.getTime(),
      this.nowMs,
    );
  }

  protected showYoureIn(row: ContestListRow): boolean {
    return this.entryCountsAsConfirmedEntrant(row);
  }

  protected statusChipAriaLabel(row: ContestListRow): string {
    return `Contest status: ${this.statusLabel(row.status)}`;
  }

  protected formatOrdinalRank = formatOrdinalRank;

  protected yourPlaceCardLine(row: ContestListRow): string | null {
    if (row.status !== 'paid') {
      return null;
    }
    const v = this.finalResults;
    if (!v) {
      return null;
    }
    return formatYourPlaceCardLine(v, this.entryCountsAsConfirmedEntrant(row));
  }

  protected slateSummaryLine(row: ContestListRow): string {
    return contestSlateSummaryLine(row);
  }

  protected payoutTransparencyLine(px: ContestPayoutView): string | null {
    return payoutDryRunTransparencyLine(px, this.simulatedContestsUiEnabled);
  }

  protected payoutSectionHeading(): string {
    return this.simulatedContestsUiEnabled ? 'Estimated payouts' : 'Payouts';
  }

  protected closureWhyHeading(): string {
    return contestClosureWhyHeading(this.finalResults);
  }

  protected closureWhyLines(): string[] {
    return contestClosureWhyLines(
      this.finalResults,
      this.simulatedContestsUiEnabled,
    );
  }

  protected closureWhyBlockVisible(row: ContestListRow): boolean {
    return contestClosureWhyBlockVisible({
      status: row.status,
      entered: this.entryCountsAsConfirmedEntrant(row),
      v: this.finalResults,
    });
  }

  protected enteredContest(row: ContestListRow): boolean {
    return this.entryCountsAsConfirmedEntrant(row);
  }

  protected engagementCardLine(row: ContestListRow): string | null {
    const entered = this.entryCountsAsConfirmedEntrant(row);
    const openLine = openEnteredEngagementLine(
      row.status,
      entered,
      row.windowEnd.getTime(),
      this.nowMs,
    );
    if (openLine) {
      return openLine;
    }
    const sched = scheduledWarmupLine(
      row.status,
      row.windowStart.getTime(),
      this.nowMs,
    );
    if (sched) {
      return sched;
    }
    return null;
  }

  /**
   * When the lock-soon strip is shown, skip engagement — both nudge “finish slate” and read as duplicate.
   */
  protected standaloneEngagementLine(row: ContestListRow): string | null {
    if (this.lockSoon(row)) {
      return null;
    }
    return this.engagementCardLine(row);
  }

  protected paidDelight(row: ContestListRow): PaidDelightView | null {
    if (row.status !== 'paid') {
      return null;
    }
    return paidResultDelight(this.finalResults, this.enteredContest(row), {
      simulatedDelight: this.simulatedContestsUiEnabled,
    });
  }

  protected engagementCardIcon(row: ContestListRow): string {
    return engagementCardIconName(row.status);
  }

  protected joinButtonLabel(): string {
    if (this.joinSubmitting) {
      return this.contestRequiresPayment(this.row)
        ? 'Redirecting…'
        : 'Joining…';
    }
    return this.contestRequiresPayment(this.row) ? 'Pay & enter' : 'Join contest';
  }

  /** Pre-join summary card (fee, lock, slate, prize, rules) — same cues as schedule/prize lines elsewhere. */
  protected preJoinEntryFeeLine(row: ContestListRow): string {
    return formatContestEntryFeeSegment(
      row.entryFeeCents,
      this.cardContestCopyOpts(),
    );
  }

  protected preJoinLockLine(row: ContestListRow): string {
    return formatContestWindowBoundaryLabel(row.windowEnd, this.nowMs);
  }

  protected preJoinSlateLine(row: ContestListRow): string {
    return `${row.leagueGamesN} games in mini-league slate`;
  }

  protected preJoinPrizeLine(row: ContestListRow): string {
    if (
      row.prizePoolCents != null &&
      Number.isFinite(row.prizePoolCents) &&
      row.prizePoolCents >= 0
    ) {
      return formatPayoutUsdLabel(row.prizePoolCents);
    }
    return this.simulatedContestsUiEnabled
      ? 'No prize pool listed · simulated'
      : 'No prize pool listed';
  }
}
