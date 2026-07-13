export interface AskCommandOptions {
  question?: string;
  showPrompt: boolean;
}

// Placeholder until Phase 1 (CLI echo); later phases wire this to askAgent.
export async function runAskCommand(options: AskCommandOptions): Promise<void> {
  console.log('ledgerbase ask: not implemented yet', options);
}
