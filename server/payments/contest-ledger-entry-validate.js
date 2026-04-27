/**
 * Phase 6 Story P6-C3 — validate `ledgerEntries` payloads before Admin SDK writes.
 * @see docs/weekly-contests/weekly-contests-phase5-ledger-schema.md (Phase 6 prize line types)
 */

/** @type {readonly string[]} */
export const CONTEST_LEDGER_LINE_TYPES = Object.freeze([
  'contest_entry_charge',
  'contest_entry_refund',
  'contest_entry_adjustment',
  'other',
  'prize_transfer_out',
  'prize_transfer_reversal',
  'platform_fee_retained',
]);

/**
 * Allowed `direction` per `lineType` (platform-centric ledger — Phase 5 + P6-C3).
 * @type {Readonly<Record<string, readonly ('credit' | 'debit')[]>>}
 */
export const CONTEST_LEDGER_DIRECTIONS_BY_LINE_TYPE = Object.freeze({
  contest_entry_charge: Object.freeze(['credit']),
  contest_entry_refund: Object.freeze(['debit']),
  contest_entry_adjustment: Object.freeze(['credit', 'debit']),
  other: Object.freeze(['credit', 'debit']),
  prize_transfer_out: Object.freeze(['debit']),
  prize_transfer_reversal: Object.freeze(['credit']),
  platform_fee_retained: Object.freeze(['credit']),
});

/**
 * @param {unknown} lineType
 * @returns {lineType is string}
 */
export function isKnownContestLedgerLineType(lineType) {
  return (
    typeof lineType === 'string' &&
    CONTEST_LEDGER_LINE_TYPES.includes(lineType)
  );
}

/**
 * @param {Record<string, unknown>} payload — fields about to be written to `ledgerEntries/{id}`
 * @returns {{ ok: true } | { ok: false; code: string; message: string }}
 */
export function validateContestLedgerEntryPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return {
      ok: false,
      code: 'ledger_invalid_shape',
      message: 'Ledger payload must be a non-null object.',
    };
  }
  const lineType = payload.lineType;
  if (!isKnownContestLedgerLineType(lineType)) {
    return {
      ok: false,
      code: 'ledger_unknown_line_type',
      message: `Unknown lineType: ${String(lineType)}`,
    };
  }
  const direction = payload.direction;
  if (direction !== 'credit' && direction !== 'debit') {
    return {
      ok: false,
      code: 'ledger_invalid_direction',
      message: `direction must be credit or debit, got: ${String(direction)}`,
    };
  }
  const allowed =
    CONTEST_LEDGER_DIRECTIONS_BY_LINE_TYPE[/** @type {string} */ (lineType)];
  if (!allowed.includes(direction)) {
    return {
      ok: false,
      code: 'ledger_line_type_direction_mismatch',
      message: `lineType ${lineType} may not use direction ${direction}; allowed: ${allowed.join(', ')}`,
    };
  }
  const amountCents = payload.amountCents;
  if (
    typeof amountCents !== 'number' ||
    !Number.isFinite(amountCents) ||
    amountCents < 0 ||
    Math.floor(amountCents) !== amountCents
  ) {
    return {
      ok: false,
      code: 'ledger_invalid_amount_cents',
      message: 'amountCents must be a non-negative finite integer.',
    };
  }
  const currency = payload.currency;
  if (typeof currency !== 'string' || currency.trim() === '') {
    return {
      ok: false,
      code: 'ledger_invalid_currency',
      message: 'currency must be a non-empty string.',
    };
  }
  const source = payload.source;
  if (source !== 'webhook' && source !== 'admin_adjustment' && source !== 'system') {
    return {
      ok: false,
      code: 'ledger_invalid_source',
      message: `source must be webhook, admin_adjustment, or system; got: ${String(source)}`,
    };
  }
  const uid = payload.uid;
  const contestId = payload.contestId;
  if (typeof uid !== 'string' || uid.trim() === '') {
    return {
      ok: false,
      code: 'ledger_invalid_uid',
      message: 'uid must be a non-empty string.',
    };
  }
  if (typeof contestId !== 'string' || contestId.trim() === '') {
    return {
      ok: false,
      code: 'ledger_invalid_contest_id',
      message: 'contestId must be a non-empty string.',
    };
  }
  const sv = payload.schemaVersion;
  if (typeof sv !== 'number' || !Number.isFinite(sv) || sv < 1) {
    return {
      ok: false,
      code: 'ledger_invalid_schema_version',
      message: 'schemaVersion must be a finite number >= 1.',
    };
  }
  return { ok: true };
}

/**
 * @param {Record<string, unknown>} payload
 * @throws {Error} when validation fails
 */
export function assertValidContestLedgerEntryPayload(payload) {
  const r = validateContestLedgerEntryPayload(payload);
  if (!r.ok) {
    throw new Error(`${r.code}: ${r.message}`);
  }
}
