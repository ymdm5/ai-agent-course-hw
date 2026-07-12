# Ledgerbase — tech stack

Elv: iparági best practice, legfrissebb STABIL verzió (se cutting-edge, se elavult).

- Nyelv / monorepo: TypeScript (strict), Nx, pnpm, Node LTS
- DB: PostgreSQL lokálisan Docker Compose-ban, Docker Desktop futtatja. Prisma (ORM: séma, migráció, seed, typed query). Helyben dolgozunk, nincs felhő-DB.
- Adatbázis-hozzáférés: külön read-write és read-only PostgreSQL role; a Prisma migrációhoz és seedhez a `DATABASE_URL`, az agent `runSql` toolja kizárólag a `DATABASE_URL_READONLY` kapcsolatot használja.
- Agent: Anthropic SDK (hivatalos kliens, nem nyers HTTP) + saját tool-use loop, agent-framework nélkül. Zod (validáció)
- CLI: commander + node:readline
- Tooling: Vitest, ESLint + Prettier, tsx
- Eszköz: VS Code, gh CLI, Docker Desktop

## employees séma

```sql
employees (
  id       serial primary key,
  name     text not null,     -- munkatárs neve
  role     text not null,     -- könyvelő / senior könyvelő / bérszámfejtő / irodavezető
  active   boolean not null default true
)
```

## clients séma

```sql
clients (
  id                     serial primary key,
  name                   text not null,     -- ügyfél neve
  vat_frequency          text not null,     -- havi / negyedéves / éves / nem áfás
  assigned_employee_id   int not null references employees(id),
  active                 boolean not null default true
)
```

## task_categories séma

```sql
task_categories (
  id            serial primary key,
  code          text not null unique,  -- stabil technikai azonosító
  name          text not null unique,  -- magyar megjelenítési név
  description   text
)
```

## tasks séma

```sql
tasks (
  id                     serial primary key,
  client_id              int not null references clients(id),
  assigned_employee_id   int not null references employees(id),
  category_id            int not null references task_categories(id),
  title                  text not null,
  period_start           date,              -- az érintett időszak első napja
  due_date               date not null,
  status                 text not null,     -- open / in_progress / blocked / completed
  priority               text not null,     -- low / medium / high
  completed_at           timestamptz,
  created_at             timestamptz not null default now()
)
```

## document_requirements séma

```sql
document_requirements (
  id            serial primary key,
  client_id     int not null references clients(id),
  document_type text not null,
  period_start  date not null,              -- az érintett időszak első napja
  status        text not null,              -- missing / received / verified
  due_date      date not null,
  received_at   timestamptz,
  verified_at   timestamptz
)
```

## Értékkészletek (kategorikus mezők)

- **employees.role:** könyvelő, senior könyvelő, bérszámfejtő, irodavezető
- **clients.vat_frequency:** havi, negyedéves, éves, nem áfás
- **tasks.status:** open, in_progress, blocked, completed
- **tasks.priority:** low, medium, high
- **document_requirements.status:** missing, received, verified
- **bool:** employees.active, clients.active

## Kezdeti feladatkategóriák

A `task_categories` tábla seedelt, adatbázisból lekérdezhető értékkészlet. Nem hardcode-oljuk az agent promptjába kizárólagos forrásként; a `listTaskCategories` tool az adatbázis aktuális tartalmát adja vissza.

- `vat_return` — Áfabevallás
- `payroll` — Bérszámfejtés
- `monthly_closing` — Havi zárás
- `bank_reconciliation` — Bankegyeztetés
- `invoice_booking` — Számlakönyvelés
- `tax_payment_check` — Adófizetés ellenőrzése
- `document_collection` — Dokumentumbekérés
- `annual_closing` — Éves zárás

## Javasolt indexek

A tipikus határidő-, státusz-, ügyfél- és terheléslekérdezésekhez:

```sql
create index idx_tasks_due_date on tasks(due_date);
create index idx_tasks_status on tasks(status);
create index idx_tasks_client_id on tasks(client_id);
create index idx_tasks_assigned_employee_id on tasks(assigned_employee_id);
create index idx_tasks_category_id on tasks(category_id);

create index idx_document_requirements_due_date
  on document_requirements(due_date);
create index idx_document_requirements_status
  on document_requirements(status);
create index idx_document_requirements_client_id
  on document_requirements(client_id);
```

## Seed célmennyiség

- 5 munkatárs
- kb. 30 ügyfél
- 8 feladatkategória
- 80–120 feladat
- 60–100 dokumentumkövetelmény

A seed kizárólag szintetikus adatot tartalmazhat. Tartalmazzon jövőbeli és lejárt határidőket, eltérő feladatstátuszokat, hiányzó és beérkezett dokumentumokat, valamint egyenetlen munkatársi terhelést, hogy a demo-kérdések eredménye egyértelműen ellenőrizhető legyen.
