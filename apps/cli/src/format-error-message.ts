import {
  AgentError,
  redactSecretsInString,
  type AgentErrorCategory,
} from '@ledgerbase/core';

const CATEGORY_MESSAGES: Record<AgentErrorCategory, string> = {
  input_validation: 'Érvénytelen bemenet: a kérdés nem lehet üres.',
  sql_guard_rejected: 'A generált lekérdezést a biztonsági szűrő elutasította.',
  database_error: 'Adatbázis-hiba történt a lekérdezés végrehajtása közben.',
  tool_execution_error: 'Hiba történt egy eszköz futtatása közben.',
  llm_error: 'Hiba történt a nyelvi modell hívása közben.',
  max_steps_reached:
    'Az agent elérte a maximális lépésszámot végleges válasz nélkül.',
};

export function formatErrorMessage(error: unknown): string {
  if (error instanceof AgentError) {
    return `${CATEGORY_MESSAGES[error.category]} (${redactSecretsInString(error.message)})`;
  }
  return 'Váratlan hiba történt a futás során.';
}
