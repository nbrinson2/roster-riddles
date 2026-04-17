/**
 * Weekly contests — allowed status transitions (Story D1).
 * @see docs/weekly-contests-phase4-adr.md
 * @see docs/weekly-contests-ops-d1.md
 */

/** @typedef {'scheduled'|'open'|'scoring'|'paid'|'cancelled'} ContestStatus */

/** @type {ReadonlySet<ContestStatus>} */
const TERMINAL = new Set(['paid', 'cancelled']);

/**
 * Adjacency: `from` → allowed `to` values.
 * @type {Readonly<Record<ContestStatus, ReadonlySet<ContestStatus>>>}
 */
const ALLOWED = Object.freeze({
  scheduled: new Set(['open', 'cancelled']),
  open: new Set(['scoring', 'cancelled']),
  scoring: new Set(['paid', 'cancelled']),
  paid: new Set(),
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
