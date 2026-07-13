import { describe, expect, it } from 'vitest';

import { AskInputSchema } from './ask-input-schema.js';

describe('AskInputSchema', () => {
  it('accepts a non-empty trimmed question', () => {
    const result = AskInputSchema.parse({ question: '  Mennyi 2+2?  ' });
    expect(result.question).toBe('Mennyi 2+2?');
  });

  it('rejects an empty question', () => {
    expect(() => AskInputSchema.parse({ question: '   ' })).toThrow();
  });
});
