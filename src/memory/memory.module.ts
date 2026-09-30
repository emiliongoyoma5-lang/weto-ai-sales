import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { MemoryService } from './memory.service';
import { MemoryController } from './memory.controller';

@Module({ imports: [PrismaModule], controllers: [MemoryController], providers: [MemoryService], exports: [MemoryService] })
export class MemoryModule {}
