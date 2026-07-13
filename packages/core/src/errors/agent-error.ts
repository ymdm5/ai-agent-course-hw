export type AgentErrorCategory =
  | 'input_validation'
  | 'sql_guard_rejected'
  | 'database_error'
  | 'tool_execution_error'
  | 'llm_error'
  | 'max_steps_reached';

export class AgentError extends Error {
  readonly category: AgentErrorCategory;

  constructor(category: AgentErrorCategory, message: string) {
    super(message);
    this.name = 'AgentError';
    this.category = category;
  }
}
