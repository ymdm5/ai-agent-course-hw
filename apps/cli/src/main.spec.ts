import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createProgram } from './main.js';

describe('createProgram ask action', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.ANTHROPIC_MODEL = 'claude-sonnet-5';
    process.env.DATABASE_URL_READONLY =
      'postgresql://user:pass@localhost:5432/db';
    delete process.env.ANTHROPIC_API_KEY;
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
});
