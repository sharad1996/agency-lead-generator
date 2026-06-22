import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import {
  LeadSourceAdapter,
  RawLead,
  SearchOptions,
} from './lead-source.adapter';

interface ApolloPerson {
  id: string;
  first_name: string;
  last_name: string;
  title: string;
  email: string | null;
  linkedin_url: string | null;
  organization: ApolloOrganization | null;
}

interface ApolloOrganization {
  id: string;
  name: string;
  website_url: string | null;
  industry: string | null;
  estimated_num_employees: number | null;
  funding_stage: string | null;
  technologies: { name: string }[];
  city: string | null;
  country: string | null;
}

@Injectable()
export class ApolloAdapter implements LeadSourceAdapter {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('APOLLO_API_KEY')!;
    this.baseUrl = this.config.get<string>('APOLLO_BASE_URL')!;
  }

  async searchLeads(options: SearchOptions): Promise<RawLead[]> {
    const response = await axios.post<{ people: ApolloPerson[] }>(
      `${this.baseUrl}/mixed_people/api_search`,
      {
        api_key: this.apiKey,
        page: options.page ?? 1,
        per_page: options.limit,
        person_titles: options.titles ?? [
          'CTO',
          'VP of Engineering',
          'Head of Engineering',
          'Engineering Manager',
          'Co-Founder',
          'Founder',
          'Technical Co-Founder',
        ],
        person_locations: options.locations ?? ['United States'],
        organization_num_employees_ranges: ['1,500'],
      },
      {
        headers: { 'Content-Type': 'application/json', 'x-api-key': this.apiKey },
      },
    );

    return (response.data.people ?? [])
      .filter((p) => p.organization !== null)
      .map((p) => this.normalize(p));
  }

  private normalize(person: ApolloPerson): RawLead {
    const org = person.organization!;
    const location = [org.city, org.country].filter(Boolean).join(', ');
    const teamSize = org.estimated_num_employees
      ? this.bucketTeamSize(org.estimated_num_employees)
      : undefined;

    return {
      source: 'apollo',
      contact: {
        apolloId: person.id,
        firstName: person.first_name,
        lastName: person.last_name?.trim() || '',
        email: person.email ?? undefined,
        linkedinUrl: person.linkedin_url ?? undefined,
        title: person.title,
      },
      company: {
        apolloId: org.id,
        name: org.name,
        website: org.website_url ?? undefined,
        industry: org.industry ?? undefined,
        teamSize,
        fundingStage: org.funding_stage ?? undefined,
        techStack: Array.isArray(org.technologies)
          ? org.technologies.map((t) => t?.name).filter(Boolean)
          : [],
        location: location || undefined,
      },
    };
  }

  private bucketTeamSize(n: number): string {
    if (n <= 10) return '1-10';
    if (n <= 50) return '11-50';
    if (n <= 200) return '51-200';
    if (n <= 500) return '201-500';
    return '500+';
  }
}
