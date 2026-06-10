import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { buildScoringPrompt, LeadScoringInput } from './prompts/scoring.prompt';
import { Priority } from '@prisma/client';

export interface ScoringResult {
  score: number;
  priority: Priority;
  reasons: string[];
}

@Injectable()
export class ScoringService {
  private readonly logger = new Logger(ScoringService.name);
  private readonly openai: OpenAI;

  constructor(private readonly config: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.config.get<string>('OPENAI_API_KEY'),
    });
  }

  async scoreLead(input: LeadScoringInput): Promise<ScoringResult> {
    const prompt = buildScoringPrompt(input);

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      max_tokens: 300,
    });

    const content = response.choices[0]?.message?.content ?? '';

    let parsed: ScoringResult;
    try {
      parsed = JSON.parse(content) as ScoringResult;
    } catch {
      this.logger.error(`Invalid scoring response from AI: ${content}`);
      throw new Error('Invalid scoring response from AI');
    }

    if (
      typeof parsed.score !== 'number' ||
      !['HOT', 'WARM', 'COLD'].includes(parsed.priority) ||
      !Array.isArray(parsed.reasons)
    ) {
      this.logger.error(`Scoring response failed schema check: ${content}`);
      throw new Error('Invalid scoring response from AI');
    }

    return {
      score: Math.max(0, Math.min(100, Math.round(parsed.score))),
      priority: parsed.priority,
      reasons: parsed.reasons,
    };
  }
}
