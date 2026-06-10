import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { LeadFollowupProcessor } from '../src/modules/outreach/processors/lead-followup.processor';
import { OutreachRepository } from '../src/modules/outreach/outreach.repository';
import { OutreachService } from '../src/modules/outreach/outreach.service';
import { SendGridService } from '../src/modules/outreach/sendgrid.service';
import { QUEUES } from '../src/queue/queue.constants';

const mockOutreachRepo = {
  countSentToday: jest.fn(),
  findStepById: jest.fn(),
  findFirstStepOfSequence: jest.fn().mockResolvedValue({ id: 'step-1', subject: 'Original subject' }),
  updateStep: jest.fn(),
  updateSequence: jest.fn(),
};
const mockOutreachService = { generateFollowupEmail: jest.fn() };
const mockSendGrid = { sendEmail: jest.fn() };

const mockStep = {
  id: 'step-2',
  stepNumber: 2,
  status: 'PENDING',
  sequence: {
    id: 'seq-1',
    status: 'ACTIVE',
    sequenceType: 'HOT',
    lead: {
      id: 'lead-1',
      tenantId: 'org-1',
      contact: { email: 'alice@techstartup.io', firstName: 'Alice' },
      company: { name: 'TechStartup' },
    },
  },
};

describe('LeadFollowupProcessor', () => {
  let processor: LeadFollowupProcessor;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockOutreachRepo.findStepById.mockResolvedValue(mockStep);
    mockOutreachRepo.findFirstStepOfSequence.mockResolvedValue({ id: 'step-1', subject: 'Original subject' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeadFollowupProcessor,
        { provide: OutreachRepository, useValue: mockOutreachRepo },
        { provide: OutreachService, useValue: mockOutreachService },
        { provide: SendGridService, useValue: mockSendGrid },
        { provide: getQueueToken(QUEUES.FOLLOWUP), useValue: {} },
      ],
    }).compile();
    processor = module.get(LeadFollowupProcessor);
  });

  it('sends follow-up email when sequence is ACTIVE and under daily limit', async () => {
    mockOutreachRepo.countSentToday.mockResolvedValue(10);
    mockOutreachService.generateFollowupEmail.mockResolvedValue({ subject: 'Re: Hi', body: 'Following up' });
    mockSendGrid.sendEmail.mockResolvedValue('msg-2');

    await processor.process({ data: { stepId: 'step-2' } } as any);

    expect(mockOutreachService.generateFollowupEmail).toHaveBeenCalledWith(
      expect.objectContaining({ stepNumber: 2, firstName: 'Alice', companyName: 'TechStartup' }),
    );
    expect(mockSendGrid.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'alice@techstartup.io', leadId: 'lead-1' }),
    );
    expect(mockOutreachRepo.updateStep).toHaveBeenCalledWith('step-2', expect.objectContaining({ status: 'SENT' }));
  });

  it('skips and reschedules when daily limit reached', async () => {
    mockOutreachRepo.countSentToday.mockResolvedValue(25);

    const mockJob = { data: { stepId: 'step-2' }, moveToDelayed: jest.fn() };
    await processor.process(mockJob as any);

    expect(mockJob.moveToDelayed).toHaveBeenCalled();
    expect(mockSendGrid.sendEmail).not.toHaveBeenCalled();
  });

  it('skips when sequence is not ACTIVE (e.g. STOPPED)', async () => {
    mockOutreachRepo.findStepById.mockResolvedValue({
      ...mockStep,
      sequence: { ...mockStep.sequence, status: 'STOPPED' },
    });

    await processor.process({ data: { stepId: 'step-2' } } as any);

    expect(mockSendGrid.sendEmail).not.toHaveBeenCalled();
  });

  it('marks sequence COMPLETED after last step (step 4 for HOT)', async () => {
    const lastStep = { ...mockStep, id: 'step-4', stepNumber: 4 };
    mockOutreachRepo.findStepById.mockResolvedValue(lastStep);
    mockOutreachRepo.countSentToday.mockResolvedValue(0);
    mockOutreachService.generateFollowupEmail.mockResolvedValue({ subject: 'Re: final', body: 'Last one' });
    mockSendGrid.sendEmail.mockResolvedValue('msg-4');

    await processor.process({ data: { stepId: 'step-4' } } as any);

    expect(mockOutreachRepo.updateSequence).toHaveBeenCalledWith(
      'seq-1',
      expect.objectContaining({ status: 'COMPLETED' }),
    );
  });

  it('uses previousSubject from step 1 when generating followup', async () => {
    mockOutreachRepo.countSentToday.mockResolvedValue(0);
    mockOutreachService.generateFollowupEmail.mockResolvedValue({ subject: 'Re: Original subject', body: 'Follow up' });
    mockSendGrid.sendEmail.mockResolvedValue('msg-2');

    await processor.process({ data: { stepId: 'step-2' } } as any);

    expect(mockOutreachService.generateFollowupEmail).toHaveBeenCalledWith(
      expect.objectContaining({ previousSubject: 'Original subject' }),
    );
  });
});
