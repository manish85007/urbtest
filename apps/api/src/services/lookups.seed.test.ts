import { describe, expect, it, vi, beforeEach } from 'vitest';

const createMany = vi.fn();
vi.mock('../lib/prisma.js', () => ({
  prisma: {
    lookupMaster: {
      createMany,
      findUnique: vi.fn(),
      upsert: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

describe('seedLookups', () => {
  beforeEach(() => {
    createMany.mockReset();
    createMany.mockResolvedValue({ count: 0 });
  });

  it('inserts lookup rows with skipDuplicates so Masters edits survive restarts', async () => {
    const { seedLookups, LOOKUP_SEED } = await import('./lookups.js');
    await seedLookups();

    expect(createMany).toHaveBeenCalled();
    const seedCalls = createMany.mock.calls.filter(
      (c) => Array.isArray(c[0]?.data) && c[0].data[0]?.active === true,
    );
    expect(seedCalls.length).toBe(LOOKUP_SEED.length);
    for (const [args] of seedCalls) {
      expect(args.skipDuplicates).toBe(true);
    }
    // Must never force-overwrite existing rows via updateMany.
    const { prisma } = await import('../lib/prisma.js');
    expect(prisma.lookupMaster.updateMany).not.toHaveBeenCalled();
  });
});
