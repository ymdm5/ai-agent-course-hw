import { afterEach, describe, expect, it } from 'vitest';

import { requireEnv } from './require-env.js';

describe('requireEnv', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns the value of a set environment variable', () => {
    process.env.MY_TEST_VAR = 'value';
    expect(requireEnv('MY_TEST_VAR')).toBe('value');
  });

  it('throws a descriptive error when the variable is not set', () => {
    delete process.env.MY_TEST_VAR;
    expect(() => requireEnv('MY_TEST_VAR')).toThrow('MY_TEST_VAR is not set.');
  });
});
