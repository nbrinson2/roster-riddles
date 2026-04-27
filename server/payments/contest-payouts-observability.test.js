import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CONTEST_PAYOUTS_LOG_DOMAIN,
  emitContestPayoutMetricCounterIfEnabled,
  logPayoutJobLine,
  logStripeWebhookPayoutLine,
} from './contest-payouts-observability.js';

const savedEnv = process.env.CONTESTS_PAYOUT_METRIC_COUNTERS;
const origLog = console.log;
const origErr = console.error;

test('contest-payouts-observability', async (t) => {
  t.afterEach(() => {
    console.log = origLog;
    console.error = origErr;
    if (savedEnv === undefined) {
      delete process.env.CONTESTS_PAYOUT_METRIC_COUNTERS;
    } else {
      process.env.CONTESTS_PAYOUT_METRIC_COUNTERS = savedEnv;
    }
  });

  await t.test('logPayoutJobLine JSON shape', () => {
    const lines = [];
    console.log = (m) => lines.push(String(m));
    console.error = () => assert.fail('unexpected console.error');
    logPayoutJobLine({
      requestId: 'req-1',
      contestId: 'c1',
      outcome: 'payout_execute_committed',
      httpStatus: 200,
      latencyMs: 12,
    });
    assert.equal(lines.length, 1);
    const o = JSON.parse(lines[0]);
    assert.equal(o.domain, CONTEST_PAYOUTS_LOG_DOMAIN);
    assert.equal(o.component, 'payout_job');
    assert.equal(o.outcome, 'payout_execute_committed');
    assert.equal(o.requestId, 'req-1');
  });

  await t.test('emitContestPayoutMetricCounterIfEnabled no-op when unset', () => {
    delete process.env.CONTESTS_PAYOUT_METRIC_COUNTERS;
    let called = false;
    console.error = () => {
      called = true;
    };
    emitContestPayoutMetricCounterIfEnabled('contest_payout_job_failure_total', {
      outcome: 'x',
    });
    assert.equal(called, false);
  });

  await t.test('job failure emits metric line when CONTESTS_PAYOUT_METRIC_COUNTERS=1', () => {
    process.env.CONTESTS_PAYOUT_METRIC_COUNTERS = '1';
    const errLines = [];
    console.log = () => assert.fail('unexpected console.log');
    console.error = (m) => errLines.push(String(m));
    logPayoutJobLine({
      requestId: 'r2',
      contestId: 'c2',
      outcome: 'firestore_read_failed',
      httpStatus: 500,
    });
    assert.equal(errLines.length, 2);
    const job = JSON.parse(errLines[0]);
    const metric = JSON.parse(errLines[1]);
    assert.equal(job.component, 'payout_job');
    assert.equal(metric.component, 'contest_payout_metrics');
    assert.equal(metric.metricName, 'contest_payout_job_failure_total');
    assert.equal(metric.outcome, 'firestore_read_failed');
  });

  await t.test('logStripeWebhookPayoutLine failure emits webhook metric', () => {
    process.env.CONTESTS_PAYOUT_METRIC_COUNTERS = '1';
    const errLines = [];
    console.log = () => assert.fail('unexpected console.log');
    console.error = (m) => errLines.push(String(m));
    logStripeWebhookPayoutLine({
      severity: 'ERROR',
      requestId: 'r3',
      eventId: 'evt_1',
      eventType: 'transfer.created',
      outcome: 'prize_transfer_transaction_failed',
      message: 'tx',
    });
    assert.equal(errLines.length, 2);
    const metric = JSON.parse(errLines[1]);
    assert.equal(metric.metricName, 'contest_payout_webhook_failure_total');
    assert.equal(metric.outcome, 'prize_transfer_transaction_failed');
  });
});
