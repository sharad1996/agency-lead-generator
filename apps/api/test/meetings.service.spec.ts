import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MeetingsService } from '../src/modules/meetings/meetings.service';
import { MeetingsRepository } from '../src/modules/meetings/meetings.repository';
import { LeadsRepository } from '../src/modules/leads/leads.repository';
import { PrismaService } from '../src/prisma/prisma.service';

const mockMeetingsRepo = {
  findOrCreateOpportunity: jest.fn(),
  createMeeting: jest.fn(),
  cancelMeeting: jest.fn(),
};
const mockLeadsRepo = { updateStatus: jest.fn() };
const mockPrisma = {
  contact: {
    findFirst: jest.fn(),
  },
};
const configMock = { get: (k: string) => (k === 'ORG_ID' ? 'org-1' : undefined) };

const mockContact = {
  id: 'contact-1',
  email: 'alice@techstartup.io',
  firstName: 'Alice',
  lastName: 'Chen',
  tenantId: 'org-1',
  leads: [{ id: 'lead-1', tenantId: 'org-1' }],
  company: { name: 'TechStartup' },
};

describe('MeetingsService', () => {
  let service: MeetingsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MeetingsService,
        { provide: MeetingsRepository, useValue: mockMeetingsRepo },
        { provide: LeadsRepository, useValue: mockLeadsRepo },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();
    service = module.get(MeetingsService);
    jest.clearAllMocks();
  });

  describe('handleBookingCreated', () => {
    it('creates meeting and moves lead to MEETING_BOOKED', async () => {
      mockPrisma.contact.findFirst.mockResolvedValue(mockContact);
      mockMeetingsRepo.findOrCreateOpportunity.mockResolvedValue({ id: 'opp-1' });
      mockMeetingsRepo.createMeeting.mockResolvedValue({ id: 'mtg-1' });

      await service.handleBookingCreated({
        uid: 'uid-123',
        startTime: '2026-06-20T10:00:00Z',
        durationMins: 30,
        attendeeEmail: 'alice@techstartup.io',
        attendeeName: 'Alice Chen',
      });

      expect(mockMeetingsRepo.findOrCreateOpportunity).toHaveBeenCalledWith(
        'lead-1',
        'org-1',
        'Alice Chen at TechStartup',
      );
      expect(mockMeetingsRepo.createMeeting).toHaveBeenCalledWith(
        expect.objectContaining({ calComEventId: 'uid-123', durationMins: 30, leadId: 'lead-1' }),
      );
      expect(mockLeadsRepo.updateStatus).toHaveBeenCalledWith('lead-1', 'MEETING_BOOKED');
    });

    it('skips gracefully when no contact found for email', async () => {
      mockPrisma.contact.findFirst.mockResolvedValue(null);

      await service.handleBookingCreated({
        uid: 'uid-x',
        startTime: '2026-06-20T10:00:00Z',
        durationMins: 30,
        attendeeEmail: 'unknown@example.com',
        attendeeName: 'Unknown Person',
      });

      expect(mockMeetingsRepo.createMeeting).not.toHaveBeenCalled();
      expect(mockLeadsRepo.updateStatus).not.toHaveBeenCalled();
    });

    it('skips when contact has no leads', async () => {
      mockPrisma.contact.findFirst.mockResolvedValue({ ...mockContact, leads: [] });

      await service.handleBookingCreated({
        uid: 'uid-x',
        startTime: '2026-06-20T10:00:00Z',
        durationMins: 30,
        attendeeEmail: 'alice@techstartup.io',
        attendeeName: 'Alice Chen',
      });

      expect(mockMeetingsRepo.createMeeting).not.toHaveBeenCalled();
    });
  });

  describe('handleBookingCancelled', () => {
    it('cancels the meeting by calComEventId', async () => {
      mockMeetingsRepo.cancelMeeting.mockResolvedValue(undefined);

      await service.handleBookingCancelled('uid-123');

      expect(mockMeetingsRepo.cancelMeeting).toHaveBeenCalledWith('uid-123');
    });
  });
});
