import { describe, expect, it } from 'vitest';

import { AgentError } from './agent-error.js';

describe('AgentError', () => {
  it('carries its category and message', () => {
    const error = new AgentError('database_error', 'connection lost');
    expect(error.category).toBe('database_error');
    expect(error.message).toBe('connection lost');
    expect(error.name).toBe('AgentError');
  });

  it('is a real Error instance', () => {
    const error = new AgentError('max_steps_reached', 'too many steps');
    expect(error).toBeInstanceOf(Error);
  });
});
