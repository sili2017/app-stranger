import 'reflect-metadata';
import { MessagingController } from '../../src/messaging.controller';
import { FakePrismaService } from '../fake-prisma';

/**
 * Feature 24: total unread message count across every chat the caller is in, backing
 * the Chats-tab badge. Starts at 0, counts only other-senders' messages, resets after
 * markRead, and never counts the caller's own sent messages.
 */
describe('Unread message count (Feature 24)', () => {
  function buildController() {
    const prisma = new FakePrismaService();
    const internal = { isBlocked: async () => false };
    const controller = new MessagingController(prisma as any, internal as any);
    return { controller, prisma };
  }

  function req(userId: string) {
    return { verifiedPrincipal: { userId } } as any;
  }

  it('is 0 for a fresh membership with no messages', async () => {
    const { controller, prisma } = buildController();
    await prisma.chatMembership.create({ data: { chatId: 'chat-1', userId: 'user-1' } });

    expect(await controller.getUnreadCount(req('user-1'))).toEqual({ unreadCount: 0 });
  });

  it('counts only messages from other senders, never the caller\'s own', async () => {
    const { controller, prisma } = buildController();
    await prisma.chatMembership.create({ data: { chatId: 'chat-1', userId: 'user-1' } });
    await prisma.message.create({ data: { chatId: 'chat-1', senderId: 'user-2', body: 'hi' } });
    await prisma.message.create({ data: { chatId: 'chat-1', senderId: 'user-1', body: 'mine' } });

    expect(await controller.getUnreadCount(req('user-1'))).toEqual({ unreadCount: 1 });
  });

  it('resets to 0 after markRead, then rises again for a later message', async () => {
    const { controller, prisma } = buildController();
    prisma.chats.set('chat-1', { id: 'chat-1', offerId: 'offer-1', status: 'active' });
    await prisma.chatMembership.create({ data: { chatId: 'chat-1', userId: 'user-1' } });
    await prisma.message.create({ data: { chatId: 'chat-1', senderId: 'user-2', body: 'hi' } });

    expect(await controller.getUnreadCount(req('user-1'))).toEqual({ unreadCount: 1 });

    await controller.markRead('chat-1', req('user-1'));
    expect(await controller.getUnreadCount(req('user-1'))).toEqual({ unreadCount: 0 });

    // Explicit later timestamp — markRead's lastReadAt and this message's createdAt can
    // otherwise land in the same millisecond in a fast test run, and the production
    // query is a strict `>` comparison.
    await prisma.message.create({
      data: {
        chatId: 'chat-1',
        senderId: 'user-2',
        body: 'again',
        createdAt: new Date(Date.now() + 1000),
      },
    });
    expect(await controller.getUnreadCount(req('user-1'))).toEqual({ unreadCount: 1 });
  });

  it('sums unread across multiple chats the caller is in', async () => {
    const { controller, prisma } = buildController();
    await prisma.chatMembership.create({ data: { chatId: 'chat-1', userId: 'user-1' } });
    await prisma.chatMembership.create({ data: { chatId: 'chat-2', userId: 'user-1' } });
    await prisma.message.create({ data: { chatId: 'chat-1', senderId: 'user-2', body: 'a' } });
    await prisma.message.create({ data: { chatId: 'chat-2', senderId: 'user-3', body: 'b' } });

    expect(await controller.getUnreadCount(req('user-1'))).toEqual({ unreadCount: 2 });
  });
});
