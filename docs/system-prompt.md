# Ledgerbase — a system prompt tartalma és indoklása

> A tényleges system prompt forrása `packages/core/src/agents/ledgerbase/ledgerbase-prompt.ts`
> (`buildLedgerbaseSystemPrompt`, `buildUserMessage`) — ez a dokumentum nem duplikálja a
> szöveget, hanem blokkonként rögzíti, hogy **mit** tartalmaz a prompt és **miért** éppen azt.
> A struktúra szabályait (mely tagek, milyen sorrendben) a `konvenciok.md` "Az agent
> promptjai" fejezete írja elő; ez a doksi a Ledgerbase-specifikus tartalmi döntésekről szól.

## Blokkonként

### `<role>`

Mit: egy mondat — könyvelőirodai asszisztens, magyarul válaszol, az öt tábla témaköréről.

Miért: rövidnek kell maradnia, mert a tényleges viselkedést a `<rules>` és `<schema>`
kényszeríti ki, nem a szerepleírás; a role csak a nyelvet és a domént rögzíti.

### `<current_date>`

Mit: futásidőben injektált dátum (`options.currentDate`), nem a modell tréningadatából
származó dátum.

Miért: a `<rules>`-ban rögzített "lejárt" definíció (`due_date < current_date`) csak akkor
helyes, ha a modell a tényleges mai dátumot ismeri — ez soha nem hardcode-olható a promptba.

### `<schema>`

Mit: a pontosan öt engedélyezett tábla és oszlopaik, semmi több.

Miért: ez a prompt-szintű tükörképe a SQL-guard tábla-allowlistjének (lásd
`konvenciok.md`). A cél, hogy a modell eleve csak létező, engedélyezett táblát/oszlopot
próbáljon lekérdezni, és ne a guard dobja vissza utólag — a guard így ritkábban kap
elutasítandó SQL-t, nem azért mert megbízunk a promptban, hanem mert kevesebb a hiba forrás.

### `<rules>`

A legtöbb szabály egy konkrét, élesben megfigyelt hibára reagál, nem elméleti óvatosságból
került be:

- **SELECT / `WITH ... SELECT` + kizárólag `runSql`** — a guard szabályainak prompt-szintű
  előrejelzése, hogy a modell eleve jó formátumú SQL-t generáljon.
- **`task_categories.code` kitalálásának tiltása, ILIKE a `name`/`description` oszlopon** —
  ez a legkonkrétabb, élő teszttel felfedezett probléma volt: `claude-haiku-4-5` időnként
  kitalált egy `code` értéket (pl. `'VAT'`), ami hamis "nincs találat" választ eredményezett
  (lásd a `feat: wire runSql into ledgerbase agent loop and prompt` commit "Known
  limitation" szakaszát). A puszta tiltás önmagában nem volt elég megbízható, ezért a
  szabály mellé bekerült egy konkrét `<examples>` minta is, majd — strukturális
  megoldásként — a `listTaskCategories` tool (lásd lent), ami a kitalálást feleslegessé
  teszi ahelyett, hogy csak tiltaná.
- **Kötelező `LIMIT` lista jellegű lekérdezésnél** — a guard eredménylimitjének
  prompt-szintű előkészítése; a cél, hogy a modell már eleve limitált SQL-t generáljon,
  ne a guard vágja le utólag.
- **"lejárt" explicit definíciója** — üzleti szabály, ami nem következik triviálisan a
  sémából (két táblán más-más "kész" állapot: `status <> 'completed'` vs. nem `verified`),
  ezért ki kell mondani, különben a modell találgatna.
- **Ha nincs találat, mondja meg egyértelműen / ne találjon ki adatot** —
  anti-hallucináció alapelv, ugyanaz a mintázat, mint a Phase 2 "nincs DB-hozzáférés"
  őszinteségi válasz (lásd `feat: add askAgent Anthropic SDK integration without DB
  tools` commit) — kiterjesztve arra az esetre, amikor van DB-hozzáférés, de nincs
  találat.
- **`listTaskCategories` preferálása `runSql` helyett kategória-kérdéseknél** — nem
  csak egy újabb tiltás, hanem a `code`-kitalálási probléma strukturális megoldása: a
  modell ahelyett, hogy egzakt értéket találna ki, ténylegesen lekérdezi a valós
  kategórialistát. Élőben verifikálva (lásd `feat: register listTaskCategories in agent
  tool loop` commit): 3/3 futásnál helyesen ezt a toolt hívta hardcode-olt lista helyett.

### `<tools>`

Mit: a `runSql` és `listTaskCategories` rövid, egy-két mondatos leírása.

Miért: a tool JSON-sémája (név, paraméterek) önmagában nem elég ahhoz, hogy a modell
eldöntse, *melyik* toolt kell hívnia kategória- vs. adatlekérdezésnél — ezt a döntési
szabályt a `<rules>` és a `<tools>` blokk együtt mondja ki, explicit.

### `<examples>`

Mit: egyetlen, végigvitt lekérdezés (lejárt ÁFA-feladatok felelős könyvelővel), ami
kifejezetten a helyes ILIKE-mintát mutatja be a `code`-kitalálás elkerülésére.

Miért: a live tesztek szerint a puszta szöveges tiltás nem volt elég megbízható, a
few-shot minta viszont igen. Szándékosan egyetlen példa van, nem több: a Ledgerbase
kérdéskör szűk (öt tábla, pár tipikus kérdéstípus), és a prompt hosszát/válaszidejét nem
akartuk feleslegesen növelni több hasonló mintával, amíg egy is elég a megfigyelt hiba
kiküszöbölésére.

### `<question>` (`buildUserMessage`)

Mit: a felhasználói kérdés külön blokkban, elkülönítve a rendszerutasításoktól.

Miért: `konvenciok.md` előírása — a user input soha nem olvadhat össze a system
instrukciókkal; ez a prompt-injection elleni védelem egyik rétege (a másik a guard és a
read-only DB-role).

## Amit tudatosan kihagytunk

- Nincs few-shot minta minden egyes szabályra, csak a live teszteken ténylegesen
  megfigyelt hibára (`code`-kitalálás) — a többi szabály (LIMIT, SELECT-only, "lejárt"
  definíció) eddig nem produkált hasonló, ismétlődő hibamintát, ezért egyelőre elég a
  puszta szövegű szabály.
- Nincs külön `system-prompt.md`-be kiszervezett prompt-szöveg-duplikátum: az
  `implementation-plan.md` B2 fázis döntése szerint a tartalom magába a promptba épül —
  ez a fájl a hiányzó indoklást pótolja, a forrás továbbra is
  `ledgerbase-prompt.ts`.

## Kapcsolódó dokumentumok

- `konvenciok.md` — a prompt XML-szerű strukturálásának általános szabályai és a
  biztonsági szabály duplikálásának elve ("A promptban szereplő biztonsági szabály nem
  helyettesíti a kód- és adatbázisszintű kontrollt").
- `architektura.md` — a system prompt betöltésének helye az architektúrában.
