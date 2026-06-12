import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sgMail from '@sendgrid/mail';

export interface SendEmailOptions {
  to: string;
  leadId: string;
  subject: string;
  body: string;
}

@Injectable()
export class SendGridService {
  private readonly logger = new Logger(SendGridService.name);
  private readonly fromEmail: string;
  private readonly fromName: string;
  private readonly outreachDomain: string;

  constructor(private readonly config: ConfigService) {
    sgMail.setApiKey(this.config.get<string>('SENDGRID_API_KEY')!);
    this.fromEmail = this.config.get<string>('FROM_EMAIL')!;
    this.fromName = this.config.get<string>('FROM_NAME')!;
    this.outreachDomain = this.config.get<string>('OUTREACH_DOMAIN')!;
  }

  async sendEmail(opts: SendEmailOptions): Promise<string> {
    const replyTo = `reply+${opts.leadId}@${this.outreachDomain}`;

    const [response] = await sgMail.send({
      to: opts.to,
      from: { email: this.fromEmail, name: this.fromName },
      replyTo,
      subject: opts.subject,
      text: opts.body,
      html: opts.body.replace(/\n/g, '<br>'),
    });

    const messageId = (response.headers as Record<string, string>)['x-message-id'] ?? '';
    this.logger.log(`Email sent to ${opts.to} — messageId=${messageId}`);
    return messageId;
  }
}
