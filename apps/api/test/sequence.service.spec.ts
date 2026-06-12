import { Test, TestingModule } from '@nestjs/testing';
import { Priority } from '@prisma/client';
import { SequenceService, SEQUENCE_DAYS } from '../src/modules/outreach/sequence.service';
import { OutreachRepository } from '../src/modules/outreach/outreach.repository';
import { OutreachService } from '../src/modules/outreach/outreach.service';

const mockRepo = {
  createSequence: jest.fn(),
  createSteps: jest.fn(),
  hasAnySentStep: jest.fn(),
  findFirstStepOfSequence: jest.fn().mockResolvedValue({ id: 'step-1' }),
};

const mockOutreachService = {
  generateColdEmail: jest.fn(),
};

const mockLeadContact = { firstName: 'Alice', lastName: 'Chen', email: 'alice@techstartup.io', title: 'CTO' };
const mockLeadCompany = { name: 'TechStartup', industry: 'SaaS', techStack: ['React'], location: 'Austin TX', website: null };

describe('SequenceService', () => {
  let service: SequenceService;

  beforeEach(async () => {
    jest.clearAllMocks();
    // Reset the default mock for findFirstStepOfSequence
    mockRepo.findFirstStepOfSequence.mockResolvedValue({ id: 'step-1' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SequenceService,
        { provide: OutreachRepository, useValue: mockRepo },
        { provide: OutreachService, useValue: mockOutreachService },
      ],
    }).compile();
    service = module.get(SequenceService);
  });

  describe('SEQUENCE_DAYS', () => {
    it('HOT has day offsets [0,1,4,9]', () => {
      expect(SEQUENCE_DAYS.HOT).toEqual([0, 1, 4, 9]);
    });

    it('STANDARD has day offsets [0,2,6,13]', () => {
      expect(SEQUENCE_DAYS.STANDARD).toEqual([0, 2, 6, 13]);
    });
  });

  describe('createForLead', () => {
    const input = {
      leadId: 'lead-1',
      tenantId: 'org-1',
      priority: 'HOT' as const,
      contact: mockLeadContact,
      company: mockLeadCompany,
    };

    it('creates HOT sequence with 4 steps', async () => {
      mockRepo.hasAnySentStep.mockResolvedValue(true);
      mockRepo.createSequence.mockResolvedValue({ id: 'seq-1' });
      mockRepo.createSteps.mockResolvedValue(undefined);
      mockOutreachService.generateColdEmail.mockResolvedValue({ subject: 'Hi', body: 'Hello' });

      const result = await service.createForLead(input);

      expect(mockRepo.createSequence).toHaveBeenCalledWith(
        expect.objectContaining({ leadId: 'lead-1', sequenceType: 'HOT' }),
      );
      const steps = mockRepo.createSteps.mock.calls[0][0];
      expect(steps).toHaveLength(4);
      expect(steps[0].sequenceId).toBe('seq-1');
      expect(result.sequenceId).toBe('seq-1');
    });

    it('sets step 1 PENDING_APPROVAL when no emails sent yet (first batch)', async () => {
      mockRepo.hasAnySentStep.mockResolvedValue(false);
      mockRepo.createSequence.mockResolvedValue({ id: 'seq-1' });
      mockRepo.createSteps.mockResolvedValue(undefined);
      mockOutreachService.generateColdEmail.mockResolvedValue({ subject: 'Hi', body: 'Hello' });

      const result = await service.createForLead(input);

      const steps = mockRepo.createSteps.mock.calls[0][0];
      expect(steps[0].status).toBe('PENDING_APPROVAL');
      expect(result.firstStepNeedsApproval).toBe(true);
    });

    it('sets step 1 APPROVED when emails already sent (auto-approve)', async () => {
      mockRepo.hasAnySentStep.mockResolvedValue(true);
      mockRepo.createSequence.mockResolvedValue({ id: 'seq-1' });
      mockRepo.createSteps.mockResolvedValue(undefined);
      mockOutreachService.generateColdEmail.mockResolvedValue({ subject: 'Hi', body: 'Hello' });

      const result = await service.createForLead(input);

      const steps = mockRepo.createSteps.mock.calls[0][0];
      expect(steps[0].status).toBe('APPROVED');
      expect(result.firstStepNeedsApproval).toBe(false);
    });

    it('uses STANDARD sequence for WARM leads', async () => {
      mockRepo.hasAnySentStep.mockResolvedValue(true);
      mockRepo.createSequence.mockResolvedValue({ id: 'seq-1' });
      mockRepo.createSteps.mockResolvedValue(undefined);
      mockOutreachService.generateColdEmail.mockResolvedValue({ subject: 'Hi', body: 'Hello' });

      await service.createForLead({ ...input, priority: Priority.WARM });

      expect(mockRepo.createSequence).toHaveBeenCalledWith(
        expect.objectContaining({ sequenceType: 'STANDARD' }),
      );
      const steps = mockRepo.createSteps.mock.calls[0][0];
      expect(steps).toHaveLength(4);
    });

    it('stores generated subject and body on step 1', async () => {
      mockRepo.hasAnySentStep.mockResolvedValue(true);
      mockRepo.createSequence.mockResolvedValue({ id: 'seq-1' });
      mockRepo.createSteps.mockResolvedValue(undefined);
      mockOutreachService.generateColdEmail.mockResolvedValue({ subject: 'Hire React devs', body: 'Hi Alice' });

      await service.createForLead(input);

      const steps = mockRepo.createSteps.mock.calls[0][0];
      expect(steps[0].subject).toBe('Hire React devs');
      expect(steps[0].body).toBe('Hi Alice');
    });
  });
});
