import { Injectable } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import { RawLead } from './lead-source.adapter';

interface CsvRow {
  firstName: string;
  lastName: string;
  email: string;
  title: string;
  companyName: string;
  website: string;
  industry: string;
  techStack: string;
  location: string;
}

@Injectable()
export class CsvAdapter {
  parseBuffer(buffer: Buffer): Promise<RawLead[]> {
    const rows = parse(buffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as CsvRow[];

    const leads: RawLead[] = rows
      .filter((row) => row.companyName?.trim())
      .map((row) => ({
        source: 'csv',
        contact: {
          firstName: row.firstName,
          lastName: row.lastName,
          email: row.email?.trim() || undefined,
          title: row.title?.trim() || undefined,
        },
        company: {
          name: row.companyName,
          website: row.website?.trim() || undefined,
          industry: row.industry?.trim() || undefined,
          techStack: row.techStack
            ? row.techStack
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            : [],
          location: row.location?.trim() || undefined,
        },
      }));

    return Promise.resolve(leads);
  }
}
