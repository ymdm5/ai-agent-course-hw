import { describe, expect, it } from 'vitest';

import { getErrorMessage } from './get-error-message.js';

describe('getErrorMessage', () => {
  it('returns the Error message when given an Error instance', () => {
    expect(getErrorMessage(new Error('boom'), 'fallback')).toBe('boom');
  });

  it('returns the fallback when given a non-Error value', () => {
    expect(getErrorMessage('not an error', 'fallback')).toBe('fallback');
  });

  it('returns the fallback when the Error message is empty', () => {
    // e.g. Node's AggregateError (thrown by `pg` when both the IPv4 and IPv6
    // loopback connection attempts fail) is instanceof Error but carries an
    // empty top-level message — the real messages live in `.errors`.
    expect(getErrorMessage(new Error(''), 'fallback')).toBe('fallback');
  });
});
