import { Controller, Get, Post, Param, Query } from '@nestjs/common';
import { ApprovalService } from './approval.service';
import { Public } from '../auth/public.decorator';

@Controller('approvals')
export class ApprovalController {
  constructor(private readonly approvalService: ApprovalService) { }

  @Get()
  @Public()
  listPending(@Query('tenantId') tenantId: string) {
    return this.approvalService.listPendingApprovals(tenantId);
  }

  @Post(':stepId/approve')
  @Public()
  approve(@Param('stepId') stepId: string, @Query('tenantId') tenantId: string) {
    return this.approvalService.approve(stepId, tenantId);
  }

  @Post(':stepId/reject')
  @Public()
  reject(@Param('stepId') stepId: string, @Query('tenantId') tenantId: string) {
    return this.approvalService.reject(stepId, tenantId);
  }
}
