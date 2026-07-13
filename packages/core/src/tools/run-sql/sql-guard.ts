const ALLOWED_TABLES = new Set([
  'employees',
  'clients',
  'task_categories',
  'tasks',
  'document_requirements',
]);

const FORBIDDEN_KEYWORDS = [
  'INSERT',
  'UPDATE',
  'DELETE',
  'DROP',
  'ALTER',
  'TRUNCATE',
  'CREATE',
  'GRANT',
  'REVOKE',
  'COPY',
  'CALL',
  'VACUUM',
  'EXECUTE',
  'MERGE',
  'REPLACE',
  'RENAME',
];

const MAX_RESULT_LIMIT = 200;

export type SqlGuardResult = { valid: true } | { valid: false; reason: string };

export function validateSql(sql: string): SqlGuardResult {
  const statements = splitStatements(stripComments(sql));

  if (statements.length === 0) {
    return { valid: false, reason: 'Empty SQL statement.' };
  }
  if (statements.length > 1) {
    return { valid: false, reason: 'Only a single SQL statement is allowed.' };
  }

  const statement = statements[0].trim();

  if (!/^(SELECT|WITH)\b/i.test(statement)) {
    return {
      valid: false,
      reason: 'Only SELECT or WITH ... SELECT statements are allowed.',
    };
  }

  for (const keyword of FORBIDDEN_KEYWORDS) {
    if (new RegExp(`\\b${keyword}\\b`, 'i').test(statement)) {
      return { valid: false, reason: `Forbidden keyword: ${keyword}` };
    }
  }

  const allowedNames = new Set([
    ...ALLOWED_TABLES,
    ...extractCteNames(statement).map((name) => name.toLowerCase()),
  ]);
  for (const table of extractReferencedTables(statement)) {
    if (!allowedNames.has(table.toLowerCase())) {
      return { valid: false, reason: `Table not allowed: ${table}` };
    }
  }

  const limitMatch = /\bLIMIT\s+(\d+)\b/i.exec(statement);
  if (!limitMatch) {
    return { valid: false, reason: 'A LIMIT clause is required.' };
  }
  if (Number(limitMatch[1]) > MAX_RESULT_LIMIT) {
    return {
      valid: false,
      reason: `LIMIT exceeds the maximum allowed result size of ${MAX_RESULT_LIMIT}.`,
    };
  }

  return { valid: true };
}

// Strips -- line comments and /* */ block comments while respecting single-quoted
// string literals, so a forbidden statement can't hide inside a comment.
function stripComments(sql: string): string {
  let result = '';
  let inString = false;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (inString) {
      result += ch;
      if (ch === "'") inString = false;
      continue;
    }
    if (ch === "'") {
      inString = true;
      result += ch;
      continue;
    }
    if (ch === '-' && sql[i + 1] === '-') {
      while (i < sql.length && sql[i] !== '\n') i++;
      continue;
    }
    if (ch === '/' && sql[i + 1] === '*') {
      i += 2;
      while (i < sql.length && !(sql[i] === '*' && sql[i + 1] === '/')) i++;
      i++;
      continue;
    }
    result += ch;
  }
  return result;
}

// Splits on semicolons outside of string literals; a single trailing
// semicolon is allowed, but more than one non-empty statement is rejected.
function splitStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inString = false;
  for (const ch of sql) {
    if (inString) {
      current += ch;
      if (ch === "'") inString = false;
      continue;
    }
    if (ch === "'") {
      inString = true;
      current += ch;
      continue;
    }
    if (ch === ';') {
      if (current.trim().length > 0) statements.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim().length > 0) statements.push(current);
  return statements;
}

function extractReferencedTables(statement: string): string[] {
  const pattern = /\b(?:FROM|JOIN)\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi;
  return [...statement.matchAll(pattern)].map((match) => match[1]);
}

// CTE aliases (WITH name AS (...)) are not real tables but are legitimate
// references within the statement that defines them.
function extractCteNames(statement: string): string[] {
  const pattern = /([a-zA-Z_][a-zA-Z0-9_]*)\s+AS\s*\(/gi;
  return [...statement.matchAll(pattern)].map((match) => match[1]);
}
