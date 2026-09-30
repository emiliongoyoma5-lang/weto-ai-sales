import { Injectable, NotFoundException } from '@nestjs/common';
import { ChannelType, MessageType } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { ConversationsService } from '../conversations/conversations.service';
import { WhatsAppCryptoService } from './whatsapp-crypto.service';

interface WhatsAppValue {
  messaging_product?: string;
  metadata?: { display_phone_number?: string; phone_number_id?: string };
  contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>;
  messages?: Array<{
    from?: string;
    id?: string;
    timestamp?: string;
    type?: string;
    text?: { body?: string };
    image?: { id?: string; caption?: string };
    audio?: { id?: string; voice?: boolean };
    document?: { id?: string; filename?: string; caption?: string };
  }>;
}

@Injectable()
export class WhatsAppService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly conversations: ConversationsService,
    private readonly crypto: WhatsAppCryptoService,
  ) {}

  async configure(channelId: string, accessToken: string, verifyToken: string) {
    const channel = await this.prisma.channel.findFirst({ where: { id: channelId, type: ChannelType.WHATSAPP, isActive: true } });
    if (!channel) throw new NotFoundException('Active WhatsApp channel not found');

    return this.prisma.whatsAppChannelConfig.upsert({
      where: { channelId },
      create: { channelId, accessToken: this.crypto.encrypt(accessToken), verifyToken: this.crypto.encrypt(verifyToken) },
      update: { accessToken: this.crypto.encrypt(accessToken), verifyToken: this.crypto.encrypt(verifyToken) },
      select: { channelId: true, createdAt: true, updatedAt: true },
    });
  }

  async verifyWebhook(mode: string | undefined, token: string | undefined, challenge: string | undefined, phoneNumberId: string) {
    const channel = await this.findChannelByExternalId(phoneNumberId);
    const config = await this.prisma.whatsAppChannelConfig.findUnique({ where: { channelId: channel.id } });
    if (mode !== 'subscribe' || !token || !challenge || !config || token !== this.crypto.decrypt(config.verifyToken)) {
      throw new NotFoundException('Webhook verification failed');
    }
    return challenge;
  }

  async receiveWebhook(payload: WhatsAppValue) {
    const phoneNumberId = payload.metadata?.phone_number_id;
    if (!phoneNumberId) return { accepted: false, reason: 'missing_phone_number_id' };

    const channel = await this.findChannelByExternalId(phoneNumberId);
    const messages = payload.messages ?? [];
    const results: Array<Record<string, unknown>> = [];

    for (const incoming of messages) {
      if (!incoming.from || !incoming.id) continue;
      const contact = (payload.contacts ?? []).find((c) => c.wa_id === incoming.from);
      const normalized = this.normalizeIncoming(incoming);
      const result = await this.conversations.ingestIncoming({
        tenantId: channel.tenantId,
        channelId: channel.id,
        customerExternalId: incoming.from,
        customerName: contact?.profile?.name,
        externalMessageId: incoming.id,
        type: normalized.type,
        text: normalized.text,
        metadata: { provider: 'whatsapp', timestamp: incoming.timestamp, rawType: incoming.type },
      });

      if (!result.duplicated && result.aiResult?.reply?.content) {
        const config = await this.prisma.whatsAppChannelConfig.findUnique({ where: { channelId: channel.id } });
        if (!config) throw new NotFoundException('WhatsApp channel is not configured');
        const outboundId = await this.sendText(
          phoneNumberId,
          incoming.from,
          result.aiResult.reply.content,
          this.crypto.decrypt(config.accessToken),
        );
        results.push({ messageId: incoming.id, outboundId });
      } else {
        results.push({ messageId: incoming.id, duplicated: result.duplicated });
      }
    }

    return { accepted: true, processed: results.length, results };
  }

  private normalizeIncoming(message: NonNullable<WhatsAppValue['messages']>[number]) {
    switch (message.type) {
      case 'text':
        return { type: MessageType.TEXT, text: message.text?.body?.trim() || undefined };
      case 'image':
        return { type: MessageType.IMAGE, text: message.image?.caption?.trim() || undefined };
      case 'audio':
        return { type: MessageType.AUDIO, text: undefined };
      case 'document':
        return { type: MessageType.DOCUMENT, text: message.document?.caption?.trim() || undefined };
      default:
        return { type: MessageType.UNKNOWN, text: undefined };
    }
  }

  private async findChannelByExternalId(phoneNumberId: string) {
    const channel = await this.prisma.channel.findFirst({ where: { type: ChannelType.WHATSAPP, externalId: phoneNumberId, isActive: true } });
    if (!channel) throw new NotFoundException('WhatsApp channel not registered');
    return channel;
  }

  async sendTextToChannel(channelId: string, to: string, body: string) {
    const channel = await this.prisma.channel.findFirst({ where: { id: channelId, type: ChannelType.WHATSAPP, isActive: true } });
    if (!channel) throw new NotFoundException('Active WhatsApp channel not found');
    const config = await this.prisma.whatsAppChannelConfig.findUnique({ where: { channelId } });
    if (!config) throw new NotFoundException('WhatsApp channel is not configured');
    return this.sendText(channel.externalId, to, body, this.crypto.decrypt(config.accessToken));
  }

  private async sendText(phoneNumberId: string, to: string, body: string, accessToken: string) {
    const version = process.env.WHATSAPP_GRAPH_VERSION;
    if (!version) throw new Error('WHATSAPP_GRAPH_VERSION is required');
    const response = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'text', text: { body } }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`WHATSAPP_SEND_FAILED:${response.status}:${JSON.stringify(data)}`);
    return data?.messages?.[0]?.id ?? null;
  }
}
