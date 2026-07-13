import { PassThrough } from 'node:stream';

import { describe, expect, it } from 'vitest';

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
  it('echoes the one-shot question back to output', async () => {
    const { output, getText } = collectOutput();

    await runAskCommand(
      { question: 'hello', showPrompt: false },
      { input: new PassThrough(), output },
    );

    expect(getText()).toBe('hello\n');
  });

  it('echoes each line typed in interactive mode until the exit command', async () => {
    const input = new PassThrough();
    const { output, getText } = collectOutput();

    const done = runAskCommand(
      { question: undefined, showPrompt: false },
      { input, output },
    );

    input.write('first message\n');
    input.write('second message\n');
    input.write('exit\n');
    input.end();

    await done;

    expect(getText()).toBe('first message\nsecond message\n');
  });
});
