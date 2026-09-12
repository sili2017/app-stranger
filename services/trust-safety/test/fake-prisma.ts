/**
 * Minimal in-memory double for PrismaService, covering only what RatingService and
 * RatingEligibilityConsumer call. No live Postgres is available for the automated test
 * run in this environment (though the same flows were verified live against real
 * Postgres/Redis during development — see conversation record).
 */
export class FakePrismaService {
  private readonly prompts = new Map<string, any>();
  private readonly ratings = new Map<string, any>();
  private readonly blocks = new Map<string, any>();
  private readonly screeningAppeals = new Map<string, any>();
  outboxRows: any[] = [];
  private nextId = 1;

  reports = new Map<string, any>();

  report = {
    create: async ({ data }: any) => {
      const id = `report-${this.nextId++}`;
      const row = { id, legalHold: false, ...data };
      this.reports.set(id, row);
      return row;
    },
    updateMany: async ({ where, data }: any) => {
      let count = 0;
      for (const [id, row] of this.reports.entries()) {
        if (row.legalHold !== where.legalHold) continue;
        if (!row.decidedAt || row.decidedAt.getTime() > where.decidedAt.lte.getTime()) continue;
        if (row.reporterUserId === where.reporterUserId.not) continue;
        this.reports.set(id, { ...row, ...data });
        count += 1;
      }
      return { count };
    },
  };

  auditLogEntry = {
    create: async ({ data }: any) => ({ id: `audit-${this.nextId++}`, createdAt: new Date(), ...data }),
  };

  screeningAppeal = {
    upsert: async ({ where, create }: any) => {
      const key = `${where.offerId_creatorUserId.offerId}:${where.offerId_creatorUserId.creatorUserId}`;
      const existing = this.screeningAppeals.get(key);
      if (existing) return existing;
      const row = { id: `appeal-${this.nextId++}`, status: 'submitted', createdAt: new Date(), decidedAt: null, ...create };
      this.screeningAppeals.set(key, row);
      return row;
    },
    findMany: async ({ where }: any) =>
      [...this.screeningAppeals.values()].filter((a) => a.offerId === where.offerId),
    update: async ({ where, data }: any) => {
      const existing = [...this.screeningAppeals.entries()].find(([, a]) => a.id === where.id);
      if (!existing) throw new Error('not found');
      const [key, row] = existing;
      const updated = { ...row, ...data };
      this.screeningAppeals.set(key, updated);
      return updated;
    },
  };

  block = {
    upsert: async ({ where, create }: any) => {
      const key = `${where.sourceUserId_targetUserId.sourceUserId}:${where.sourceUserId_targetUserId.targetUserId}`;
      const existing = this.blocks.get(key);
      if (existing) return existing;
      const row = { id: `block-${this.nextId++}`, status: 'pending_review', ...create };
      this.blocks.set(key, row);
      return row;
    },
    findUnique: async ({ where }: any) => {
      const key = `${where.sourceUserId_targetUserId.sourceUserId}:${where.sourceUserId_targetUserId.targetUserId}`;
      return this.blocks.get(key) ?? null;
    },
    findMany: async ({ where }: any) =>
      [...this.blocks.values()].filter((b) => b.sourceUserId === where.sourceUserId),
  };

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
      const row = { id, createdAt: new Date(), ...data };
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
    findMany: async ({ where }: any) =>
      [...this.ratings.values()].filter(
        (r) => r.visibility === where.visibility && r.createdAt.getTime() <= where.createdAt.lte.getTime(),
      ),
  };

  outboxEvent = {
    create: async ({ data }: any) => {
      this.outboxRows.push(data);
      return data;
    },
  };

  $transaction = async (fn: (tx: this) => Promise<any>) => fn(this);
}
