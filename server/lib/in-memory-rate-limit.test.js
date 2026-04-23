import assert from 'node:assert/strict';
import test from 'node:test';
import { createFixedWindowLimiter } from './in-memory-rate-limit.js';

test('fixed window allows up to maxRequests then blocks', () => {
  const lim = createFixedWindowLimiter({ maxRequests: 3, windowMs: 10_000 });
  assert.equal(lim('a').allowed, true);
  assert.equal(lim('a').allowed, true);
  assert.equal(lim('a').allowed, true);
  const d = lim('a');
  assert.equal(d.allowed, false);
  assert.ok(d.retryAfterSec != null && d.retryAfterSec >= 1);
});

test('separate keys have separate buckets', () => {
  const lim = createFixedWindowLimiter({ maxRequests: 1, windowMs: 60_000 });
  assert.equal(lim('u1').allowed, true);
  assert.equal(lim('u1').allowed, false);
  assert.equal(lim('u2').allowed, true);
});
