import { Module } from '@nestjs/common';
import { PrismaModule } from './common/prisma/prisma.module';
import { MemoryModule } from './memory/memory.module';
import { ChannelsModule } from './channels/channels.module';
import { FollowUpsController } from './follow-ups.controller';
import { FollowUpsService } from './follow-ups.service';

@Module({
  imports: [PrismaModule, MemoryModule, ChannelsModule],
  controllers: [FollowUpsController],
  providers: [FollowUpsService],
})
export class FollowUpsModule {}
