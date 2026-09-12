import { Body, Controller, Get, HttpStatus, Param, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { DomainError } from '@stranger/ts-platform';
import { PrismaService } from './prisma.service';
import { SendMessageDto } from './dto';
import { InternalClients } from './internal-clients';

function principal(req: Request) {
  return (req as any).verifiedPrincipal?.userId as string;
}

@Controller()
export class MessagingController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly internal: InternalClients,
  ) {}

  /** T078: only conversations the caller is a member of. */
  @Get('conversations')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async listConversations(@Req() req: Request) {
    const userId = principal(req);
    const memberships = await this.prisma.chatMembership.findMany({
      where: { userId },
      include: { chat: true },
    });
    return memberships.map((m) => m.chat);
  }

  @Get('conversations/:id/messages')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async listMessages(@Param('id') chatId: string, @Req() req: Request) {
    await this.assertMember(chatId, principal(req));
    return this.prisma.message.findMany({ where: { chatId }, orderBy: { createdAt: 'asc' } });
  }

  @Post('conversations/:id/messages')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async sendMessage(@Param('id') chatId: string, @Body() dto: SendMessageDto, @Req() req: Request) {
    const senderId = principal(req);
    const chat = await this.assertMember(chatId, senderId);
    if (chat.status !== 'active') {
      throw new DomainError('CHAT_NOT_ACTIVE', 'errors.chatNotActive', HttpStatus.CONFLICT);
    }

    // Convergence T126 (FR-015): a block against any other current member blocks a new
    // send — this gates new contact, not historical message visibility (undefined by
    // spec.md for a shared group chat; left as a documented remaining nuance).
    const otherMembers = await this.prisma.chatMembership.findMany({
      where: { chatId, userId: { not: senderId } },
    });
    for (const member of otherMembers) {
      if (await this.internal.isBlocked(senderId, member.userId)) {
        throw new DomainError('BLOCKED', 'errors.blocked', HttpStatus.FORBIDDEN);
      }
    }

    return this.prisma.message.create({ data: { chatId, senderId, body: dto.body } });
  }

  private async assertMember(chatId: string, userId: string) {
    const chat = await this.prisma.chat.findUnique({ where: { id: chatId } });
    if (!chat) {
      throw new DomainError('CHAT_NOT_FOUND', 'errors.chatNotFound', HttpStatus.NOT_FOUND);
    }
    const membership = await this.prisma.chatMembership.findUnique({
      where: { chatId_userId: { chatId, userId } },
    });
    if (!membership) {
      throw new DomainError('UNAUTHORIZED', 'errors.unauthorized', HttpStatus.FORBIDDEN);
    }
    return chat;
  }
}
