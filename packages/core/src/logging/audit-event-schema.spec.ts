import { describe, expect, it } from 'vitest';

import { AuditEventSchema } from './audit-event-schema.js';

describe('AuditEventSchema', () => {
  it('accepts a minimal valid event', () => {
    const result = AuditEventSchema.parse({
      timestamp: '2026-07-13T10:00:00.000Z',
      runId: 'run-1',
      eventType: 'run_started',
    });
    expect(result.eventType).toBe('run_started');
  });

  it('accepts an event with step, durationMs and a data payload', () => {
    const result = AuditEventSchema.parse({
      timestamp: '2026-07-13T10:00:00.000Z',
      runId: 'run-1',
      eventType: 'tool_call',
      step: 1,
      durationMs: 42,
      data: { toolName: 'runSql', input: { sql: 'SELECT 1' } },
    });
    expect(result.data).toEqual({
      toolName: 'runSql',
      input: { sql: 'SELECT 1' },
    });
  });

  it('rejects an unknown eventType', () => {
    expect(() =>
      AuditEventSchema.parse({
        timestamp: '2026-07-13T10:00:00.000Z',
        runId: 'run-1',
        eventType: 'something_else',
      }),
    ).toThrow();
  });

  it('rejects a missing runId', () => {
    expect(() =>
      AuditEventSchema.parse({
        timestamp: '2026-07-13T10:00:00.000Z',
        eventType: 'run_started',
      }),
    ).toThrow();
  });
});
