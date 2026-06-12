import { Controller, Get, Post, Param, Query, Body, Res, NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import { ProposalsService } from './proposals.service';
import { ProposalsRepository } from './proposals.repository';
import { PdfService } from './pdf.service';
import { CreateProposalDto } from './dto/create-proposal.dto';
import type { ProposalContent } from './prompts/proposal.prompt';

@Controller('proposals')
export class ProposalsController {
  constructor(
    private readonly proposalsService: ProposalsService,
    private readonly proposalsRepo: ProposalsRepository,
    private readonly pdfService: PdfService,
  ) {}

  @Get()
  findAll(@Query('tenantId') tenantId: string) {
    return this.proposalsRepo.findAll(tenantId);
  }

  @Post()
  create(@Body() dto: CreateProposalDto) {
    return this.proposalsService.generateProposal(dto);
  }

  @Get(':id/pdf')
  async downloadPdf(@Param('id') id: string, @Res() res: Response) {
    const proposal = await this.proposalsRepo.findById(id);
    if (!proposal) throw new NotFoundException(`Proposal ${id} not found`);

    const pdfBuffer = await this.pdfService.generateProposalPdf(
      proposal.title,
      proposal.content as unknown as ProposalContent,
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="proposal-${id}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });
    res.end(pdfBuffer);
  }
}
