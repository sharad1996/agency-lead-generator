import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { MeetingsModule } from '../meetings/meetings.module';
import { ProposalsModule } from '../proposals/proposals.module';

@Module({
  imports: [MeetingsModule, ProposalsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
