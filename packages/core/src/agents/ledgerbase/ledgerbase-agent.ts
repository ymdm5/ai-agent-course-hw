import { randomUUID } from 'node:crypto';

import {
  runAgentLoop,
  type AgentTool,
  type MessagesClient,
} from '../agent-loop.js';
import { AgentError } from '../../errors/agent-error.js';
import type { AuditLogger } from '../../logging/audit-logger.js';
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
  logger?: AuditLogger;
  runId?: string;
}

export interface AskAgentResult {
  answer: string;
  systemPrompt: string;
  userMessage: string;
}

export async function askAgent(
  options: AskAgentOptions,
): Promise<AskAgentResult> {
  const runId = options.runId ?? randomUUID();
  const { logger } = options;
  const startedAt = Date.now();

  const parsed = AskInputSchema.safeParse({ question: options.question });
  if (!parsed.success) {
    const message = 'A kérdés nem lehet üres.';
    logger?.log({
      runId,
      eventType: 'error',
      data: { category: 'input_validation', message },
    });
    throw new AgentError('input_validation', message);
  }
  const { question } = parsed.data;

  const currentDate =
    options.currentDate ?? new Date().toISOString().slice(0, 10);
  const systemPrompt = buildLedgerbaseSystemPrompt({ currentDate });
  const userMessage = buildUserMessage(question);

  logger?.log({
    runId,
    eventType: 'run_started',
    data: { question, model: options.model, systemPrompt },
  });

  const answer = await runAgentLoop({
    client: options.client,
    model: options.model,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
    tools: options.tools,
    logger,
    runId,
  });

  logger?.log({ runId, eventType: 'final_answer', data: { answer } });
  logger?.log({
    runId,
    eventType: 'run_finished',
    durationMs: Date.now() - startedAt,
  });

  return { answer, systemPrompt, userMessage };
}
