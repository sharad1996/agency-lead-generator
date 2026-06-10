import { Module } from '@nestjs/common';
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
  ],
})
export class AppModule {}
