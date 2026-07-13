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

  // Scan for forbidden keywords with string-literal content masked out, so a
  // keyword can't (a) hide inside a comment (stripComments, above) or
  // (b) be mistaken for one because it appears inside a quoted search string.
  const maskedStatement = maskStringLiterals(statement);
  for (const keyword of FORBIDDEN_KEYWORDS) {
    if (new RegExp(`\\b${keyword}\\b`, 'i').test(maskedStatement)) {
      return { valid: false, reason: `Forbidden keyword: ${keyword}` };
    }
  }

  const ctes = extractCtes(statement);
  const referencedTables = extractReferencedTables(statement);

  if (referencedTables.length === 0) {
    return {
      valid: false,
      reason: 'The statement must reference at least one allowed table.',
    };
  }

  for (const table of referencedTables) {
    const cte = ctes.find(
      (c) => c.name.toLowerCase() === table.name.toLowerCase(),
    );
    if (cte) {
      // A non-recursive CTE's name is not visible inside its own body, so a
      // reference to it *within* its own defining span is not a legitimate
      // use of the CTE — it would resolve to a real table of the same name
      // in Postgres, which is exactly the bypass this check closes.
      const withinOwnBody =
        table.index >= cte.bodyStart && table.index < cte.bodyEnd;
      if (!withinOwnBody) continue;
    }
    if (!ALLOWED_TABLES.has(table.name.toLowerCase())) {
      return { valid: false, reason: `Table not allowed: ${table.name}` };
    }
  }

  const topLevelLimit = findTopLevelLimit(statement);
  if (topLevelLimit === null) {
    return { valid: false, reason: 'A LIMIT clause is required.' };
  }
  if (topLevelLimit > MAX_RESULT_LIMIT) {
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

// Replaces the *content* of single-quoted string literals with a character
// that can't match a keyword's \b...\b regex, while preserving the original
// length/positions (quotes and everything outside literals stay untouched).
function maskStringLiterals(sql: string): string {
  let result = '';
  let inString = false;
  for (const ch of sql) {
    if (inString) {
      if (ch === "'") {
        inString = false;
        result += ch;
      } else {
        result += '#';
      }
      continue;
    }
    if (ch === "'") {
      inString = true;
      result += ch;
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

interface TableReference {
  name: string;
  index: number;
}

// Matches identifiers (bare or double-quoted) introduced by FROM or JOIN,
// including comma-separated lists after FROM (old-style implicit joins).
function extractReferencedTables(statement: string): TableReference[] {
  const identifier = '(?:"[^"]+"|[a-zA-Z_][a-zA-Z0-9_]*)';
  const references: TableReference[] = [];

  const fromListPattern = new RegExp(
    `\\bFROM\\s+(${identifier}(?:\\s*,\\s*${identifier})*)`,
    'gi',
  );
  for (const match of statement.matchAll(fromListPattern)) {
    const listStart = match.index + match[0].indexOf(match[1]);
    let cursor = listStart;
    for (const part of match[1].split(',')) {
      const partIndex = statement.indexOf(part.trim(), cursor);
      references.push({
        name: normalizeIdentifier(part.trim()),
        index: partIndex,
      });
      cursor = partIndex + part.trim().length;
    }
  }

  const joinPattern = new RegExp(`\\bJOIN\\s+(${identifier})`, 'gi');
  for (const match of statement.matchAll(joinPattern)) {
    const index = match.index + match[0].indexOf(match[1]);
    references.push({ name: normalizeIdentifier(match[1]), index });
  }

  return references;
}

function normalizeIdentifier(identifier: string): string {
  return identifier.startsWith('"') && identifier.endsWith('"')
    ? identifier.slice(1, -1)
    : identifier;
}

interface CteDefinition {
  name: string;
  bodyStart: number;
  bodyEnd: number;
}

// Walks only the top-level WITH clause header (name AS ( ... ), name AS ( ... ), ...),
// tracking parenthesis depth so it never wanders into the final SELECT or a
// nested subquery. Returns each CTE's own body span so callers can tell a
// legitimate external reference to the CTE apart from a same-named reference
// inside the CTE's own (non-recursive) body.
function extractCtes(statement: string): CteDefinition[] {
  const withMatch = /^\s*WITH\s+/i.exec(statement);
  if (!withMatch) return [];

  const ctes: CteDefinition[] = [];
  let i = withMatch[0].length;

  for (;;) {
    while (i < statement.length && /\s/.test(statement[i])) i++;
    const identMatch = /^[a-zA-Z_][a-zA-Z0-9_]*/.exec(statement.slice(i));
    if (!identMatch) break;
    const name = identMatch[0];
    i += name.length;

    while (i < statement.length && /\s/.test(statement[i])) i++;
    const asMatch = /^AS\s*\(/i.exec(statement.slice(i));
    if (!asMatch) break;
    i += asMatch[0].length;
    const bodyStart = i;

    let depth = 1;
    while (i < statement.length && depth > 0) {
      if (statement[i] === '(') depth++;
      else if (statement[i] === ')') depth--;
      i++;
    }
    const bodyEnd = i - 1;
    ctes.push({ name, bodyStart, bodyEnd });

    while (i < statement.length && /\s/.test(statement[i])) i++;
    if (statement[i] === ',') {
      i++;
      continue;
    }
    break;
  }

  return ctes;
}

// Finds the LIMIT clause belonging to the outermost statement (parenthesis
// depth 0) — a LIMIT inside a subquery or CTE body must not stand in for the
// limit on what's actually returned to the caller.
function findTopLevelLimit(statement: string): number | null {
  const limitPattern = /\bLIMIT\s+(\d+)\b/gi;
  let result: number | null = null;
  for (const match of statement.matchAll(limitPattern)) {
    let depth = 0;
    for (let i = 0; i < match.index; i++) {
      if (statement[i] === '(') depth++;
      else if (statement[i] === ')') depth--;
    }
    if (depth === 0) {
      result = Number(match[1]);
    }
  }
  return result;
}
