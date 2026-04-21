import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Timestamp } from 'firebase-admin/firestore';
import {
  evaluateTransitionGuards,
  isAllowedTransition,
  isContestStatus,
} from './contest-transitions.js';

describe('contest-transitions matrix', () => {
  it('allows scheduled → open and scheduled → cancelled', () => {
    assert.equal(isAllowedTransition('scheduled', 'open'), true);
    assert.equal(isAllowedTransition('scheduled', 'cancelled'), true);
    assert.equal(isAllowedTransition('scheduled', 'scoring'), false);
  });

  it('allows open → scoring and open → cancelled', () => {
    assert.equal(isAllowedTransition('open', 'scoring'), true);
    assert.equal(isAllowedTransition('open', 'cancelled'), true);
    assert.equal(isAllowedTransition('open', 'paid'), false);
  });

  it('allows scoring → paid and scoring → cancelled', () => {
    assert.equal(isAllowedTransition('scoring', 'paid'), true);
    assert.equal(isAllowedTransition('scoring', 'cancelled'), true);
    assert.equal(isAllowedTransition('scoring', 'open'), false);
  });

  it('denies transitions from cancelled; paid override edges exist (Story F2)', () => {
    assert.equal(isAllowedTransition('cancelled', 'open'), false);
    assert.equal(isAllowedTransition('paid', 'cancelled'), true);
    assert.equal(isAllowedTransition('paid', 'scoring'), true);
    assert.equal(isAllowedTransition('paid', 'open'), false);
  });

  it('isContestStatus narrows known literals', () => {
    assert.equal(isContestStatus('open'), true);
    assert.equal(isContestStatus('bogus'), false);
  });
});

describe('open → scoring time guard', () => {
  const past = Timestamp.fromMillis(Date.now() - 60_000);
  const future = Timestamp.fromMillis(Date.now() + 3600_000);

  it('rejects when windowEnd is in the future without force', () => {
    const r = evaluateTransitionGuards({
      from: 'open',
      to: 'scoring',
      contestData: { windowEnd: future },
      nowMs: Date.now(),
      force: false,
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.code, 'transition_window_not_closed');
  });

  it('allows when windowEnd has passed', () => {
    const r = evaluateTransitionGuards({
      from: 'open',
      to: 'scoring',
      contestData: { windowEnd: past },
      nowMs: Date.now(),
      force: false,
    });
    assert.equal(r.ok, true);
  });

  it('allows before windowEnd when force is true', () => {
    const r = evaluateTransitionGuards({
      from: 'open',
      to: 'scoring',
      contestData: { windowEnd: future },
      nowMs: Date.now(),
      force: true,
    });
    assert.equal(r.ok, true);
  });
});

describe('paid dry-run override (Story F2)', () => {
  it('requires force for paid → cancelled', () => {
    const r = evaluateTransitionGuards({
      from: 'paid',
      to: 'cancelled',
      contestData: {},
      nowMs: Date.now(),
      force: false,
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.code, 'override_requires_force');
  });

  it('allows paid → cancelled with force', () => {
    const r = evaluateTransitionGuards({
      from: 'paid',
      to: 'cancelled',
      contestData: {},
      nowMs: Date.now(),
      force: true,
    });
    assert.equal(r.ok, true);
  });

  it('allows paid → scoring with force', () => {
    const r = evaluateTransitionGuards({
      from: 'paid',
      to: 'scoring',
      contestData: {},
      nowMs: Date.now(),
      force: true,
    });
    assert.equal(r.ok, true);
  });

  it('still rejects cancelled → anything', () => {
    const r = evaluateTransitionGuards({
      from: 'cancelled',
      to: 'scoring',
      contestData: {},
      nowMs: Date.now(),
      force: true,
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.code, 'contest_terminal');
  });
});
