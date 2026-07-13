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

  it('rejects a forbidden statement without calling the database', async () => {
    const query = vi.fn(async () => []);
    const tool = createRunSqlTool({ query });

    const outcome = await tool.execute({ sql: 'DROP TABLE clients' });

    expect(outcome.ok).toBe(false);
    expect(query).not.toHaveBeenCalled();
  });

  it('rejects malformed tool input', async () => {
    const query = vi.fn(async () => []);
    const tool = createRunSqlTool({ query });

    const outcome = await tool.execute({});

    expect(outcome.ok).toBe(false);
    expect(query).not.toHaveBeenCalled();
  });

  it('returns an error outcome when the database query fails', async () => {
    const query = vi.fn(async () => {
      throw new Error('connection lost');
    });
    const tool = createRunSqlTool({ query });

    const outcome = await tool.execute({
      sql: 'SELECT id FROM clients LIMIT 10',
    });

    expect(outcome).toEqual({ ok: false, error: 'connection lost' });
  });
});
