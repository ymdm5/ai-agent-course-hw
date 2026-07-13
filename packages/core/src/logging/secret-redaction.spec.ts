import { describe, expect, it } from 'vitest';

import { redactSecretsInString } from './secret-redaction.js';

describe('redactSecretsInString', () => {
  it('redacts a Postgres connection string embedded in a longer message', () => {
    const input =
      'connection to postgresql://ledgerbase:ledgerbase@localhost:5433/ledgerbase failed';
    const result = redactSecretsInString(input);
    expect(result).not.toContain('ledgerbase:ledgerbase');
    expect(result).not.toContain('postgresql://');
    expect(result).toContain('[REDACTED_CONNECTION_STRING]');
  });

  it('redacts an Anthropic API key embedded in a longer message', () => {
    const input =
      'request failed with key sk-ant-api03-abcDEF123_-xyz in header';
    const result = redactSecretsInString(input);
    expect(result).not.toContain('sk-ant-api03-abcDEF123_-xyz');
    expect(result).toContain('[REDACTED_API_KEY]');
  });

  it('leaves an ordinary message with no secret-shaped content unchanged', () => {
    const input = 'relation "clients" does not exist';
    expect(redactSecretsInString(input)).toBe(input);
  });
});
