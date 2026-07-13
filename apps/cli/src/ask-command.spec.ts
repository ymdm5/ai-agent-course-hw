import { PassThrough } from 'node:stream';

import { describe, expect, it, vi } from 'vitest';

import { runAskCommand, type AskAgentResult } from './ask-command.js';

function collectOutput() {
  const output = new PassThrough();
  let text = '';
  output.on('data', (chunk: Buffer) => {
    text += chunk.toString();
  });
  return { output, getText: () => text };
}

function fakeResult(answer: string, question: string): AskAgentResult {
  return {
    answer,
    systemPrompt: '<role>...</role>',
    userMessage: `<question>\n${question}\n</question>`,
  };
}

describe('runAskCommand', () => {
  it('asks the agent for the one-shot question and prints the answer', async () => {
    const { output, getText } = collectOutput();
    const askAgent = vi.fn(async (question: string) =>
      fakeResult(`válasz erre: ${question}`, question),
    );

    await runAskCommand(
      { question: 'Mennyi 2+2?', showPrompt: false },
      { askAgent, streams: { input: new PassThrough(), output } },
    );

    expect(askAgent).toHaveBeenCalledWith('Mennyi 2+2?');
    expect(getText()).toBe('válasz erre: Mennyi 2+2?\n');
  });

  it('does not print the prompt structure when --show-prompt is off', async () => {
    const { output, getText } = collectOutput();
    const askAgent = vi.fn(async (question: string) =>
      fakeResult('válasz', question),
    );

    await runAskCommand(
      { question: 'kérdés', showPrompt: false },
      { askAgent, streams: { input: new PassThrough(), output } },
    );

    expect(getText()).not.toContain('<role>');
  });

  it('prints the system prompt and user message before the answer when --show-prompt is on', async () => {
    const { output, getText } = collectOutput();
    const askAgent = vi.fn(async (question: string) =>
      fakeResult('a válasz', question),
    );

    await runAskCommand(
      { question: 'kérdés', showPrompt: true },
      { askAgent, streams: { input: new PassThrough(), output } },
    );

    const text = getText();
    expect(text).toContain('<role>...</role>');
    expect(text).toContain('<question>\nkérdés\n</question>');
    expect(text.indexOf('<role>')).toBeLessThan(text.indexOf('a válasz'));
  });

  it('asks the agent for each line typed in interactive mode until the exit command', async () => {
    const input = new PassThrough();
    const { output, getText } = collectOutput();
    const askAgent = vi.fn(async (question: string) =>
      fakeResult(`visszhang: ${question}`, question),
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
