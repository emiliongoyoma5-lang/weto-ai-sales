import { Injectable, NotFoundException } from '@nestjs/common';
import { ChannelType } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class ChannelsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, type: ChannelType, externalId: string, displayName?: string) {
    await this.assertTenant(tenantId);
    return this.prisma.channel.create({ data: { tenantId, type, externalId, displayName } });
  }

  async assertTenant(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
    if (!tenant) throw new NotFoundException('Tenant not found');
  }
}
