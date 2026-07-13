import { z } from 'zod';

export const AuditEventSchema = z.object({
  timestamp: z.string(),
  runId: z.string().min(1),
  eventType: z.enum([
    'run_started',
    'model_request',
    'model_response',
    'tool_call',
    'tool_result',
    'final_answer',
    'error',
    'run_finished',
  ]),
  step: z.number().int().nonnegative().optional(),
  durationMs: z.number().nonnegative().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
});

export type AuditEvent = z.infer<typeof AuditEventSchema>;
export type AuditEventInput = Omit<AuditEvent, 'timestamp'>;
