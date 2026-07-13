import { describe, expect, it, vi } from 'vitest';

import { createRunSqlTool } from './run-sql-tool.js';

describe('createRunSqlTool', () => {
  it('returns the query rows when the SQL passes the guard', async () => {
    const query = vi.fn(async () => [{ id: 1, name: 'Alfa Kft.' }]);
    const tool = createRunSqlTool({ query });

    const outcome = await tool.execute({
      sql: 'SELECT id, name FROM clients LIMIT 10',
    });

    expect(outcome).toEqual({ ok: true, data: [{ id: 1, name: 'Alfa Kft.' }] });
    expect(query).toHaveBeenCalledWith('SELECT id, name FROM clients LIMIT 10');
  });

  it('rejects a forbidden statement without calling the database, tagged as sql_guard_rejected', async () => {
    const query = vi.fn(async () => []);
    const tool = createRunSqlTool({ query });

    const outcome = await tool.execute({ sql: 'DROP TABLE clients' });

    expect(outcome.ok).toBe(false);
    expect(!outcome.ok && outcome.category).toBe('sql_guard_rejected');
    expect(query).not.toHaveBeenCalled();
  });

  it('rejects malformed tool input, tagged as input_validation', async () => {
    const query = vi.fn(async () => []);
    const tool = createRunSqlTool({ query });

    const outcome = await tool.execute({});

    expect(outcome.ok).toBe(false);
    expect(!outcome.ok && outcome.category).toBe('input_validation');
    expect(query).not.toHaveBeenCalled();
  });

  it('returns a database_error outcome when a returned row contains a value of an unexpected shape', async () => {
    const query = vi.fn(async () => [{ id: 1, weird: { nested: 'object' } }]);
    const tool = createRunSqlTool({ query });

    const outcome = await tool.execute({
      sql: 'SELECT id, weird FROM clients LIMIT 10',
    });

    expect(outcome.ok).toBe(false);
    expect(!outcome.ok && outcome.category).toBe('database_error');
  });

  it('returns a database_error outcome when the database query fails', async () => {
    const query = vi.fn(async () => {
      throw new Error('connection lost');
    });
    const tool = createRunSqlTool({ query });

    const outcome = await tool.execute({
      sql: 'SELECT id FROM clients LIMIT 10',
    });

    expect(outcome).toEqual({
      ok: false,
      error: 'connection lost',
      category: 'database_error',
    });
  });
});
