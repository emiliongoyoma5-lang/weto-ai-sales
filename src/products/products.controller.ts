import { Body, Controller, Post } from '@nestjs/common';
import { IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { PrismaService } from '../common/prisma/prisma.service';

class CreateProductDto {
  @IsString() tenantId!: string;
  @IsString() name!: string;
  @IsOptional() @IsString() sku?: string;
  @IsNumber() @Min(0) basePrice!: number;
  @IsOptional() @IsInt() @Min(0) quantity?: number;
}

@Controller('products')
export class ProductsController {
  constructor(private readonly prisma: PrismaService) {}
  @Post()
  create(@Body() dto: CreateProductDto) {
    return this.prisma.product.create({ data: { tenantId: dto.tenantId, name: dto.name, sku: dto.sku, basePrice: dto.basePrice, inventory: { create: { quantity: dto.quantity ?? 0 } } }, include: { inventory: true } });
  }
}
