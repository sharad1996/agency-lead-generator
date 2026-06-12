import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ApprovalService } from '../src/modules/approval/approval.service';
import { OutreachRepository } from '../src/modules/outreach/outreach.repository';
import { LeadsRepository } from '../src/modules/leads/leads.repository';
import { SendGridService } from '../src/modules/outreach/sendgrid.service';
import { getQueueToken } from '@nestjs/bullmq';
import { QUEUES } from '../src/queue/queue.constants';

const mockOutreachRepo = {
  findPendingApprovalSteps: jest.fn(),
  findStepById: jest.fn(),
  findPendingStepsBySequenceId: jest.fn(),
  updateStep: jest.fn(),
  updateSequence: jest.fn(),
};
const mockLeadsRepo = { updateStatus: jest.fn() };
const mockSendGrid = { sendEmail: jest.fn() };
const mockFollowupQueue = { add: jest.fn() };

const approvalStep = {
  id: 'step-1',
  status: 'PENDING_APPROVAL',
  subject: 'Hello Alice',
  body: 'We help with React dev',
  stepNumber: 1,
  scheduledAt: new Date('2026-06-10T10:00:00Z'),
  sequence: {
    id: 'seq-1',
    sequenceType: 'HOT',
    status: 'ACTIVE',
    lead: {
      id: 'lead-1',
      tenantId: 'org-1',
      contact: { firstName: 'Alice', lastName: 'Chen', email: 'alice@techstartup.io', title: 'CTO' },
      company: { name: 'TechStartup' },
    },
  },
};

describe('ApprovalService', () => {
  let service: ApprovalService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockOutreachRepo.findPendingStepsBySequenceId.mockResolvedValue([
      { id: 'step-2', stepNumber: 2 },
      { id: 'step-3', stepNumber: 3 },
      { id: 'step-4', stepNumber: 4 },
    ]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApprovalService,
        { provide: OutreachRepository, useValue: mockOutreachRepo },
        { provide: LeadsRepository, useValue: mockLeadsRepo },
        { provide: SendGridService, useValue: mockSendGrid },
        { provide: getQueueToken(QUEUES.FOLLOWUP), useValue: mockFollowupQueue },
      ],
    }).compile();
    service = module.get(ApprovalService);
  });

  describe('listPendingApprovals', () => {
    it('returns pending steps with lead details', async () => {
      mockOutreachRepo.findPendingApprovalSteps.mockResolvedValue([approvalStep]);
      const result = await service.listPendingApprovals('org-1');
      expect(result).toHaveLength(1);
      expect(result[0].stepId).toBe('step-1');
      expect(result[0].contactEmail).toBe('alice@techstartup.io');
      expect(result[0].contactName).toBe('Alice Chen');
      expect(result[0].companyName).toBe('TechStartup');
    });
  });

  describe('approve', () => {
    it('sends email, marks step SENT, updates lead OUTREACH_SENT', async () => {
      mockOutreachRepo.findStepById.mockResolvedValue(approvalStep);
      mockSendGrid.sendEmail.mockResolvedValue('msg-1');

      await service.approve('step-1', 'org-1');

      expect(mockSendGrid.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'alice@techstartup.io', subject: 'Hello Alice' }),
      );
      expect(mockOutreachRepo.updateStep).toHaveBeenCalledWith(
        'step-1',
        expect.objectContaining({ status: 'SENT' }),
      );
      expect(mockLeadsRepo.updateStatus).toHaveBeenCalledWith('lead-1', 'OUTREACH_SENT');
    });

    it('schedules follow-up jobs for pending steps', async () => {
      mockOutreachRepo.findStepById.mockResolvedValue(approvalStep);
      mockSendGrid.sendEmail.mockResolvedValue('msg-1');

      await service.approve('step-1', 'org-1');

      expect(mockFollowupQueue.add).toHaveBeenCalledWith(
        'send-followup',
        { stepId: 'step-2' },
        expect.objectContaining({ delay: expect.any(Number) }),
      );
      expect(mockFollowupQueue.add).toHaveBeenCalledTimes(3);
    });

    it('skips re-approval when step is already SENT', async () => {
      mockOutreachRepo.findStepById.mockResolvedValue({ ...approvalStep, status: 'SENT' });

      await service.approve('step-1', 'org-1');

      expect(mockSendGrid.sendEmail).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when step not found', async () => {
      mockOutreachRepo.findStepById.mockResolvedValue(null);
      await expect(service.approve('bad-id', 'org-1')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when tenantId does not match', async () => {
      mockOutreachRepo.findStepById.mockResolvedValue({
        ...approvalStep,
        sequence: { ...approvalStep.sequence, lead: { ...approvalStep.sequence.lead, tenantId: 'other' } },
      });
      await expect(service.approve('step-1', 'org-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('reject', () => {
    it('marks step FAILED, stops sequence, disqualifies lead', async () => {
      mockOutreachRepo.findStepById.mockResolvedValue(approvalStep);

      await service.reject('step-1', 'org-1');

      expect(mockOutreachRepo.updateStep).toHaveBeenCalledWith('step-1', { status: 'FAILED' });
      expect(mockOutreachRepo.updateSequence).toHaveBeenCalledWith('seq-1', expect.objectContaining({ status: 'STOPPED' }));
      expect(mockLeadsRepo.updateStatus).toHaveBeenCalledWith('lead-1', 'DISQUALIFIED');
    });

    it('throws NotFoundException when step not found on reject', async () => {
      mockOutreachRepo.findStepById.mockResolvedValue(null);
      await expect(service.reject('bad-id', 'org-1')).rejects.toThrow(NotFoundException);
    });
  });
});
