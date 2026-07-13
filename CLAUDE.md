# Ledgerbase — Claude Code project context (L1)

Ledgerbase is a CLI-only TypeScript AI agent that turns natural-language
questions into read-only SQL over a small accounting office's operative
database, and answers in Hungarian. Full context lives in `docs/` — read
these before implementing anything, in this order:

1. `docs/brs-ledgerbase.md` — business problem, scope, FR/NFR requirements.
2. `docs/stack.md` — tech stack and the exact database schema.
3. `docs/architektura.md` — module layout and the 14 architectural decisions.
4. `docs/konvenciok.md` — naming, TypeScript, testing, logging, security and
   system-prompt conventions. Treat this as binding, not advisory.
5. `docs/dev-workflow.md` — branching, commit, and done-criteria rules.
6. `docs/implementation-plan.md` — the phased build plan currently being executed.

## Monorepo layout

```
apps/cli/       commander CLI entry point — no business/SQL/DB logic here
packages/core/  agent loop, prompts, tools (runSql, listTaskCategories), logging
packages/db/    Prisma schema, migrations, seed — the only place using DATABASE_URL
```

`packages/core` must never import from `apps/cli`. `packages/db`'s Prisma client
is for migrations/seed only — the agent's runtime tools never go through Prisma.

## The two-DB-role rule

There are two Postgres connection strings, and mixing them up is the one
mistake that would break the project's core security requirement:

- `DATABASE_URL` — read-write. Used only by Prisma (migrate, seed, studio).
- `DATABASE_URL_READONLY` — a genuinely read-only Postgres role. Used only by
  the agent's `runSql` and `listTaskCategories` tools, via raw `pg`, never Prisma.

The SQL guard (single statement, SELECT/WITH...SELECT only, table allowlist,
result limit) is a second, independent layer — it does not replace the
database-level read-only role, and vice versa.

## Before committing

Run the checks relevant to what changed; before merging to `main`, all of
these must pass:

```
pnpm build
pnpm typecheck
pnpm lint
pnpm test
```

Follow `docs/dev-workflow.md` for branch naming and Conventional Commits —
one coherent step per commit, never a single commit for a whole phase.
