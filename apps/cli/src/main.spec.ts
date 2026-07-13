import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const closeSpy = vi.fn(async () => undefined);
const queryMock = vi.fn(async () => [] as Record<string, unknown>[]);
const askAgentMock = vi.fn(async () => ({
  answer: 'teszt válasz',
  systemPrompt: '<role></role>',
  userMessage: '<question></question>',
}));

vi.mock('@ledgerbase/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@ledgerbase/core')>();
  return {
    ...actual,
    createReadonlyDatabaseClient: vi.fn(() => ({
      query: queryMock,
      close: closeSpy,
    })),
    askAgent: askAgentMock,
  };
});

const { createProgram } = await import('./main.js');

describe('createProgram ask action', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.ANTHROPIC_MODEL = 'claude-sonnet-5';
    process.env.DATABASE_URL_READONLY =
      'postgresql://user:pass@localhost:5432/db';
    delete process.env.ANTHROPIC_API_KEY;
    closeSpy.mockClear();
    askAgentMock.mockClear();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    process.exitCode = undefined;
  });

  it('routes a missing-config error through formatErrorMessage instead of crashing unhandled', async () => {
    const errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    const program = createProgram();
    await program.parseAsync(['node', 'ledgerbase', 'ask', 'kérdés']);

    const output = errorSpy.mock.calls.flat().join('\n');
    expect(output).not.toContain('ANTHROPIC_API_KEY is not set.');
    expect(output).toContain('Váratlan hiba történt a futás során.');
    expect(output).toContain('Részletek:');
    expect(process.exitCode).toBe(1);

    errorSpy.mockRestore();
  });

  it('closes the read-only database pool after a successful run', async () => {
    process.env.ANTHROPIC_API_KEY = 'fake-key';

    const program = createProgram();
    await program.parseAsync(['node', 'ledgerbase', 'ask', 'kérdés']);

    expect(askAgentMock).toHaveBeenCalledTimes(1);
    expect(closeSpy).toHaveBeenCalledTimes(1);
  });
});
