import type { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';

export async function nextSequence(key: string): Promise<string> {
  return prisma.$transaction(async (tx) => {
    const seq = await tx.idSequence.findUnique({ where: { key } });
    if (!seq) throw new Error(`Sequence "${key}" is not configured.`);

    const value = seq.nextValue;
    await tx.idSequence.update({
      where: { key },
      data: { nextValue: value + 1 },
    });

    return `${seq.prefix}${String(value).padStart(seq.pad, '0')}`;
  });
}

export const submissionInclude = {
  client: true,
  site: true,
  vehicles: { include: { team: true, weighment: true } },
  invoices: {
    include: {
      payments: true,
      mrn: { include: { factory: true } },
      recycling: { include: { categories: { include: { category: true } }, serials: true, factory: true } },
      certificates: true,
    },
  },
  queries: { include: { replies: { orderBy: { createdAt: 'asc' as const } } }, orderBy: { createdAt: 'asc' as const } },
  items: { orderBy: { sortOrder: 'asc' as const } },
  lifecycleEvents: { orderBy: { createdAt: 'asc' as const } },
} satisfies Prisma.SubmissionInclude;

export type SubmissionFull = Prisma.SubmissionGetPayload<{ include: typeof submissionInclude }>;
