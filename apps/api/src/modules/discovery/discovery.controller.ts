import {
  Controller,
  Post,
  Body,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { Public } from '../auth/public.decorator';
import { DiscoveryService } from './discovery.service';
import { QUEUES } from '../../queue/queue.constants';

class TriggerDiscoveryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 50;
}

@ApiTags('discovery')
@Controller('discovery')
export class DiscoveryController {
  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly config: ConfigService,
    @InjectQueue(QUEUES.LEAD_DISCOVERY) private readonly discoveryQueue: Queue,
  ) { }

  @Post('trigger')
  @Public()
  @ApiOperation({ summary: 'Trigger Apollo lead discovery job (max 50 leads/day)' })
  async trigger(@Body() dto: TriggerDiscoveryDto) {
    const job = await this.discoveryQueue.add('discover', { limit: dto.limit });
    return { jobId: job.id, message: `Discovery job queued for up to ${dto.limit} leads` };
  }

  @Post('run')
  @Public()
  @ApiOperation({ summary: 'Run Apollo discovery synchronously (debug only)' })
  async runNow(@Body() dto: TriggerDiscoveryDto) {
    const tenantId = this.config.get<string>('ORG_ID')!;
    const result = await this.discoveryService.runDiscovery({ limit: dto.limit, tenantId });
    return result;
  }

  @Post('run-peopledatalabs')
  @Public()
  @ApiOperation({ summary: 'Run PeopleDataLabs discovery synchronously (debug only)' })
  async runPeopleDataLabsNow(@Body() dto: TriggerDiscoveryDto) {
    const tenantId = this.config.get<string>('ORG_ID')!;
    try {
      const result = await this.discoveryService.runPeopleDataLabsDiscovery({ limit: dto.limit, tenantId });
      console.log(result, "////////result")
      return result;
    }
    catch (error) {
      const message = error instanceof Error ? error.message : 'PeopleDataLabs discovery failed';
      return {
        discovered: 0,
        error: message,
      };
    }
  }

  @Post('import/csv')
  @Public()
  @ApiOperation({ summary: 'Import leads from CSV file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async importCsv(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('CSV file is required');
    const tenantId = this.config.get<string>('ORG_ID')!;
    return this.discoveryService.importFromCsv(file.buffer, tenantId);
  }
}
