/**
 * Minimal in-memory double for PrismaService, covering only what VerificationService and
 * ProfilesService call. No live Postgres is available for the automated test run in this
 * environment (though the same flows were verified live against real Postgres/Redis
 * during development — see conversation record). `$transaction` just invokes the callback
 * with `this` as `tx` — no real isolation, matching this codebase's existing FakePrismaService
 * convention (see services/trust-safety/test/fake-prisma.ts).
 */
export class FakePrismaService {
  private readonly userAccounts = new Map<string, any>();
  private readonly publicProfiles = new Map<string, any>();
  verificationCases: any[] = [];

  userAccount = {
    upsert: async ({ where, create, update }: any) => {
      const existing = this.userAccounts.get(where.id);
      const row = existing ? { ...existing, ...update } : { id: where.id, ...create };
      this.userAccounts.set(where.id, row);
      return row;
    },
    update: async ({ where, data }: any) => {
      const existing = this.userAccounts.get(where.id);
      if (!existing) throw new Error('not found');
      const updated = { ...existing, ...data };
      this.userAccounts.set(where.id, updated);
      return updated;
    },
  };

  publicProfile = {
    upsert: async ({ where, create, update }: any) => {
      const existing = this.publicProfiles.get(where.userId);
      const row = existing
        ? { ...existing, ...update }
        : {
            userId: where.userId,
            photoAssetId: null,
            interests: [],
            languagePreference: 'en',
            publicRatingAverage: null,
            publicRatingCount: 0,
            ...create,
          };
      this.publicProfiles.set(where.userId, row);
      return row;
    },
    findUnique: async ({ where }: any) => this.publicProfiles.get(where.userId) ?? null,
    update: async ({ where, data }: any) => {
      const existing = this.publicProfiles.get(where.userId);
      if (!existing) throw new Error('not found');
      const updated = { ...existing, ...data };
      this.publicProfiles.set(where.userId, updated);
      return updated;
    },
  };

  verificationCase = {
    create: async ({ data }: any) => {
      const row = { id: `case-${this.verificationCases.length + 1}`, ...data };
      this.verificationCases.push(row);
      return row;
    },
    findFirst: async () => null,
    findUnique: async () => null,
  };

  $transaction = async (cb: (tx: this) => Promise<unknown>) => cb(this);
}
