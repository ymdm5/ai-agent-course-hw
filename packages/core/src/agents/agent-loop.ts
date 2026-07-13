import type Anthropic from '@anthropic-ai/sdk';

import { AgentError } from '../errors/agent-error.js';
import { getErrorMessage } from '../errors/get-error-message.js';
import type { AuditLogger } from '../logging/audit-logger.js';
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
  logger?: AuditLogger;
  runId?: string;
}

const DEFAULT_MAX_STEPS = 5;

export async function runAgentLoop(options: AgentLoopOptions): Promise<string> {
  const {
    client,
    model,
    system,
    tools = [],
    maxSteps = DEFAULT_MAX_STEPS,
    logger,
    runId = 'unknown',
  } = options;
  const toolsByName = new Map(tools.map((tool) => [tool.name, tool]));
  const conversation: Anthropic.MessageParam[] = [...options.messages];

  for (let step = 0; step < maxSteps; step++) {
    logger?.log({
      runId,
      eventType: 'model_request',
      step,
      data: { messagesSent: conversation.length },
    });

    let response: Anthropic.Message;
    try {
      response = await client.messages.create({
        model,
        system,
        max_tokens: 1024,
        messages: conversation,
        tools: tools.length > 0 ? tools.map(toAnthropicTool) : undefined,
      });
    } catch (error) {
      const message = getErrorMessage(error, 'The model call failed.');
      logger?.log({
        runId,
        eventType: 'error',
        step,
        data: { category: 'llm_error', message },
      });
      throw new AgentError('llm_error', message);
    }

    logger?.log({
      runId,
      eventType: 'model_response',
      step,
      data: {
        stopReason: response.stop_reason,
        inputTokens: response.usage?.input_tokens,
        outputTokens: response.usage?.output_tokens,
      },
    });

    if (response.stop_reason === 'end_turn') {
      return extractText(response);
    }

    if (response.stop_reason !== 'tool_use') {
      const message = `Unexpected stop_reason from model: ${response.stop_reason}`;
      logger?.log({
        runId,
        eventType: 'error',
        step,
        data: { category: 'llm_error', message },
      });
      throw new AgentError('llm_error', message);
    }

    conversation.push({ role: 'assistant', content: response.content });
    conversation.push({
      role: 'user',
      content: await Promise.all(
        extractToolUseBlocks(response).map((block) =>
          dispatchTool(block, toolsByName, logger, runId, step),
        ),
      ),
    });
  }

  const message = 'Maximum agent steps reached without a final answer.';
  logger?.log({
    runId,
    eventType: 'error',
    data: { category: 'max_steps_reached', message },
  });
  throw new AgentError('max_steps_reached', message);
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
  logger: AuditLogger | undefined,
  runId: string,
  step: number,
): Promise<Anthropic.ToolResultBlockParam> {
  logger?.log({
    runId,
    eventType: 'tool_call',
    step,
    data: { toolName: block.name, input: block.input },
  });

  const tool = toolsByName.get(block.name);
  if (!tool) {
    logger?.log({
      runId,
      eventType: 'tool_result',
      step,
      data: {
        toolName: block.name,
        ok: false,
        category: 'input_validation',
        error: 'Unknown tool',
      },
    });
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
      error: getErrorMessage(error, 'Tool execution failed.'),
      category: 'tool_execution_error',
    };
  }

  logger?.log({
    runId,
    eventType: 'tool_result',
    step,
    data: outcome.ok
      ? {
          toolName: block.name,
          ok: true,
          resultPreview: truncate(JSON.stringify(outcome.data)),
        }
      : {
          toolName: block.name,
          ok: false,
          error: outcome.error,
          category: outcome.category,
        },
  });

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

const MAX_RESULT_PREVIEW_LENGTH = 1000;

function truncate(text: string): string {
  return text.length > MAX_RESULT_PREVIEW_LENGTH
    ? `${text.slice(0, MAX_RESULT_PREVIEW_LENGTH - 1)}…`
    : text;
}

function extractText(message: Anthropic.Message): string {
  return message.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();
}
