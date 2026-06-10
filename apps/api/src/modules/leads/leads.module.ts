import { Module } from '@nestjs/common';
import { LeadsRepository } from './leads.repository';
import { LeadsService } from './leads.service';
import { LeadsController } from './leads.controller';

@Module({
  providers: [LeadsRepository, LeadsService],
  controllers: [LeadsController],
  exports: [LeadsService, LeadsRepository],
})
export class LeadsModule {}
