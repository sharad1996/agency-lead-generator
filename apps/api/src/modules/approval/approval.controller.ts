import { Controller, Get, Post, Param, Query } from '@nestjs/common';
import { ApprovalService } from './approval.service';

@Controller('approvals')
export class ApprovalController {
  constructor(private readonly approvalService: ApprovalService) {}

  @Get()
  listPending(@Query('tenantId') tenantId: string) {
    return this.approvalService.listPendingApprovals(tenantId);
  }

  @Post(':stepId/approve')
  approve(@Param('stepId') stepId: string, @Query('tenantId') tenantId: string) {
    return this.approvalService.approve(stepId, tenantId);
  }

  @Post(':stepId/reject')
  reject(@Param('stepId') stepId: string, @Query('tenantId') tenantId: string) {
    return this.approvalService.reject(stepId, tenantId);
  }
}
