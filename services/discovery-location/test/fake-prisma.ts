/**
 * Minimal in-memory double for PrismaService, covering only what EligibilityService
 * calls. No live Postgres is available in this environment; swap for the real
 * PrismaService against docker-compose's postgres-discovery-location for a true
 * integration run.
 */
export class FakePrismaService {
  private readonly eligibilityRows = new Map<string, any>();
  cityInterests = new Map<string, any[]>();
  locations = new Map<string, any>();

  locationSnapshot = {
    findUnique: async ({ where }: any) => this.locations.get(where.userId) ?? null,
  };

  cityInterest = {
    findMany: async ({ where }: any) => this.cityInterests.get(where.userId) ?? [],
  };

  discoveryEligibility = {
    set: (id: string, row: any) => this.eligibilityRows.set(id, row),
    findMany: async ({ where }: any) => {
      // Mirrors real Prisma semantics: an absent `cityId` key in the where clause means
      // "no filter on that field" (matches every city), not "match nothing" — the
      // eligibility.service.ts fallback for a recipient with zero city interests
      // depends on exactly this (real Postgres already does this correctly; this fake
      // just needs to not diverge from it).
      const cityIds: string[] | undefined = where.cityId?.in;
      return [...this.eligibilityRows.values()].filter(
        (row) =>
          row.status === where.status && (cityIds === undefined || cityIds.includes(row.cityId)),
      );
    },
  };
}
