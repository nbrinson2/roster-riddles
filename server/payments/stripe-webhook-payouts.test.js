import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  extractPrizeTransferWebhookContext,
  findPayoutFinalLineIndexForTransfer,
  mapPayoutStripeFailureToPublicCode,
  mapTransferStripeFailureToPublicCode,
} from './stripe-webhook-payouts.js';

describe('mapTransferStripeFailureToPublicCode (P6-E2)', () => {
  it('maps insufficient patterns', () => {
    assert.equal(
      mapTransferStripeFailureToPublicCode('balance_insufficient', ''),
      'prize_payout_transfer_insufficient_funds',
    );
    assert.equal(
      mapTransferStripeFailureToPublicCode(null, 'Insufficient funds'),
      'prize_payout_transfer_insufficient_funds',
    );
  });

  it('falls back to generic', () => {
    assert.equal(mapTransferStripeFailureToPublicCode('weird', 'x'), 'prize_payout_transfer_generic');
  });
});

describe('mapPayoutStripeFailureToPublicCode (P6-E2)', () => {
  it('maps known Stripe payout failure_code families', () => {
    assert.equal(mapPayoutStripeFailureToPublicCode('account_closed'), 'bank_payout_failed_account_closed');
    assert.equal(mapPayoutStripeFailureToPublicCode('insufficient_funds'), 'bank_payout_failed_insufficient_funds');
    assert.equal(mapPayoutStripeFailureToPublicCode('debit_not_authorized'), 'bank_payout_debit_not_authorized');
  });
});

describe('extractPrizeTransferWebhookContext (P6-E2)', () => {
  it('returns null without contest metadata', () => {
    assert.equal(
      extractPrizeTransferWebhookContext(
        /** @type {import('stripe').Stripe.Event} */ ({
          id: 'evt_x',
          type: 'transfer.created',
          data: {
            object: {
              id: 'tr_1',
              metadata: {},
            },
          },
        }),
      ),
      null,
    );
  });

  it('parses contest_id firebase_uid rank', () => {
    const ctx = extractPrizeTransferWebhookContext(
      /** @type {import('stripe').Stripe.Event} */ ({
        id: 'evt_x',
        type: 'transfer.paid',
        data: {
          object: {
            id: 'tr_abc',
            metadata: {
              contest_id: 'bb-1',
              firebase_uid: 'user1',
              rank: '1',
            },
          },
        },
      }),
    );
    assert.ok(ctx);
    assert.equal(ctx?.contestId, 'bb-1');
    assert.equal(ctx?.uid, 'user1');
    assert.equal(ctx?.rank, 1);
  });
});

describe('findPayoutFinalLineIndexForTransfer (P6-E2)', () => {
  it('prefers stripeTransferId match', () => {
    const lines = [
      { rank: 1, uid: 'a', stripeTransferId: 'tr_x' },
      { rank: 2, uid: 'b', stripeTransferId: 'tr_y' },
    ];
    const transfer = /** @type {import('stripe').Stripe.Transfer} */ ({
      id: 'tr_y',
      metadata: {},
    });
    assert.equal(findPayoutFinalLineIndexForTransfer(lines, transfer, 'b', 99), 1);
  });
});
