import { describe, expect, it } from 'vitest';

import {
  buildLedgerbaseSystemPrompt,
  buildUserMessage,
} from './ledgerbase-prompt.js';

describe('buildLedgerbaseSystemPrompt', () => {
  it('includes the current date in a current_date tag', () => {
    const prompt = buildLedgerbaseSystemPrompt({ currentDate: '2026-07-13' });
    expect(prompt).toContain('<current_date>2026-07-13</current_date>');
  });

  it('includes the five allowed tables in a schema block', () => {
    const prompt = buildLedgerbaseSystemPrompt({ currentDate: '2026-07-13' });
    expect(prompt).toContain('<schema>');
    for (const table of [
      'employees',
      'clients',
      'task_categories',
      'tasks',
      'document_requirements',
    ]) {
      expect(prompt).toContain(table);
    }
  });

  it('describes the runSql tool in a tools block', () => {
    const prompt = buildLedgerbaseSystemPrompt({ currentDate: '2026-07-13' });
    expect(prompt).toContain('<tools>');
    expect(prompt).toContain('runSql');
  });

  it('tells the model to never invent data and to always use LIMIT', () => {
    const prompt = buildLedgerbaseSystemPrompt({ currentDate: '2026-07-13' });
    expect(prompt.toLowerCase()).toContain('ne találj ki');
    expect(prompt).toContain('LIMIT');
  });

  it('defines what "lejárt" (overdue) means relative to the current date', () => {
    const prompt = buildLedgerbaseSystemPrompt({ currentDate: '2026-07-13' });
    expect(prompt.toLowerCase()).toContain('lejárt');
    expect(prompt).toContain('due_date');
  });

  it('instructs the model to use ILIKE instead of guessing an exact code/name value', () => {
    const prompt = buildLedgerbaseSystemPrompt({ currentDate: '2026-07-13' });
    expect(prompt).toContain('ILIKE');
    expect(prompt.toLowerCase()).toContain('pontos');
  });

  it('includes a worked example querying by category name instead of a guessed code', () => {
    const prompt = buildLedgerbaseSystemPrompt({ currentDate: '2026-07-13' });
    expect(prompt).toContain('<examples>');
    expect(prompt).toContain('tc.name ILIKE');
  });
});

describe('buildUserMessage', () => {
  it('wraps the question in a question tag', () => {
    expect(buildUserMessage('Mennyi 2+2?')).toBe(
      '<question>\nMennyi 2+2?\n</question>',
    );
  });
});
