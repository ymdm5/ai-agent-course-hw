# Ledgerbase — fejlesztői workflow + automatizmus

> Konkrét Git-szabályok, hook-konfigurációk és dokumentációs folyamat. L1 — amivel építünk: ezt is átadjuk a Claude Code-nak.

## Git

### Branching

- `main`: mindig zöld és futtatható állapotú. Közvetlenül a `main` branchre NEM commitolunk.
- Feature branch: `feat/<rövid-leírás>` — például `feat/runsql-tool`.
- Egyéb branch prefixek:
  - `fix/`
  - `refactor/`
  - `docs/`
  - `chore/`
- Dokumentációs példa: `docs/dev-workflow`.
- A kurzus checkpointjai (`stage-N`) külön branchek a fallbackhez.
- Egy branch egyetlen összefüggő változtatási célt szolgáljon.
- A munka megkezdése előtt a branchet a friss `main` ágból hozzuk létre.

Példa:

```bash
git switch main
git pull --ff-only origin main
git switch -c feat/runsql-tool
```

### Commit — Conventional Commits

Formátum:

```text
<típus>: <leírás>
```

Engedélyezett típusok:

- `feat`
- `fix`
- `refactor`
- `docs`
- `test`
- `chore`
- `perf`

Példák:

```text
feat: add read-only runSql tool
feat: add listTaskCategories tool
test: cover runSql SELECT-only guard
docs: add Ledgerbase development workflow
chore: configure Docker Compose for PostgreSQL
```

Szabályok:

- A leírás legyen rövid, konkrét és angol nyelvű.
- Egy commit egyetlen befejezett, koherens lépést tartalmazzon.
- Ne keverj egy commitba egymástól független funkciót, refaktort és dokumentációt.
- A commit history a házi feladat értékelésének része, ezért a nagy, mindent egyszerre tartalmazó commit nem elfogadható.

### Auto-commit

Minden befejezett, koherens lépés után kicsi, fókuszált commit készüljön:

```text
egy lépés = egy commit
```

A commit létrehozása előtt a változtatás típusának megfelelő ellenőrzéseket le kell futtatni. A commit-üzenetek elkészítését a `commit-commands` plugin segítheti, de a commit tartalmát és üzenetét a felhasználó review-za.

### Branch lezárása

A branch feltöltése:

```bash
git push -u origin <branch-név>
```

A változtatás Pull Requesten keresztül kerül a `main` branchbe. Merge előtt legalább az alábbi ellenőrzéseknek sikeresen kell lefutniuk:

```bash
pnpm build
pnpm typecheck
pnpm lint
pnpm test
```

A branch merge után törölhető.

## Hookok (`settings.json`)

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit",
        "hooks": [
          {
            "type": "command",
            "command": "pnpm prettier --write $FILE",
            "timeout": 10000,
            "async": true
          },
          {
            "type": "command",
            "command": "pnpm vitest related --run $FILE",
            "timeout": 60000,
            "async": true
          }
        ]
      }
    ]
  }
}
```

- **Prettier** — `PostToolUse`, `Edit`: automatikus formázás a Claude Code által végzett szerkesztés után.
- **Vitest** — `PostToolUse`, `Edit`: az adott változtatáshoz kapcsolódó tesztek futtatása.

FONTOS: ezek a hookok a **Claude Code L1-műveleteit** fogják meg — vagyis azt, amit Claude szerkeszt vagy futtat. Nem a Ledgerbase termék futásidejű SQL-műveleteit ellenőrzik.

A Ledgerbase L2 read-only védelmét az alábbiak biztosítják:

- külön `DATABASE_URL_READONLY`;
- tényleges read-only PostgreSQL role;
- SQL-guard;
- egyetlen engedélyezett olvasási statement;
- engedélyezett táblák allowlistje;
- eredménylimit.

A `runSql` a futó termék része, nem Claude Code tool, ezért a biztonságát nem L1 hookkal kell megoldani.

### Windows / WSL

A projekt Windows alatt WSL-ben fut. A hookokat, a `pnpm` parancsokat, a Git-műveleteket és a Docker Compose parancsokat ugyanabban a WSL-környezetben kell futtatni, ahol a Claude Code és a repository is elérhető.

A hookokban használt shell-parancsokat ne PowerShell-specifikus szintaxissal írjuk.

## Claude Code pluginek és MCP-szerverek

A `.claude/settings.json` engedélyezett pluginjei és a `.mcp.json` MCP-szerverei nem
alapértelmezésből kerültek be, hanem konkrét, ismétlődő fejlesztési igényt fedeznek le:

- **`superpowers`** — a projekt fejlesztési folyamata (dokumentum-elsőségű tervezés,
  fázisos build, TDD, systematic debugging, code review checkpointok) erre a skill-keretre
  épül; enélkül ezek a lépések ad-hoc, session-ről session-re változó módon futnának.
- **`commit-commands`** — a Conventional Commits-formátumú, egy-lépés-egy-commit
  fegyelmet (lásd fent) segíti commit-üzenet generálással; a commit tartalmát és
  üzenetét ettől függetlenül mindig a felhasználó review-zza, a plugin csak a
  formázási/összefoglalási terhet veszi le.
- **`skill-creator`** — a projekt-specifikus skillek (pl. a `/docs`-frissítést végző
  `ddd-audit`) létrehozásához és karbantartásához kell; ezek nem a Claude Code
  beépített skilljei, hanem a Ledgerbase-hez írt, saját folyamatot kódoló skillek.

MCP-szerverek (`.mcp.json`, project scope):

- **`github`** — PR- és issue-műveletek a Claude Code-on belülről, hogy a
  branch/PR-workflow (lásd fent) ne igényeljen külön böngészőváltást.
- **`prisma`** — séma- és migrációvizsgálat a `DATABASE_URL` (read-write) kapcsolaton;
  kizárólag a Prisma-oldalhoz kötött, sosem az agent futásidejéhez — összhangban a
  README-ben és `architektura.md`-ban rögzített két-DB-role szabállyal.
- **`postgres`** — ad-hoc, Claude Code-on belüli adatbázis-vizsgálathoz a
  `DATABASE_URL_READONLY`-t olvassa a környezetből, nem a connection stringet a
  `.mcp.json`-ba égetve. Ez ugyanazt a két-DB-role elvet tartja be a fejlesztői
  eszköz szintjén is, amit az agent `runSql` toolja a futásidőben: még a Claude
  Code saját, exploratív lekérdezései sem tudnak írni az adatbázisba.

## `/docs` — dokumentáció a repositoryban

```text
docs/
├── ddd/
│   ├── glossary.md        ubiquitous language
│   │                      ügyfél, munkatárs, feladat, feladatkategória,
│   │                      határidő, dokumentumkövetelmény, státusz
│   └── model.md           entitások, value objectek, relációk és aggregátumok
└── tech/
    ├── infra.md           PostgreSQL Docker Desktop + Docker Compose,
    │                      .env és a két DB-kapcsolat
    ├── architecture.md    core/apps/db felosztás,
    │                      read-only adat-elérés vs. Prisma
    └── api.md             tool- és CLI-felület:
                           ask, runSql, listTaskCategories
```

### Dokumentációs felelősségek

- `docs/ddd/glossary.md`
  - a Ledgerbase üzleti fogalmai;
  - a technikai kódok és magyar megjelenítési nevek;
  - a státuszok pontos jelentése;
  - a félreérthető fogalmak kizárása.

- `docs/ddd/model.md`
  - `Employee`;
  - `Client`;
  - `TaskCategory`;
  - `Task`;
  - `DocumentRequirement`;
  - relációk és üzleti invariánsok.

- `docs/tech/infra.md`
  - Docker Desktop;
  - Docker Compose;
  - PostgreSQL;
  - read-write és read-only role;
  - `.env` és `.env.example`;
  - lokális indítás és leállítás.

- `docs/tech/architecture.md`
  - `packages/core`;
  - `packages/db`;
  - `apps/cli`;
  - agent loop;
  - tool-dispatch;
  - JSONL naplózás;
  - adatbiztonsági határok.

- `docs/tech/api.md`
  - `ledgerbase ask`;
  - interaktív CLI;
  - `runSql`;
  - `listTaskCategories`;
  - tool input/output sémák;
  - tipikus hibaeredmények.

## Dokumentáció-frissítés

A `/docs` frissítését a **`ddd-audit` skill** végzi a Git history és az aktuális kód alapján, külön, igény szerint futtatva.

A HF1 elején:

- nem készítünk külön dokumentációfrissesség-ellenőrző scriptet;
- nem készítünk dokumentációs `Stop` hookot;
- nem építünk CI-alapú dokumentációs gate-et.

A CI-alapú változat a kurzus későbbi, always-on / CI-CD szakaszában kerül be.

A `ddd-audit` eredményét nem fogadjuk el automatikusan. A generált dokumentációt review-zni kell abból a szempontból, hogy:

- megfelel-e az aktuális kódnak;
- nem talál-e ki nem létező komponenst;
- nem tartalmaz-e secretet vagy személyes adatot;
- nem lépi-e túl a HF1 scope-ját;
- megkülönbözteti-e az L1 és L2 elemeket.

## Kész-kritérium egy fejlesztési lépéshez

Egy lépés akkor tekinthető késznek, ha:

1. a változtatás egyértelműen kapcsolódik az adott branch céljához;
2. az érintett build, typecheck, lint és tesztek sikeresen lefutnak;
3. a változtatás nem gyengíti a read-only vagy secret-kezelési kontrollokat;
4. a szükséges dokumentáció frissült;
5. a diff review-zott;
6. kis, fókuszált Conventional Commit készült.
