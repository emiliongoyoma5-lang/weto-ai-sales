import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './common/prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { TenantsModule } from './tenants/tenants.module';
import { ChannelsModule } from './channels/channels.module';
import { ConversationsModule } from './conversations/conversations.module';
import { AiModule } from './ai/ai.module';
import { ProductsModule } from './products/products.module';
import { MemoryModule } from './memory/memory.module';
import { FollowUpsModule } from './follow-ups.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, HealthModule, TenantsModule, ChannelsModule, ConversationsModule, AiModule, ProductsModule, MemoryModule, FollowUpsModule],
})
export class AppModule {}
