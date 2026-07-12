# Ledgerbase — kódkonvenciók és best practice-ek

> A konvenciók túlnyomó része projektfüggetlen, és bármely TypeScript projektre alkalmazható. A Ledgerbase-specifikus architekturális döntéseket az `architektura.md`, az adatmodellt és a technológiai stacket a `stack.md`, az agent SQL- és válaszadási szabályait a `system-prompt.md` tartalmazza. Ezt a dokumentumot 1:1 átadjuk a Claude Code-nak.

## Naming

- `camelCase` változóhoz és függvényhez, `PascalCase` típushoz, interfészhez és osztályhoz, `UPPER_SNAKE_CASE` konstanshoz.
- Használj beszédes, domainhez illeszkedő neveket.
- Boolean változó neve `is`, `has` vagy `can` prefixszel kezdődjön.
- A függvénynév igével kezdődjön, például `listTaskCategories`, `validateSql`, `writeAuditLog`.
- Fájlnév: `kebab-case`.
- Egy fájl egyetlen, jól körülhatárolt felelősséget kapjon.
- **A fájlnév hordozza a szerepét is.** A típus-utótagból ránézésre legyen egyértelmű, mi található benne:
  - `*-agent.ts`
  - `*-tool.ts`
  - `*-prompt.ts`
  - `*-schema.ts`
  - `*-logger.ts`
  - `*.spec.ts`
- Ne legyen két, csak szórendben eltérő név két különböző fogalomra. Például:
  - `run-sql-tool.ts` — az L2 tool;
  - `readonly-database-client.ts` — az adatbázis-kliens;
  - ne legyen mellette egy félreérthető `sql-runner.ts`, ha ugyanazt vagy majdnem ugyanazt jelenti.
- A kódbeli technikai azonosítók angol nyelvűek legyenek. A felhasználói szövegek és a domain megjelenítési nevei lehetnek magyarok.

## TypeScript

- A TypeScript `strict` módja kötelező.
- A publikus API-kon használj explicit típusokat; lokális implementációban elegendő a biztonságos típus-inferencia.
- Külső vagy megbízhatatlan input típusa `unknown`, nem `any`.
- Az `unknown` értéket használat előtt biztonságosan szűkítsd vagy validáld.
- `interface` objektumalakhoz, amely később bővülhet.
- `type` unióhoz, intersectionhöz és utility típusokhoz.
- String literal union használata előnyben részesítendő `enum` helyett.
- Használj `readonly` típust, ahol a módosítás nem szükséges.
- Preferáld az immutábilis adatkezelést:

  ```ts
  // rossz
  task.status = 'completed';

  // jó
  const completedTask = {
    ...task,
    status: 'completed' as const,
  };
  ```

- Ne használj indokolatlan type assertiont (`as`) a validáció megkerülésére.
- Ne használj `@ts-ignore` vagy `@ts-expect-error` megjegyzést dokumentált és indokolt eset nélkül.
- A típushibát ne az ellenőrzés kikapcsolásával, hanem a gyökérok javításával oldd meg.

## Hibakezelés

- Aszinkron rendszerhatárokon használj kontrollált `try/catch` hibakezelést.
- Az elkapott hiba típusa `unknown`; szűkítsd például `instanceof Error` ellenőrzéssel.
- Ne nyeld el a hibát némán.
- A felhasználó rövid, érthető CLI-hibaüzenetet kapjon.
- A strukturált auditlog tartalmazza a technikai hibakategóriát és a szükséges diagnosztikai adatokat.
- Secret, adatbázis-jelszó, connection string, API-kulcs vagy teljes környezeti konfiguráció nem kerülhet hibaüzenetbe vagy naplóba.
- Validálj minden rendszerhatáron Zoddal, és alkalmazz fail-fast működést:

  ```ts
  import { z } from 'zod';

  export const AskInputSchema = z.object({
    question: z.string().trim().min(1),
  });
  ```

- Különítsd el legalább az alábbi hibakategóriákat:
  - inputvalidációs hiba;
  - SQL-guard elutasítás;
  - adatbázis-hiba;
  - tool-végrehajtási hiba;
  - LLM- vagy SDK-hiba;
  - maximális agent-lépésszám elérése.
- A hibákat ne általános `catch` blokkal alakítsd automatikusan sikeres válasszá.

## Tesztelés

- TDD ott, ahol értelmes: piros teszt → minimális zöld implementáció → refaktor.
- Tesztszintek:
  - unit teszt a tiszta függvényekhez és guardokhoz;
  - integration teszt a PostgreSQL- és tool-integrációhoz;
  - black-box CLI/E2E teszt a kritikus `ledgerbase ask` folyamatra.
- A HF1 CLI-only scope-jában a Playwright nem szükséges. Webes felület esetén később használható.
- Egy teszt egyetlen viselkedést ellenőrizzen.
- Használj beszédes tesztneveket:

  ```ts
  it('should reject UPDATE statements before database execution', () => {
    // ...
  });
  ```

- A tesztek legyenek determinisztikusak és izoláltak.
- Ne függjenek:
  - külső API aktuális állapotától;
  - kontrollálatlan globális állapottól;
  - véletlenszerű futási sorrendtől;
  - a valódi rendszeridőtől.
- Dátumfüggő üzleti logikához injektálható clockot vagy rögzített referenciaidőt használj.
- Az SQL-guard tesztjei legalább az alábbi eseteket fedjék:
  - érvényes `SELECT`;
  - érvényes `WITH … SELECT`;
  - `INSERT`, `UPDATE`, `DELETE`, DDL és adminisztratív parancs tiltása;
  - több SQL statement tiltása;
  - kommenttel vagy whitespace-szel álcázott tiltott utasítás;
  - nem engedélyezett tábla használata;
  - eredménylimit kezelése.
- A `listTaskCategories` toolhoz legyen teszt arra, hogy:
  - a read-only kapcsolatot használja;
  - az adatbázis aktuális kategóriáit adja vissza;
  - nem hardcode-olt értékkészletet szolgáltat;
  - adatbázishiba esetén kontrollált tool-hibát ad.
- Cél: legalább 80% lefedettség, de a kritikus biztonsági útvonalakon a branch coverage fontosabb, mint az összesített százalék.

## Fájlszervezés

- Használj sok kis, fókuszált fájlt.
- Irányadó méret: 200–400 sor; 800 sor felett bontás szükséges, kivéve dokumentált indok esetén.
- Magas kohézió, alacsony csatolás.
- Feature vagy domain szerint szervezz, ne pusztán technikai típus szerint.
- Kerüld a négy szintnél mélyebb kódbeágyazást; használj korai returnt.
- **Egy fogalom = egy könyvtár, benne minden hozzávalója.**
- Minden agent és minden tool saját könyvtárat kapjon a hozzá tartozó:
  - sémával;
  - guarddal;
  - klienssel vagy adapterrel;
  - implementációval;
  - tesztekkel.
- A közös kód eggyel kijjebb, a fogalmak szintjén lakjon.
- A könyvtárstruktúra legyen a rendszer térképe: ami könyvtár, az egy konkrét fogalom vagy példány; ami közös fájl, az a közös alap.
- A teszt a tesztelt kód mellett lakjon, ne külön tesztfában.

Példa:

```text
packages/core/src/
├── agents/
│   ├── agent-loop.ts
│   └── ledgerbase/
│       ├── ledgerbase-agent.ts
│       ├── ledgerbase-prompt.ts
│       └── ledgerbase-agent.spec.ts
├── tools/
│   ├── tool-outcome.ts
│   ├── run-sql/
│   │   ├── run-sql-tool.ts
│   │   ├── sql-guard.ts
│   │   └── run-sql-tool.spec.ts
│   └── list-task-categories/
│       ├── list-task-categories-tool.ts
│       ├── list-task-categories-schema.ts
│       └── list-task-categories-tool.spec.ts
└── logging/
    ├── audit-logger.ts
    └── audit-event-schema.ts
```

- Új tool bekötése lehetőleg egyetlen deklaratív toolset-bejegyzés legyen.
- Ne legyen több, egymással párhuzamosan karbantartandó tool-registry vagy dispatch-tábla.
- A `packages/core` nem importálhat az `apps/cli` csomagból.
- Az `apps/cli` csak belépési pont és megjelenítési réteg; agent-, SQL- és adatbázislogika nem kerülhet bele.
- A Prisma séma, migráció, kliens és seed a `packages/db` csomagban maradjon.

## Naplózás

- A core termékkódban ne használj ad hoc `console.log` hívásokat.
- Használj strukturált loggert és validált audit event sémákat.
- A CLI felhasználói kimenete külön output boundaryn keresztül történjen.
- Minden auditbejegyzés egyetlen JSON-objektum legyen egy sorban.
- Az események legalább az alábbi közös mezőket tartalmazzák:
  - `timestamp`;
  - `runId`;
  - `eventType`;
  - `step`;
  - `durationMs`, ahol értelmezhető.
- A logból legyen visszakövethető:
  - a user input;
  - a modellnek adott kontextus;
  - a toolválasztás;
  - a tool input;
  - a generált SQL;
  - a tool eredménye;
  - a végleges válasz;
  - a hiba;
  - a tokenhasználat, ha az SDK biztosítja.
- Ne naplózz:
  - API-kulcsot;
  - adatbázis-jelszót;
  - teljes connection stringet;
  - `.env` tartalmat;
  - indokolatlanul nagy vagy érzékeny payloadot.
- A strukturált log ne legyen egyben felhasználói felület. A CLI-válasz és az auditlog eltérő felelősség.

## Biztonság

- Minden secret környezeti változóban legyen.
- A `.env` szerepeljen a `.gitignore` fájlban.
- A `.env.example` csak változóneveket és biztonságos mintákat tartalmazhat.
- Minden külső adat megbízhatatlan:
  - user input;
  - LLM-output;
  - tool input;
  - adatbázis-eredmény;
  - API-válasz;
  - konfigurációs környezeti változó.
- A rendszerhatárokon Zod-validáció kötelező.
- Alkalmazás által összeállított lekérdezésnél használj paraméterezett SQL-t.
- A `runSql` tool esetén az LLM teljes SQL statementet ad át. Ehhez:
  - soha ne fűzz hozzá user inputot vagy más stringet konkatenációval;
  - a teljes statementet a SQL-guard validálja;
  - kizárólag a read-only adatbázis-kapcsolat hajthatja végre;
  - csak egyetlen olvasási statement engedélyezett;
  - engedélyezett táblák allowlistje szükséges;
  - eredménylimit szükséges.
- A `listTaskCategories` tool paraméterezett vagy statikus, konstans SQL-lekérdezést használjon.
- A promptban szereplő biztonsági szabály nem helyettesíti a kód- és adatbázisszintű kontrollt.
- A read-only PostgreSQL role tényleges jogosultságait integration teszttel ellenőrizni kell.
- Valódi ügyfél-, munkavállalói, adózási vagy pénzügyi adat nem kerülhet seedbe, fixture-be, tesztbe vagy logba.
- Ne kapcsold ki a lintet, typechecket, teszteket vagy SQL-guardot azért, hogy a build zöld legyen.

## Az agent promptjai — XML-szerű struktúra

- Amit a **TERMÉK** ad át az LLM-nek — a system prompt és az `askAgent` üzenetei — XML-szerű tagekkel strukturáljuk.
- A tagek világosan válasszák szét:
  - a szerepet;
  - a sémát;
  - a szabályokat;
  - az aktuális dátumot;
  - a példákat;
  - a felhasználói kérdést;
  - a toolok leírását.
- Ez nem a Claude Code-nak adott fejlesztői promptokra vonatkozik; azok természetes nyelvűek maradnak.
- Ajánlott tagek:
  - `<role>`
  - `<current_date>`
  - `<schema>`
  - `<rules>`
  - `<tools>`
  - `<examples>`
  - `<question>`
- A tagnevek lehetnek mások, de legyenek beszédesek és következetesek.
- A felhasználói input mindig külön `<question>` blokkba kerüljön; ne olvadjon össze a rendszerutasításokkal.
- A tooleredmény külön, egyértelműen jelölt blokkban kerüljön vissza a modellhez.
- A system prompt ne tartalmazzon secretet vagy teljes connection stringet.

Példa:

```xml
<role>
Ledgerbase asszisztens vagy. Egy könyvelőiroda ügyfél-, feladat-, határidő-,
dokumentum- és munkaterhelési adatairól válaszolsz.
</role>

<current_date>2026-07-12</current_date>

<schema>
employees(id, name, role, active)
clients(id, name, vat_frequency, assigned_employee_id, active)
task_categories(id, code, name, description)
tasks(id, client_id, assigned_employee_id, category_id, title, period_start,
      due_date, status, priority, completed_at, created_at)
document_requirements(id, client_id, document_type, period_start, status,
                      due_date, received_at, verified_at)
</schema>

<rules>
- Kizárólag a megadott táblákat és oszlopokat használd.
- Adatlekérdezéshez csak SELECT vagy WITH ... SELECT használható.
- Szöveges kereséshez ILIKE használható.
- Lista jellegű lekérdezésnél mindig alkalmazz LIMIT-et.
- A feladatkategóriákat szükség esetén a listTaskCategories toollal kérdezd le.
- A „lejárt” azt jelenti, hogy due_date korábbi a current_date értékénél,
  és a feladat státusza nem completed.
- Ha nincs találat, mondd meg egyértelműen.
- Ne találj ki táblát, oszlopot, kategóriát, ügyfelet vagy eredményt.
</rules>
```

## Git

- Conventional Commits formátumot használunk.
- Minden fejlesztés feature vagy dokumentációs branchen történik.
- A commitok legyenek kicsik, fókuszáltak és önmagukban értelmezhetők.
- Egy commit ne keverjen össze dokumentációt, refaktort és új funkciót, ha ezek különválaszthatók.
- Commit előtt legalább az érintett ellenőrzéseket futtasd.
- A részletes branch-, commit-, rebase-, hook- és pull request szabályokat a `dev-workflow.md` tartalmazza.
