export interface ColdEmailInput {
  firstName: string;
  lastName: string;
  title: string | null;
  companyName: string;
  industry: string | null;
  techStack: string[];
  location: string | null;
}

export function buildColdEmailPrompt(input: ColdEmailInput): string {
  const stack = input.techStack.length ? input.techStack.join(', ') : 'modern web stack';
  const loc = input.location ? ` based in ${input.location}` : '';
  const ind = input.industry ? ` (${input.industry})` : '';
  const title = input.title ? input.title : 'tech leader';

  return `You are a senior sales rep at Conversion.io, an IT services company specialising in React, Next.js, Node.js, NestJS, and TypeScript.

Write a cold outreach email to ${input.firstName} ${input.lastName}, ${title} at ${input.companyName}${ind}${loc}. Their tech stack includes ${stack}.

Rules:
- 3–5 short sentences, no fluff
- Personalise to their stack and company size/industry
- Mention one concrete benefit (fast delivery, TypeScript expertise, NestJS microservices, etc.)
- End with a soft CTA: ask for a 20-min call
- NO subject line emojis
- Subject line max 8 words
- Body max 120 words

Respond ONLY with valid JSON (no markdown):
{"subject": "...", "body": "..."}`;
}
