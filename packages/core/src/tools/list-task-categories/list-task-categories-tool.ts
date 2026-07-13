import type { AgentTool } from '../../agents/agent-loop.js';
import type { ToolOutcome } from '../tool-outcome.js';
import {
  ListTaskCategoriesInputSchema,
  ListTaskCategoriesOutputSchema,
  type TaskCategory,
} from './list-task-categories-schema.js';

export interface ListTaskCategoriesToolDeps {
  query: (sql: string) => Promise<Record<string, unknown>[]>;
}

// Static, constant query — never built from LLM input, unlike runSql.
const LIST_TASK_CATEGORIES_QUERY =
  'SELECT code, name, description FROM task_categories ORDER BY name LIMIT 50';

export function createListTaskCategoriesTool(
  deps: ListTaskCategoriesToolDeps,
): AgentTool {
  return {
    name: 'listTaskCategories',
    description:
      'Visszaadja a Ledgerbase adatbázisban ténylegesen elérhető feladatkategóriákat (code, name, description). Kategória-alapú kérdésnél ezt hívd — ne találj ki és ne hardcode-olj kategórianevet.',
    inputSchema: { type: 'object', properties: {} },
    execute: async (input: unknown): Promise<ToolOutcome<unknown>> => {
      const parsed = ListTaskCategoriesInputSchema.safeParse(input ?? {});
      if (!parsed.success) {
        return {
          ok: false,
          error: 'Invalid listTaskCategories input: expected no arguments.',
        };
      }

      try {
        const rows = await deps.query(LIST_TASK_CATEGORIES_QUERY);
        const categories: TaskCategory[] =
          ListTaskCategoriesOutputSchema.parse(rows);
        return { ok: true, data: categories };
      } catch (error) {
        return {
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : 'Database error while listing task categories.',
        };
      }
    },
  };
}
