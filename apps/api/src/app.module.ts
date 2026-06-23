import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { QueueModule } from './queue/queue.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { ContactsModule } from './modules/contacts/contacts.module';
import { LeadsModule } from './modules/leads/leads.module';
import { DiscoveryModule } from './modules/discovery/discovery.module';
import { ScoringModule } from './modules/scoring/scoring.module';
import { OutreachModule } from './modules/outreach/outreach.module';
import { ApprovalModule } from './modules/approval/approval.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { MeetingsModule } from './modules/meetings/meetings.module';
import { ContentModule } from './modules/content/content.module';
import { ProposalsModule } from './modules/proposals/proposals.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { JwtGuard } from './modules/auth/jwt.guard';
import { RolesGuard } from './modules/auth/roles.guard';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    QueueModule,
    CompaniesModule,
    ContactsModule,
    LeadsModule,
    DiscoveryModule,
    ScoringModule,
    OutreachModule,
    ApprovalModule,
    WebhooksModule,
    MeetingsModule,
    ContentModule,
    ProposalsModule,
    DashboardModule,
    AuthModule,
    UsersModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
