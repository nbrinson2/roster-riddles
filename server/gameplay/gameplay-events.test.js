/**
 * Request body validation for POST /api/v1/me/gameplay-events.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { gameplayEventBodySchema } from './gameplay-events.js';

const validBase = {
  schemaVersion: 1,
  gameMode: 'bio-ball',
  durationMs: 1000,
  clientSessionId: '1234567890abcdef',
};

describe('gameplayEventBodySchema', () => {
  it('accepts abandoned with at least one guess', () => {
    const parsed = gameplayEventBodySchema.parse({
      ...validBase,
      result: 'abandoned',
      mistakeCount: 1,
    });
    assert.equal(parsed.result, 'abandoned');
  });

  it('rejects abandoned with zero guesses', () => {
    assert.throws(
      () =>
        gameplayEventBodySchema.parse({
          ...validBase,
          result: 'abandoned',
          mistakeCount: 0,
        }),
      /Abandoned sessions require at least one guess/,
    );
  });
});
