# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Ledgerbase is a CLI-only TypeScript AI agent (course project) that turns natural-language questions into **read-only SQL** over a small accounting office's operative database (`employees`, `clients`, `tasks`, `task_categories`, `document_requirements`) and answers in Hungarian. User-facing text, the domain vocabulary, and the system prompt are Hungarian; keep that convention when editing. Full context lives in `docs/` — read it before implementing anything non-trivial (see Reference docs below).

## Commands

Package manager is **pnpm**. Root scripts wrap Nx; prefer them.

```bash
# Build / test / lint / typecheck (all projects, via nx run-many)
pnpm build            # nx run-many -t build
pnpm typecheck        # nx run-many -t typecheck
pnpm lint             # nx run-many -t lint
pnpm test             # nx run-many -t test (Vitest)
pnpm format           # prettier --write .

# Per-project (Nx)
pnpm nx test @ledgerbase/core
pnpm nx test @ledgerbase/core -- run src/tools/run-sql/sql-guard.spec.ts
pnpm nx test @ledgerbase/core -- -t "rejects non-SELECT"

# Run the CLI in dev (tsx, no build step)
pnpm cli ask "Hány aktív ügyfél van?"
pnpm cli ask                        # interactive mode (readline; "exit"/"quit" to leave)
pnpm cli ask --show-prompt "..."    # also prints the exact system/user prompt sent to the model

# Database (Prisma, read-write connection — migrations/seed/studio only, never the agent runtime)
docker compose up -d
pnpm db:migrate
pnpm db:seed
pnpm db:studio
```

First-time setup: `pnpm install` → `cp .env.example .env` and fill `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `DATABASE_URL`, `DATABASE_URL_READONLY` → `docker compose up -d` → `pnpm db:migrate && pnpm db:seed`.

Before merging to `main`, all four checks (`build`, `typecheck`, `lint`, `test`) must pass. `main` is never committed to directly — see branch/commit rules in `docs/dev-workflow.md`.

## Architecture

Nx monorepo, three projects: **`apps/cli`** (`@ledgerbase/cli`, commander entry point — no business/SQL/DB logic lives here), **`packages/core`** (`@ledgerbase/core`, agent loop, prompt, tools, audit logging), **`packages/db`** (`@ledgerbase/db`, Prisma schema/migrations/seed + generated client).

`packages/core` must never import from `apps/cli`.

### The agent loop (`packages/core/src/agents/`)

`runAgentLoop` (`agent-loop.ts`) is a hand-rolled prompt → tool-call → tool-result → repeat cycle over the raw `@anthropic-ai/sdk` `messages.create` call — no agent framework, so the mechanics stay visible (`docs/architektura.md`, decision 5). One agent: `askAgent` (`agents/ledgerbase/ledgerbase-agent.ts`), whose system prompt is built by `buildLedgerbaseSystemPrompt` (`ledgerbase-prompt.ts`) as XML-tagged blocks (`<role>`, `<schema>`, `<rules>`, `<tools>`, `<examples>`) to reduce hallucination — e.g. the model is told explicitly that it doesn't know `task_categories.code`'s real values and must filter by `name`/`description` with `ILIKE` instead of guessing an exact code. Block-by-block rationale: `docs/system-prompt.md`.

Every tool call/result is written to an audit log (`logging/audit-logger.ts` + `audit-event-schema.ts`) with secrets redacted before anything hits disk (`secret-redaction.ts`); `apps/cli/src/jsonl-file-sink.ts` writes the JSONL under `logs/`.

### Tool layer (`packages/core/src/tools/`)

Two tools, one directory each, sharing `ToolOutcome` (`tools/tool-outcome.ts`: `{ ok: true; data }` | `{ ok: false; error; category }`). `execute` never throws — even a rejected call comes back as a normal (Hungarian-friendly) `tool_result`, never an uncaught exception reaching the model or the CLI.

- **`runSql`** (`tools/run-sql/`) — the model's only data-query path. `run-sql-tool.ts` validates input (Zod), runs the SQL through `sql-guard.ts`, then executes via `readonly-database-client.ts` (a plain `pg` `Pool` — never Prisma).
- **`listTaskCategories`** (`tools/list-task-categories/`) — a fixed, non-LLM-built query for the actual category rows, so the model never has to guess or hardcode a category name/code.

### SQL guard (`tools/run-sql/sql-guard.ts`)

Rejects anything but a single `SELECT` or `WITH ... SELECT` statement: strips comments and masks string literals before scanning for forbidden keywords (`INSERT`, `DROP`, `GRANT`, …), checks every referenced table against an allowlist (`employees`, `clients`, `task_categories`, `tasks`, `document_requirements`), and requires a top-level `LIMIT` (≤ 200). This is a second, independent layer — it does not replace the database-level read-only role, and vice versa.

### The two-DB-role rule — the core safety design

- `DATABASE_URL` — read-write. Used only by Prisma (`migrate`, `seed`, `studio`).
- `DATABASE_URL_READONLY` — a genuinely read-only Postgres role. Used only by the agent's `runSql`/`listTaskCategories` tools, via raw `pg`, never Prisma.

Mixing these up is the one mistake that would break the project's core security requirement. `packages/db`'s Prisma client is for migrations/seed only — the agent's runtime tools never go through Prisma.

### Database schema (`packages/db/prisma/schema.prisma`)

`employees` (accountants) ← `clients` (`assigned_employee_id`) → `tasks` / `document_requirements` (per-client work items with `due_date` + `status`), `task_categories` (fixed category catalog referenced by `tasks.category_id`). Full FR/NFR and schema rationale: `docs/brs-ledgerbase.md`, `docs/stack.md`.

## Reference docs

Read these in order before implementing anything non-trivial:

1. `docs/brs-ledgerbase.md` — business problem, scope, FR/NFR requirements.
2. `docs/stack.md` — tech stack and the exact database schema.
3. `docs/architektura.md` — module layout and the 14 architectural decisions.
4. `docs/konvenciok.md` — naming, TypeScript, testing, logging, security and system-prompt conventions. Binding, not advisory.
5. `docs/dev-workflow.md` — branching, commit, and done-criteria rules.
6. `docs/implementation-plan.md` — the phased build plan currently being executed.

Supporting docs: `docs/system-prompt.md` (block-by-block rationale for the actual system prompt) and `docs/roi.md` (the ROI estimate behind `brs-ledgerbase.md`'s business case).
