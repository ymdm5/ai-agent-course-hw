import { Pool } from 'pg';

export interface ReadonlyDatabaseClient {
  query: (sql: string) => Promise<Record<string, unknown>[]>;
}

// Must only ever be constructed with DATABASE_URL_READONLY — never the
// read-write DATABASE_URL used by Prisma.
export function createReadonlyDatabaseClient(
  connectionString: string,
): ReadonlyDatabaseClient {
  const pool = new Pool({ connectionString });
  return {
    query: async (sql: string) => {
      const result = await pool.query(sql);
      return result.rows;
    },
  };
}
