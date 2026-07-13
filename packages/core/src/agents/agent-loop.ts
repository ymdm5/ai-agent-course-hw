import type Anthropic from '@anthropic-ai/sdk';

import type { ToolOutcome } from '../tools/tool-outcome.js';

export interface MessagesClient {
  messages: {
    create: (
      params: Anthropic.MessageCreateParamsNonStreaming,
    ) => Promise<Anthropic.Message>;
  };
}

export interface AgentTool {
  name: string;
  description: string;
  inputSchema: Anthropic.Tool.InputSchema;
  execute: (input: unknown) => Promise<ToolOutcome<unknown>>;
}

export interface AgentLoopOptions {
  client: MessagesClient;
  model: string;
  system: string;
  messages: Anthropic.MessageParam[];
  tools?: AgentTool[];
  maxSteps?: number;
}

const DEFAULT_MAX_STEPS = 5;

export async function runAgentLoop(options: AgentLoopOptions): Promise<string> {
  const {
    client,
    model,
    system,
    tools = [],
    maxSteps = DEFAULT_MAX_STEPS,
  } = options;
  const toolsByName = new Map(tools.map((tool) => [tool.name, tool]));
  const conversation: Anthropic.MessageParam[] = [...options.messages];

  for (let step = 0; step < maxSteps; step++) {
    const response = await client.messages.create({
      model,
      system,
      max_tokens: 1024,
      messages: conversation,
      tools: tools.length > 0 ? tools.map(toAnthropicTool) : undefined,
    });

    if (response.stop_reason === 'end_turn') {
      return extractText(response);
    }

    if (response.stop_reason !== 'tool_use') {
      throw new Error(
        `Unexpected stop_reason from model: ${response.stop_reason}`,
      );
    }

    conversation.push({ role: 'assistant', content: response.content });
    conversation.push({
      role: 'user',
      content: await Promise.all(
        extractToolUseBlocks(response).map((block) =>
          dispatchTool(block, toolsByName),
        ),
      ),
    });
  }

  throw new Error('Maximum agent steps reached without a final answer.');
}

function toAnthropicTool(tool: AgentTool): Anthropic.Tool {
  return {
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema,
  };
}

function extractToolUseBlocks(
  message: Anthropic.Message,
): Anthropic.ToolUseBlock[] {
  return message.content.filter(
    (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
  );
}

async function dispatchTool(
  block: Anthropic.ToolUseBlock,
  toolsByName: Map<string, AgentTool>,
): Promise<Anthropic.ToolResultBlockParam> {
  const tool = toolsByName.get(block.name);
  if (!tool) {
    return {
      type: 'tool_result',
      tool_use_id: block.id,
      content: `Unknown tool: ${block.name}`,
      is_error: true,
    };
  }

  let outcome: ToolOutcome<unknown>;
  try {
    outcome = await tool.execute(block.input);
  } catch (error) {
    outcome = {
      ok: false,
      error: error instanceof Error ? error.message : 'Tool execution failed.',
    };
  }

  return outcome.ok
    ? {
        type: 'tool_result',
        tool_use_id: block.id,
        content: JSON.stringify(outcome.data),
      }
    : {
        type: 'tool_result',
        tool_use_id: block.id,
        content: outcome.error,
        is_error: true,
      };
}

function extractText(message: Anthropic.Message): string {
  return message.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();
}
