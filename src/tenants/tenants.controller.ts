import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { IsNotEmpty, IsString } from 'class-validator';
import { TenantsService } from './tenants.service';

class CreateTenantDto {
  @IsString()
  @IsNotEmpty()
  name!: string;
}

@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  @Post()
  create(@Body() dto: CreateTenantDto) { return this.tenants.create(dto.name); }

  @Get(':id')
  get(@Param('id') id: string) { return this.tenants.getById(id); }
}
