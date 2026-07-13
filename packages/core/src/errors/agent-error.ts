// Two families share this type, and only the first is ever thrown as a
// fatal AgentError:
//   - fatal: input_validation, llm_error, max_steps_reached — the run
//     cannot continue, so these abort the agent loop.
//   - recoverable: sql_guard_rejected, database_error, tool_execution_error
//     — these only ever appear on ToolOutcome.category and are fed back to
//     the model as a tool_result, so it can see the failure and react (e.g.
//     explain a rejected query) instead of the whole run aborting.
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
