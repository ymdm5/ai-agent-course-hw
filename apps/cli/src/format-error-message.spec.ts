import { AgentError } from '@ledgerbase/core';
import { describe, expect, it } from 'vitest';

import { formatErrorMessage } from './format-error-message.js';

describe('formatErrorMessage', () => {
  it('formats an input_validation AgentError', () => {
    const message = formatErrorMessage(
      new AgentError('input_validation', 'A kérdés nem lehet üres.'),
    );
    expect(message).toContain('kérdés');
  });

  it('formats a max_steps_reached AgentError', () => {
    const message = formatErrorMessage(
      new AgentError('max_steps_reached', 'too many steps'),
    );
    expect(message.toLowerCase()).toContain('lépés');
  });

  it('formats an llm_error AgentError, including the underlying message', () => {
    const message = formatErrorMessage(
      new AgentError('llm_error', 'rate limited'),
    );
    expect(message).toContain('rate limited');
  });

  it('never includes a raw stack trace or exception name for a generic Error', () => {
    const message = formatErrorMessage(
      new Error('ECONNREFUSED at postgresql://user:pass@host/db'),
    );
    expect(message).not.toContain('postgresql://');
    expect(message).not.toContain('ECONNREFUSED');
  });

  it('handles non-Error thrown values without crashing', () => {
    const message = formatErrorMessage('just a string');
    expect(typeof message).toBe('string');
  });
});
