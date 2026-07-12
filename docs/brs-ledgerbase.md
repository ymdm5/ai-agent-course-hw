# Ledgerbase — Üzleti követelmény-leírás (BRS)

> Kurzus-melléklet. Egyben a build brief, amelyet 1:1 átadunk a Claude Code-nak a projekt elején. A technikai részleteket külön dokumentumok tartalmazzák: `stack.md`, `architektura.md`, `konvenciok.md`, `dev-workflow.md`, `system-prompt.md`.

## 1. Üzleti igény / probléma

Egy kis könyvelőiroda irodavezetője vagy senior könyvelője rendszeresen több különböző szempont alapján ellenőrzi az ügyfelek aktuális operatív állapotát:

- mely feladatok közelednek a határidőhöz vagy jártak már le;
- mely ügyfelektől hiányzik még szükséges dokumentum;
- mely munkatársaknál torlódnak a nyitott feladatok;
- mely ügyfélhez, időszakhoz és feladattípushoz tartozik egy adott teendő;
- mely ügyfelek igényelnek azonnali figyelmet.

Hol megy el az idő a kézi munkában:

- Excel-táblák, feladatlisták és ügyféllisták szűrése;
- több feltétel együttes ellenőrzése;
- határidők és státuszok összevetése;
- hiányzó dokumentumok ügyfelenkénti áttekintése;
- munkatársi terhelés manuális összesítése;
- vezetői vagy napi státuszriport összeállítása.

Az adat rendelkezésre áll, de a gyors kinyerése manuális szűrést, összesítést vagy SQL-tudást igényelne. Ez lassítja a napi operatív döntéseket, és növeli annak kockázatát, hogy egy sürgős vagy lejárt feladat későn kerül felszínre.

### ROI / mérőszámok

A részletes pénzügyi levezetés külön, a `docs/roi.md` dokumentumban készül el.

**Hard ROI — forintosítható:**

- [FELTÉTELEZÉS] Egy 5 fős iroda munkatársanként napi átlag 15 percet tölt státusz-, határidő- és dokumentumkereséssel.
- [FELTÉTELEZÉS] Ez havi 20 munkanappal számolva kb. 25 munkaóra/hó.
- [FELTÉTELEZÉS] Ha a Ledgerbase ennek 60%-át kiváltja, kb. 15 munkaóra/hó szabadul fel.
- [FELTÉTELEZÉS] 8 000 Ft teljes belső óraköltséggel ez kb. 120 000 Ft/hó, illetve 1 440 000 Ft/év kapacitásérték.
- KPI: egy tipikus operatív kérdés megválaszolása legfeljebb 30 másodperc alatt.
- KPI: a napi határidő- és terhelésellenőrzés 15–20 percről 5 perc alá csökkenjen.

**Soft ROI — valós, de nehezen forintosítható:**

- gyorsabb napi priorizálás;
- jobb átláthatóság az ügyfél- és feladatállomány felett;
- kevesebb manuális keresés és kontextusváltás;
- kiegyenlítettebb munkaterhelés;
- alacsonyabb működési kockázat a lejárt vagy elakadt feladatok korábbi felismerése miatt.

**Bővítési képesség — későbbi verziókban:**

- automatikus értesítés és eszkaláció;
- e-mail- és dokumentumforrások bekötése;
- NAV-, számlázó- vagy workflow-rendszer integráció;
- webes vezetői felület;
- többfelhasználós jogosultságkezelés;
- trend- és kapacitáselemzés.

A v1 ezek közül egyiket sem valósítja meg: kizárólag a saját adatbázis felett működő, read-only text-to-SQL agent.

## 2. Megoldás

`ledgerbase`: parancssori (CLI) AI agent, amely a természetes nyelvű kérdést SQL-re fordítja a könyvelőiroda operatív adatbázisa felett, read-only módon lefuttatja, majd természetes nyelvű választ ad.

A rendszer célja az önkiszolgáló operatív analitika: a felhasználó SQL-tudás és manuális Excel-szűrés nélkül kérdezhet az ügyfelekről, feladatokról, határidőkről, dokumentumstátuszokról és munkatársi terhelésről.

Példakérdések:

- „Mely ügyfeleknek van határideje a következő 7 napban?”
- „Mely feladatok jártak le, de még nincsenek lezárva?”
- „Mely ügyfelektől hiányzik még a bankszámlakivonat?”
- „Melyik munkatársnak van a legtöbb nyitott feladata?”
- „Mutasd az Alfa Kft. összes aktuális feladatát.”
- „Kinek van háromnál több lejárt feladata?”

Skálázódási irány a kurzus során: CLI operatív lekérdező → több agentből álló workflow → always-on szolgáltatás → webes felület → tudásbázis és dokumentumkezelés → eszkaláció, compliance, eval és monitoring.

## 3. Hatókör (scope, v1)

### Benne van a v1-ben

- Természetes nyelvű kérdés-válasz az alábbi adatkörök felett:
  - ügyfelek;
  - munkatársak;
  - feladatkategóriák;
  - feladatok és határidők;
  - dokumentumkövetelmények és dokumentumstátuszok.
- Read-only adat-elérés.
- CLI felület:
  - egyszeri `ask` parancs;
  - interaktív readline mód.
- Többlépéses agent loop.
- `runSql` tool a lekérdezések futtatására.
- Saját `listTaskCategories` tool a tényleges feladatkategóriák lekérdezésére.
- JSONL naplózás.
- `--show-prompt` átláthatósági mód.
- Szintetikus seed adatok, valós személyes vagy ügyféladat nélkül.

### Kívül van a v1-en

- Adat létrehozása, módosítása vagy törlése.
- Automatikus feladatkiosztás.
- Értesítés, e-mail-küldés vagy eszkaláció.
- NAV-, Számlázz.hu-, Billingo-, banki vagy más külső integráció.
- Dokumentumfeltöltés, OCR és dokumentumtartalom-feldolgozás.
- Webes vagy mobil felület.
- Voice interfész.
- Több felhasználó és szerepkör-alapú hozzáférés.
- Autentikáció.
- Multi-agent architektúra.
- RAG vagy külső tudásbázis.
- Prediktív kapacitástervezés.
- Deployment és production üzemeltetés.

## 4. Követelmények

### Funkcionális követelmények (FR)

- **FR1 — Kérdezés:** a `ledgerbase ask "<kérdés>"` parancs egyszeri lekérdezést indít; az interaktív mód addig fogad új kérdéseket, amíg a felhasználó ki nem lép.
- **FR2 — NL → SQL:** az agent az LLM segítségével SQL-lekérdezést generál, és azt kizárólag a `runSql` toolon keresztül futtatja.
- **FR3 — Többlépéses futás:** az `askAgent` több lépéses tool-use loopban dolgozik a végleges válaszig.
- **FR4 — Természetes nyelvű válasz:** a lekérdezés eredményéből rövid, érthető és az adatokkal alátámasztott magyar nyelvű választ ad.
- **FR5 — Saját tool:** a `listTaskCategories` tool lekéri az adatbázisban elérhető feladatkategóriákat, és az agent ténylegesen használhatja kategóriaalapú kérdések értelmezésekor.
- **FR6 — Naplózás:** minden interakció JSONL formátumban naplózott a `logs/<timestamp>.jsonl` fájlba, beleértve legalább:
  - a system promptot;
  - az üzeneteket;
  - a tool-hívásokat;
  - a generált SQL-t;
  - a lekérdezési eredményt;
  - a végleges választ;
  - a hibákat;
  - a tokenhasználatot, ha az SDK elérhetővé teszi.
- **FR7 — Átláthatóság:** a `--show-prompt` mód kiírja a modellnek küldött teljes üzenetstruktúrát.
- **FR8 — Üres eredmény kezelése:** ha a lekérdezés nem ad találatot, az agent ezt egyértelműen közli, és nem talál ki adatot.
- **FR9 — Bizonytalan kérdés kezelése:** ha a kérdés többféleképpen értelmezhető, az agent pontosítást kér vagy egyértelműen megjelöli a választott értelmezést.
- **FR10 — Dátumértelmezés:** a relatív időbeli kifejezéseket — például „ma”, „a következő 7 napban”, „ebben a hónapban” — a futás aktuális dátumához viszonyítva értelmezi.

### Nem-funkcionális követelmények (NFR)

- **NFR1 — Adatbiztonság:** az agent kizárólag külön read-only adatbázis-kapcsolatot és tényleges read-only DB-role-t használ.
- **NFR2 — SQL-biztonság:** csak egyetlen, olvasási célú `SELECT` vagy `WITH … SELECT` utasítás hajtható végre; író vagy adminisztratív SQL nem engedélyezett.
- **NFR3 — Eredménykorlát:** minden lista jellegű lekérdezés korlátozott eredményszámmal fusson, hogy a modell és a napló ne kapjon indokolatlanul nagy adatmennyiséget.
- **NFR4 — Átláthatóság és auditálhatóság:** a működés a JSONL naplókból és a `--show-prompt` módból visszakövethető.
- **NFR5 — Titokkezelés:** API-kulcs, adatbázis-jelszó vagy connection string nem kerülhet repositoryba vagy naplóba; a `.env` fájl git által ignorált, a `.env.example` nem tartalmaz valódi secretet.
- **NFR6 — Karbantarthatóság:** a megoldás betartja a `konvenciok.md` és `architektura.md` előírásait.
- **NFR7 — Reprodukálhatóság:** a projekt a `stack.md` szerinti környezetben, dokumentált parancsokkal újra felépíthető és futtatható.
- **NFR8 — Tesztelhetőség:** a kritikus SQL-guard, tool-dispatch és agent-loop viselkedés automatizált tesztekkel ellenőrizhető.
- **NFR9 — Hibatűrés:** adatbázis-, tool- vagy modellhiba esetén a CLI kontrollált, érthető hibaüzenetet ad, és nem jelenít meg secretet vagy belső connection stringet.
- **NFR10 — Scope-fegyelem:** a v1 egyetlen CLI-only TypeScript agent, agent-framework, frontend és külső integráció nélkül.

## 5. Sikerkritériumok

- A felhasználó természetes nyelven kérdez az operatív adatokról, és SQL-tudás nélkül helyes, érthető választ kap.
- A teljes lánc működik: `CLI → askAgent → tool → SQL → read-only PostgreSQL → válasz`.
- Demo-kritérium:

  ```bash
  ledgerbase ask "Mely ügyfeleknek van lejárt, még nyitott áfabevallási feladata, és ki a felelős könyvelőjük?"
  ```

  A parancs a seed adatok alapján helyes ügyfél-, feladat- és felelőslistát ad.

- Saját tool demo-kritérium:

  ```bash
  ledgerbase ask "Milyen feladatkategóriák vannak, és melyikhez tartozik a bérrel kapcsolatos munka?"
  ```

  A futás során az agent bizonyíthatóan meghívja a `listTaskCategories` toolt.

- Az agent soha nem módosít adatot.
- Az agent kizárólag a read-only adatbázis-kapcsolatot használja.
- Minden interakció naplózott, és a működés `--show-prompt` móddal átlátható.
- Az üres találati eredményt az agent hallucináció nélkül kezeli.
- A build, typecheck, lint és kapcsolódó tesztek sikeresen lefutnak.
- KPI: egy tipikus operatív kérdésre 30 másodpercen belül használható válasz érkezik lokális fejlesztői környezetben.
- [FELTÉTELEZÉS] Az ötfős iroda napi határidő- és státuszellenőrzési ideje 15–20 percről 5 perc alá csökkenthető.

## 6. Adat

A Ledgerbase v1 domainje a következő fő adatköröket tartalmazza:

- `employees` — könyvelőirodai munkatársak;
- `clients` — ügyfelek;
- `task_categories` — feladatkategóriák;
- `tasks` — ügyfélhez, munkatárshoz és kategóriához rendelt feladatok;
- `document_requirements` — időszakhoz kötött dokumentumkövetelmények és státuszok.

A pontos adatbázisséma a `stack.md` dokumentumban kerül meghatározásra.

A seed kizárólag szintetikus adatot tartalmaz. Javasolt mennyiség:

- 5 munkatárs;
- kb. 30 ügyfél;
- 6–8 feladatkategória;
- 80–120 feladat;
- 60–100 dokumentumkövetelmény.

A seednek tartalmaznia kell:

- jövőbeli és lejárt határidőket;
- nyitott, folyamatban lévő, blokkolt és lezárt feladatokat;
- hiányzó, beérkezett és ellenőrzött dokumentumokat;
- eltérő munkatársi terhelést;
- olyan teszteseteket, amelyekhez egyértelműen ellenőrizhető elvárt válasz tartozik.

Valódi ügyfél-, munkavállalói, adózási vagy egyéb személyes adat használata tilos.
