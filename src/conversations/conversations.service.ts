import { Injectable, NotFoundException } from '@nestjs/common';
import { MessageSender, MessageType } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AiSalesService } from '../ai/ai-sales.service';
import { MemoryService } from '../memory/memory.service';

export interface IncomingMessage {
  tenantId: string;
  channelId: string;
  customerExternalId: string;
  customerName?: string;
  text?: string;
  type?: MessageType;
  mediaUrl?: string;
  externalMessageId?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService, private readonly ai: AiSalesService, private readonly memory: MemoryService) {}

  async ingestIncoming(input: IncomingMessage) {
    const channel = await this.prisma.channel.findFirst({ where: { id: input.channelId, tenantId: input.tenantId, isActive: true } });
    if (!channel) throw new NotFoundException('Active channel not found');

    let customer = await this.prisma.customer.findFirst({
      where: { tenantId: input.tenantId, phone: input.customerExternalId },
    });

    if (customer) {
      customer = await this.prisma.customer.update({
        where: { id: customer.id },
        data: { name: input.customerName ?? undefined },
      });
    } else {
      customer = await this.prisma.customer.create({
        data: { tenantId: input.tenantId, name: input.customerName, phone: input.customerExternalId },
      });
    }

    let conversation = await this.prisma.conversation.findFirst({
      where: { tenantId: input.tenantId, customerId: customer.id, channelId: input.channelId, status: { not: 'CLOSED' } },
      orderBy: { updatedAt: 'desc' },
    });

    if (!conversation) {
      conversation = await this.prisma.conversation.create({ data: { tenantId: input.tenantId, customerId: customer.id, channelId: input.channelId } });
    }

    if (input.externalMessageId) {
      const existing = await this.prisma.message.findFirst({ where: { conversationId: conversation.id, externalId: input.externalMessageId } });
      if (existing) return { conversation, message: existing, duplicated: true };
    }

    await this.memory.touchOpenOpportunities(input.tenantId, customer.id);

    const message = await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        externalId: input.externalMessageId,
        sender: MessageSender.CUSTOMER,
        type: input.type ?? MessageType.TEXT,
        content: input.text,
        mediaUrl: input.mediaUrl,
        metadata: input.metadata,
      },
    });

    const aiResult = await this.ai.handleIncomingMessage(message.id);
    return { conversation, message, duplicated: false, aiResult };
  }

}
