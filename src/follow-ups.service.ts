import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ChannelType, ConversationStatus, MessageSender, MessageType, OpportunityStatus } from '@prisma/client';
import { PrismaService } from './common/prisma/prisma.service';
import { WhatsAppService } from './channels/whatsapp.service';
import { MemoryService } from './memory/memory.service';

const MAX_ATTEMPTS = 3;
const CLAIM_LEASE_MS = 5 * 60 * 1000;

@Injectable()
export class FollowUpsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FollowUpsService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsAppService,
    private readonly memory: MemoryService,
  ) {}

  onModuleInit() {
    const enabled = process.env.FOLLOW_UP_ENABLED !== 'false';
    if (!enabled) return;
    const interval = Math.max(30, Number(process.env.FOLLOW_UP_INTERVAL_SECONDS || 60)) * 1000;
    this.timer = setInterval(() => void this.runDueFollowUps(), interval);
    void this.runDueFollowUps();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async runDueFollowUps(limit = 50) {
    if (this.running) return { processed: 0, skipped: true };
    this.running = true;
    let processed = 0;
    try {
      const due = await this.prisma.salesOpportunity.findMany({
        where: {
          status: OpportunityStatus.OPEN,
          nextFollowUpAt: { lte: new Date() },
          OR: [{ followUpSendingAt: null }, { followUpSendingAt: { lt: new Date(Date.now() - CLAIM_LEASE_MS) } }],
        },
        orderBy: { nextFollowUpAt: 'asc' },
        take: Math.min(Math.max(limit, 1), 200),
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          product: { select: { id: true, name: true, sku: true } },
          conversation: { include: { channel: true } },
        },
      });

      for (const opportunity of due) {
        const claimed = await this.prisma.salesOpportunity.updateMany({
          where: {
            id: opportunity.id,
            status: OpportunityStatus.OPEN,
            nextFollowUpAt: { lte: new Date() },
            OR: [{ followUpSendingAt: null }, { followUpSendingAt: { lt: new Date(Date.now() - CLAIM_LEASE_MS) } }],
          },
          data: { followUpSendingAt: new Date() },
        });
        if (claimed.count !== 1) continue;

        try {
          const sent = await this.processOne(opportunity.id);
          if (sent) processed += 1;
        } catch (error) {
          this.logger.error(`Follow-up ${opportunity.id} failed`, error instanceof Error ? error.stack : String(error));
          await this.prisma.salesOpportunity.update({
            where: { id: opportunity.id },
            data: {
              followUpSendingAt: null,
              nextFollowUpAt: new Date(Date.now() + 15 * 60 * 1000),
            },
          }).catch(() => undefined);
        }
      }
    } finally {
      this.running = false;
    }
    return { processed, skipped: false };
  }

  private async processOne(opportunityId: string) {
    const opportunity = await this.prisma.salesOpportunity.findUnique({
      where: { id: opportunityId },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        product: { select: { id: true, name: true, sku: true } },
        conversation: { include: { channel: true } },
      },
    });
    if (!opportunity || opportunity.status !== OpportunityStatus.OPEN) return false;

    if (!opportunity.customer.phone) return this.defer(opportunity.id, 'Cliente sem telefone', 24);

    const conversation = await this.findConversation(opportunity);
    if (!conversation) return this.defer(opportunity.id, 'Sem conversa AI ativa', 24);
    if (conversation.status === ConversationStatus.HUMAN_HANDLING) return this.defer(opportunity.id, 'Atendimento humano ativo', 24);
    if (conversation.status === ConversationStatus.CLOSED) return this.defer(opportunity.id, 'Conversa fechada', 24);
    if (conversation.channel.type !== ChannelType.WHATSAPP) return this.defer(opportunity.id, 'Canal ainda não suporta follow-up automático', 24);

    const context = await this.memory.getContext(opportunity.tenantId, opportunity.customerId);
    const body = this.buildMessage(opportunity, context);
    const outboundId = await this.whatsapp.sendTextToChannel(conversation.channel.id, opportunity.customer.phone, body);

    await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        sender: MessageSender.AI,
        type: MessageType.TEXT,
        content: body,
        externalId: outboundId ? `followup:${outboundId}` : undefined,
        metadata: { kind: 'SALES_FOLLOW_UP', opportunityId: opportunity.id, attempt: opportunity.followUpAttempts + 1 },
      },
    });

    const attempts = opportunity.followUpAttempts + 1;
    if (attempts >= MAX_ATTEMPTS) {
      await this.prisma.salesOpportunity.update({
        where: { id: opportunity.id },
        data: { status: OpportunityStatus.LOST, followUpAttempts: attempts, lastFollowUpAt: new Date(), nextFollowUpAt: null, followUpSendingAt: null },
      });
      return true;
    }

    const delayHours = attempts === 1 ? 24 : 72;
    await this.prisma.salesOpportunity.update({
      where: { id: opportunity.id },
      data: {
        followUpAttempts: attempts,
        lastFollowUpAt: new Date(),
        nextFollowUpAt: new Date(Date.now() + delayHours * 60 * 60 * 1000),
        followUpSendingAt: null,
      },
    });
    return true;
  }

  private async findConversation(opportunity: any) {
    if (opportunity.conversation?.status === ConversationStatus.AI_HANDLING) return opportunity.conversation;
    return this.prisma.conversation.findFirst({
      where: { tenantId: opportunity.tenantId, customerId: opportunity.customerId, status: ConversationStatus.AI_HANDLING },
      orderBy: { updatedAt: 'desc' },
      include: { channel: true },
    });
  }

  private buildMessage(opportunity: any, context: any) {
    const name = opportunity.customer.name?.trim();
    const greeting = name ? `Olá, ${name}!` : 'Olá!';
    const product = opportunity.product?.name;
    const reason = opportunity.reason || 'vi que ficou uma oportunidade em aberto';
    const recent = context.recentOrders?.find((order: any) => order.status === 'PENDING_CONFIRMATION');
    if (recent) return `${greeting} Só para confirmar: ficou um pedido pendente no seu atendimento. Se ainda tiver interesse, posso continuar a partir daqui. Se já não precisar, diga-me e encerro o pedido.`;
    if (product) return `${greeting} Vi que tinha interesse em ${product}. ${reason.includes('stock') ? 'Se quiser, posso verificar a disponibilidade atual.' : 'Se ainda estiver interessado, posso ajudar a avançar com o pedido.'}`;
    return `${greeting} Passando para saber se ainda precisa de ajuda com o que estava a procurar. Se quiser, continuamos o atendimento por aqui.`;
  }

  private async defer(id: string, reason: string, hours: number) {
    await this.prisma.salesOpportunity.update({
      where: { id },
      data: { reason, nextFollowUpAt: new Date(Date.now() + hours * 60 * 60 * 1000), followUpSendingAt: null },
    });
    return false;
  }
}
