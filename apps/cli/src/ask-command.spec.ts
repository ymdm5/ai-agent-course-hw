import { PassThrough } from 'node:stream';

import { describe, expect, it, vi } from 'vitest';

import { runAskCommand } from './ask-command.js';

function collectOutput() {
  const output = new PassThrough();
  let text = '';
  output.on('data', (chunk: Buffer) => {
    text += chunk.toString();
  });
  return { output, getText: () => text };
}

describe('runAskCommand', () => {
  it('asks the agent for the one-shot question and prints the answer', async () => {
    const { output, getText } = collectOutput();
    const askAgent = vi.fn(
      async (question: string) => `válasz erre: ${question}`,
    );

    await runAskCommand(
      { question: 'Mennyi 2+2?', showPrompt: false },
      { askAgent, streams: { input: new PassThrough(), output } },
    );

    expect(askAgent).toHaveBeenCalledWith('Mennyi 2+2?');
    expect(getText()).toBe('válasz erre: Mennyi 2+2?\n');
  });

  it('asks the agent for each line typed in interactive mode until the exit command', async () => {
    const input = new PassThrough();
    const { output, getText } = collectOutput();
    const askAgent = vi.fn(
      async (question: string) => `visszhang: ${question}`,
    );

    const done = runAskCommand(
      { question: undefined, showPrompt: false },
      { askAgent, streams: { input, output } },
    );

    input.write('első kérdés\n');
    input.write('második kérdés\n');
    input.write('exit\n');
    input.end();

    await done;

    expect(askAgent).toHaveBeenCalledTimes(2);
    expect(getText()).toBe(
      'visszhang: első kérdés\nvisszhang: második kérdés\n',
    );
  });
});
