import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from './generated/prisma/client.js';

export type {
  Employee,
  Client,
  TaskCategory,
  Task,
  DocumentRequirement,
  Prisma,
} from './generated/prisma/client.js';
export { PrismaClient } from './generated/prisma/client.js';

export function createReadWritePrismaClient(
  connectionString: string,
): PrismaClient {
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}
