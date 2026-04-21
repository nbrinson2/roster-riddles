/**
 * Weekly contests — allowed status transitions (Story D1).
 * @see docs/weekly-contests-phase4-adr.md
 * @see docs/weekly-contests-ops-d1.md
 */

/** @typedef {'scheduled'|'open'|'scoring'|'paid'|'cancelled'} ContestStatus */

/**
 * Hard terminal: no outgoing transitions. (`paid` is only terminal for normal flows;
 * Story F2 allows `paid` → `cancelled`|`scoring` with `force: true`.)
 * @type {ReadonlySet<ContestStatus>}
 */
const TERMINAL = new Set(['cancelled']);

/**
 * Adjacency: `from` → allowed `to` values.
 * @type {Readonly<Record<ContestStatus, ReadonlySet<ContestStatus>>>}
 */
const ALLOWED = Object.freeze({
  scheduled: new Set(['open', 'cancelled']),
  open: new Set(['scoring', 'cancelled']),
  scoring: new Set(['paid', 'cancelled']),
  /** Story F2 — dry-run override (requires `force: true` in guards). */
  paid: new Set(['cancelled', 'scoring']),
  cancelled: new Set(),
});

/**
 * @param {unknown} s
 * @returns {s is ContestStatus}
 */
export function isContestStatus(s) {
  return (
    s === 'scheduled' ||
    s === 'open' ||
    s === 'scoring' ||
    s === 'paid' ||
    s === 'cancelled'
  );
}

/**
 * @param {ContestStatus} from
 * @param {ContestStatus} to
 * @returns {boolean}
 */
export function isAllowedTransition(from, to) {
  if (!ALLOWED[from] || !ALLOWED[from].has(to)) {
    return false;
  }
  return true;
}

/**
 * @param {import('firebase-admin/firestore').Timestamp | unknown} windowEnd
 * @param {number} nowMs
 * @returns {boolean}
 */
function windowClosed(windowEnd, nowMs) {
  if (
    windowEnd &&
    typeof windowEnd === 'object' &&
    'toMillis' in windowEnd &&
    typeof /** @type {{ toMillis: () => number }} */ (windowEnd).toMillis ===
      'function'
  ) {
    return nowMs >= /** @type {{ toMillis: () => number }} */ (windowEnd).toMillis();
  }
  return false;
}

/**
 * Extra guards beyond the adjacency matrix.
 *
 * @param {object} opts
 * @param {ContestStatus} opts.from
 * @param {ContestStatus} opts.to
 * @param {Record<string, unknown>} opts.contestData
 * @param {number} opts.nowMs
 * @param {boolean} [opts.force]
 * @returns {{ ok: true } | { ok: false; code: string; message: string }}
 */
export function evaluateTransitionGuards(opts) {
  const { from, to, contestData, nowMs, force } = opts;

  if (!isContestStatus(from) || !isContestStatus(to)) {
    return {
      ok: false,
      code: 'invalid_status',
      message: 'Contest has an invalid status value.',
    };
  }

  if (TERMINAL.has(from)) {
    return {
      ok: false,
      code: 'contest_terminal',
      message: `Cannot transition from terminal status "${from}".`,
    };
  }

  if (!isAllowedTransition(from, to)) {
    return {
      ok: false,
      code: 'invalid_status_transition',
      message: `Transition from "${from}" to "${to}" is not allowed.`,
    };
  }

  /** Story F2 — void or re-score after dry-run `paid`; internal operator only (`force`). */
  if (from === 'paid') {
    if (!force) {
      return {
        ok: false,
        code: 'override_requires_force',
        message:
          'Transitions from paid (dry-run final) require force:true — see Story F2 / weekly-contests-ops-f2.md.',
      };
    }
    return { ok: true };
  }

  if (from === 'open' && to === 'scoring') {
    const we = contestData.windowEnd;
    if (!force && !windowClosed(we, nowMs)) {
      return {
        ok: false,
        code: 'transition_window_not_closed',
        message:
          'Cannot move to scoring until windowEnd has passed (or use force for trusted operators).',
      };
    }
  }

  return { ok: true };
}
