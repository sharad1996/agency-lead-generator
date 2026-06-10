import { Test, TestingModule } from '@nestjs/testing';
import { WebhooksService } from '../src/modules/webhooks/webhooks.service';
import { OutreachRepository } from '../src/modules/outreach/outreach.repository';
import { LeadsRepository } from '../src/modules/leads/leads.repository';

const mockOutreachRepo = {
  findSequencesByLeadId: jest.fn(),
  updateSequence: jest.fn(),
};
const mockLeadsRepo = { updateStatus: jest.fn() };

describe('WebhooksService', () => {
  let service: WebhooksService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhooksService,
        { provide: OutreachRepository, useValue: mockOutreachRepo },
        { provide: LeadsRepository, useValue: mockLeadsRepo },
      ],
    }).compile();
    service = module.get(WebhooksService);
  });

  describe('handleInboundEmail', () => {
    it('stops sequence and marks lead REPLIED when leadId extracted from To address', async () => {
      mockOutreachRepo.findSequencesByLeadId.mockResolvedValue([{ id: 'seq-1', tenantId: 'org-1', status: 'ACTIVE' }]);

      await service.handleInboundEmail({
        to: 'reply+lead-abc123@outreach.example.com',
        from: 'alice@techstartup.io',
        subject: 'Re: Hello',
        text: 'Thanks for reaching out',
        headers: '',
      });

      expect(mockOutreachRepo.findSequencesByLeadId).toHaveBeenCalledWith('lead-abc123');
      expect(mockOutreachRepo.updateSequence).toHaveBeenCalledWith('seq-1', expect.objectContaining({ status: 'STOPPED' }));
      expect(mockLeadsRepo.updateStatus).toHaveBeenCalledWith('lead-abc123', 'REPLIED');
    });

    it('does nothing when To address does not match reply+ pattern', async () => {
      await service.handleInboundEmail({
        to: 'random@outreach.example.com',
        from: 'alice@techstartup.io',
        subject: 'Hi',
        text: 'Hello',
        headers: '',
      });

      expect(mockOutreachRepo.findSequencesByLeadId).not.toHaveBeenCalled();
    });

    it('does nothing when no sequences found for leadId', async () => {
      mockOutreachRepo.findSequencesByLeadId.mockResolvedValue([]);

      await service.handleInboundEmail({
        to: 'reply+lead-abc123@outreach.example.com',
        from: 'alice@techstartup.io',
        subject: 'Re: Hi',
        text: '',
        headers: '',
      });

      expect(mockOutreachRepo.updateSequence).not.toHaveBeenCalled();
    });

    it('does nothing when sequence already stopped', async () => {
      mockOutreachRepo.findSequencesByLeadId.mockResolvedValue([{ id: 'seq-1', tenantId: 'org-1', status: 'STOPPED' }]);

      await service.handleInboundEmail({
        to: 'reply+lead-abc123@outreach.example.com',
        from: 'alice@techstartup.io',
        subject: 'Re: Hi',
        text: 'No thanks',
        headers: '',
      });

      expect(mockOutreachRepo.updateSequence).not.toHaveBeenCalled();
      expect(mockLeadsRepo.updateStatus).not.toHaveBeenCalled();
    });
  });
});
