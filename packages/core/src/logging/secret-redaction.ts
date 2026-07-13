const CONNECTION_STRING_PATTERN = /\b(?:postgres|postgresql):\/\/\S+/gi;
const ANTHROPIC_KEY_PATTERN = /\bsk-ant-[a-zA-Z0-9_-]+/gi;

// Content-based redaction, complementing the key-based redaction in
// audit-logger.ts's redact(): a secret can appear inside a string value
// under an innocuous key (e.g. a raw `pg` error message under "error"),
// so both checks are needed.
export function redactSecretsInString(value: string): string {
  return value
    .replace(CONNECTION_STRING_PATTERN, '[REDACTED_CONNECTION_STRING]')
    .replace(ANTHROPIC_KEY_PATTERN, '[REDACTED_API_KEY]');
}
