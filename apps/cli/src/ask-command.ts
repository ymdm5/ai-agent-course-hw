import * as readline from 'node:readline';

export interface AskCommandOptions {
  question?: string;
  showPrompt: boolean;
}

export interface AskCommandStreams {
  input: NodeJS.ReadableStream;
  output: NodeJS.WritableStream;
}

export interface AskCommandDeps {
  askAgent: (question: string) => Promise<string>;
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
    const answer = await deps.askAgent(options.question);
    streams.output.write(`${answer}\n`);
    return;
  }

  await runInteractiveAsk(deps.askAgent, streams);
}

async function runInteractiveAsk(
  askAgent: AskCommandDeps['askAgent'],
  streams: AskCommandStreams,
): Promise<void> {
  const rl = readline.createInterface({
    input: streams.input,
    terminal: false,
  });
  for await (const line of rl) {
    if (EXIT_COMMANDS.has(line.trim().toLowerCase())) break;
    const answer = await askAgent(line);
    streams.output.write(`${answer}\n`);
  }
  rl.close();
}
