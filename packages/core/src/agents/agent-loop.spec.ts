import { describe, expect, it } from 'vitest';

import { runAgentLoop, type MessagesClient } from './agent-loop.js';

function fakeClient(response: {
  content: Array<{ type: 'text'; text: string }>;
  stop_reason: string;
}): MessagesClient {
  return {
    messages: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      create: async () => response as any,
    },
  };
}

describe('runAgentLoop', () => {
  it('returns the concatenated text blocks when the model ends its turn', async () => {
    const client = fakeClient({
      content: [{ type: 'text', text: 'Hello there!' }],
      stop_reason: 'end_turn',
    });

    const result = await runAgentLoop({
      client,
      model: 'claude-haiku-4-5',
      system: 'system prompt',
      messages: [{ role: 'user', content: 'hi' }],
    });

    expect(result).toBe('Hello there!');
  });

  it('throws a clear error for an unexpected stop reason', async () => {
    const client = fakeClient({ content: [], stop_reason: 'max_tokens' });

    await expect(
      runAgentLoop({
        client,
        model: 'claude-haiku-4-5',
        system: 'system prompt',
        messages: [{ role: 'user', content: 'hi' }],
      }),
    ).rejects.toThrow('max_tokens');
  });
});
