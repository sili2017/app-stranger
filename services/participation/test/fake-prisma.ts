/**
 * Minimal in-memory double for PrismaService, covering only what ParticipationService
 * calls. No live Postgres is available for the automated test run in this environment
 * (though the same flows were verified live against real Postgres/Redis during
 * development — see conversation record); swap for the real PrismaService against
 * docker-compose's postgres-participation for a true integration run.
 */
export class FakePrismaService {
  private readonly eoiById = new Map<string, any>();
  private readonly eoiByKey = new Map<string, string>(); // `${offerId}:${recipientUserId}` -> id
  private readonly selections = new Map<string, any>();
  outboxRows: any[] = [];
  private nextId = 1;

  expressionOfInterest = {
    upsert: async ({ where, create }: any) => {
      const key = `${create.offerId}:${create.recipientUserId}`;
      const existingId = this.eoiByKey.get(key);
      if (existingId) return this.eoiById.get(existingId);
      const id = `eoi-${this.nextId++}`;
      const row = { id, ...create, createdAt: new Date() };
      this.eoiById.set(id, row);
      this.eoiByKey.set(key, id);
      void where;
      return row;
    },
    findUnique: async ({ where, include }: any) => {
      const row = this.eoiById.get(where.id);
      if (!row) return null;
      if (include?.selection) {
        const selection = [...this.selections.values()].find(
          (s) => s.expressionOfInterestId === row.id,
        );
        return { ...row, selection: selection ?? null };
      }
      return row;
    },
  };

  selection = {
    count: async ({ where }: any) => {
      return [...this.selections.values()].filter(
        (s) => s.offerId === where.offerId && s.outcome !== 'cancelled',
      ).length;
    },
    create: async ({ data }: any) => {
      const id = `sel-${this.nextId++}`;
      const row = { id, selectedAt: new Date(), resolvedAt: null, cancelledBy: null, ...data };
      this.selections.set(id, row);
      return row;
    },
    findUnique: async ({ where }: any) => this.selections.get(where.id) ?? null,
    findMany: async ({ where }: any) =>
      [...this.selections.values()].filter(
        (s) => s.offerId === where.offerId && s.outcome === where.outcome,
      ),
    update: async ({ where, data }: any) => {
      const row = { ...this.selections.get(where.id), ...data };
      this.selections.set(where.id, row);
      return row;
    },
  };

  outboxEvent = {
    create: async ({ data }: any) => {
      this.outboxRows.push(data);
      return data;
    },
  };

  $transaction = async (fn: (tx: this) => Promise<any>) => fn(this);
}
