import { describe, expect, it, vi } from 'vitest';

import { createListTaskCategoriesTool } from './list-task-categories-tool.js';

describe('createListTaskCategoriesTool', () => {
  it('returns the task categories currently in the database', async () => {
    const query = vi.fn(async () => [
      {
        code: 'vat_return',
        name: 'Áfabevallás',
        description: 'Időszakos áfabevallás elkészítése és beküldése.',
      },
      {
        code: 'payroll',
        name: 'Bérszámfejtés',
        description: 'Havi bérszámfejtés és kapcsolódó bevallások.',
      },
    ]);
    const tool = createListTaskCategoriesTool({ query });

    const outcome = await tool.execute({});

    expect(outcome).toEqual({
      ok: true,
      data: [
        {
          code: 'vat_return',
          name: 'Áfabevallás',
          description: 'Időszakos áfabevallás elkészítése és beküldése.',
        },
        {
          code: 'payroll',
          name: 'Bérszámfejtés',
          description: 'Havi bérszámfejtés és kapcsolódó bevallások.',
        },
      ],
    });
  });

  it('queries via the read-only connection using a static, non-LLM-supplied query', async () => {
    const query = vi.fn(async (sql: string) => {
      void sql;
      return [];
    });
    const tool = createListTaskCategoriesTool({ query });

    await tool.execute({});

    expect(query).toHaveBeenCalledTimes(1);
    const sql = query.mock.calls[0]?.[0] ?? '';
    expect(sql).toContain('FROM task_categories');
    expect(sql).not.toContain(';;');
  });

  it('returns a controlled error outcome when the database query fails', async () => {
    const query = vi.fn(async () => {
      throw new Error('connection lost');
    });
    const tool = createListTaskCategoriesTool({ query });

    const outcome = await tool.execute({});

    expect(outcome).toEqual({ ok: false, error: 'connection lost' });
  });
});
