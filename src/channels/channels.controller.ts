import { Body, Controller, Post } from '@nestjs/common';
import { ChannelType } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ChannelsService } from './channels.service';

class CreateChannelDto {
  @IsString() @IsNotEmpty() tenantId!: string;
  @IsEnum(ChannelType) type!: ChannelType;
  @IsString() @IsNotEmpty() externalId!: string;
  @IsOptional() @IsString() displayName?: string;
}

@Controller('channels')
export class ChannelsController {
  constructor(private readonly channels: ChannelsService) {}
  @Post() create(@Body() dto: CreateChannelDto) {
    return this.channels.create(dto.tenantId, dto.type, dto.externalId, dto.displayName);
  }
}
