/**
 * Phase 6 Story P6-E1 — optional Stripe platform balance check before prize transfers.
 * @see docs/weekly-contests/weekly-contests-phase6-payouts-jira.md (P6-E1)
 */
import {
  entryEligibleForAutomatedPrizePayout,
  userConnectReadyForPayoutTransfer,
} from './contest-payout-execute.helpers.js';

/**
 * When `CONTEST_PAYOUT_BALANCE_GUARD_ENABLED` is exactly `true` (trimmed), payout execute
 * loads Stripe Balance and blocks if USD available is below planned transfer total.
 * @returns {boolean}
 */
export function isContestPayoutBalanceGuardEnabled() {
  return process.env.CONTEST_PAYOUT_BALANCE_GUARD_ENABLED?.trim() === 'true';
}

/**
 * Sum of cents we intend to move via `transfers.create` (money lines that pass entry + Connect gates).
 *
 * @param {{ rank: number; uid: string; amountCents: number }[]} baseLines
 * @param {import('firebase-admin/firestore').DocumentSnapshot[]} entrySnaps
 * @param {import('firebase-admin/firestore').DocumentSnapshot[]} userSnaps
 * @returns {number}
 */
export function computePlannedPrizeTransferTotalCents(baseLines, entrySnaps, userSnaps) {
  let total = 0;
  for (let i = 0; i < baseLines.length; i++) {
    const line = baseLines[i];
    if (line.amountCents <= 0) {
      continue;
    }
    if (!entryEligibleForAutomatedPrizePayout(entrySnaps[i])) {
      continue;
    }
    if (!userConnectReadyForPayoutTransfer(userSnaps[i])) {
      continue;
    }
    total += line.amountCents;
  }
  return total;
}

/**
 * Stripe `balance.available` lists per-currency buckets; v1 prizes are USD only.
 *
 * @param {import('stripe').Stripe.Balance} balance
 * @returns {number} — USD cents immediately available (0 if no USD row).
 */
export function extractUsdAvailableCentsFromBalance(balance) {
  const available = balance.available;
  if (!Array.isArray(available)) {
    return 0;
  }
  let sum = 0;
  for (const row of available) {
    if (
      row &&
      typeof row === 'object' &&
      row.currency === 'usd' &&
      typeof row.amount === 'number' &&
      Number.isFinite(row.amount)
    ) {
      sum += row.amount;
    }
  }
  return sum;
}
