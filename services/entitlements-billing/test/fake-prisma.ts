/**
 * Minimal in-memory double for PrismaService, covering only what EntitlementsService
 * calls. No live Postgres is available for the automated test run in this environment
 * (though the same flows were verified live against real Postgres/Redis during
 * development — see conversation record).
 */
export class FakePrismaService {
  private readonly ledgers = new Map<string, any>();
  private readonly entries: any[] = [];
  private readonly subscriptions = new Map<string, any>();
  private readonly purchases = new Map<string, any>();
  private nextId = 1;

  publishingEntitlementLedger = {
    upsert: async ({ where, create }: any) => {
      const key = `${where.userId_calendarMonthKey.userId}:${where.userId_calendarMonthKey.calendarMonthKey}`;
      const existing = this.ledgers.get(key);
      if (existing) return existing;
      const row = { id: `ledger-${this.nextId++}`, ...create };
      this.ledgers.set(key, row);
      return row;
    },
    findUnique: async ({ where }: any) => {
      const key = `${where.userId_calendarMonthKey.userId}:${where.userId_calendarMonthKey.calendarMonthKey}`;
      return this.ledgers.get(key) ?? null;
    },
    update: async ({ where, data }: any) => {
      const entry = [...this.ledgers.entries()].find(([, l]) => l.id === where.id);
      if (!entry) throw new Error('not found');
      const [key, row] = entry;
      const updated = { ...row };
      if (data.freeOffersUsedThisMonth?.increment) {
        updated.freeOffersUsedThisMonth += data.freeOffersUsedThisMonth.increment;
      }
      this.ledgers.set(key, updated);
      return updated;
    },
  };

  entitlementLedgerEntry = {
    create: async ({ data }: any) => {
      this.entries.push(data);
      return data;
    },
  };

  subscription = {
    findFirst: async ({ where }: any) => {
      const now = new Date();
      const matches = [...this.subscriptions.values()].filter(
        (s) =>
          s.userId === where.userId &&
          where.status.in.includes(s.status) &&
          s.currentPeriodEnd.getTime() > now.getTime(),
      );
      matches.sort((a, b) => b.currentPeriodEnd.getTime() - a.currentPeriodEnd.getTime());
      return matches[0] ?? null;
    },
    findUnique: async ({ where }: any) => {
      if (where.id) return this.subscriptions.get(where.id) ?? null;
      if (where.stripeSubscriptionId) {
        return (
          [...this.subscriptions.values()].find(
            (s) => s.stripeSubscriptionId === where.stripeSubscriptionId,
          ) ?? null
        );
      }
      return null;
    },
    update: async ({ where, data }: any) => {
      const row = { ...this.subscriptions.get(where.id), ...data };
      this.subscriptions.set(where.id, row);
      return row;
    },
    create: async ({ data }: any) => {
      const row = { id: `sub-${this.nextId++}`, ...data };
      this.subscriptions.set(row.id, row);
      return row;
    },
    // Test helper, not a real Prisma method.
    __seed: (row: any) => {
      this.subscriptions.set(row.id, row);
    },
  };

  oneTimeBroadcastPurchase = {
    findFirst: async ({ where }: any) => {
      const matches = [...this.purchases.values()].filter(
        (p) => p.userId === where.userId && p.status === where.status,
      );
      matches.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      return matches[0] ?? null;
    },
    update: async ({ where, data }: any) => {
      const row = { ...this.purchases.get(where.id), ...data };
      this.purchases.set(where.id, row);
      return row;
    },
    count: async ({ where }: any) =>
      [...this.purchases.values()].filter(
        (p) => p.userId === where.userId && p.status === where.status,
      ).length,
    // Test helper, not a real Prisma method.
    __seed: (row: any) => {
      this.purchases.set(row.id, row);
    },
  };

  outboxEvent = {
    create: async ({ data }: any) => data,
  };

  publishingEntitlementLedgerLookup(userId: string, calendarMonthKey: string) {
    return this.ledgers.get(`${userId}:${calendarMonthKey}`);
  }

  entriesFor(userId: string) {
    return this.entries.filter((e) => e.userId === userId);
  }

  $transaction = async (arg: any) => {
    if (Array.isArray(arg)) return Promise.all(arg);
    return arg(this);
  };
}
