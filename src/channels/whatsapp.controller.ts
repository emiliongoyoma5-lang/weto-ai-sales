import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { IsNotEmpty, IsString } from 'class-validator';
import { WhatsAppService } from './whatsapp.service';

class ConfigureWhatsAppDto {
  @IsString() @IsNotEmpty() channelId!: string;
  @IsString() @IsNotEmpty() accessToken!: string;
  @IsString() @IsNotEmpty() verifyToken!: string;
}

@Controller('webhooks/whatsapp')
export class WhatsAppController {
  constructor(private readonly whatsapp: WhatsAppService) {}

  @Get()
  verify(
    @Query('hub.mode') mode: string | undefined,
    @Query('hub.verify_token') token: string | undefined,
    @Query('hub.challenge') challenge: string | undefined,
    @Query('phone_number_id') phoneNumberId: string,
  ) {
    return this.whatsapp.verifyWebhook(mode, token, challenge, phoneNumberId);
  }

  @Post()
  receive(@Body() payload: Record<string, unknown>) {
    return this.whatsapp.receiveWebhook(payload as never);
  }
}

@Controller('channels/whatsapp')
export class WhatsAppConfigurationController {
  constructor(private readonly whatsapp: WhatsAppService) {}

  @Post('configure')
  configure(@Body() dto: ConfigureWhatsAppDto) {
    return this.whatsapp.configure(dto.channelId, dto.accessToken, dto.verifyToken);
  }
}
