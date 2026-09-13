/**
 * Minimal in-memory double for PrismaService, covering only what
 * RetentionPurgeScheduler calls. No live Postgres is available for this automated
 * test run (though the schema itself has been migrated against real Postgres — see
 * conversation record); swap for the real PrismaService against
 * docker-compose's postgres-messaging for a true integration run.
 */
export class FakePrismaService {
  chats = new Map<string, any>();
  messages = new Map<string, any>();
  memberships = new Map<string, any>();

  chat = {
    create: async ({ data }: any) => {
      this.chats.set(data.id, { ...data });
      return { ...data };
    },
    findUnique: async ({ where }: any) => this.chats.get(where.id) ?? null,
    findMany: async ({ where }: any) =>
      [...this.chats.values()].filter(
        (c) =>
          c.status === where.status &&
          c.legalHold === where.legalHold &&
          c.archivedAt &&
          c.archivedAt.getTime() <= where.archivedAt.lte.getTime(),
      ),
    delete: async ({ where }: any) => {
      const row = this.chats.get(where.id);
      this.chats.delete(where.id);
      return row;
    },
  };

  message = {
    create: async ({ data }: any) => {
      const id = `msg-${this.messages.size + 1}`;
      this.messages.set(id, { id, createdAt: new Date(), ...data });
      return { id, ...data };
    },
    count: async ({ where }: any) => {
      return [...this.messages.values()].filter((m) => {
        if (m.chatId !== where.chatId) return false;
        if (where.senderId?.not !== undefined && m.senderId === where.senderId.not) return false;
        if (where.createdAt?.gt && !(m.createdAt.getTime() > where.createdAt.gt.getTime())) {
          return false;
        }
        return true;
      }).length;
    },
    deleteMany: async ({ where }: any) => {
      let count = 0;
      for (const [id, row] of this.messages.entries()) {
        if (row.chatId === where.chatId) {
          this.messages.delete(id);
          count += 1;
        }
      }
      return { count };
    },
  };

  chatMembership = {
    create: async ({ data }: any) => {
      const id = `member-${this.memberships.size + 1}`;
      this.memberships.set(id, { id, ...data });
      return { id, ...data };
    },
    findUnique: async ({ where }: any) => {
      const { chatId, userId } = where.chatId_userId;
      return (
        [...this.memberships.values()].find(
          (m) => m.chatId === chatId && m.userId === userId,
        ) ?? null
      );
    },
    findMany: async ({ where }: any) =>
      [...this.memberships.values()].filter((m) => m.userId === where.userId),
    update: async ({ where, data }: any) => {
      const { chatId, userId } = where.chatId_userId;
      const existing = [...this.memberships.entries()].find(
        ([, m]) => m.chatId === chatId && m.userId === userId,
      );
      if (!existing) throw new Error('membership not found');
      const [id, row] = existing;
      const updated = { ...row, ...data };
      this.memberships.set(id, updated);
      return updated;
    },
    deleteMany: async ({ where }: any) => {
      let count = 0;
      for (const [id, row] of this.memberships.entries()) {
        if (row.chatId === where.chatId) {
          this.memberships.delete(id);
          count += 1;
        }
      }
      return { count };
    },
  };
}
