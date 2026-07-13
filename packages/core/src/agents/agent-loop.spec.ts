import type Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';

import type { AuditEventInput } from '../logging/audit-event-schema.js';
import {
  runAgentLoop,
  type AgentTool,
  type MessagesClient,
} from './agent-loop.js';

function fakeClient(response: {
  content: unknown[];
  stop_reason: string;
}): MessagesClient {
  return {
    messages: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      create: async () => response as any,
    },
  };
}

function fakeSequentialClient(
  responses: Array<{ content: unknown[]; stop_reason: string }>,
) {
  const calls: Anthropic.MessageCreateParamsNonStreaming[] = [];
  let index = 0;
  const client: MessagesClient = {
    messages: {
      create: async (params) => {
        calls.push(params);
        const response = responses[Math.min(index, responses.length - 1)];
        index += 1;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return response as any;
      },
    },
  };
  return { client, calls };
}

function fakeLogger() {
  const events: AuditEventInput[] = [];
  return {
    logger: { log: (event: AuditEventInput) => events.push(event) },
    events,
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

  it('throws an llm_error AgentError for an unexpected stop reason', async () => {
    const client = fakeClient({ content: [], stop_reason: 'max_tokens' });

    await expect(
      runAgentLoop({
        client,
        model: 'claude-haiku-4-5',
        system: 'system prompt',
        messages: [{ role: 'user', content: 'hi' }],
      }),
    ).rejects.toMatchObject({ category: 'llm_error' });
  });

  it('throws an llm_error AgentError when the SDK call itself throws', async () => {
    const client: MessagesClient = {
      messages: {
        create: async () => {
          throw new Error('network timeout');
        },
      },
    };

    await expect(
      runAgentLoop({
        client,
        model: 'm',
        system: 's',
        messages: [{ role: 'user', content: 'hi' }],
      }),
    ).rejects.toMatchObject({
      category: 'llm_error',
      message: 'network timeout',
    });
  });

  it('sends the registered tool definitions to the model', async () => {
    const { client, calls } = fakeSequentialClient([
      { content: [{ type: 'text', text: 'ok' }], stop_reason: 'end_turn' },
    ]);
    const tool: AgentTool = {
      name: 'runSql',
      description: 'desc',
      inputSchema: { type: 'object', properties: {} },
      execute: async () => ({ ok: true, data: [] }),
    };

    await runAgentLoop({
      client,
      model: 'm',
      system: 's',
      messages: [{ role: 'user', content: 'hi' }],
      tools: [tool],
    });

    expect(calls[0]?.tools).toEqual([
      {
        name: 'runSql',
        description: 'desc',
        input_schema: { type: 'object', properties: {} },
      },
    ]);
  });

  it('dispatches a tool_use response to the matching tool and sends the result back', async () => {
    const { client, calls } = fakeSequentialClient([
      {
        content: [
          {
            type: 'tool_use',
            id: 'tool_1',
            name: 'echoTool',
            input: { value: 'hi' },
          },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [{ type: 'text', text: 'Final answer' }],
        stop_reason: 'end_turn',
      },
    ]);

    const echoTool: AgentTool = {
      name: 'echoTool',
      description: 'echoes input',
      inputSchema: {
        type: 'object',
        properties: { value: { type: 'string' } },
        required: ['value'],
      },
      execute: async (input) => ({ ok: true, data: input }),
    };

    const result = await runAgentLoop({
      client,
      model: 'm',
      system: 's',
      messages: [{ role: 'user', content: 'hi' }],
      tools: [echoTool],
    });

    expect(result).toBe('Final answer');
    expect(calls).toHaveLength(2);
    const secondCallMessages = calls[1]?.messages ?? [];
    const toolResultMessage = secondCallMessages[secondCallMessages.length - 1];
    expect(toolResultMessage?.content).toEqual([
      {
        type: 'tool_result',
        tool_use_id: 'tool_1',
        content: JSON.stringify({ value: 'hi' }),
      },
    ]);
  });

  it('returns an error tool_result when the model requests an unregistered tool', async () => {
    const { client, calls } = fakeSequentialClient([
      {
        content: [
          { type: 'tool_use', id: 'tool_1', name: 'missingTool', input: {} },
        ],
        stop_reason: 'tool_use',
      },
      { content: [{ type: 'text', text: 'ok' }], stop_reason: 'end_turn' },
    ]);

    const result = await runAgentLoop({
      client,
      model: 'm',
      system: 's',
      messages: [{ role: 'user', content: 'hi' }],
      tools: [],
    });

    expect(result).toBe('ok');
    const secondCallMessages = calls[1]?.messages ?? [];
    const toolResultMessage = secondCallMessages[secondCallMessages.length - 1];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((toolResultMessage?.content as any[])[0]).toMatchObject({
      type: 'tool_result',
      tool_use_id: 'tool_1',
      is_error: true,
    });
  });

  it('tags an uncaught tool exception as tool_execution_error in the tool_result event', async () => {
    const { client } = fakeSequentialClient([
      {
        content: [
          { type: 'tool_use', id: 'tool_1', name: 'crashingTool', input: {} },
        ],
        stop_reason: 'tool_use',
      },
      { content: [{ type: 'text', text: 'ok' }], stop_reason: 'end_turn' },
    ]);
    const { logger, events } = fakeLogger();

    const crashingTool: AgentTool = {
      name: 'crashingTool',
      description: '',
      inputSchema: { type: 'object', properties: {} },
      execute: async () => {
        throw new Error('boom');
      },
    };

    await runAgentLoop({
      client,
      model: 'm',
      system: 's',
      messages: [{ role: 'user', content: 'hi' }],
      tools: [crashingTool],
      logger,
      runId: 'run-1',
    });

    const toolResultEvent = events.find((e) => e.eventType === 'tool_result');
    expect(toolResultEvent?.data).toMatchObject({
      toolName: 'crashingTool',
      ok: false,
      category: 'tool_execution_error',
    });
  });

  it('throws a max_steps_reached AgentError after reaching the max step limit without a final answer', async () => {
    const alwaysToolUse = {
      content: [{ type: 'tool_use', id: 't', name: 'noop', input: {} }],
      stop_reason: 'tool_use',
    };
    const { client } = fakeSequentialClient([
      alwaysToolUse,
      alwaysToolUse,
      alwaysToolUse,
    ]);

    const noopTool: AgentTool = {
      name: 'noop',
      description: '',
      inputSchema: { type: 'object', properties: {} },
      execute: async () => ({ ok: true, data: null }),
    };

    await expect(
      runAgentLoop({
        client,
        model: 'm',
        system: 's',
        messages: [{ role: 'user', content: 'hi' }],
        tools: [noopTool],
        maxSteps: 2,
      }),
    ).rejects.toMatchObject({ category: 'max_steps_reached' });
  });

  it('logs model_request/model_response and tool_call/tool_result events when a logger is provided', async () => {
    const { client } = fakeSequentialClient([
      {
        content: [
          {
            type: 'tool_use',
            id: 'tool_1',
            name: 'echoTool',
            input: { value: 'hi' },
          },
        ],
        stop_reason: 'tool_use',
      },
      {
        content: [{ type: 'text', text: 'Final answer' }],
        stop_reason: 'end_turn',
      },
    ]);
    const { logger, events } = fakeLogger();
    const echoTool: AgentTool = {
      name: 'echoTool',
      description: 'echoes input',
      inputSchema: { type: 'object', properties: {} },
      execute: async (input) => ({ ok: true, data: input }),
    };

    await runAgentLoop({
      client,
      model: 'm',
      system: 's',
      messages: [{ role: 'user', content: 'hi' }],
      tools: [echoTool],
      logger,
      runId: 'run-1',
    });

    const eventTypes = events.map((e) => e.eventType);
    expect(eventTypes).toEqual([
      'model_request',
      'model_response',
      'tool_call',
      'tool_result',
      'model_request',
      'model_response',
    ]);
    expect(events.every((e) => e.runId === 'run-1')).toBe(true);
    const toolCallEvent = events.find((e) => e.eventType === 'tool_call');
    expect(toolCallEvent?.data).toMatchObject({
      toolName: 'echoTool',
      input: { value: 'hi' },
    });
    const toolResultEvent = events.find((e) => e.eventType === 'tool_result');
    expect(toolResultEvent?.data).toMatchObject({
      toolName: 'echoTool',
      ok: true,
      resultPreview: JSON.stringify({ value: 'hi' }),
    });
  });

  it('truncates an oversized tool result before logging it', async () => {
    const largeArray = Array.from({ length: 500 }, (_, i) => ({
      id: i,
      name: `row-${i}`,
    }));
    const { client } = fakeSequentialClient([
      {
        content: [
          { type: 'tool_use', id: 'tool_1', name: 'bigTool', input: {} },
        ],
        stop_reason: 'tool_use',
      },
      { content: [{ type: 'text', text: 'ok' }], stop_reason: 'end_turn' },
    ]);
    const { logger, events } = fakeLogger();
    const bigTool: AgentTool = {
      name: 'bigTool',
      description: '',
      inputSchema: { type: 'object', properties: {} },
      execute: async () => ({ ok: true, data: largeArray }),
    };

    await runAgentLoop({
      client,
      model: 'm',
      system: 's',
      messages: [{ role: 'user', content: 'hi' }],
      tools: [bigTool],
      logger,
      runId: 'run-1',
    });

    const toolResultEvent = events.find((e) => e.eventType === 'tool_result');
    const preview =
      (toolResultEvent?.data as { resultPreview?: string })?.resultPreview ??
      '';
    expect(preview.length).toBeLessThan(JSON.stringify(largeArray).length);
    expect(preview.length).toBeLessThanOrEqual(1000);
  });
});
