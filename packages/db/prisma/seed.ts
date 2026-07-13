import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../src/generated/prisma/client.js';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is not set — cannot seed the database.');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: DATABASE_URL }),
});

// Deterministic PRNG (mulberry32) so re-running the seed always produces the
// same distribution of statuses/priorities/dates — no external random source.
function createRng(seed: number) {
  let state = seed;
  return function next(): number {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = createRng(20260713);
function pick<T>(items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)];
}
function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

const now = new Date();

const EMPLOYEES = [
  { name: 'Nagy Katalin', role: 'irodavezető' },
  { name: 'Kovács Béla', role: 'senior könyvelő' },
  { name: 'Szabó Anna', role: 'könyvelő' },
  { name: 'Tóth Márk', role: 'könyvelő' },
  { name: 'Varga Eszter', role: 'bérszámfejtő' },
] as const;

const VAT_FREQUENCIES = ['havi', 'negyedéves', 'éves', 'nem áfás'] as const;

const CLIENT_NAME_STEMS = [
  'Alfa',
  'Zenit',
  'Nova',
  'Pannon',
  'Duna',
  'Tisza',
  'Corvus',
  'Solaris',
  'Meridián',
  'Aurum',
  'Ezüst',
  'Kristály',
  'Halmos',
  'Kővári',
  'Székely',
  'Bástya',
  'Delta',
  'Kelta',
  'Orion',
  'Vertikál',
  'Horizont',
  'Prizma',
  'Mátra',
  'Bakony',
  'Zafír',
  'Gránit',
  'Kompász',
  'Titán',
  'Ébredés',
  'Aranykor',
] as const;
const CLIENT_SUFFIXES = ['Kft.', 'Bt.', 'Zrt.'] as const;

const TASK_CATEGORIES = [
  {
    code: 'vat_return',
    name: 'Áfabevallás',
    description: 'Időszakos áfabevallás elkészítése és beküldése.',
  },
  {
    code: 'payroll',
    name: 'Bérszámfejtés',
    description: 'Havi bérszámfejtés és kapcsolódó bevallások.',
  },
  {
    code: 'monthly_closing',
    name: 'Havi zárás',
    description: 'Havi könyvelési zárás elvégzése.',
  },
  {
    code: 'bank_reconciliation',
    name: 'Bankegyeztetés',
    description: 'Bankszámlakivonatok egyeztetése a könyveléssel.',
  },
  {
    code: 'invoice_booking',
    name: 'Számlakönyvelés',
    description: 'Bejövő és kimenő számlák könyvelése.',
  },
  {
    code: 'tax_payment_check',
    name: 'Adófizetés ellenőrzése',
    description: 'Adó- és járulékfizetések ellenőrzése.',
  },
  {
    code: 'document_collection',
    name: 'Dokumentumbekérés',
    description: 'Hiányzó ügyféldokumentumok bekérése.',
  },
  {
    code: 'annual_closing',
    name: 'Éves zárás',
    description: 'Éves beszámoló és zárás elkészítése.',
  },
] as const;

const TASK_STATUSES = ['open', 'in_progress', 'blocked', 'completed'] as const;
const TASK_PRIORITIES = ['low', 'medium', 'high'] as const;
const DOCUMENT_STATUSES = ['missing', 'received', 'verified'] as const;
const DOCUMENT_TYPES = [
  'bankszámlakivonat',
  'számlaösszesítő',
  'szerződés',
  'bérjegyzék alapadat',
  'leltárív',
] as const;

async function main() {
  // Idempotent: clear in FK-safe order before re-seeding.
  await prisma.documentRequirement.deleteMany();
  await prisma.task.deleteMany();
  await prisma.taskCategory.deleteMany();
  await prisma.client.deleteMany();
  await prisma.employee.deleteMany();

  const employees = await Promise.all(
    EMPLOYEES.map((e) =>
      prisma.employee.create({
        data: { name: e.name, role: e.role, active: true },
      }),
    ),
  );

  const categories = await Promise.all(
    TASK_CATEGORIES.map((c) =>
      prisma.taskCategory.create({
        data: { code: c.code, name: c.name, description: c.description },
      }),
    ),
  );
  const vatReturnCategory = categories.find((c) => c.code === 'vat_return');
  if (!vatReturnCategory)
    throw new Error('vat_return category missing after seed insert');

  // Uneven workload: employees[1] (senior könyvelő) and employees[2] (könyvelő)
  // are assigned noticeably more clients than the others.
  const employeeWeights = [1, 4, 4, 2, 1];
  const weightedEmployeeIds: number[] = [];
  employees.forEach((emp, i) => {
    for (let w = 0; w < employeeWeights[i]; w++)
      weightedEmployeeIds.push(emp.id);
  });

  const clientNames = new Set<string>();
  const clientRecords: {
    name: string;
    assignedEmployeeId: number;
    vatFrequency: string;
  }[] = [];
  let stemIndex = 0;
  let suffixIndex = 0;
  while (clientRecords.length < 30) {
    const name = `${CLIENT_NAME_STEMS[stemIndex % CLIENT_NAME_STEMS.length]} ${CLIENT_SUFFIXES[suffixIndex % CLIENT_SUFFIXES.length]}`;
    stemIndex++;
    if (stemIndex % CLIENT_NAME_STEMS.length === 0) suffixIndex++;
    if (clientNames.has(name)) continue;
    clientNames.add(name);
    clientRecords.push({
      name,
      assignedEmployeeId:
        weightedEmployeeIds[clientRecords.length % weightedEmployeeIds.length],
      vatFrequency:
        VAT_FREQUENCIES[clientRecords.length % VAT_FREQUENCIES.length],
    });
  }

  const clients = await Promise.all(
    clientRecords.map((c) =>
      prisma.client.create({
        data: {
          name: c.name,
          vatFrequency: c.vatFrequency,
          assignedEmployeeId: c.assignedEmployeeId,
          active: true,
        },
      }),
    ),
  );
  const alfaKft = clients.find((c) => c.name === 'Alfa Kft.');
  if (!alfaKft)
    throw new Error('Alfa Kft. demo client missing after seed insert');

  // --- Deterministic demo case for the graded demo question ---
  // "Mely ügyfeleknek van lejárt, még nyitott áfabevallási feladata, és ki a
  // felelős könyvelőjük?" must return Alfa Kft. / its assigned employee.
  await prisma.task.create({
    data: {
      clientId: alfaKft.id,
      assignedEmployeeId: alfaKft.assignedEmployeeId,
      categoryId: vatReturnCategory.id,
      title: 'Q2 áfabevallás beküldése',
      periodStart: addDays(now, -100),
      dueDate: addDays(now, -10),
      status: 'open',
      priority: 'high',
    },
  });

  const tasksToCreate = 96;
  for (let i = 0; i < tasksToCreate; i++) {
    const client = pick(clients);
    const category = pick(categories);
    const status = pick(TASK_STATUSES);
    const isOverdue = rng() < 0.35;
    const dueOffset = isOverdue
      ? -Math.floor(rng() * 30) - 1
      : Math.floor(rng() * 30) + 1;
    await prisma.task.create({
      data: {
        clientId: client.id,
        assignedEmployeeId: client.assignedEmployeeId,
        categoryId: category.id,
        title: `${category.name} — ${client.name}`,
        periodStart: addDays(now, dueOffset - 30),
        dueDate: addDays(now, dueOffset),
        status,
        priority: pick(TASK_PRIORITIES),
        completedAt:
          status === 'completed' ? addDays(now, dueOffset - 2) : null,
      },
    });
  }

  const documentsToCreate = 80;
  for (let i = 0; i < documentsToCreate; i++) {
    const client = pick(clients);
    const status = pick(DOCUMENT_STATUSES);
    const dueOffset = Math.floor(rng() * 60) - 30;
    await prisma.documentRequirement.create({
      data: {
        clientId: client.id,
        documentType: pick(DOCUMENT_TYPES),
        periodStart: addDays(now, dueOffset - 30),
        dueDate: addDays(now, dueOffset),
        status,
        receivedAt: status !== 'missing' ? addDays(now, dueOffset - 5) : null,
        verifiedAt: status === 'verified' ? addDays(now, dueOffset - 2) : null,
      },
    });
  }

  const [taskCount, documentCount] = await Promise.all([
    prisma.task.count(),
    prisma.documentRequirement.count(),
  ]);

  console.log(
    `Seeded ${employees.length} employees, ${clients.length} clients, ${categories.length} task categories, ${taskCount} tasks, ${documentCount} document requirements.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
