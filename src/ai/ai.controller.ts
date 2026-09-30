import { Controller, Param, Post } from '@nestjs/common';
import { AiSalesService } from './ai-sales.service';

@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiSalesService) {}

  @Post('conversations/:messageId/process')
  process(@Param('messageId') messageId: string) { return this.ai.handleIncomingMessage(messageId); }
}
