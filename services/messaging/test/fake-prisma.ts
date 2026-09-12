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
      this.messages.set(id, { id, ...data });
      return { id, ...data };
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
