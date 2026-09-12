import 'reflect-metadata';
import { RetentionPurgeScheduler, CHAT_RETENTION_MS } from '../../src/retention-purge-scheduler';
import { FakePrismaService } from '../fake-prisma';

/**
 * Convergence T130 (FR-038, Clarifications Session 2026-09-12 round 2): a Chat and
 * its Messages are deleted 12 months after archiving — except under an active legal
 * hold, and never before the deadline.
 */
describe('RetentionPurgeScheduler (T130, FR-038)', () => {
  function buildChat(prisma: FakePrismaService, id: string, overrides: Partial<any> = {}) {
    prisma.chats.set(id, {
      id,
      offerId: `offer-${id}`,
      status: 'archived_readonly',
      legalHold: false,
      archivedAt: new Date(Date.now() - CHAT_RETENTION_MS - 60_000),
      ...overrides,
    });
  }

  it('deletes a chat and its messages/memberships once past the 12-month retention window', async () => {
    const prisma = new FakePrismaService();
    buildChat(prisma, 'chat-1');
    await prisma.message.create({ data: { chatId: 'chat-1', senderId: 'user-1', body: 'hi' } });
    await prisma.chatMembership.create({ data: { chatId: 'chat-1', userId: 'user-1' } });

    const scheduler = new RetentionPurgeScheduler(prisma as any);
    await scheduler.tick();

    expect(prisma.chats.has('chat-1')).toBe(false);
    expect([...prisma.messages.values()].filter((m) => m.chatId === 'chat-1')).toHaveLength(0);
    expect([...prisma.memberships.values()].filter((m) => m.chatId === 'chat-1')).toHaveLength(0);
  });

  it('does not delete a chat still within the 12-month window', async () => {
    const prisma = new FakePrismaService();
    buildChat(prisma, 'chat-2', { archivedAt: new Date(Date.now() - CHAT_RETENTION_MS + 60_000) });

    const scheduler = new RetentionPurgeScheduler(prisma as any);
    await scheduler.tick();

    expect(prisma.chats.has('chat-2')).toBe(true);
  });

  it('never deletes a chat under an active legal hold, regardless of age', async () => {
    const prisma = new FakePrismaService();
    buildChat(prisma, 'chat-3', { legalHold: true });

    const scheduler = new RetentionPurgeScheduler(prisma as any);
    await scheduler.tick();

    expect(prisma.chats.has('chat-3')).toBe(true);
  });

  it('never deletes an active (not yet archived) chat', async () => {
    const prisma = new FakePrismaService();
    buildChat(prisma, 'chat-4', { status: 'active', archivedAt: null });

    const scheduler = new RetentionPurgeScheduler(prisma as any);
    await scheduler.tick();

    expect(prisma.chats.has('chat-4')).toBe(true);
  });
});
