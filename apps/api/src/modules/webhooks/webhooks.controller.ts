import { Controller, Post, Body, Logger } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';

@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(private readonly webhooksService: WebhooksService) {}

  @Post('inbound-email')
  async handleInboundEmail(@Body() body: Record<string, string>) {
    this.logger.log(`Inbound email from ${body['from']} to ${body['to']}`);
    await this.webhooksService.handleInboundEmail({
      to: body['to'] ?? '',
      from: body['from'] ?? '',
      subject: body['subject'] ?? '',
      text: body['text'] ?? '',
      headers: body['headers'] ?? '',
    });
    return { ok: true };
  }
}
