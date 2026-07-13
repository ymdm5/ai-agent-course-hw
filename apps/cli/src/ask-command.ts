import * as readline from 'node:readline';

import { formatErrorMessage } from './format-error-message.js';

export interface AskAgentResult {
  answer: string;
  systemPrompt: string;
  userMessage: string;
}

export interface AskCommandOptions {
  question?: string;
  showPrompt: boolean;
}

export interface AskCommandStreams {
  input: NodeJS.ReadableStream;
  output: NodeJS.WritableStream;
}

export interface AskCommandDeps {
  askAgent: (question: string) => Promise<AskAgentResult>;
  streams?: AskCommandStreams;
}

const EXIT_COMMANDS = new Set(['exit', 'quit']);
const defaultStreams: AskCommandStreams = {
  input: process.stdin,
  output: process.stdout,
};

export async function runAskCommand(
  options: AskCommandOptions,
  deps: AskCommandDeps,
): Promise<void> {
  const streams = deps.streams ?? defaultStreams;

  if (options.question !== undefined) {
    const result = await deps.askAgent(options.question);
    writeResult(result, options.showPrompt, streams);
    return;
  }

  await runInteractiveAsk(deps.askAgent, options.showPrompt, streams);
}

async function runInteractiveAsk(
  askAgent: AskCommandDeps['askAgent'],
  showPrompt: boolean,
  streams: AskCommandStreams,
): Promise<void> {
  const rl = readline.createInterface({
    input: streams.input,
    terminal: false,
  });
  for await (const line of rl) {
    if (EXIT_COMMANDS.has(line.trim().toLowerCase())) break;
    try {
      const result = await askAgent(line);
      writeResult(result, showPrompt, streams);
    } catch (error) {
      streams.output.write(`${formatErrorMessage(error)}\n`);
    }
  }
  rl.close();
}

function writeResult(
  result: AskAgentResult,
  showPrompt: boolean,
  streams: AskCommandStreams,
): void {
  if (showPrompt) {
    streams.output.write(`${formatPromptDisplay(result)}\n\n`);
  }
  streams.output.write(`${result.answer}\n`);
}

function formatPromptDisplay(result: AskAgentResult): string {
  return [
    '--- system prompt ---',
    result.systemPrompt,
    '--- user message ---',
    result.userMessage,
  ].join('\n');
}
