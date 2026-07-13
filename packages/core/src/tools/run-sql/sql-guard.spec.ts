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

  it('rejects a query with no LIMIT clause', () => {
    const result = validateSql('SELECT * FROM clients');
    expect(result.valid).toBe(false);
  });

  it('rejects a query whose LIMIT exceeds the maximum allowed result size', () => {
    const result = validateSql('SELECT * FROM clients LIMIT 100000');
    expect(result.valid).toBe(false);
  });
});
