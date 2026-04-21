import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isAdminFromDecodedToken } from './auth-claims.js';

describe('isAdminFromDecodedToken (Story AD-2)', () => {
  it('is true only when admin claim is boolean true', () => {
    assert.equal(isAdminFromDecodedToken({ admin: true }), true);
    assert.equal(isAdminFromDecodedToken({ admin: false }), false);
    assert.equal(isAdminFromDecodedToken({ admin: 'true' }), false);
    assert.equal(isAdminFromDecodedToken({}), false);
    assert.equal(isAdminFromDecodedToken(null), false);
  });
});
