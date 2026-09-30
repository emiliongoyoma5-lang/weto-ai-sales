import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
@Module({ imports: [PrismaModule], exports: [PrismaModule] })
export class OrdersModule {}
