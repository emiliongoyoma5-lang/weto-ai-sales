import { Module } from '@nestjs/common';
import { ChannelsController } from './channels.controller';
import { ChannelsService } from './channels.service';
import { WhatsAppController, WhatsAppConfigurationController } from './whatsapp.controller';
import { WhatsAppCryptoService } from './whatsapp-crypto.service';
import { WhatsAppService } from './whatsapp.service';
import { ConversationsModule } from '../conversations/conversations.module';

@Module({
  imports: [ConversationsModule],
  controllers: [ChannelsController, WhatsAppController, WhatsAppConfigurationController],
  providers: [ChannelsService, WhatsAppService, WhatsAppCryptoService],
  exports: [ChannelsService, WhatsAppService],
})
export class ChannelsModule {}
