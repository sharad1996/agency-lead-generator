import { CsvAdapter } from '../src/modules/discovery/adapters/csv.adapter';

describe('CsvAdapter', () => {
  let adapter: CsvAdapter;

  beforeEach(() => {
    adapter = new CsvAdapter();
  });

  it('parses a CSV buffer into raw leads', async () => {
    const csv = Buffer.from(
      `firstName,lastName,email,title,companyName,website,industry,techStack,location
Jane,Doe,jane@acme.com,CTO,Acme Corp,https://acme.com,SaaS,"React,Node.js",San Francisco`,
    );

    const results = await adapter.parseBuffer(csv);

    expect(results).toHaveLength(1);
    expect(results[0].contact.firstName).toBe('Jane');
    expect(results[0].company.techStack).toEqual(['React', 'Node.js']);
    expect(results[0].source).toBe('csv');
  });

  it('skips rows with missing companyName', async () => {
    const csv = Buffer.from(
      `firstName,lastName,email,title,companyName,website,industry,techStack,location
Jane,Doe,jane@acme.com,CTO,,https://acme.com,SaaS,React,SF`,
    );

    const results = await adapter.parseBuffer(csv);
    expect(results).toHaveLength(0);
  });

  it('handles techStack with no comma (single tech)', async () => {
    const csv = Buffer.from(
      `firstName,lastName,email,title,companyName,website,industry,techStack,location
Bob,Smith,bob@startup.io,Founder,StartupIO,https://startup.io,SaaS,React,Austin`,
    );

    const results = await adapter.parseBuffer(csv);
    expect(results[0].company.techStack).toEqual(['React']);
  });

  it('handles empty techStack', async () => {
    const csv = Buffer.from(
      `firstName,lastName,email,title,companyName,website,industry,techStack,location
Alice,Chen,alice@corp.com,VP Engineering,MegaCorp,https://megacorp.com,Enterprise,,NYC`,
    );

    const results = await adapter.parseBuffer(csv);
    expect(results[0].company.techStack).toEqual([]);
  });
});
