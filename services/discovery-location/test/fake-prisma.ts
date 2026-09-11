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
      const cityIds: string[] = where.cityId?.in ?? [];
      return [...this.eligibilityRows.values()].filter(
        (row) => row.status === where.status && cityIds.includes(row.cityId),
      );
    },
  };
}
