/**
 * Minimal in-memory double for PrismaService, covering only what RatingService and
 * RatingEligibilityConsumer call. No live Postgres is available for the automated test
 * run in this environment (though the same flows were verified live against real
 * Postgres/Redis during development — see conversation record).
 */
export class FakePrismaService {
  private readonly prompts = new Map<string, any>();
  private readonly ratings = new Map<string, any>();
  outboxRows: any[] = [];
  private nextId = 1;

  ratingPrompt = {
    upsert: async ({ where, create }: any) => {
      const existing = this.prompts.get(where.selectionId);
      if (existing) return existing;
      const row = {
        id: `prompt-${this.nextId++}`,
        creatorUserId: null,
        recipientUserId: null,
        sentAt: null,
        ...create,
      };
      this.prompts.set(where.selectionId, row);
      return row;
    },
    findUnique: async ({ where }: any) => this.prompts.get(where.selectionId) ?? null,
    findMany: async ({ where }: any) => {
      const now = Date.now();
      return [...this.prompts.values()].filter(
        (p) => p.sentAt === where.sentAt && p.scheduledSendAt.getTime() <= now,
      );
    },
    update: async ({ where, data }: any) => {
      const entry = [...this.prompts.entries()].find(([, p]) => p.id === where.id);
      if (!entry) throw new Error('not found');
      const [key, row] = entry;
      const updated = { ...row, ...data };
      this.prompts.set(key, updated);
      return updated;
    },
  };

  ratingFeedback = {
    findUnique: async ({ where }: any) => {
      if (where.id) return [...this.ratings.values()].find((r) => r.id === where.id) ?? null;
      const key = `${where.selectionId_raterUserId.selectionId}:${where.selectionId_raterUserId.raterUserId}`;
      return this.ratings.get(key) ?? null;
    },
    create: async ({ data }: any) => {
      const id = `rating-${this.nextId++}`;
      const row = { id, ...data };
      this.ratings.set(`${data.selectionId}:${data.raterUserId}`, row);
      return row;
    },
    update: async ({ where, data }: any) => {
      const existing = [...this.ratings.entries()].find(([, r]) => r.id === where.id);
      if (!existing) throw new Error('not found');
      const [key, row] = existing;
      const updated = { ...row, ...data };
      this.ratings.set(key, updated);
      return updated;
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
