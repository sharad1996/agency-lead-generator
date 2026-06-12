import { Controller, Post, Body, Logger } from '@nestjs/common';
import { MeetingsService } from './meetings.service';

@Controller('webhooks/calcom')
export class MeetingsController {
  private readonly logger = new Logger(MeetingsController.name);

  constructor(private readonly meetingsService: MeetingsService) {}

  @Post()
  async handleCalComWebhook(@Body() body: Record<string, unknown>) {
    const triggerEvent = body['triggerEvent'] as string;
    const payload = body['payload'] as Record<string, unknown>;

    this.logger.log(`Cal.com webhook: ${triggerEvent}`);

    if (triggerEvent === 'BOOKING_CREATED' || triggerEvent === 'BOOKING_RESCHEDULED') {
      const attendees = payload['attendees'] as Array<{ email: string; name: string }>;
      const attendee = attendees?.[0];
      if (!attendee) return { ok: true };

      await this.meetingsService.handleBookingCreated({
        uid: payload['uid'] as string,
        startTime: payload['startTime'] as string,
        durationMins: (payload['length'] as number) ?? 30,
        attendeeEmail: attendee.email,
        attendeeName: attendee.name,
      });
    }

    if (triggerEvent === 'BOOKING_CANCELLED') {
      await this.meetingsService.handleBookingCancelled(payload['uid'] as string);
    }

    return { ok: true };
  }
}
