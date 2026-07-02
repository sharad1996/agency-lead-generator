import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import {
  LeadSourceAdapter,
  RawLead,
  SearchOptions,
} from './lead-source.adapter';

@Injectable()
export class PeopleDataLabsAdapter implements LeadSourceAdapter {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('PEOPLEDATALABS_API_KEY') ?? '';
    this.baseUrl = this.config.get<string>('PEOPLEDATALABS_BASE_URL') ?? 'https://api.peopledatalabs.com/v5';
  }

  async searchLeads(options: SearchOptions): Promise<RawLead[]> {
    if (!this.apiKey) {
      throw new Error('PEOPLEDATALABS_API_KEY is not configured');
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/company/search`,
        {
          query: {
            bool: {
              must: [
                {
                  term: {
                    'location.country': 'United States',
                  },
                },
              ],
            },
          },
          size: options.limit,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Api-Key': this.apiKey,
          },
        },
      );

      const companies = this.extractResults(response.data);
      if (!companies.length) {
        throw new Error('PeopleDataLabs returned no companies for the provided query.');
      }

      return companies.map((company) => this.normalize(company));
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const detail = error.response?.data;
        const message = typeof detail === 'string'
          ? detail
          : JSON.stringify(detail ?? {});

        throw new Error(`PeopleDataLabs request failed (status ${status}): ${message}`);
      }

      throw error;
    }
  }

  private extractResults(payload: Record<string, unknown>): Record<string, unknown>[] {
    if (Array.isArray(payload)) return payload as Record<string, unknown>[];
    if (Array.isArray((payload as Record<string, unknown>)?.data)) {
      return (payload as Record<string, unknown>).data as Record<string, unknown>[];
    }
    if (Array.isArray((payload as Record<string, unknown>)?.companies)) {
      return (payload as Record<string, unknown>).companies as Record<string, unknown>[];
    }
    if (Array.isArray((payload as Record<string, unknown>)?.results)) {
      return (payload as Record<string, unknown>).results as Record<string, unknown>[];
    }
    return [];
  }

  private normalize(company: Record<string, unknown>): RawLead {
    const companyName = this.asString(company.name) ?? this.asString(company.company_name) ?? 'Unnamed Company';
    const primaryContact = this.resolvePrimaryContact(company);
    const contactName = this.extractContactName(primaryContact, companyName);
    const location = this.buildLocation(company);
    const employeeCount = this.resolveEmployeeCount(company);
    const teamSize = employeeCount ? this.bucketTeamSize(employeeCount) : undefined;

    return {
      source: 'peopledatalabs',
      contact: {
        firstName: contactName.firstName,
        lastName: contactName.lastName,
        email: this.asString(company.email) ?? this.asString(company.contact_email) ?? this.asString(primaryContact?.email) ?? undefined,
        linkedinUrl: this.asString(company.linkedin_url) ?? this.asString(company.linkedinUrl) ?? this.asString(primaryContact?.linkedin_url) ?? undefined,
        title: this.asString(company.title) ?? this.asString(primaryContact?.title) ?? this.asString(primaryContact?.job_title) ?? undefined,
      },
      company: {
        name: companyName,
        website: this.buildWebsite(company),
        industry: this.asString(company.industry) ?? this.asString(company.industry_name) ?? undefined,
        teamSize,
        fundingStage: this.asString(company.funding_stage) ?? this.asString(company.fundingStage) ?? undefined,
        techStack: this.extractTechStack(company),
        location: location || undefined,
      },
      hiringSignals: {
        source: 'peopledatalabs',
        employeeCount,
        employeeCountRange: this.asString(company.employee_count_range) ?? this.asString(company.employee_count) ?? undefined,
      },
    };
  }

  private resolvePrimaryContact(company: Record<string, unknown>): Record<string, unknown> | null {
    const candidates = [
      company.primary_contact,
      company.contact,
      company.person,
      company.owner,
    ];

    return candidates.find((item) => item && typeof item === 'object') as Record<string, unknown> | null;
  }

  private extractContactName(primaryContact: Record<string, unknown> | null, fallbackCompanyName: string) {
    const firstName = this.asString(primaryContact?.first_name) ?? this.asString(primaryContact?.firstName) ?? '';
    const lastName = this.asString(primaryContact?.last_name) ?? this.asString(primaryContact?.lastName) ?? '';

    if (firstName || lastName) {
      return {
        firstName: firstName || 'Unknown',
        lastName: lastName || 'Contact',
      };
    }

    const normalizedCompanyName = fallbackCompanyName.trim();
    return {
      firstName: normalizedCompanyName ? 'Primary' : 'Unknown',
      lastName: normalizedCompanyName ? 'Contact' : 'Contact',
    };
  }

  private buildLocation(company: Record<string, unknown>): string {
    const city = this.asString(company.city) ?? this.asString(company.location_city) ?? '';
    const state = this.asString(company.state) ?? this.asString(company.location_state) ?? '';
    const country = this.asString(company.country) ?? this.asString(company.location_country) ?? '';
    const location = this.asString(company.location);

    if (location) return location;
    return [city, state, country].filter(Boolean).join(', ');
  }

  private resolveEmployeeCount(company: Record<string, unknown>): number | undefined {
    const rawValue = this.asString(company.employee_count) ?? this.asString(company.employees) ?? this.asString(company.size);
    const numeric = Number(rawValue);
    return Number.isFinite(numeric) ? numeric : undefined;
  }

  private buildWebsite(company: Record<string, unknown>): string | undefined {
    const domain = this.asString(company.domain);
    const website = this.asString(company.website) ?? this.asString(company.website_url);
    if (domain && !/^https?:\/\//i.test(domain)) {
      return `https://${domain}`;
    }
    return website || undefined;
  }

  private extractTechStack(company: Record<string, unknown>): string[] {
    const stack = company.technologies;
    if (Array.isArray(stack)) {
      return stack
        .map((item) => (typeof item === 'string' ? item : this.asString((item as Record<string, unknown>)?.name)))
        .filter(Boolean) as string[];
    }
    return [];
  }

  private bucketTeamSize(n: number): string {
    if (n <= 10) return '1-10';
    if (n <= 50) return '11-50';
    if (n <= 200) return '51-200';
    if (n <= 500) return '201-500';
    return '500+';
  }

  private asString(value: unknown): string | undefined {
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    return undefined;
  }
}
