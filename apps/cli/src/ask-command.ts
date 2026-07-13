import * as readline from 'node:readline';

export interface AskCommandOptions {
  question?: string;
  showPrompt: boolean;
}

export interface AskCommandStreams {
  input: NodeJS.ReadableStream;
  output: NodeJS.WritableStream;
}

const EXIT_COMMANDS = new Set(['exit', 'quit']);

const defaultStreams: AskCommandStreams = {
  input: process.stdin,
  output: process.stdout,
};

export async function runAskCommand(
  options: AskCommandOptions,
  streams: AskCommandStreams = defaultStreams,
): Promise<void> {
  if (options.question !== undefined) {
    streams.output.write(`${options.question}\n`);
    return;
  }

  await runInteractiveEcho(streams);
}

async function runInteractiveEcho(streams: AskCommandStreams): Promise<void> {
  const rl = readline.createInterface({
    input: streams.input,
    terminal: false,
  });
  for await (const line of rl) {
    if (EXIT_COMMANDS.has(line.trim().toLowerCase())) break;
    streams.output.write(`${line}\n`);
  }
  rl.close();
}
