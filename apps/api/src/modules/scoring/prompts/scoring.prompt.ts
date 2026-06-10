export interface LeadScoringInput {
  companyName: string;
  industry?: string;
  location?: string;
  teamSize?: string;
  fundingStage?: string;
  fundingAmount?: number;
  techStack?: string[];
  hiringSignals?: Record<string, unknown>;
  contactTitle?: string;
}

export function buildScoringPrompt(input: LeadScoringInput): string {
  return `You are a lead scoring agent for an IT services company specializing in React.js, Next.js, Node.js, NestJS, and TypeScript development. The company provides dedicated development teams and custom software to US startups and SaaS companies.

Score this prospect 0-100 and classify as HOT (score >= 70), WARM (40-69), or COLD (< 40).

SCORING CRITERIA — apply each that matches:
+25 points: Actively hiring React, Node.js, Next.js, or TypeScript developers
+20 points: Recent funding in last 6 months (Seed, Series A, Series B, etc.)
+15 points: SaaS or product company
+15 points: US-based (United States)
+10 points: Team size 11-200 (sweet spot for outsourcing)
+10 points: Tech stack includes React, Node.js, Next.js, TypeScript, or MERN
-10 points: Team size > 500 (unlikely to need outsourcing)
-15 points: Non-tech industry (retail, food, manufacturing)
-20 points: No tech signals matching our stack

PROSPECT DATA:
Company: ${input.companyName}
Industry: ${input.industry ?? 'Unknown'}
Location: ${input.location ?? 'Unknown'}
Team Size: ${input.teamSize ?? 'Unknown'}
Funding Stage: ${input.fundingStage ?? 'Unknown'}
Funding Amount: ${input.fundingAmount ? `$${(input.fundingAmount / 1e6).toFixed(1)}M` : 'Unknown'}
Tech Stack: ${input.techStack?.join(', ') || 'Unknown'}
Hiring Signals: ${JSON.stringify(input.hiringSignals ?? {})}
Contact Title: ${input.contactTitle ?? 'Unknown'}

Respond with ONLY valid JSON — no markdown, no explanation, no code block:
{"score": <0-100>, "priority": "<HOT|WARM|COLD>", "reasons": ["<concise reason>", ...]}`;
}
