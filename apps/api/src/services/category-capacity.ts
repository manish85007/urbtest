import { getFY, checkCategoryCapacity, capacityExceedMessage, fiscalYearBounds } from '@urb-tectrack/shared';
import { AppError } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';

export async function getCategoryUsedKg(
  factoryId: string,
  entryId: string,
  processedAt: Date,
  excludeRecyclingId?: string,
): Promise<number> {
  const fy = getFY(processedAt);
  if (!fy) return 0;

  const { start, end } = fiscalYearBounds(fy);
  const rows = await prisma.recyclingCategory.findMany({
    where: {
      entryId,
      recycling: {
        factoryId,
        processedAt: { gte: start, lte: end },
        ...(excludeRecyclingId ? { NOT: { id: excludeRecyclingId } } : {}),
      },
    },
    select: { weightKg: true },
  });

  return rows.reduce((sum, row) => sum + Number(row.weightKg), 0);
}

export async function assertCategoryCapacityOrOverride(input: {
  factoryId: string;
  entryId: string;
  addKg: number;
  capacityTpa: number;
  processedAt: Date;
  overrideReason?: string | null;
  excludeRecyclingId?: string;
}) {
  const usedKg = await getCategoryUsedKg(
    input.factoryId,
    input.entryId,
    input.processedAt,
    input.excludeRecyclingId,
  );
  const check = {
    ...checkCategoryCapacity(usedKg, input.addKg, Number(input.capacityTpa)),
    entryId: input.entryId,
  };

  if (check.exceeds && !String(input.overrideReason || '').trim()) {
    throw new AppError(capacityExceedMessage(input.entryId, check));
  }

  return check;
}
