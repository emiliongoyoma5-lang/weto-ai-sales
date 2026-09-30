import { Injectable } from '@nestjs/common';
import { CustomerMemoryType, OpportunityStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class MemoryService {
  constructor(private readonly prisma: PrismaService) {}

  async getContext(tenantId: string, customerId: string) {
    const now = new Date();
    const [customer, memories, opportunities, recentOrders] = await Promise.all([
      this.prisma.customer.findFirst({ where: { id: customerId, tenantId }, select: { id: true, name: true, phone: true, email: true } }),
      this.prisma.customerMemory.findMany({
        where: { customerId, tenantId, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
        orderBy: { updatedAt: 'desc' }, take: 20,
      }),
      this.prisma.salesOpportunity.findMany({
        where: { customerId, tenantId, status: OpportunityStatus.OPEN },
        orderBy: { updatedAt: 'desc' }, take: 10,
        include: { product: { select: { id: true, name: true, sku: true } } },
      }),
      this.prisma.order.findMany({
        where: { customerId, tenantId }, orderBy: { createdAt: 'desc' }, take: 5,
        select: { id: true, status: true, total: true, createdAt: true, items: { select: { quantity: true, product: { select: { id: true, name: true, sku: true } } } } },
      }),
    ]);

    return { customer, memories, opportunities, recentOrders };
  }

  async remember(tenantId: string, customerId: string, type: CustomerMemoryType, key: string, value: string, source = 'ai', confidence = 1, expiresAt?: Date) {
    const cleanKey = key.trim().slice(0, 120);
    const cleanValue = value.trim().slice(0, 1000);
    if (!cleanKey || !cleanValue) return null;
    return this.prisma.customerMemory.upsert({
      where: { customerId_type_key: { customerId, type, key: cleanKey } },
      create: { tenantId, customerId, type, key: cleanKey, value: cleanValue, source, confidence, expiresAt },
      update: { value: cleanValue, source, confidence, expiresAt },
    });
  }

  async upsertOpportunity(input: { tenantId: string; customerId: string; conversationId?: string; productId?: string; reason?: string; nextFollowUpAt?: Date }) {
    const existing = await this.prisma.salesOpportunity.findFirst({ where: { tenantId: input.tenantId, customerId: input.customerId, status: OpportunityStatus.OPEN, productId: input.productId ?? null }, orderBy: { updatedAt: 'desc' } });
    if (existing) return this.prisma.salesOpportunity.update({ where: { id: existing.id }, data: { conversationId: input.conversationId, reason: input.reason, nextFollowUpAt: input.nextFollowUpAt, lastActivityAt: new Date() } });
    return this.prisma.salesOpportunity.create({ data: { tenantId: input.tenantId, customerId: input.customerId, conversationId: input.conversationId, productId: input.productId, reason: input.reason, nextFollowUpAt: input.nextFollowUpAt } });
  }

  async touchOpenOpportunities(tenantId: string, customerId: string) {
    await this.prisma.salesOpportunity.updateMany({ where: { tenantId, customerId, status: OpportunityStatus.OPEN }, data: { lastActivityAt: new Date(), nextFollowUpAt: new Date(Date.now() + 24 * 60 * 60 * 1000) } });
  }

  async closeOpportunitiesForProducts(tenantId: string, customerId: string, productIds: string[], status: OpportunityStatus) {
    if (!productIds.length) return;
    await this.prisma.salesOpportunity.updateMany({ where: { tenantId, customerId, status: OpportunityStatus.OPEN, productId: { in: productIds } }, data: { status, lastActivityAt: new Date(), nextFollowUpAt: null } });
  }

  async listFollowUps(tenantId: string, limit = 50) {
    return this.prisma.salesOpportunity.findMany({ where: { tenantId, status: OpportunityStatus.OPEN, nextFollowUpAt: { lte: new Date() } }, orderBy: { nextFollowUpAt: 'asc' }, take: Math.min(Math.max(limit, 1), 200), include: { customer: { select: { id: true, name: true, phone: true } }, product: { select: { id: true, name: true, sku: true } } } });
  }
}
