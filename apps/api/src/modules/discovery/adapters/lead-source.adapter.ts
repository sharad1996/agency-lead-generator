export interface RawContact {
  apolloId?: string;
  firstName: string;
  lastName: string;
  email?: string;
  linkedinUrl?: string;
  title?: string;
}

export interface RawCompany {
  apolloId?: string;
  name: string;
  website?: string;
  industry?: string;
  teamSize?: string;
  fundingStage?: string;
  fundingAmount?: number;
  techStack: string[];
  location?: string;
}

export interface RawLead {
  contact: RawContact;
  company: RawCompany;
  hiringSignals?: Record<string, unknown>;
  source: string;
}

export interface SearchOptions {
  limit: number;
  page?: number;
  titles?: string[];
  locations?: string[];
}

export interface LeadSourceAdapter {
  searchLeads(options: SearchOptions): Promise<RawLead[]>;
}
