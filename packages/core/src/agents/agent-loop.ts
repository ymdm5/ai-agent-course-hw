import type Anthropic from '@anthropic-ai/sdk';

export interface MessagesClient {
  messages: {
    create: (
      params: Anthropic.MessageCreateParamsNonStreaming,
    ) => Promise<Anthropic.Message>;
  };
}

export interface AgentLoopOptions {
  client: MessagesClient;
  model: string;
  system: string;
  messages: Anthropic.MessageParam[];
}

// No tools are wired up yet (Phase 2). Phase 3 extends this with a tool
// registry and a real multi-step loop around the tool_use stop reason.
export async function runAgentLoop(options: AgentLoopOptions): Promise<string> {
  const response = await options.client.messages.create({
    model: options.model,
    system: options.system,
    max_tokens: 1024,
    messages: options.messages,
  });

  if (response.stop_reason !== 'end_turn') {
    throw new Error(
      `Unexpected stop_reason from model: ${response.stop_reason}`,
    );
  }

  return extractText(response);
}

function extractText(message: Anthropic.Message): string {
  return message.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();
}
