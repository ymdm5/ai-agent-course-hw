# Ledgerbase — ROI (megtérülési) levezetés

> Ez a dokumentum a `brs-ledgerbase.md` "ROI / mérőszámok" szakaszában vázolt hard ROI-t vezeti le részletesen, egy fiktív, ötfős könyvelőiroda példáján. Minden bemeneti szám becslés — `[FELTÉTELEZÉS]` jelöléssel —, nem mért adat egyetlen valós irodáról sem. A cél nem egy pontos pénzügyi ígéret, hanem annak bemutatása, hogy a becslések milyen nagyságrendű kapacitásértéket jelentenek, és milyen mérőszámokkal ellenőrizhető ez éles használat közben.

## 1. Kiindulási feltételezések

| Feltételezés | Érték |
|---|---|
| Iroda mérete | 5 munkatárs |
| Napi időveszteség / fő státusz-, határidő- és dokumentumkereséssel | 15 perc |
| Munkanapok / hónap | 20 |
| Ledgerbase által kiváltható hányad | 60% |
| Belső, rezsivel terhelt óraköltség | 8 000 Ft/óra |

Mind az öt sor `[FELTÉTELEZÉS]`: iparági tapasztalat és józan becslés alapján felvett kiindulópontok, nem mérési eredmény. Éles bevezetés után ezeket a tényleges mért időadatokkal kell felülírni (lásd 4. szakasz).

## 2. Hard ROI — levezetés lépésről lépésre

```text
1. Napi időveszteség (teljes iroda)
   5 fő × 15 perc/fő/nap = 75 perc/nap

2. Havi időveszteség
   75 perc/nap × 20 munkanap/hó = 1 500 perc/hó = 25 óra/hó

3. Ledgerbase által kiváltható rész (60%)
   25 óra/hó × 0,60 = 15 óra/hó

4. Havi kapacitásérték
   15 óra/hó × 8 000 Ft/óra = 120 000 Ft/hó

5. Éves kapacitásérték
   120 000 Ft/hó × 12 hónap = 1 440 000 Ft/év
```

| Lépés | Eredmény |
|---|---|
| Havi időveszteség (teljes iroda) | 25 óra/hó |
| Ledgerbase által felszabadított idő | 15 óra/hó |
| Havi kapacitásérték | 120 000 Ft/hó |
| **Éves kapacitásérték** | **1 440 000 Ft/év** |

Ez egy **kapacitásérték**, nem közvetlen készpénz-megtakarítás: a felszabaduló idő más, magasabb hozzáadott értékű munkára (pl. ügyfélkapcsolat, tanácsadás, plusz ügyfelek kiszolgálása) fordítható, nem feltétlenül létszámcsökkentésre.

## 3. KPI-k (a hard ROI ellenőrzésére)

- Egy tipikus operatív kérdés megválaszolása **legfeljebb 30 másodperc** alatt (`ledgerbase ask` végrehajtási idő).
- A napi határidő- és terhelésellenőrzés ideje **15–20 percről 5 perc alá** csökken irodavezetői/senior könyvelői visszajelzés alapján.

Mindkét KPI közvetlenül mérhető: az első a CLI válaszidejéből (a JSONL napló `run_started`/`run_finished` időbélyegeiből is levezethető), a második felhasználói interjúval vagy egyszerű időméréssel.

## 4. Korlátok és validálási terv

- A fenti számok **becslések**, nem mért adatok — nincs mögöttük valós irodai megfigyelés.
- A tényleges kiváltási arány (60%) irodánként, sőt kérdéstípusonként eltérhet; alábecsülheti a hatást gyakori, ismétlődő lekérdezéseknél, felülbecsülheti szokatlan/ritka kérdéseknél.
- A belső óraköltség (8 000 Ft/óra) irodánként és pozíciónként változik.
- Validálási javaslat éles bevezetés esetén: 2–4 hetes mérés a bevezetés előtt és után (pl. napi 5 perces önbevallásos időmérés vagy mintavételes megfigyelés), majd a fenti levezetés újraszámolása mért adatokkal.

## 5. Soft ROI — nehezen forintosítható haszon

- gyorsabb napi priorizálás;
- jobb átláthatóság az ügyfél- és feladatállomány felett;
- kevesebb manuális keresés és kontextusváltás;
- kiegyenlítettebb munkaterhelés a munkatársak között;
- alacsonyabb működési kockázat, mert a lejárt vagy elakadt feladatok korábban felismerhetők.

## 6. Bővítési irányok (nem része a v1-nek)

A v1 kizárólag egy saját adatbázis felett működő, read-only text-to-SQL CLI agent — az alábbiak egyike sem valósul meg jelenleg, de további ROI-t jelenthetnek egy későbbi verzióban:

- automatikus értesítés és eszkaláció (pl. lejáró határidőknél);
- e-mail- és dokumentumforrások bekötése;
- NAV-, számlázó- vagy workflow-rendszer integráció;
- webes vezetői felület;
- többfelhasználós jogosultságkezelés;
- trend- és kapacitáselemzés (pl. munkatársi terhelés időbeli alakulása).

Lásd még: `brs-ledgerbase.md` (1. szakasz, üzleti probléma és scope).
