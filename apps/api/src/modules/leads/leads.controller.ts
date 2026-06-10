import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { LeadsService } from './leads.service';
import { LeadFiltersDto } from './dto/lead-filters.dto';

@ApiTags('leads')
@Controller('leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Get()
  @ApiOperation({ summary: 'List all leads with optional filters' })
  findAll(@Query() filters: LeadFiltersDto) {
    return this.leadsService.findAll(filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a lead by ID' })
  findOne(@Param('id') id: string) {
    return this.leadsService.findById(id);
  }
}
