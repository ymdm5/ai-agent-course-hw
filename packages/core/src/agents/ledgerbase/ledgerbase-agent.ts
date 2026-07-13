import {
  runAgentLoop,
  type AgentTool,
  type MessagesClient,
} from '../agent-loop.js';
import { AskInputSchema } from './ask-input-schema.js';
import {
  buildLedgerbaseSystemPrompt,
  buildUserMessage,
} from './ledgerbase-prompt.js';

export interface AskAgentOptions {
  client: MessagesClient;
  model: string;
  question: string;
  currentDate?: string;
  tools?: AgentTool[];
}

export async function askAgent(options: AskAgentOptions): Promise<string> {
  const { question } = AskInputSchema.parse({ question: options.question });
  const currentDate =
    options.currentDate ?? new Date().toISOString().slice(0, 10);

  return runAgentLoop({
    client: options.client,
    model: options.model,
    system: buildLedgerbaseSystemPrompt({ currentDate }),
    messages: [{ role: 'user', content: buildUserMessage(question) }],
    tools: options.tools,
  });
}
