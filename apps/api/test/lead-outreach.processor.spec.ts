import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { LeadOutreachProcessor } from '../src/modules/outreach/processors/lead-outreach.processor';
import { LeadsRepository } from '../src/modules/leads/leads.repository';
import { SequenceService } from '../src/modules/outreach/sequence.service';
import { SendGridService } from '../src/modules/outreach/sendgrid.service';
import { OutreachRepository } from '../src/modules/outreach/outreach.repository';
import { PrismaService } from '../src/prisma/prisma.service';
import { QUEUES } from '../src/queue/queue.constants';

const mockLeadsRepo = { updateStatus: jest.fn() };
const mockSequenceService = { createForLead: jest.fn() };
const mockSendGrid = { sendEmail: jest.fn() };
const mockOutreachRepo = {
  countSentToday: jest.fn(),
  updateStep: jest.fn(),
  updateSequence: jest.fn(),
  findStepById: jest.fn(),
  findPendingStepsBySequenceId: jest.fn().mockResolvedValue([]),
};
const mockFollowupQueue = { add: jest.fn() };
const mockPrisma = {
  lead: { findUnique: jest.fn() },
};

const mockLead = {
  id: 'lead-1',
  tenantId: 'org-1',
  score: 80,
  priority: 'HOT',
  contact: { firstName: 'Alice', lastName: 'Chen', email: 'alice@techstartup.io', title: 'CTO' },
  company: { name: 'TechStartup', industry: 'SaaS', techStack: ['React'], location: 'Austin TX', website: null },
};

describe('LeadOutreachProcessor', () => {
  let processor: LeadOutreachProcessor;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockOutreachRepo.findStepById.mockResolvedValue({
      id: 'step-1', subject: 'Hi', body: 'Hello', stepNumber: 1,
      sequence: { id: 'seq-1', leadId: 'lead-1' },
    });
    mockOutreachRepo.findPendingStepsBySequenceId.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeadOutreachProcessor,
        { provide: LeadsRepository, useValue: mockLeadsRepo },
        { provide: SequenceService, useValue: mockSequenceService },
        { provide: SendGridService, useValue: mockSendGrid },
        { provide: OutreachRepository, useValue: mockOutreachRepo },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: getQueueToken(QUEUES.FOLLOWUP), useValue: mockFollowupQueue },
      ],
    }).compile();
    processor = module.get(LeadOutreachProcessor);
  });

  it('creates sequence and updates lead to OUTREACH_PENDING_APPROVAL when first batch', async () => {
    mockPrisma.lead.findUnique.mockResolvedValue(mockLead);
    mockOutreachRepo.countSentToday.mockResolvedValue(0);
    mockSequenceService.createForLead.mockResolvedValue({
      sequenceId: 'seq-1',
      firstStepId: 'step-1',
      firstStepNeedsApproval: true,
    });

    await processor.process({ data: { leadId: 'lead-1' } } as any);

    expect(mockLeadsRepo.updateStatus).toHaveBeenCalledWith('lead-1', 'OUTREACH_PENDING_APPROVAL');
  });

  it('sends email and updates lead to OUTREACH_SENT when auto-approved', async () => {
    mockPrisma.lead.findUnique.mockResolvedValue(mockLead);
    mockOutreachRepo.countSentToday.mockResolvedValue(0);
    mockSequenceService.createForLead.mockResolvedValue({
      sequenceId: 'seq-1',
      firstStepId: 'step-1',
      firstStepNeedsApproval: false,
    });
    mockSendGrid.sendEmail.mockResolvedValue('msg-1');

    await processor.process({ data: { leadId: 'lead-1' } } as any);

    expect(mockSendGrid.sendEmail).toHaveBeenCalled();
    expect(mockLeadsRepo.updateStatus).toHaveBeenCalledWith('lead-1', 'OUTREACH_SENT');
  });

  it('skips and reschedules when daily limit reached', async () => {
    mockPrisma.lead.findUnique.mockResolvedValue(mockLead);
    mockOutreachRepo.countSentToday.mockResolvedValue(25);

    const mockJob = { data: { leadId: 'lead-1' }, moveToDelayed: jest.fn() };
    await processor.process(mockJob as any);

    expect(mockJob.moveToDelayed).toHaveBeenCalled();
    expect(mockSequenceService.createForLead).not.toHaveBeenCalled();
  });

  it('skips gracefully if lead not found', async () => {
    mockPrisma.lead.findUnique.mockResolvedValue(null);
    await processor.process({ data: { leadId: 'missing' } } as any);
    expect(mockSequenceService.createForLead).not.toHaveBeenCalled();
  });

  it('schedules follow-up jobs with { stepId } for each pending step', async () => {
    mockPrisma.lead.findUnique.mockResolvedValue(mockLead);
    mockOutreachRepo.countSentToday.mockResolvedValue(0);
    mockSequenceService.createForLead.mockResolvedValue({
      sequenceId: 'seq-1',
      firstStepId: 'step-1',
      firstStepNeedsApproval: false,
    });
    mockSendGrid.sendEmail.mockResolvedValue('msg-1');
    mockOutreachRepo.findPendingStepsBySequenceId.mockResolvedValue([
      { id: 'step-2', stepNumber: 2 },
      { id: 'step-3', stepNumber: 3 },
    ]);

    await processor.process({ data: { leadId: 'lead-1' } } as any);

    expect(mockFollowupQueue.add).toHaveBeenCalledWith(
      'send-followup',
      { stepId: 'step-2' },
      expect.objectContaining({ delay: expect.any(Number) }),
    );
    expect(mockFollowupQueue.add).toHaveBeenCalledTimes(2);
  });
});
