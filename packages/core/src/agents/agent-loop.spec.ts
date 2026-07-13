import type Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';

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

  it('throws after reaching the max step limit without a final answer', async () => {
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
    ).rejects.toThrow('Maximum agent steps');
  });
});
