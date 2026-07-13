import { afterEach, describe, expect, it } from 'vitest';

import {
  createReadonlyDatabaseClient,
  type ReadonlyDatabaseClient,
} from './readonly-database-client.js';

// Integration test against the real local Postgres (docker compose up),
// using the actual read-only role — proves the database itself enforces
// read-only access, independent of the SQL guard.
const connectionString = process.env.DATABASE_URL_READONLY ?? '';

describe.skipIf(!connectionString)(
  'createReadonlyDatabaseClient (integration)',
  () => {
    const clients: ReadonlyDatabaseClient[] = [];

    function makeClient(): ReadonlyDatabaseClient {
      const client = createReadonlyDatabaseClient(connectionString);
      clients.push(client);
      return client;
    }

    afterEach(async () => {
      await Promise.all(clients.splice(0).map((client) => client.close()));
    });

    it('runs a SELECT against the read-only role and returns rows', async () => {
      const client = makeClient();
      const rows = await client.query(
        'SELECT code, name FROM task_categories LIMIT 5',
      );
      expect(Array.isArray(rows)).toBe(true);
      expect(rows.length).toBeGreaterThan(0);
    });

    it('rejects a write attempt at the Postgres level', async () => {
      const client = makeClient();
      await expect(
        client.query(
          "INSERT INTO task_categories (code, name) VALUES ('x', 'x')",
        ),
      ).rejects.toThrow();
    });

    it('closes the underlying connection pool via close()', async () => {
      const client = makeClient();
      await client.query('SELECT 1');

      await client.close();
      clients.splice(clients.indexOf(client), 1);

      await expect(client.query('SELECT 1')).rejects.toThrow();
    });
  },
);
