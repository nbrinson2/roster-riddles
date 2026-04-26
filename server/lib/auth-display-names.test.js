import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  contestStandingDisplayLabel,
  emailLocalPartFromEmail,
} from './auth-display-names.js';

describe('emailLocalPartFromEmail', () => {
  it('returns substring before @', () => {
    assert.equal(emailLocalPartFromEmail('  nick@example.com '), 'nick');
  });

  it('returns null for empty or missing', () => {
    assert.equal(emailLocalPartFromEmail(null), null);
    assert.equal(emailLocalPartFromEmail(''), null);
    assert.equal(emailLocalPartFromEmail('   '), null);
  });

  it('returns full trim when no @', () => {
    assert.equal(emailLocalPartFromEmail('nolabel'), 'nolabel');
  });
});

describe('contestStandingDisplayLabel', () => {
  it('prefers non-empty snapshot', () => {
    assert.equal(
      contestStandingDisplayLabel('Aaron', 'other@x.com'),
      'Aaron',
    );
  });

  it('uses email local part when snapshot null or blank', () => {
    assert.equal(
      contestStandingDisplayLabel(null, 'mystery_user@gmail.com'),
      'mystery_user',
    );
    assert.equal(contestStandingDisplayLabel('  ', 'a@b.co'), 'a');
  });

  it('returns null when no snapshot and no email', () => {
    assert.equal(contestStandingDisplayLabel(null, null), null);
    assert.equal(contestStandingDisplayLabel(null, ''), null);
  });
});
