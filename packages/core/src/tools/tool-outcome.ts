import type { AgentErrorCategory } from '../errors/agent-error.js';

export type ToolOutcome<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; category?: AgentErrorCategory };
