#!/usr/bin/env node
import 'dotenv/config';

import Anthropic from '@anthropic-ai/sdk';
import {
  askAgent,
  createAuditLogger,
  createListTaskCategoriesTool,
  createReadonlyDatabaseClient,
  createRunSqlTool,
  getErrorMessage,
} from '@ledgerbase/core';
import { Command } from 'commander';

import { runAskCommand } from './ask-command.js';
import { formatErrorMessage } from './format-error-message.js';
import { createJsonlFileSink } from './jsonl-file-sink.js';
import { requireEnv } from './require-env.js';

function createAnthropicClient(): Anthropic {
  return new Anthropic({ apiKey: requireEnv('ANTHROPIC_API_KEY') });
}

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
        const sink = createJsonlFileSink('logs');
        const logger = createAuditLogger(sink);
        let readonlyDb:
          ReturnType<typeof createReadonlyDatabaseClient> | undefined;

        try {
          const client = createAnthropicClient();
          const model = requireEnv('ANTHROPIC_MODEL');
          readonlyDb = createReadonlyDatabaseClient(
            requireEnv('DATABASE_URL_READONLY'),
          );
          const tools = [
            createRunSqlTool({ query: readonlyDb.query }),
            createListTaskCategoriesTool({ query: readonlyDb.query }),
          ];

          await runAskCommand(
            { question, showPrompt: options.showPrompt },
            {
              askAgent: (q) =>
                askAgent({ client, model, question: q, tools, logger }),
            },
          );
        } catch (error) {
          console.error(formatErrorMessage(error));
          console.error(`Részletek: ${sink.filePath}`);
          process.exitCode = 1;
        } finally {
          await readonlyDb?.close();
        }
      },
    );

  return program;
}

async function main(): Promise<void> {
  await createProgram().parseAsync(process.argv);
}

main().catch((error: unknown) => {
  console.error(getErrorMessage(error, String(error)));
  process.exitCode = 1;
});
