export type ToolOutcome<T> =
  { ok: true; data: T } | { ok: false; error: string };
