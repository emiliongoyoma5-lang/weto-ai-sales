import { Controller, Post, Query } from '@nestjs/common';
import { FollowUpsService } from './follow-ups.service';

@Controller('follow-ups')
export class FollowUpsController {
  constructor(private readonly followUps: FollowUpsService) {}

  @Post('run')
  run(@Query('limit') limit?: string) {
    return this.followUps.runDueFollowUps(limit ? Number(limit) : 50);
  }
}
