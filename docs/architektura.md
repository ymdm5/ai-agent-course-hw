# Ledgerbase — architektúra (fájlstruktúra + főbb döntések)

> A „mivel” — verziók, eszközlista és adatbázisséma — a `stack.md` dokumentumban található; itt a STRUKTÚRÁT és a kulcsfontosságú architekturális döntéseket rögzítjük.

## Fájlstruktúra (Nx monorepo)

```text
ledgerbase/
├── packages/core   agent-logika (LLM-hívás, agent-loop, toolok, séma-kontextus, naplózás)
├── packages/db     Prisma lib (séma, migráció, kliens, seed) — NEM a gyökérben
├── apps/cli        CLI (ask parancs + interaktív mód)
├── docs            dokumentáció (lásd dev-workflow.md)
└── config          nx, package.json, .env, docker-compose

```

A `packages/core` tartalmazza legalább:

- az `askAgent` többlépéses tool-use loopot;
- a `runSql` read-only toolt;
- a `listTaskCategories` saját toolt;
- az adatbázisséma LLM-nek átadott kontextusát;
- a system prompt betöltését;
- a JSONL naplózást;
- a tool input- és outputvalidációt.

A fájlszintű bontást Claude Code generálja a `konvenciok.md` előírásai szerint. Ez a dokumentum nem ír elő indokolatlanul részletes implementációt.

## Főbb technológiai és architekturális döntések

1. **Framework-agnostic core.**  
   A `packages/core` nem ismeri a belépési pontokat — CLI, későbbi API vagy web. Új felület új appot jelent, nem az agent-logika újraírását. Agent frameworköt a HF1-ben nem használunk; a későbbi Mastra-integráció a core köré épülhet.

2. **Három elkülönített felelősségi terület.**  
   - `packages/core`: agent-logika és L2 toolok;  
   - `packages/db`: adatmodell, migráció, seed és Prisma kliens;  
   - `apps/cli`: felhasználói belépési pont és parancskezelés.  

   A CLI nem tartalmazhat üzleti vagy SQL-végrehajtási logikát.

3. **Két adatbázis-kapcsolat, két jogosultsági szint.**  
   Az agent `runSql` toolja kizárólag a `DATABASE_URL_READONLY` kapcsolaton, tényleges read-only PostgreSQL role-lal fut. A `DATABASE_URL` read-write kapcsolatot csak a Prisma séma-, migrációs és seedfolyamatai használják. Az agent nem Prismán keresztül kérdez.

4. **Read-only védelem több rétegben.**  
   A promptban szereplő „csak SELECT” szabály önmagában nem biztonsági kontroll. A védelem rétegei:
   - külön read-only DB-role;
   - csak egy SQL statement engedélyezése;
   - kizárólag `SELECT` vagy `WITH … SELECT`;
   - író, DDL-, adminisztratív és több statementből álló SQL tiltása;
   - eredménylimit;
   - engedélyezett Ledgerbase-táblák használata;
   - tool input validálása végrehajtás előtt.

5. **Saját agent-loop.**  
   Az `askAgent` az Anthropic SDK-ra — hivatalos kliensre, nem nyers HTTP-re — épülő, kézzel írt tool-use loop. Agent frameworköt nem használunk, hogy az LLM → tool → eredmény → következő modellhívás mechanika látható és tesztelhető maradjon.

6. **Két L2 tool, eltérő felelősséggel.**  
   - `runSql`: általános read-only SQL-lekérdezés a Ledgerbase engedélyezett sémája felett;  
   - `listTaskCategories`: célzott saját tool, amely az adatbázis aktuális feladatkategóriáit listázza.  

   A `listTaskCategories` nem hardcode-olt listát ad vissza, és ugyanazt a read-only adatbázis-hozzáférést használja. Az agentnek ténylegesen képesnek kell lennie a tool kiválasztására és használatára.

7. **A séma explicit modellkontextus.**  
   A system prompt tartalmazza a Ledgerbase engedélyezett tábláinak, oszlopainak, relációinak és releváns értékkészleteinek tömör leírását:
   - `employees`;
   - `clients`;
   - `task_categories`;
   - `tasks`;
   - `document_requirements`.  

   Az agent nem találhat ki táblát, oszlopot, relációt vagy státuszértéket.

8. **A dátumértelmezés reprodukálható.**  
   A „ma”, „lejárt”, „a következő 7 napban” és hasonló kifejezések értelmezéséhez a futás aktuális dátuma explicit módon bekerül az agent kontextusába. A tesztek nem függhetnek kontrollálatlanul a rendszeridőtől; ahol szükséges, injektálható vagy rögzített referenciaidőt használunk.

9. **Átláthatóság és auditálhatóság beépítve.**  
   Minden interakció JSONL formátumban naplózott. A napló legalább az alábbiakat tartalmazza:
   - modell- és futásazonosító;
   - system prompt és üzenetek;
   - toolválasztás és tool input;
   - generált SQL;
   - lekérdezési eredmény vagy annak biztonságosan korlátozott reprezentációja;
   - tool- és modellhibák;
   - végleges válasz;
   - tokenhasználat, ha az SDK biztosítja.  

   A `--show-prompt` kapcsoló megjeleníti a modellnek átadott teljes üzenetstruktúrát. Secret vagy teljes connection string nem kerülhet sem konzolra, sem naplóba.

10. **Lokális adatbázis Docker Desktopban.**  
    A PostgreSQL szolgáltatást `docker-compose` indítja, Docker Desktop futtatja. Helyben dolgozunk; a HF1-ben nincs felhő-adatbázis és deployment.

11. **Prisma külön Nx lib.**  
    A Prisma séma, migrációk, generált kliens és seed a `packages/db` libben él, nem a repository gyökerében. Így az adatbázisréteg az Nx project graph része, és a függőségi irányok ellenőrizhetők.

12. **Szintetikus adat, valódi ügyféladat nélkül.**  
    A seed kizárólag fiktív könyvelőirodai adatokat tartalmazhat. Valódi ügyfélnév, adóazonosító, személyes adat, pénzügyi bizonylat vagy más bizalmas adat nem kerülhet a repositoryba, tesztbe vagy naplóba.

13. **Library-dokumentáció implementáció előtt.**  
    Új vagy ritkán használt API esetén — például Prisma, Anthropic SDK vagy Nx konfiguráció — először a hivatalos dokumentációt olvassuk be, szükség esetén Context7-en keresztül, és csak utána implementálunk.

14. **HF1 scope-fegyelem.**  
    A v1 egyetlen CLI-only TypeScript agent. Nincs:
    - multi-agent rendszer;
    - API vagy webes frontend;
    - RAG;
    - autentikáció;
    - külső könyvelési vagy NAV-integráció;
    - író adatbázis-művelet;
    - automatikus értesítés vagy eszkaláció;
    - production deployment.

Konvenciók: `konvenciok.md`. Git-, hook- és automatizmus-szabályok: `dev-workflow.md`.
