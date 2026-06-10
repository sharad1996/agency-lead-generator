const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export interface LeadContact {
  firstName: string;
  lastName: string;
  email: string | null;
  title: string | null;
}

export interface LeadCompany {
  name: string;
  website: string | null;
  industry: string | null;
  techStack: string[];
  location: string | null;
}

export interface Lead {
  id: string;
  status: string;
  score: number | null;
  priority: 'HOT' | 'WARM' | 'COLD' | null;
  scoreReasons: string[];
  source: string;
  createdAt: string;
  contact: LeadContact;
  company: LeadCompany;
}

export interface LeadsResponse {
  leads: Lead[];
  total: number;
}

export async function fetchLeads(params?: {
  page?: number;
  limit?: number;
  priority?: string;
  status?: string;
}): Promise<LeadsResponse> {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.priority) query.set('priority', params.priority);
  if (params?.status) query.set('status', params.status);

  const res = await fetch(`${API_BASE}/leads?${query}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch leads');
  return res.json() as Promise<LeadsResponse>;
}

export async function triggerDiscovery(limit = 50): Promise<{ jobId: string; message: string }> {
  const res = await fetch(`${API_BASE}/discovery/trigger`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ limit }),
  });
  if (!res.ok) throw new Error('Failed to trigger discovery');
  return res.json() as Promise<{ jobId: string; message: string }>;
}

export interface PendingApproval {
  stepId: string;
  leadId: string;
  contactName: string;
  contactEmail: string;
  contactTitle: string | null;
  companyName: string;
  subject: string;
  body: string;
  scheduledAt: string;
}

const ORG_ID = process.env.NEXT_PUBLIC_ORG_ID ?? '00000000-0000-0000-0000-000000000001';

export async function fetchPendingApprovals(): Promise<PendingApproval[]> {
  const res = await fetch(`${API_BASE}/approvals?tenantId=${ORG_ID}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch approvals');
  return res.json() as Promise<PendingApproval[]>;
}

export async function approveStep(stepId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/approvals/${stepId}/approve?tenantId=${ORG_ID}`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to approve step');
}

export async function rejectStep(stepId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/approvals/${stepId}/reject?tenantId=${ORG_ID}`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to reject step');
}
