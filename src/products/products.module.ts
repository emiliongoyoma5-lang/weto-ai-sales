import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { ProductsController } from './products.controller';
@Module({ imports: [PrismaModule], controllers: [ProductsController] })
export class ProductsModule {}
