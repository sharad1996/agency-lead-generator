import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { buildColdEmailPrompt, ColdEmailInput } from './prompts/cold-email.prompt';
import { buildFollowupEmailPrompt, FollowupEmailInput } from './prompts/followup-email.prompt';

export interface GeneratedEmail {
  subject: string;
  body: string;
}

@Injectable()
export class OutreachService {
  private readonly logger = new Logger(OutreachService.name);
  private readonly openai: OpenAI;

  constructor(private readonly config: ConfigService) {
    this.openai = new OpenAI({ apiKey: this.config.get<string>('OPENAI_API_KEY') });
  }

  async generateColdEmail(input: ColdEmailInput): Promise<GeneratedEmail> {
    const prompt = buildColdEmailPrompt(input);
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 400,
    });

    const content = response.choices[0]?.message?.content ?? '';
    return this.parseEmailResponse(content);
  }

  async generateFollowupEmail(input: FollowupEmailInput): Promise<GeneratedEmail> {
    const prompt = buildFollowupEmailPrompt(input);
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 300,
    });

    const content = response.choices[0]?.message?.content ?? '';
    return this.parseEmailResponse(content);
  }

  private parseEmailResponse(content: string): GeneratedEmail {
    try {
      const parsed = JSON.parse(content) as GeneratedEmail;
      if (typeof parsed.subject !== 'string' || typeof parsed.body !== 'string') {
        throw new Error('Missing fields');
      }
      return { subject: parsed.subject, body: parsed.body };
    } catch {
      this.logger.error(`Invalid email generation response: ${content}`);
      throw new Error('Invalid email generation response');
    }
  }
}
