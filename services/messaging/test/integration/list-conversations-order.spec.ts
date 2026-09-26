import 'reflect-metadata';
import { MessagingController } from '../../src/messaging.controller';
import { FakePrismaService } from '../fake-prisma';

/**
 * The Chats tab lists conversations most-recently-active first (item 42): a chat's
 * latest message time, falling back to its creation time when it has no messages yet.
 */
describe('List conversations ordering', () => {
  function buildController() {
    const prisma = new FakePrismaService();
    const internal = { isBlocked: async () => false };
    const controller = new MessagingController(prisma as any, internal as any);
    return { controller, prisma };
  }

  function req(userId: string) {
    return { verifiedPrincipal: { userId } } as any;
  }

  it('orders by latest message time, most recent first', async () => {
    const { controller, prisma } = buildController();
    prisma.chats.set('chat-old', {
      id: 'chat-old',
      offerId: 'offer-old',
      status: 'active',
      createdAt: new Date('2026-01-01T00:00:00Z'),
    });
    prisma.chats.set('chat-new', {
      id: 'chat-new',
      offerId: 'offer-new',
      status: 'active',
      createdAt: new Date('2026-01-02T00:00:00Z'),
    });
    await prisma.chatMembership.create({ data: { chatId: 'chat-old', userId: 'user-1' } });
    await prisma.chatMembership.create({ data: { chatId: 'chat-new', userId: 'user-1' } });

    // chat-old received a message after chat-new was created, so it should sort first
    // even though chat-new is the newer chat.
    await prisma.message.create({
      data: {
        chatId: 'chat-old',
        senderId: 'user-2',
        body: 'hi',
        createdAt: new Date('2026-01-03T00:00:00Z'),
      },
    });

    const result = await controller.listConversations(req('user-1'));
    expect(result.map((c: any) => c.id)).toEqual(['chat-old', 'chat-new']);
  });

  it('falls back to chat creation time when a chat has no messages yet', async () => {
    const { controller, prisma } = buildController();
    prisma.chats.set('chat-a', {
      id: 'chat-a',
      offerId: 'offer-a',
      status: 'active',
      createdAt: new Date('2026-01-01T00:00:00Z'),
    });
    prisma.chats.set('chat-b', {
      id: 'chat-b',
      offerId: 'offer-b',
      status: 'active',
      createdAt: new Date('2026-01-02T00:00:00Z'),
    });
    await prisma.chatMembership.create({ data: { chatId: 'chat-a', userId: 'user-1' } });
    await prisma.chatMembership.create({ data: { chatId: 'chat-b', userId: 'user-1' } });

    const result = await controller.listConversations(req('user-1'));
    expect(result.map((c: any) => c.id)).toEqual(['chat-b', 'chat-a']);
  });

  it('returns an empty list when the caller has no conversations', async () => {
    const { controller } = buildController();
    expect(await controller.listConversations(req('user-1'))).toEqual([]);
  });
});
