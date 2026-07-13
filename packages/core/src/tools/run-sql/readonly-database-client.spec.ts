import { describe, expect, it } from 'vitest';

import { createReadonlyDatabaseClient } from './readonly-database-client.js';

// Integration test against the real local Postgres (docker compose up),
// using the actual read-only role — proves the database itself enforces
// read-only access, independent of the SQL guard.
const connectionString = process.env.DATABASE_URL_READONLY ?? '';

describe.skipIf(!connectionString)(
  'createReadonlyDatabaseClient (integration)',
  () => {
    it('runs a SELECT against the read-only role and returns rows', async () => {
      const client = createReadonlyDatabaseClient(connectionString);
      const rows = await client.query(
        'SELECT code, name FROM task_categories LIMIT 5',
      );
      expect(Array.isArray(rows)).toBe(true);
      expect(rows.length).toBeGreaterThan(0);
    });

    it('rejects a write attempt at the Postgres level', async () => {
      const client = createReadonlyDatabaseClient(connectionString);
      await expect(
        client.query(
          "INSERT INTO task_categories (code, name) VALUES ('x', 'x')",
        ),
      ).rejects.toThrow();
    });
  },
);
