/**
 * Minimal in-memory double for PrismaService, covering only the methods OffersService /
 * ExpiryScheduler call. Used because no live Postgres is available in this environment;
 * swap for the real PrismaService against docker-compose's postgres-offer for a true
 * integration run.
 */
export class FakePrismaService {
  offers = new Map<string, any>();
  outboxRows: any[] = [];

  meetOffer = {
    create: async ({ data }: any) => {
      this.offers.set(data.id, { ...data });
      return { ...data };
    },
    findUnique: async ({ where }: any) => {
      const row = this.offers.get(where.id);
      return row ? { ...row } : null;
    },
    update: async ({ where, data }: any) => {
      const row = this.offers.get(where.id);
      const updated = { ...row, ...data };
      this.offers.set(where.id, updated);
      return { ...updated };
    },
    updateMany: async ({ where, data }: any) => {
      let count = 0;
      for (const [id, row] of this.offers.entries()) {
        if (row.id === (where.id ?? id) && row.status === where.status) {
          this.offers.set(id, { ...row, ...data });
          count += 1;
        }
      }
      return { count };
    },
    findMany: async ({ where }: any) => {
      return [...this.offers.values()].filter((row) => {
        if (where.status && row.status !== where.status) return false;
        if (where.expiresAt?.lte && !(row.expiresAt <= where.expiresAt.lte)) return false;
        if (where.creatorUserId && row.creatorUserId !== where.creatorUserId) return false;
        return true;
      });
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
