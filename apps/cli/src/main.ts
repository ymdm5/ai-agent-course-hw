#!/usr/bin/env node
import { Command } from 'commander';

import { runAskCommand } from './ask-command.js';

export function createProgram(): Command {
  const program = new Command();

  program
    .name('ledgerbase')
    .description('Ledgerbase CLI agent')
    .version('0.0.1');

  program
    .command('ask')
    .description(
      'Ask a natural-language question about the Ledgerbase data, or start interactive mode',
    )
    .argument('[question]', 'one-shot question; omit to start interactive mode')
    .option(
      '--show-prompt',
      'print the full message structure sent to the model',
      false,
    )
    .action(
      async (
        question: string | undefined,
        options: { showPrompt: boolean },
      ) => {
        await runAskCommand({ question, showPrompt: options.showPrompt });
      },
    );

  return program;
}

async function main(): Promise<void> {
  await createProgram().parseAsync(process.argv);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
