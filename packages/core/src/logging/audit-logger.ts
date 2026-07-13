import {
  AuditEventSchema,
  type AuditEvent,
  type AuditEventInput,
} from './audit-event-schema.js';
import { redactSecretsInString } from './secret-redaction.js';

export interface AuditSink {
  write: (line: string) => void;
}

export interface AuditLogger {
  log: (event: AuditEventInput) => void;
}

const SENSITIVE_KEY_PATTERN =
  /apikey|api_key|password|secret|connectionstring|connection_string|databaseurl|database_url|authorization/i;

export function createAuditLogger(sink: AuditSink): AuditLogger {
  return {
    log: (event: AuditEventInput) => {
      const full: AuditEvent = {
        timestamp: new Date().toISOString(),
        ...event,
      };
      const validated = AuditEventSchema.parse(full);
      sink.write(JSON.stringify(redact(validated)));
    },
  };
}

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, v]) => [
        key,
        SENSITIVE_KEY_PATTERN.test(key) ? '[REDACTED]' : redact(v),
      ]),
    );
  }
  if (typeof value === 'string') return redactSecretsInString(value);
  return value;
}
