# Ledgerbase — Implementációs terv

## Context

A repo jelenleg **kizárólag dokumentáció** (README.md + `docs/brs-ledgerbase.md`, `stack.md`, `architektura.md`, `konvenciok.md`, `dev-workflow.md`) — nincs `package.json`, `nx.json`, `packages/`, `apps/`, seed, teszt vagy Prisma-séma. Ez egy kurzus-házifeladat (HF1): egy CLI-only TypeScript AI agent ("Ledgerbase"), amely természetes nyelvű kérdést SQL-re fordít egy könyvelőirodai read-only adatbázis felett, és magyarul válaszol.

Tisztázott döntések:
- A domain-séma a dokumentált **Ledgerbase séma** (employees/clients/task_categories/tasks/document_requirements).
- A repóban a terv írásakor ténylegesen semmi nem volt kész — Part A a nulláról épít fel mindent.
- A terv **mind az 5 README-fázist** tartalmazza, mert a HF1 sikerkritériumok (`listTaskCategories`, JSONL log, `--show-prompt`) kötelezőek.
- A hiányzó, de hivatkozott fájlok (`CLAUDE.md`, `docker-compose.yml`) a Part A része; `system-prompt.md`-tartalom a B2 fázisban készül el (a promptba építve), `docs/roi.md` külön, dokumentációs feladatként. Külön `.env.example` sablon nem készül — a `.env` már létezik a repóban.

A build-sorrend (környezet → 5 fázis) azért ez, mert:
- `dev-workflow.md` minden lépéshez kis, önállóan ellenőrizhető Conventional Commitot ír elő ("egy lépés = egy commit"), a commit history értékelt — az infra és az agent-logika nem keveredhet egy commitba.
- `architektura.md` #13: minden új/ritkán használt library API-hoz előbb a hivatalos dokumentációt kell beolvasni, Context7-en keresztül.
- A README "Implementációs fázisok" pontosan ezt az 5 lépést írja elő, hogy az `LLM → tool → eredmény → következő hívás` mechanika minden lépésben látható és tesztelhető maradjon, és az agent sose hallucináljon adatbázis-hozzáférést, mielőtt az ténylegesen be van kötve (2. fázis explicit "őszinte nem tudok" ellenőrzés).
- `konvenciok.md` "egy fogalom = egy könyvtár" szabálya és a fájlnév-szuffixumok (`*-agent.ts`, `*-tool.ts`, `*-schema.ts`, `*-logger.ts`, `*.spec.ts`) adják az alábbi konkrét fájlelrendezést.
- A két DB-role / SQL-guard modell miatt (`stack.md`, `architektura.md` #3–4) a `packages/db` (Prisma, `DATABASE_URL`) már Part A-ban kell, de a futásidejű agent-toolok sose mennek Prismán keresztül — csak nyers `pg`-vel a `DATABASE_URL_READONLY` kapcsolaton.

---

## Part A — Környezet létrehozása (mérföldkő: "kész a környezet")

Minden al-lépés önállóan ellenőrizhető, és külön commitban zárul (`chore/...` vagy `feat/...` branch-eken, `dev-workflow.md` szerint, `main`-re sose közvetlenül).

**A0. Proposal dokumentum**
- `docs/implementation-plan.md` — ennek a tervnek a leirata a repóban.
- Commit: `docs: add Ledgerbase implementation plan`.

**A1. Nx + pnpm workspace scaffold**
- Context7 előbb: Nx workspace generators, pnpm workspaces.
- Fájlok: root `package.json`, `pnpm-workspace.yaml`, `nx.json`, `tsconfig.base.json`, `.gitignore` (`.env`, `dist`, `node_modules`, `logs/`).
- Üres Nx projektek: `apps/cli`, `packages/core`, `packages/db` (utóbbi NEM a repo gyökerén, `architektura.md` #11).
- Ellenőrzés: `pnpm install`; `pnpm exec nx show projects` mindhármat listázza; `packages/core` nem függ `apps/cli`-től.
- Commit: `chore: scaffold Nx + pnpm monorepo`.

**A2. Alap tooling**
- Context7 előbb: Vitest, ESLint flat config (TS), Prettier, tsx.
- Fájlok: `eslint.config.js`, `.prettierrc`, `vitest.config.ts`, projektenkénti `tsconfig.json` (strict mode kötelező), root scriptek: `build`, `typecheck`, `lint`, `test`, `format` (Nx run-many).
- Ellenőrzés: `pnpm typecheck && pnpm lint && pnpm test && pnpm format` mind lefut hibátlanul az üres scaffoldon.
- Commit: `chore: configure TypeScript, ESLint, Prettier, Vitest tooling`.

**A3. Docker Compose + env fájlok**
- Fájlok: `docker-compose.yml` (Postgres, stabil LTS image; init scriptben létrehozza a read-write és a ténylegesen read-only DB role-t, pl. `docker/init-readonly-role.sql` `GRANT SELECT`/`REVOKE` paranccsal). A `.env` (gitignored, már létezik a repóban) tartalmazza a szükséges változókat (`ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `DATABASE_URL`, `DATABASE_URL_READONLY`) — külön `.env.example` sablon nem készül.
- Ellenőrzés: `docker compose up -d`; `psql "$DATABASE_URL"` ír; `psql "$DATABASE_URL_READONLY"` egy manuális `INSERT`/`CREATE TABLE` kísérlete Postgres-szinten elutasításra kerül (ez az első konkrét bizonyíték, hogy a read-only role valódi, nem csak app-szintű konvenció).
- Commit: `chore: add Docker Compose PostgreSQL with read-write and read-only roles`.

**A4. packages/db — Prisma séma + migráció**
- Context7 előbb: Prisma schema szintaxis, migrate workflow, generált kliens.
- Fájl: `packages/db/prisma/schema.prisma` — 5 modell (`Employee`, `Client`, `TaskCategory`, `Task`, `DocumentRequirement`) pontosan a `stack.md` SQL-je szerint, indexekkel. Datasource kizárólag `DATABASE_URL`-t használ (sose `_READONLY`-t).
- Ellenőrzés: `pnpm db:migrate` létrehozza mind az 5 táblát + indexeket; generált Prisma kliens hibátlanul buildel.
- Commit: `feat: add Prisma schema and migration for Ledgerbase data model`.

**A5. Seed script + betöltés**
- Fájl: `packages/db/prisma/seed.ts` — szintetikus adat a célmennyiségek szerint (5 munkatárs mind a 4 role-lal, ~30 ügyfél mind a 4 `vat_frequency` értékkel, a 8 rögzített `task_categories`, 80–120 feladat változatos státusszal/prioritással, jövőbeli+lejárt határidőkkel, egyenetlen terheléssel, 60–100 `document_requirements` missing/received/verified keverékkel). Kell benne legalább egy determinisztikusan ellenőrizhető eset a demo-kérdéshez (lejárt, nyitott `vat_return` feladat konkrét ügyfélhez/munkatárshoz) és a kategória demo-kérdéshez (egyértelmű `payroll` sor).
- `pnpm db:seed` root script bekötve (tsx / `prisma db seed`).
- Ellenőrzés: `pnpm db:seed` idempotens; `psql` count-ellenőrzés; a demo-kérdés válasza kézzel is ellenőrizhető.
- Commit: `feat: add synthetic seed data for Ledgerbase`.

**A6. CLAUDE.md**
- Root `CLAUDE.md` — L1 kontextus Claude Code-nak: hivatkozás az 5 dokumentumra, a monorepo-elrendezésre, a két DB-role szabályra, és hogy `pnpm build/typecheck/lint/test` fusson minden commit előtt. Ezen a ponton stub, Part B alatt bővíthető.
- Commit: `docs: add CLAUDE.md project context for Claude Code`.

**A7. Üres apps/cli shell (logika nélkül)**
- Context7 előbb: commander.
- Fájl: `apps/cli/src/main.ts` — commander `ask` parancs (opcionális `<question>` pozíciós argumentum + `--show-prompt` flag), a handler egyelőre placeholder (a valódi echo a B1 fázisban jön). Root `pnpm cli` script.
- Ellenőrzés: `pnpm cli --help` mutatja az `ask` parancsot és a `--show-prompt` flaget; `pnpm cli ask "test"` lefut hiba nélkül.
- Commit: `feat: add empty CLI shell with ask command scaffold`.

**"Kész a környezet" — végső ellenőrzés (README "Indulás" szerint)**
```
pnpm install
docker compose up -d
pnpm db:migrate
pnpm db:seed
pnpm build && pnpm typecheck && pnpm lint && pnpm test
pnpm cli --help
```
Mindegyiknek hibátlanul le kell futnia, mielőtt Part B elkezdődik.

---

## Part B — Implementáció (5 fázis, ebben a sorrendben)

Minden fázis külön branch (`feat/cli-echo`, `feat/llm-no-db`, `feat/runsql-tool`, `feat/list-task-categories`, `feat/audit-logging`), kis fókuszált Conventional Commit(ok), és a fázis végén **explicit tesztelési checkpoint** a felhasználónál, mielőtt a következő indul.

### 1. fázis — CLI echo
- A CLI `ask` parancsa és az interaktív readline-mód is szó szerint visszaadja a beírt szöveget. Nincs LLM, nincs DB.
- Fájlok: `apps/cli/src/main.ts`, `apps/cli/src/ask-command.ts` (one-shot + readline loop), `apps/cli/src/*.spec.ts`.
- Tesztelhető increment: `pnpm cli ask "hello"` → `hello`; `pnpm cli ask` (argumentum nélkül) interaktív módba lép, több sort is elfogad, tisztán kilép.
- Commit: `feat: implement CLI echo command`.

### 2. fázis — LLM-hívás adatbázis nélkül
- Context7 előbb: `@anthropic-ai/sdk` (messages API, tool-use üzenetformátum).
- `packages/core` első valódi tartalma: `askAgent` az Anthropic SDK-t hívja, XML-szerű system prompttal (`<role>`, `<current_date>`, `<schema>`, `<rules>`, `<examples>`, `<question>`). Adatkérdésnél őszintén jelzi, hogy nincs még DB-hozzáférése (anti-hallucináció ellenőrzés).
- Fájlok: `packages/core/src/agents/agent-loop.ts`, `packages/core/src/agents/ledgerbase/ledgerbase-agent.ts`, `ledgerbase-prompt.ts`, megfelelő `*.spec.ts`-ek. `apps/cli` az `ask` handlerben mostantól `askAgent`-et hív echo helyett. Zod input-validáció (`AskInputSchema`).
- Tesztelhető increment: `pnpm cli ask "Mennyi 2+2?"` valódi Claude-választ ad; `pnpm cli ask "Mely ügyfeleknek van lejárt feladata?"` őszinte "nincs adatbázis-hozzáférésem" választ ad, nem kitalált listát.
- Commit(s): `feat: add askAgent Anthropic SDK integration without DB tools`.

### 3. fázis — Read-only SQL-interakció
- Context7 előbb: `pg` (node-postgres), és az Anthropic SDK tool-use üzenetformátum újraellenőrzése.
- `runSql` végponttól-végpontig bekötve: kérdés → generált SQL → SQL-guard validálja → futtatás `DATABASE_URL_READONLY`-n nyers `pg`-vel → eredmény vissza a modellnek → magyar válasz.
- Fájlok (`konvenciok.md` egy-fogalom-egy-könyvtár mintája szerint):
  - `packages/core/src/tools/tool-outcome.ts` (közös tool eredmény/hiba típus)
  - `packages/core/src/tools/run-sql/run-sql-tool.ts`
  - `packages/core/src/tools/run-sql/sql-guard.ts` — egyetlen statement, csak SELECT/WITH...SELECT, INSERT/UPDATE/DELETE/DDL/admin elutasítás, multi-statement elutasítás, komment/whitespace-álcázás elutasítása, tábla-allowlist, kötelező LIMIT.
  - `packages/core/src/tools/run-sql/readonly-database-client.ts` (kizárólag `DATABASE_URL_READONLY`).
  - `run-sql-tool.spec.ts` / `sql-guard.spec.ts` — a `konvenciok.md`-ben felsorolt összes guard-teszteset.
  - `ledgerbase-prompt.ts` frissítve: teljes `<schema>` és `<rules>` blokk, `<tools>` blokk a `runSql`-lel.
  - `agent-loop.ts` bővítve tool-dispatch-csal (egyetlen deklaratív tool-registry).
- Tesztelhető increment: a demo-parancs helyes, seed-adatból ellenőrizhető választ ad:
  ```
  pnpm cli ask "Mely ügyfeleknek van lejárt, még nyitott áfabevallási feladata, és ki a felelős könyvelőjük?"
  ```
  Negatív teszt: írási kísérlet (pl. prompt-injection DELETE-re) a guard szintjén elutasítva; integration teszt igazolja, hogy a `DATABASE_URL_READONLY` role Postgres-szinten is elutasítja az írást.
- Commit(s): `test: add SQL guard unit tests` → `feat: implement runSql tool with SQL guard` → `feat: wire runSql into ledgerbase agent loop and prompt`.

### 4. fázis — Saját domain-tool
- `listTaskCategories` — statikus/paraméterezett lekérdezés a `task_categories`-ből (read-only kapcsolat), az agent kategória-alapú kérdésnél ténylegesen ezt választja, nem hardcode-olt listát ad.
- Fájlok: `packages/core/src/tools/list-task-categories/list-task-categories-tool.ts`, `list-task-categories-schema.ts`, `list-task-categories-tool.spec.ts`. `ledgerbase-prompt.ts` `<tools>` blokkja mindkét toolt leírja; tool-registry bővítve.
- Tesztelhető increment:
  ```
  pnpm cli ask --show-prompt "Milyen feladatkategóriák vannak, és melyikhez tartozik a bérrel kapcsolatos munka?"
  ```
- Commit(s): `test: add listTaskCategories tool tests` → `feat: implement listTaskCategories tool` → `feat: register listTaskCategories in agent tool loop`.

### 5. fázis — Auditálhatóság és kész-kritérium
- JSONL naplózás minden futáshoz, teljes `--show-prompt` mód, kontrollált hibakezelés minden kategóriára, végső zöld build/typecheck/lint/test.
- Fájlok: `packages/core/src/logging/audit-logger.ts`, `audit-event-schema.ts`, `audit-logger.spec.ts`. `apps/cli` valódi `--show-prompt` viselkedés. Hibakategóriák (input-validáció, SQL-guard elutasítás, DB-hiba, tool-hiba, LLM/SDK-hiba, max-lépésszám) elkülönítve.
- Tesztelhető increment: minden `ask` futás után új `logs/<timestamp>.jsonl`, minden sor valid JSON, grep nem talál secretet; `--show-prompt` a teljes XML-tagelt promptot kiírja; `pnpm build && pnpm typecheck && pnpm lint && pnpm test` mind zöld.
- Commit(s): `feat: add JSONL audit logging` → `feat: implement --show-prompt mode` → `feat: add controlled error handling across agent and tools` → `docs: finalize README for reproducible setup`.

---

## Context7 lookup-térkép

| Lépés | Library docs |
|---|---|
| A1 | Nx workspace generators, pnpm workspaces |
| A2 | Vitest, ESLint flat config (TS), Prettier, tsx |
| A4 | Prisma (schema, migrate, generated client) |
| A7 | commander |
| B2 | `@anthropic-ai/sdk` (messages API, tool-use formátum) |
| B3 | `pg` (node-postgres), Anthropic SDK tool-result formátum |
| B4 | `@anthropic-ai/sdk` multi-tool selection (csak ha szükséges) |
| B5 | nincs új library |

## Végső, teljes ellenőrzés

```
pnpm install
docker compose up -d
pnpm db:migrate
pnpm db:seed
pnpm build && pnpm typecheck && pnpm lint && pnpm test
pnpm cli ask "Mely ügyfeleknek van lejárt, még nyitott áfabevallási feladata, és ki a felelős könyvelőjük?"
pnpm cli ask --show-prompt "Milyen feladatkategóriák vannak, és melyikhez tartozik a bérrel kapcsolatos munka?"
```
Ellenőrzendő: helyes ügyfél/feladat/munkatárs lista az elsőre; látható `listTaskCategories` hívás a másodikra; friss `logs/<timestamp>.jsonl` secret nélkül; manuális írási kísérlet a `DATABASE_URL_READONLY`-n Postgres-szinten is elbukik.

## Git-munkafolyamat

- Sose commitolunk közvetlenül `main`-re; minden al-lépés/fázis friss `main`-ből ágazó branchen (`chore/...` Part A-hoz, `feat/...` Part B fázisonként).
- Minden Part A al-lépés és minden Part B fázison belüli természetes bontás (piros teszt → zöld implementáció → bekötés) külön commit.
- `stage-N` branch-ek opcionálisan checkpoint-ként használhatók (`stage-1` = Part A vége, `stage-2..6` = fázisok vége), a feature branch-ek mellett, nem helyette.
- Merge előtt `main`-be: `pnpm build && pnpm typecheck && pnpm lint && pnpm test` mind zöld kell legyen (dev-workflow.md).

### Kritikus fájlok
- `docs/stack.md`, `docs/konvenciok.md`, `docs/architektura.md`, `docs/dev-workflow.md`, `docs/brs-ledgerbase.md`, `README.md`
