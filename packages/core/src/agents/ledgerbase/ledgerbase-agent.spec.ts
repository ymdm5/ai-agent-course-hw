import type Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';

import type { AgentTool, MessagesClient } from '../agent-loop.js';
import type { AuditEventInput } from '../../logging/audit-event-schema.js';
import { askAgent } from './ledgerbase-agent.js';

function fakeLogger() {
  const events: AuditEventInput[] = [];
  return {
    logger: { log: (event: AuditEventInput) => events.push(event) },
    events,
  };
}

describe('askAgent', () => {
  it('rejects an empty question before calling the model, as an input_validation AgentError', async () => {
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
    ).rejects.toMatchObject({
      category: 'input_validation',
    });
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

    expect(result.answer).toBe('válasz');
    expect(result.systemPrompt).toContain(
      '<current_date>2026-07-13</current_date>',
    );
    expect(result.userMessage).toBe('<question>\nMennyi 2+2?\n</question>');
    expect(capturedSystem).toContain('<current_date>2026-07-13</current_date>');
    expect(capturedMessages[0]?.content).toBe(
      '<question>\nMennyi 2+2?\n</question>',
    );
  });

  it('passes provided tools through so the model can use them', async () => {
    let capturedTools: unknown;
    const client: MessagesClient = {
      messages: {
        create: async (params) => {
          capturedTools = params.tools;
          return {
            content: [{ type: 'text', text: 'ok' }],
            stop_reason: 'end_turn',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any;
        },
      },
    };

    const tool: AgentTool = {
      name: 'runSql',
      description: 'desc',
      inputSchema: { type: 'object', properties: {} },
      execute: async () => ({ ok: true, data: [] }),
    };

    await askAgent({
      client,
      model: 'm',
      question: 'Mely ügyfeleknek van lejárt feladata?',
      tools: [tool],
    });

    expect(capturedTools).toEqual([
      {
        name: 'runSql',
        description: 'desc',
        input_schema: { type: 'object', properties: {} },
      },
    ]);
  });

  it('logs run_started, final_answer and run_finished events under one shared runId', async () => {
    const client: MessagesClient = {
      messages: {
        create: async () =>
          ({
            content: [{ type: 'text', text: 'válasz' }],
            stop_reason: 'end_turn',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          }) as any,
      },
    };
    const { logger, events } = fakeLogger();

    await askAgent({ client, model: 'm', question: 'Mennyi 2+2?', logger });

    const eventTypes = events.map((e) => e.eventType);
    expect(eventTypes).toEqual([
      'run_started',
      'model_request',
      'model_response',
      'final_answer',
      'run_finished',
    ]);
    const runIds = new Set(events.map((e) => e.runId));
    expect(runIds.size).toBe(1);
    const runStarted = events.find((e) => e.eventType === 'run_started');
    expect(runStarted?.data).toMatchObject({
      question: 'Mennyi 2+2?',
      model: 'm',
    });
    const finalAnswer = events.find((e) => e.eventType === 'final_answer');
    expect(finalAnswer?.data).toMatchObject({ answer: 'válasz' });
  });

  it('returns the answer alongside the exact system prompt and user message sent to the model', async () => {
    const client: MessagesClient = {
      messages: {
        create: async () =>
          ({
            content: [{ type: 'text', text: 'ok' }],
            stop_reason: 'end_turn',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          }) as any,
      },
    };

    const result = await askAgent({
      client,
      model: 'm',
      question: 'teszt',
      currentDate: '2026-07-13',
    });

    expect(result).toEqual({
      answer: 'ok',
      systemPrompt: expect.stringContaining(
        '<current_date>2026-07-13</current_date>',
      ),
      userMessage: '<question>\nteszt\n</question>',
    });
  });
});
