import { describe, expect, it } from 'vitest';

import { getErrorMessage } from './get-error-message.js';

describe('getErrorMessage', () => {
  it('returns the Error message when given an Error instance', () => {
    expect(getErrorMessage(new Error('boom'), 'fallback')).toBe('boom');
  });

  it('returns the fallback when given a non-Error value', () => {
    expect(getErrorMessage('not an error', 'fallback')).toBe('fallback');
  });
});
