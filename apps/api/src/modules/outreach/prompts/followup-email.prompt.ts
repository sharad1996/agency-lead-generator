export interface FollowupEmailInput {
  firstName: string;
  companyName: string;
  stepNumber: number;
  previousSubject: string;
}

const FOLLOWUP_TONE: Record<number, string> = {
  2: 'Brief and friendly — assume they were busy, not uninterested.',
  3: 'Add a tiny bit of value — mention a React/Next.js trend or quick insight.',
  4: 'Final polite nudge — acknowledge this is the last email in this thread.',
};

export function buildFollowupEmailPrompt(input: FollowupEmailInput): string {
  const tone = FOLLOWUP_TONE[input.stepNumber] ?? FOLLOWUP_TONE[2];

  return `You are a senior sales rep at Conversion.io.

Write follow-up email #${input.stepNumber - 1} to ${input.firstName} at ${input.companyName}. The original thread subject was "${input.previousSubject}".

Tone: ${tone}

Rules:
- 2–4 sentences max
- Do NOT repeat the original pitch verbatim
- Subject: prefix with "Re: " then shorten the original subject
- Body max 80 words

Respond ONLY with valid JSON (no markdown):
{"subject": "...", "body": "..."}`;
}
