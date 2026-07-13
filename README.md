# Ledgerbase

> Parancssori (CLI) AI agent, amely a természetes nyelvű kérdéseket SQL-lekérdezéssé alakítja egy könyvelőiroda operatív adatbázisa felett, azokat kizárólag read-only módban futtatja, majd rövid, magyar nyelvű választ ad. Önkiszolgáló operatív analitika SQL-tudás és manuális Excel-szűrés nélkül.

Az elsődleges felhasználó egy kis könyvelőiroda irodavezetője vagy senior könyvelője, aki gyorsan szeretné áttekinteni:

- a közelgő és lejárt határidőket;
- a nyitott vagy elakadt feladatokat;
- a hiányzó ügyféldokumentumokat;
- a munkatársak aktuális terhelését;
- az ügyfelekhez, időszakokhoz és feladatkategóriákhoz tartozó teendőket.

A Ledgerbase a kurzus HF1 scope-jában egyetlen, CLI-only TypeScript agent. A cél az agent működésének rétegről rétegre történő felépítése és megértése — agent-framework, frontend, külső könyvelési integráció és deployment nélkül.

---

## Hogyan működik?

```text
felhasználó kérdése
        │
        ▼
   apps/cli  ─────────────►  packages/core  (askAgent)
  (commander,                 │
   readline)                  │  1. system prompt
                              │     (séma + szabályok + aktuális dátum)
                              │  2. Anthropic messages.create
                              │  3. a modell toolt választ
                              │       ├──► runSql
                              │       └──► listTaskCategories
                              │  4. inputvalidáció + SQL-guard
                              │  5. READ-ONLY kapcsolat
                              │       └──► PostgreSQL
                              │  6. tooleredmény vissza a modellnek
                              ▼
                    magyar nyelvű válasz
                              +
                  logs/<timestamp>.jsonl
                              +
                      --show-prompt mód
```

A `packages/core` framework-agnostic: nem ismeri a belépési pontot, ezért a későbbi API- vagy webes felület új appként épülhet köré az agent-logika újraírása nélkül.

Az `askAgent` az Anthropic SDK fölé épülő, saját, többlépéses tool-use loop. A HF1-ben szándékosan nincs agent-framework, hogy az `LLM → tool → eredmény → következő modellhívás` mechanika látható és tesztelhető maradjon.

---

## L1 és L2

A projekt két réteget különít el:

- **L1 — amivel építünk:** Claude Code, MCP-szerverek, pluginek, skillek, hookok, permission mode és `CLAUDE.md`.
- **L2 — amit építünk:** a futó Ledgerbase TypeScript agent, az `askAgent` loop, a `runSql` és `listTaskCategories` toolok, a PostgreSQL adatbázis és a CLI.

Az L1-eszközök a fejlesztést támogatják, de nem kerülnek bele a futó termékbe. Az L2-komponensek a Ledgerbase szállított működésének részei.

---

## Többrétegű read-only védelem

Az agent nem módosíthat adatot. Ezt több, egymástól független kontroll biztosítja:

1. **Külön adatbázis-szerepkör**  
   A `runSql` és a `listTaskCategories` kizárólag a `DATABASE_URL_READONLY` kapcsolaton, ténylegesen read-only PostgreSQL role-lal fut.

2. **SQL-guard**  
   Csak egyetlen `SELECT` vagy `WITH … SELECT` statement engedélyezett. Író, DDL-, adminisztratív és több statementből álló SQL elutasítandó.

3. **Tábla-allowlist és eredménylimit**  
   Az agent kizárólag az engedélyezett Ledgerbase-táblákat használhatja, és a lista jellegű eredményeket korlátozni kell.

4. **Elkülönített read-write kapcsolat**  
   A `DATABASE_URL` kapcsolatot csak a Prisma séma-, migrációs és seedfolyamatai használják. Az agent futásidejű SQL-tooljai nem használhatják.

A system promptban szereplő „csak SELECT” szabály önmagában nem biztonsági kontroll; a jogosultságot kód- és adatbázisszinten is érvényesíteni kell.

---

## Adatmodell

A Ledgerbase v1 az alábbi fő adatköröket kezeli:

| Tábla | Tartalom |
|---|---|
| `employees` | Könyvelőirodai munkatársak és szerepkörük |
| `clients` | Ügyfelek, áfagyakoriság és felelős munkatárs |
| `task_categories` | Stabil kóddal rendelkező feladatkategóriák |
| `tasks` | Ügyfélhez, munkatárshoz és kategóriához rendelt feladatok |
| `document_requirements` | Időszakhoz kötött dokumentumkövetelmények és státuszok |

A seed kizárólag szintetikus adatot tartalmazhat. Valódi ügyfél-, munkavállalói, adózási vagy pénzügyi adat nem kerülhet a repositoryba, a tesztekbe vagy a naplókba.

Javasolt seedmennyiség:

- 5 munkatárs;
- körülbelül 30 ügyfél;
- 8 feladatkategória;
- 80–120 feladat;
- 60–100 dokumentumkövetelmény.

---

## Tech stack

| Réteg | Eszköz |
|---|---|
| Nyelv és runtime | TypeScript strict módban, Node LTS |
| Monorepo | Nx, pnpm workspaces |
| Agent | `@anthropic-ai/sdk` + saját tool-use loop |
| Validáció | Zod a rendszerhatárokon |
| CLI | commander + `node:readline` |
| Adatbázis | PostgreSQL, Docker Compose, Docker Desktop |
| Adatbázis-elérés | `pg` a read-only agent-toolokhoz |
| ORM és migráció | Prisma |
| Tooling | Vitest, ESLint, Prettier, tsx |

---

## Projektstruktúra

```text
ledgerbase/
├── apps/
│   └── cli/                  # ask parancs + interaktív mód
├── packages/
│   ├── core/                 # agent-loop, promptok, toolok, validáció, naplózás
│   │   └── src/
│   │       ├── agents/
│   │       ├── tools/
│   │       │   ├── run-sql/
│   │       │   └── list-task-categories/
│   │       └── logging/
│   └── db/                   # Prisma séma, migrációk, kliens és seed
├── docs/                     # BRS, architektúra, stack, workflow, implementációs terv
├── docker-compose.yml        # lokális PostgreSQL + DB-role-ok
└── CLAUDE.md                 # L1 projektkontextus a Claude Code számára
```

A CLI csak belépési és megjelenítési réteg. Agent-, SQL- és adatbázislogika nem kerülhet az `apps/cli` csomagba.

---

## Előfeltételek

- Node LTS;
- pnpm (`corepack enable`);
- Docker Desktop;
- WSL Windows használata esetén;
- Anthropic API-kulcs;
- `psql` opcionálisan, kézi adatbázis- és jogosultság-ellenőrzéshez.

A repositoryt, a Claude Code-ot, a pnpm parancsokat és a Docker Compose műveleteket Windows alatt ugyanabban a WSL-környezetben futtasd.

---

## Környezeti változók

A `.env` fájlt kézzel kell létrehozni a repo gyökerében, legalább az alábbi változókkal:

```dotenv
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=
DATABASE_URL=
DATABASE_URL_READONLY=
POSTGRES_DB=
POSTGRES_PORT=
POSTGRES_USER=
POSTGRES_PASSWORD=
POSTGRES_RO_USER=
POSTGRES_RO_PASSWORD=
```

A `POSTGRES_*` változókat a `docker-compose.yml` használja a helyi Postgres és a két DB-role (read-write + read-only) létrehozásához; ezeknek összhangban kell lenniük a `DATABASE_URL`/`DATABASE_URL_READONLY` connection stringekkel.

Biztonsági szabályok:

- a `.env` szerepeljen a `.gitignore` fájlban;
- valódi API-kulcs vagy adatbázis-jelszó ne kerüljön Gitbe;
- secret vagy teljes connection string ne kerüljön a konzolkimenetbe vagy a naplókba.

---

## Indulás

```bash
# 1. Függőségek telepítése
pnpm install

# 2. .env létrehozása és kitöltése (lásd fent)

# 3. PostgreSQL indítása
docker compose up -d

# 4. Adatbázisséma létrehozása
pnpm db:migrate

# 5. Szintetikus seed betöltése
pnpm db:seed

# 6. Ellenőrzés
pnpm build && pnpm typecheck && pnpm lint && pnpm test
pnpm cli ask "Mely ügyfeleknek van lejárt, még nyitott áfabevallási feladata, és ki a felelős könyvelőjük?"
```

A lokális PostgreSQL a `5433`-as porton fut (lásd `docker-compose.yml` / `.env`), hogy ne ütközzön egy esetleges már futó, alapértelmezett portú Postgres-szel.

---

## Használat

### Egyszeri kérdés

```bash
pnpm cli ask "Mely ügyfeleknek van lejárt, még nyitott áfabevallási feladata, és ki a felelős könyvelőjük?"
```

### Interaktív mód

```bash
pnpm cli ask
```

Az interaktív mód új kérdéseket fogad a kilépési parancsig.

### System prompt és üzenetstruktúra megjelenítése

```bash
pnpm cli ask --show-prompt "Melyik munkatársnak van a legtöbb nyitott feladata?"
```

### Saját tool demonstrálása

```bash
pnpm cli ask --show-prompt "Milyen feladatkategóriák vannak, és melyikhez tartozik a bérrel kapcsolatos munka?"
```

A futás során ellenőrizhetőnek kell lennie, hogy az agent a `listTaskCategories` toolt választotta, és nem hardcode-olt kategórialistából válaszolt.

### Súgó

```bash
pnpm cli --help
```

---

## Példakérdések

```text
Mely ügyfeleknek van határideje a következő 7 napban?

Mely feladatok jártak le, de még nincsenek lezárva?

Mely ügyfelektől hiányzik még a bankszámlakivonat?

Melyik munkatársnak van a legtöbb nyitott feladata?

Mutasd az Alfa Kft. összes aktuális feladatát.

Kinek van háromnál több lejárt feladata?
```

Relatív dátumot tartalmazó kérdésnél — például „ma”, „lejárt” vagy „a következő 7 napban” — az aktuális dátumnak explicit módon szerepelnie kell az agent kontextusában.

---

## Átláthatóság és auditálhatóság

Minden interakció JSONL formátumban naplózott:

```text
logs/<timestamp>.jsonl
```

A napló legalább az alábbi eseményeket vagy adatokat tartalmazza:

- futás- és modellazonosító;
- system prompt és üzenetek;
- toolválasztás és tool input;
- generált SQL;
- lekérdezési eredmény vagy annak biztonságosan korlátozott reprezentációja;
- tool- és modellhibák;
- végleges válasz;
- tokenhasználat, ha az SDK elérhetővé teszi.

A napló nem tartalmazhat:

- API-kulcsot;
- adatbázis-jelszót;
- teljes connection stringet;
- valódi személyes vagy ügyféladatot;
- indokolatlanul nagy, korlátozatlan lekérdezési eredményt.

---

## Hasznos scriptek

| Script | Feladat |
|---|---|
| `pnpm cli ask "…"` | Egyszeri CLI-kérdés |
| `pnpm cli ask` | Interaktív mód |
| `pnpm db:migrate` | Prisma migráció |
| `pnpm db:seed` | Szintetikus seed betöltése |
| `pnpm db:studio` | Prisma Studio |
| `pnpm build` | Minden Nx-projekt buildje |
| `pnpm typecheck` | TypeScript typecheck |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest tesztek |
| `pnpm format` | Prettier formázás |

Egy fejlesztési lépés csak akkor tekinthető késznek, ha az érintett build, typecheck, lint és tesztek sikeresen lefutottak.

---

## Implementációs fázisok

A projektet kis, ellenőrizhető lépésekben kell felépíteni:

1. **CLI echo**  
   A CLI visszaadja a bemenetet. Még nincs LLM és adatbázis.

2. **LLM-hívás adatbázis nélkül**  
   Az `askAgent` az Anthropic SDK-t használja. Adatkérdésnél nem talál ki választ, hanem jelzi, hogy még nincs adatbázis-hozzáférése.

3. **Read-only SQL-interakció**  
   A `runSql` toollal a természetes nyelvű kérdésből SQL készül, amely validálás után a read-only PostgreSQL-kapcsolaton fut.

4. **Saját domain-tool**  
   A `listTaskCategories` az adatbázis aktuális feladatkategóriáit adja vissza. Az agent kategóriaalapú kérdésnél ténylegesen ezt a toolt használja.

5. **Auditálhatóság és kész-kritérium**  
   JSONL naplózás, `--show-prompt`, kontrollált hibakezelés, build, typecheck, lint, tesztek és reprodukálható README.

Minden fázis külön, kis, fókuszált Conventional Commit legyen.

---

## Sikerkritériumok

A Ledgerbase v1 akkor tekinthető működőnek, ha:

- a teljes lánc működik: `CLI → askAgent → tool → SQL → read-only PostgreSQL → válasz`;
- valós seed adatok alapján helyes magyar választ ad a demo-kérdésre;
- a `listTaskCategories` tool bekötött, és az agent bizonyíthatóan használja;
- író SQL nem hajtható végre;
- az agent kizárólag a read-only DB-role-t használja;
- az üres eredményt hallucináció nélkül kezeli;
- a működés JSONL naplóból és `--show-prompt` módból visszakövethető;
- a build, typecheck, lint és a kapcsolódó tesztek sikeresen lefutnak;
- a repository nem tartalmaz secretet vagy valódi ügyféladatot.

Demo-kérdés:

```bash
pnpm cli ask "Mely ügyfeleknek van lejárt, még nyitott áfabevallási feladata, és ki a felelős könyvelőjük?"
```

Saját tool demo-kérdés:

```bash
pnpm cli ask --show-prompt "Milyen feladatkategóriák vannak, és melyikhez tartozik a bérrel kapcsolatos munka?"
```

---

## HF1 scope

### Benne van

- egyetlen CLI-only TypeScript agent;
- Nx monorepo;
- PostgreSQL Docker Compose-ban;
- Prisma séma, migráció és seed;
- saját, többlépéses agent-loop;
- `runSql` read-only tool;
- `listTaskCategories` saját tool;
- JSONL naplózás;
- `--show-prompt`;
- automatizált tesztek;
- javított és indokolt system prompt;
- legalább három releváns Claude Code plugin vagy skill.

### Nincs benne

- multi-agent rendszer;
- API vagy webes frontend;
- RAG;
- autentikáció és többfelhasználós jogosultságkezelés;
- NAV-, számlázó-, banki vagy más külső integráció;
- OCR és dokumentumfeldolgozás;
- adatírás;
- automatikus értesítés vagy eszkaláció;
- production deployment és monitoring.

---

## Dokumentáció

A projekt döntéseinek elsődleges dokumentumai:

- `brs-ledgerbase.md` — üzleti probléma, megoldás, scope és sikerkritériumok;
- `stack.md` — technológiai stack, adatbázisséma és seedcélok;
- `architektura.md` — komponensek, felelősségek és biztonsági határok;
- `konvenciok.md` — TypeScript-, fájlszervezési, tesztelési és naplózási szabályok;
- `dev-workflow.md` — branching, Conventional Commits, hookok és kész-kritérium;
- `implementation-plan.md` — a végrehajtott fázisolt terv (környezet + 5 implementációs fázis);
- az L2 agent tényleges system promptja kódban él: `packages/core/src/agents/ledgerbase/ledgerbase-prompt.ts` (séma, szabályok, toolok, példák).

> Megjegyzés: a `docs/roi.md` (pénzügyi megtérülés-levezetés) a BRS-ben tervezett, de még nem elkészült dokumentum — nem része a jelenlegi implementációnak.

A README a futtatás és az első belépés dokumentuma. Részletes architekturális vagy üzleti döntést ne duplikáljon indokolatlanul: arra a fenti forrásdokumentumok szolgálnak.

---

## Licenc

Nincs elég információm a repository választott licencéről. Licencszekciót csak a ténylegesen hozzáadott `LICENSE` fájl alapján véglegesíts.
