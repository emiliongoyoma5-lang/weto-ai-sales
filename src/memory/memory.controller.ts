import { Controller, Get, Param, Query } from '@nestjs/common';
import { MemoryService } from './memory.service';

@Controller('memory')
export class MemoryController {
  constructor(private readonly memory: MemoryService) {}

  @Get('customers/:customerId/context')
  context(@Query('tenantId') tenantId: string, @Param('customerId') customerId: string) {
    return this.memory.getContext(tenantId, customerId);
  }

  @Get('follow-ups')
  followUps(@Query('tenantId') tenantId: string, @Query('limit') limit?: string) {
    return this.memory.listFollowUps(tenantId, limit ? Number(limit) : 50);
  }
}
