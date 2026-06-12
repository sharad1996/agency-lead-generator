import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { OutreachModule } from '../outreach/outreach.module';
import { LeadsModule } from '../leads/leads.module';

@Module({
  imports: [OutreachModule, LeadsModule],
  controllers: [WebhooksController],
  providers: [WebhooksService],
})
export class WebhooksModule {}
