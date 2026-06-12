import { Test, TestingModule } from '@nestjs/testing';
import { PdfService } from '../src/modules/proposals/pdf.service';
import { ProposalContent } from '../src/modules/proposals/prompts/proposal.prompt';

const mockContent: ProposalContent = {
  executiveSummary: 'We help you ship fast.',
  proposedSolution: 'We build your React app.',
  techStack: ['React', 'NestJS'],
  timeline: '3 months.',
  teamComposition: [{ role: 'Frontend Developer', seniority: 'Senior', count: 2, monthlyRate: 8000 }],
  investment: 'Total: $48,000.',
  whyUs: 'We are experts.',
  caseStudyHighlight: null,
};

describe('PdfService', () => {
  let service: PdfService;
  let mockPage: any;
  let mockBrowser: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    const puppeteer = require('puppeteer');
    mockBrowser = puppeteer.__mockBrowser;
    mockPage = puppeteer.__mockPage;

    const module: TestingModule = await Test.createTestingModule({
      providers: [PdfService],
    }).compile();
    service = module.get(PdfService);
  });

  describe('generateProposalPdf', () => {
    it('launches puppeteer, sets HTML content, returns PDF buffer', async () => {
      const result = await service.generateProposalPdf('TechStartup Proposal', mockContent);

      expect(mockBrowser.newPage).toHaveBeenCalled();
      expect(mockPage.setContent).toHaveBeenCalledWith(
        expect.stringContaining('TechStartup Proposal'),
        expect.any(Object),
      );
      expect(mockPage.pdf).toHaveBeenCalledWith(expect.objectContaining({ format: 'A4' }));
      expect(result).toBeInstanceOf(Buffer);
    });
  });
});
