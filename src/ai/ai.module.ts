import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../common/prisma/prisma.module';
import { AiController } from './ai.controller';
import { AiProviderService } from './ai-provider.service';
import { AiSalesService } from './ai-sales.service';
import { MemoryModule } from '../memory/memory.module';

@Module({
  imports: [ConfigModule, PrismaModule, MemoryModule],
  controllers: [AiController],
  providers: [AiProviderService, AiSalesService],
  exports: [AiSalesService],
})
export class AiModule {}
