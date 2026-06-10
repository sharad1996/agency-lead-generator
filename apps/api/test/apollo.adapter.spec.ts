import { ApolloAdapter } from '../src/modules/discovery/adapters/apollo.adapter';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ApolloAdapter', () => {
  let adapter: ApolloAdapter;

  beforeEach(() => {
    const config = {
      get: (key: string) => {
        const map: Record<string, string> = {
          APOLLO_API_KEY: 'test-key',
          APOLLO_BASE_URL: 'https://api.apollo.io/v1',
        };
        return map[key];
      },
    } as ConfigService;

    adapter = new ApolloAdapter(config);
  });

  it('searches people and returns normalized leads', async () => {
    mockedAxios.post = jest.fn().mockResolvedValue({
      data: {
        people: [
          {
            id: 'apollo-person-1',
            first_name: 'Jane',
            last_name: 'Doe',
            title: 'CTO',
            email: 'jane@acme.com',
            linkedin_url: 'https://linkedin.com/in/janedoe',
            organization: {
              id: 'apollo-org-1',
              name: 'Acme Corp',
              website_url: 'https://acme.com',
              industry: 'Software',
              estimated_num_employees: 50,
              funding_stage: 'Series A',
              technologies: [{ name: 'React' }, { name: 'Node.js' }],
              city: 'San Francisco',
              country: 'United States',
            },
          },
        ],
        pagination: { total_entries: 1 },
      },
    });

    const results = await adapter.searchLeads({ limit: 10 });

    expect(results).toHaveLength(1);
    expect(results[0].contact.firstName).toBe('Jane');
    expect(results[0].company.techStack).toContain('React');
    expect(results[0].company.location).toBe('San Francisco, United States');
  });

  it('filters out people with no organization', async () => {
    mockedAxios.post = jest.fn().mockResolvedValue({
      data: {
        people: [
          {
            id: 'apollo-person-2',
            first_name: 'Bob',
            last_name: 'Smith',
            title: 'Founder',
            email: null,
            linkedin_url: null,
            organization: null,
          },
        ],
      },
    });

    const results = await adapter.searchLeads({ limit: 10 });
    expect(results).toHaveLength(0);
  });

  it('buckets team size correctly', async () => {
    mockedAxios.post = jest.fn().mockResolvedValue({
      data: {
        people: [
          {
            id: 'p3',
            first_name: 'Alice',
            last_name: 'Chen',
            title: 'VP Engineering',
            email: 'alice@startup.io',
            linkedin_url: null,
            organization: {
              id: 'o3',
              name: 'Startup IO',
              website_url: null,
              industry: 'SaaS',
              estimated_num_employees: 75,
              funding_stage: 'Seed',
              technologies: [],
              city: 'Austin',
              country: 'United States',
            },
          },
        ],
      },
    });

    const results = await adapter.searchLeads({ limit: 10 });
    expect(results[0].company.teamSize).toBe('51-200');
  });
});
