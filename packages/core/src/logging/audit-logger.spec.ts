import { describe, expect, it } from 'vitest';

import { createAuditLogger } from './audit-logger.js';

function fakeSink() {
  const lines: string[] = [];
  return { write: (line: string) => lines.push(line), lines };
}

describe('createAuditLogger', () => {
  it('writes one valid JSON line per logged event with an assigned timestamp', () => {
    const sink = fakeSink();
    const logger = createAuditLogger(sink);

    logger.log({
      runId: 'run-1',
      eventType: 'run_started',
      data: { question: 'hi' },
    });

    expect(sink.lines).toHaveLength(1);
    const parsed = JSON.parse(sink.lines[0] ?? '{}');
    expect(parsed.runId).toBe('run-1');
    expect(parsed.eventType).toBe('run_started');
    expect(typeof parsed.timestamp).toBe('string');
    expect(parsed.data).toEqual({ question: 'hi' });
  });

  it('writes each event as a single line (no embedded newlines)', () => {
    const sink = fakeSink();
    const logger = createAuditLogger(sink);

    logger.log({
      runId: 'run-1',
      eventType: 'final_answer',
      data: { answer: 'line1\nline2' },
    });

    expect(sink.lines).toHaveLength(1);
    expect(sink.lines[0]?.includes('\n')).toBe(false);
  });

  it('redacts values under secret-shaped keys even if accidentally passed in', () => {
    const sink = fakeSink();
    const logger = createAuditLogger(sink);

    logger.log({
      runId: 'run-1',
      eventType: 'error',
      data: {
        apiKey: 'sk-ant-super-secret',
        databaseUrl: 'postgresql://user:pass@host/db',
        message: 'something failed',
      },
    });

    const parsed = JSON.parse(sink.lines[0] ?? '{}');
    expect(parsed.data.apiKey).toBe('[REDACTED]');
    expect(parsed.data.databaseUrl).toBe('[REDACTED]');
    expect(parsed.data.message).toBe('something failed');
  });

  it('does not redact legitimate token usage fields', () => {
    const sink = fakeSink();
    const logger = createAuditLogger(sink);

    logger.log({
      runId: 'run-1',
      eventType: 'model_response',
      data: { inputTokens: 10, outputTokens: 5 },
    });

    const parsed = JSON.parse(sink.lines[0] ?? '{}');
    expect(parsed.data).toEqual({ inputTokens: 10, outputTokens: 5 });
  });

  it('throws (fails fast) for an event missing a required field', () => {
    const sink = fakeSink();
    const logger = createAuditLogger(sink);

    // @ts-expect-error runId intentionally omitted to test fail-fast validation
    expect(() => logger.log({ eventType: 'run_started' })).toThrow();
  });
});
