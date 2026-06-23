import { CaseStudy, RateCard } from '@prisma/client';

export interface ProposalPromptInput {
  clientName: string;
  companyName: string;
  industry: string | null;
  projectDescription: string;
  techStackNeeded: string[];
  durationMonths: number;
  teamSize: number;
  seniorityMix: 'senior' | 'mixed' | 'junior';
  caseStudies: Pick<CaseStudy, 'title' | 'client' | 'industry' | 'techStack' | 'challenge' | 'solution' | 'result'>[];
  rateCards: Pick<RateCard, 'role' | 'seniorityLevel' | 'monthlyRate'>[];
}

export interface ProposalContent {
  executiveSummary: string;
  proposedSolution: string;
  techStack: string[];
  timeline: string;
  teamComposition: { role: string; seniority: string; count: number; monthlyRate: number }[];
  investment: string;
  whyUs: string;
  caseStudyHighlight: string | null;
}

export function buildProposalPrompt(input: ProposalPromptInput): string {
  const caseStudyContext = input.caseStudies.length
    ? `\nRelevant past projects:\n${input.caseStudies
        .map((cs) => `- "${cs.title}" for ${cs.client} (${cs.industry ?? 'unknown industry'}): ${cs.result}`)
        .join('\n')}`
    : '';

  const rateCardContext = input.rateCards.length
    ? `\nAvailable rates (USD/month):\n${input.rateCards
        .map((rc) => `- ${rc.role} (${rc.seniorityLevel}): $${rc.monthlyRate}`)
        .join('\n')}`
    : '';

  return `You are a senior solutions consultant at Technomatz, an IT services company specialising in React, Next.js, Node.js, NestJS, and TypeScript.

Write a professional client proposal for:
- Client: ${input.clientName} at ${input.companyName}${input.industry ? ` (${input.industry})` : ''}
- Project: ${input.projectDescription}
- Tech stack needed: ${input.techStackNeeded.join(', ')}
- Duration: ${input.durationMonths} months
- Team size: ${input.teamSize} developers (${input.seniorityMix} seniority)
${caseStudyContext}
${rateCardContext}

Respond ONLY with valid JSON (no markdown, no code fences):
{
  "executiveSummary": "2-3 sentence summary of the engagement",
  "proposedSolution": "3-4 sentences on technical approach",
  "techStack": ["React", "NestJS", "..."],
  "timeline": "Description of milestones and sprint breakdown",
  "teamComposition": [
    { "role": "Frontend Developer", "seniority": "Senior", "count": 2, "monthlyRate": 8000 }
  ],
  "investment": "Total investment breakdown and final amount",
  "whyUs": "2-3 sentences on why Technomatz is the right partner",
  "caseStudyHighlight": "1-2 sentences referencing the most relevant past project, or null if none"
}`;
}
