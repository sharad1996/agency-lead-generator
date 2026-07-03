import { Controller, Get, Post, Param, Query, Patch } from '@nestjs/common';
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
  @Patch(':stepId/edit')
  @Public()
  updateStep(
    @Param('stepId') stepId: string,
    @Query('tenantId') tenantId: string,
    @Query('subject') subject: string,
    @Query('body') body: string,
  ) {
    return this.approvalService.updateStep(stepId, tenantId, subject, body);
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
