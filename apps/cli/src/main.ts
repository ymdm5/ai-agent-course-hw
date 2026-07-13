#!/usr/bin/env node
import 'dotenv/config';

import Anthropic from '@anthropic-ai/sdk';
import {
  askAgent,
  createAuditLogger,
  createListTaskCategoriesTool,
  createReadonlyDatabaseClient,
  createRunSqlTool,
} from '@ledgerbase/core';
import { Command } from 'commander';

import { runAskCommand } from './ask-command.js';
import { formatErrorMessage } from './format-error-message.js';
import { createJsonlFileSink } from './jsonl-file-sink.js';

function createAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set.');
  return new Anthropic({ apiKey });
}

function getModel(): string {
  const model = process.env.ANTHROPIC_MODEL;
  if (!model) throw new Error('ANTHROPIC_MODEL is not set.');
  return model;
}

function getReadonlyDatabaseUrl(): string {
  const url = process.env.DATABASE_URL_READONLY;
  if (!url) throw new Error('DATABASE_URL_READONLY is not set.');
  return url;
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
          const model = getModel();
          readonlyDb = createReadonlyDatabaseClient(getReadonlyDatabaseUrl());
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
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
