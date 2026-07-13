import type Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';

import type { MessagesClient } from '../agent-loop.js';
import { askAgent } from './ledgerbase-agent.js';

describe('askAgent', () => {
  it('rejects an empty question before calling the model', async () => {
    let called = false;
    const client: MessagesClient = {
      messages: {
        create: async () => {
          called = true;
          throw new Error('should not be called');
        },
      },
    };

    await expect(
      askAgent({ client, model: 'claude-haiku-4-5', question: '   ' }),
    ).rejects.toThrow();
    expect(called).toBe(false);
  });

  it('sends the question wrapped in <question> tags with the current date and returns the model text', async () => {
    let capturedSystem: string | undefined;
    let capturedMessages: Anthropic.MessageParam[] = [];
    const client: MessagesClient = {
      messages: {
        create: async (params) => {
          capturedSystem = params.system as string;
          capturedMessages = params.messages;
          return {
            content: [{ type: 'text', text: 'válasz' }],
            stop_reason: 'end_turn',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any;
        },
      },
    };

    const result = await askAgent({
      client,
      model: 'claude-haiku-4-5',
      question: 'Mennyi 2+2?',
      currentDate: '2026-07-13',
    });

    expect(result).toBe('válasz');
    expect(capturedSystem).toContain('<current_date>2026-07-13</current_date>');
    expect(capturedMessages[0]?.content).toBe(
      '<question>\nMennyi 2+2?\n</question>',
    );
  });
});
