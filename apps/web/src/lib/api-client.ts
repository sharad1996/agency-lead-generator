import { cookies } from 'next/headers';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';
const ORG_ID = process.env.NEXT_PUBLIC_ORG_ID ?? '00000000-0000-0000-0000-000000000001';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const cookieStore = await cookies();
  const token =
    cookieStore.get('next-auth.session-token')?.value ??
    cookieStore.get('__Secure-next-auth.session-token')?.value;
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

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

  const res = await fetch(`${API_BASE}/leads?${query}`, {
    cache: 'no-store',
    // headers: await getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch leads');
  return res.json() as Promise<LeadsResponse>;
}

export async function triggerDiscovery(limit = 50): Promise<{ jobId: string; message: string }> {
  const res = await fetch(`${API_BASE}/discovery/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // ...(await getAuthHeaders())
    },
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

export async function fetchPendingApprovals(): Promise<PendingApproval[]> {
  const res = await fetch(`${API_BASE}/approvals?tenantId=${ORG_ID}`, { cache: 'no-store' });
  const approvals = await res.json() as PendingApproval[];

  return approvals.map(approval => ({
    ...approval,
    body: approval.body.replace(/Conversion\.io/g, 'Technomatz')
  }));
  // if (!res.ok) throw new Error('Failed to fetch approvals');
  // return res.json() as Promise<PendingApproval[]>;
}


export async function approveStep(stepId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/approvals/${stepId}/approve?tenantId=${ORG_ID}`, {
    method: 'POST',
    // headers: await getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to approve step');
}

export async function updateStep(
  stepId: string,
  subject: string,
  body: string,
) {
  const res = await fetch(`${API_BASE}/approvals/${stepId}/edit?tenantId=${ORG_ID}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, {
    method: "PATCH",
    // headers: {
    //   "Content-Type": "application/json",
    // },
  });
  if (!res.ok) throw new Error('Failed to update step');
}

export async function rejectStep(stepId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/approvals/${stepId}/reject?tenantId=${ORG_ID}`, {
    method: 'POST',
    // headers: await getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to reject step');
}

export interface DashboardMetrics {
  leads: { total: number; byStatus: Record<string, number> };
  emails: { sentToday: number; sentThisWeek: number; replyRate: number };
  meetings: { scheduled: number; total: number };
  proposals: { draft: number; sent: number };
}

export async function fetchDashboardMetrics(): Promise<DashboardMetrics> {
  const res = await fetch(`${API_BASE}/dashboard/metrics?tenantId=${ORG_ID}`, {
    cache: 'no-store',
    // headers: await getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch dashboard metrics');
  return res.json() as Promise<DashboardMetrics>;
}

export interface CaseStudy {
  id: string;
  title: string;
  client: string;
  industry: string | null;
  techStack: string[];
  challenge: string;
  solution: string;
  result: string;
}

export interface RateCard {
  id: string;
  role: string;
  seniorityLevel: string;
  monthlyRate: number;
  hourlyRate: number;
  currency: string;
}

export async function fetchCaseStudies(): Promise<CaseStudy[]> {
  const res = await fetch(`${API_BASE}/case-studies?tenantId=${ORG_ID}`, {
    cache: 'no-store',
    // headers: await getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch case studies');
  return res.json() as Promise<CaseStudy[]>;
}

export async function createCaseStudy(data: Omit<CaseStudy, 'id'>): Promise<CaseStudy> {
  const res = await fetch(`${API_BASE}/case-studies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
    body: JSON.stringify({ ...data, tenantId: ORG_ID }),
  });
  if (!res.ok) throw new Error('Failed to create case study');
  return res.json() as Promise<CaseStudy>;
}

export async function deleteCaseStudy(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/case-studies/${id}`, {
    method: 'DELETE',
    // headers: await getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete case study');
}

export async function fetchRateCards(): Promise<RateCard[]> {
  const res = await fetch(`${API_BASE}/rate-cards?tenantId=${ORG_ID}`, {
    cache: 'no-store',
    // headers: await getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch rate cards');
  return res.json() as Promise<RateCard[]>;
}

export async function upsertRateCard(data: Omit<RateCard, 'id'>): Promise<RateCard> {
  const res = await fetch(`${API_BASE}/rate-cards`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // ...(await getAuthHeaders())
    },
    body: JSON.stringify({ ...data, tenantId: ORG_ID }),
  });
  if (!res.ok) throw new Error('Failed to upsert rate card');
  return res.json() as Promise<RateCard>;
}

export async function deleteRateCard(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/rate-cards/${id}`, {
    method: 'DELETE',
    // headers: await getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete rate card');
}

export interface Proposal {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  sentAt: string | null;
  opportunityId: string;
}

export async function fetchProposals(): Promise<Proposal[]> {
  const res = await fetch(`${API_BASE}/proposals?tenantId=${ORG_ID}`, {
    cache: 'no-store',
    // headers: await getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch proposals');
  return res.json() as Promise<Proposal[]>;
}

export async function createProposal(data: {
  opportunityId: string;
  projectDescription: string;
  techStackNeeded: string[];
  durationMonths: number;
  teamSize: number;
  seniorityMix: 'senior' | 'mixed' | 'junior';
}): Promise<Proposal> {
  const res = await fetch(`${API_BASE}/proposals`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // ...(await getAuthHeaders())
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create proposal');
  return res.json() as Promise<Proposal>;
}

export interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
}

export async function fetchUsers(): Promise<User[]> {
  const res = await fetch(`${API_BASE}/users`, {
    cache: 'no-store',
    // headers: await getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch users');
  return res.json() as Promise<User[]>;
}

export async function updateUserRole(id: string, role: 'ADMIN' | 'MEMBER'): Promise<User> {
  const res = await fetch(`${API_BASE}/users/${id}/role`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      // ...(await getAuthHeaders())
    },
    body: JSON.stringify({ role }),
  });
  if (!res.ok) throw new Error('Failed to update user role');
  return res.json() as Promise<User>;
}
