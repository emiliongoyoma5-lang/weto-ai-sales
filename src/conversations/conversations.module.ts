import { Module } from '@nestjs/common';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';
import { AiModule } from '../ai/ai.module';
import { MemoryModule } from '../memory/memory.module';
@Module({ imports: [AiModule, MemoryModule], controllers: [ConversationsController], providers: [ConversationsService], exports: [ConversationsService] })
export class ConversationsModule {}
