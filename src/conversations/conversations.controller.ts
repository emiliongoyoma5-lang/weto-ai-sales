import { Body, Controller, Post } from '@nestjs/common';
import { MessageType } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';
import { ConversationsService } from './conversations.service';

class IngestMessageDto {
  @IsString() @IsNotEmpty() tenantId!: string;
  @IsString() @IsNotEmpty() channelId!: string;
  @IsString() @IsNotEmpty() customerExternalId!: string;
  @IsOptional() @IsString() customerName?: string;
  @IsOptional() @IsString() text?: string;
  @IsOptional() @IsEnum(MessageType) type?: MessageType;
  @IsOptional() @IsString() mediaUrl?: string;
  @IsOptional() @IsString() externalMessageId?: string;
  @IsOptional() @IsObject() metadata?: Record<string, unknown>;
}

@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}
  @Post('messages/incoming') ingest(@Body() dto: IngestMessageDto) { return this.conversations.ingestIncoming(dto); }
}
