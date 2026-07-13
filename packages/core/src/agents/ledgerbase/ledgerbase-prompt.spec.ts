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

  it('tells the model it has no database access yet and must not invent data', () => {
    const prompt = buildLedgerbaseSystemPrompt({ currentDate: '2026-07-13' });
    expect(prompt).toContain('nincs adatbázis-hozzáférésed');
    expect(prompt.toLowerCase()).toContain('ne találj ki');
  });
});

describe('buildUserMessage', () => {
  it('wraps the question in a question tag', () => {
    expect(buildUserMessage('Mennyi 2+2?')).toBe(
      '<question>\nMennyi 2+2?\n</question>',
    );
  });
});
