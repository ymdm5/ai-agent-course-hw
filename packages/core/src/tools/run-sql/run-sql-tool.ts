import { z } from 'zod';

import type { AgentTool } from '../../agents/agent-loop.js';
import type { ToolOutcome } from '../tool-outcome.js';
import { validateSql } from './sql-guard.js';

const RunSqlInputSchema = z.object({ sql: z.string().min(1) });

export interface RunSqlToolDeps {
  query: (sql: string) => Promise<Record<string, unknown>[]>;
}

export function createRunSqlTool(deps: RunSqlToolDeps): AgentTool {
  return {
    name: 'runSql',
    description:
      'Egyetlen, olvasásra korlátozott SQL SELECT vagy WITH ... SELECT lekérdezést futtat a Ledgerbase adatbázison. Csak az employees, clients, task_categories, tasks és document_requirements táblák érhetők el, és a lekérdezésnek kötelezően tartalmaznia kell egy LIMIT záradékot.',
    inputSchema: {
      type: 'object',
      properties: {
        sql: {
          type: 'string',
          description:
            'A futtatandó, teljes SELECT vagy WITH ... SELECT SQL utasítás, kötelező LIMIT záradékkal.',
        },
      },
      required: ['sql'],
    },
    execute: async (input: unknown): Promise<ToolOutcome<unknown>> => {
      const parsed = RunSqlInputSchema.safeParse(input);
      if (!parsed.success) {
        return {
          ok: false,
          error: 'Invalid runSql input: expected { sql: string }.',
          category: 'input_validation',
        };
      }

      const guardResult = validateSql(parsed.data.sql);
      if (!guardResult.valid) {
        return {
          ok: false,
          error: guardResult.reason,
          category: 'sql_guard_rejected',
        };
      }

      try {
        const rows = await deps.query(parsed.data.sql);
        return { ok: true, data: rows };
      } catch (error) {
        return {
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : 'Database error while running the query.',
          category: 'database_error',
        };
      }
    },
  };
}
