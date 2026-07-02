import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MulterModule } from '@nestjs/platform-express';
import { DiscoveryService } from './discovery.service';
import { DiscoveryController } from './discovery.controller';
import { LeadDiscoveryProcessor } from './processors/lead-discovery.processor';
import { ApolloAdapter } from './adapters/apollo.adapter';
import { PeopleDataLabsAdapter } from './adapters/peopledatalabs.adapter';
import { CsvAdapter } from './adapters/csv.adapter';
import { CompaniesModule } from '../companies/companies.module';
import { ContactsModule } from '../contacts/contacts.module';
import { LeadsModule } from '../leads/leads.module';
import { QUEUES } from '../../queue/queue.constants';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: QUEUES.LEAD_DISCOVERY },
      { name: QUEUES.LEAD_SCORING },
    ),
    MulterModule.register({ limits: { fileSize: 5 * 1024 * 1024 } }),
    CompaniesModule,
    ContactsModule,
    LeadsModule,
  ],
  providers: [DiscoveryService, LeadDiscoveryProcessor, ApolloAdapter, PeopleDataLabsAdapter, CsvAdapter],
  controllers: [DiscoveryController],
  exports: [DiscoveryService],
})
export class DiscoveryModule {}
