export const QUEUES = {
  LEAD_DISCOVERY: 'lead-discovery',
  LEAD_SCORING: 'lead-scoring',
  OUTREACH: 'lead-outreach',
  FOLLOWUP: 'lead-followup',
  MEETING: 'lead-meeting',
  PROPOSAL: 'lead-proposal',
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];
