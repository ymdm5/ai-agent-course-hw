import { describe, expect, it } from 'vitest';

import { validateSql } from './sql-guard.js';

describe('validateSql', () => {
  it('accepts a valid SELECT with a LIMIT', () => {
    const result = validateSql('SELECT id, name FROM clients LIMIT 50');
    expect(result).toEqual({ valid: true });
  });

  it('accepts a valid WITH ... SELECT with a LIMIT', () => {
    const result = validateSql(
      'WITH overdue AS (SELECT * FROM tasks WHERE due_date < current_date) SELECT * FROM overdue LIMIT 50',
    );
    expect(result).toEqual({ valid: true });
  });

  it.each([
    'INSERT',
    'UPDATE',
    'DELETE',
    'DROP',
    'ALTER',
    'TRUNCATE',
    'CREATE',
    'GRANT',
    'REVOKE',
  ])('rejects %s statements', (keyword) => {
    const result = validateSql(`${keyword} something on clients LIMIT 50`);
    expect(result.valid).toBe(false);
  });

  it('rejects multiple statements separated by a semicolon', () => {
    const result = validateSql(
      'SELECT * FROM clients LIMIT 50; DROP TABLE clients',
    );
    expect(result.valid).toBe(false);
  });

  it('allows a single trailing semicolon', () => {
    const result = validateSql('SELECT * FROM clients LIMIT 50;');
    expect(result).toEqual({ valid: true });
  });

  it('rejects a forbidden statement hidden after a line comment', () => {
    const result = validateSql(
      'SELECT * FROM clients LIMIT 50; -- ignore this\nDROP TABLE clients',
    );
    expect(result.valid).toBe(false);
  });

  it('rejects a forbidden statement hidden inside a block comment', () => {
    const result = validateSql(
      'SELECT * FROM clients /* sneaky */; DROP TABLE clients LIMIT 50',
    );
    expect(result.valid).toBe(false);
  });

  it('rejects a data-modifying CTE disguised as WITH ... SELECT', () => {
    const result = validateSql(
      'WITH deleted AS (DELETE FROM tasks RETURNING id) SELECT * FROM deleted LIMIT 50',
    );
    expect(result.valid).toBe(false);
  });

  it('rejects queries referencing a table outside the allowlist', () => {
    const result = validateSql('SELECT * FROM pg_shadow LIMIT 50');
    expect(result.valid).toBe(false);
  });

  it('rejects a disallowed table referenced with a double-quoted identifier', () => {
    const result = validateSql('SELECT * FROM "pg_shadow" LIMIT 50');
    expect(result.valid).toBe(false);
  });

  it('rejects a disallowed table introduced via a comma-join', () => {
    const result = validateSql('SELECT * FROM tasks, pg_settings LIMIT 50');
    expect(result.valid).toBe(false);
  });

  it('rejects a statement with no FROM/JOIN at all (e.g. a bare function call)', () => {
    const result = validateSql('SELECT pg_sleep(5) LIMIT 1');
    expect(result.valid).toBe(false);
  });

  it('rejects a CTE whose name collides with a disallowed table and self-references it', () => {
    const result = validateSql(
      'WITH pg_shadow AS (SELECT * FROM pg_shadow) SELECT * FROM pg_shadow LIMIT 5',
    );
    expect(result.valid).toBe(false);
  });

  it('rejects a query with no LIMIT clause', () => {
    const result = validateSql('SELECT * FROM clients');
    expect(result.valid).toBe(false);
  });

  it('rejects a query whose LIMIT exceeds the maximum allowed result size', () => {
    const result = validateSql('SELECT * FROM clients LIMIT 100000');
    expect(result.valid).toBe(false);
  });

  it('rejects an unbounded outer query even when an inner subquery has a small LIMIT', () => {
    const result = validateSql(
      'WITH x AS (SELECT id FROM tasks LIMIT 1) SELECT * FROM tasks WHERE id IN (SELECT id FROM x)',
    );
    expect(result.valid).toBe(false);
  });

  it('rejects an oversized outer LIMIT even when an inner subquery has a small LIMIT', () => {
    const result = validateSql(
      'SELECT * FROM tasks WHERE id > (SELECT id FROM tasks ORDER BY id LIMIT 1) LIMIT 5000',
    );
    expect(result.valid).toBe(false);
  });

  it('accepts a query with a legitimate top-level LIMIT even when a subquery also has a LIMIT', () => {
    const result = validateSql(
      'SELECT * FROM tasks WHERE id > (SELECT id FROM tasks ORDER BY id LIMIT 1) LIMIT 50',
    );
    expect(result).toEqual({ valid: true });
  });

  it('does not reject a query whose string literal happens to contain a forbidden keyword as a substring', () => {
    const result = validateSql(
      "SELECT * FROM clients WHERE name ILIKE '%Update Systems%' LIMIT 10",
    );
    expect(result).toEqual({ valid: true });
  });

  it('accepts the REPLACE() string function, which is not a Postgres write statement', () => {
    const result = validateSql(
      "SELECT REPLACE(name, 'Kft.', 'Kft') FROM clients LIMIT 10",
    );
    expect(result).toEqual({ valid: true });
  });
});
