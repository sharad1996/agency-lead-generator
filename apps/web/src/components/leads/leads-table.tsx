import { Lead } from '@/lib/api-client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScoreBadge } from './score-badge';
import { Badge } from '@/components/ui/badge';

interface LeadsTableProps {
  leads: Lead[];
}

export function LeadsTable({ leads }: LeadsTableProps) {
  if (leads.length === 0) {
    return (
      <div className="py-12 text-center text-gray-500">
        No leads yet. Trigger a discovery run to get started.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Contact</TableHead>
          <TableHead>Company</TableHead>
          <TableHead>Industry</TableHead>
          <TableHead>Tech Stack</TableHead>
          <TableHead>Score</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Source</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {leads.map((lead) => (
          <TableRow key={lead.id}>
            <TableCell>
              <div>
                <p className="font-medium">
                  {lead.contact.firstName} {lead.contact.lastName}
                </p>
                {lead.contact.title && (
                  <p className="text-sm text-gray-500">{lead.contact.title}</p>
                )}
                {lead.contact.email && (
                  <p className="text-xs text-gray-400">{lead.contact.email}</p>
                )}
              </div>
            </TableCell>
            <TableCell>
              <div>
                <p className="font-medium">{lead.company.name}</p>
                {lead.company.location && (
                  <p className="text-xs text-gray-500">{lead.company.location}</p>
                )}
              </div>
            </TableCell>
            <TableCell>{lead.company.industry ?? '—'}</TableCell>
            <TableCell>
              <div className="flex flex-wrap gap-1">
                {lead.company.techStack.slice(0, 3).map((tech) => (
                  <Badge key={tech} variant="secondary" className="text-xs">
                    {tech}
                  </Badge>
                ))}
                {lead.company.techStack.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{lead.company.techStack.length - 3}
                  </Badge>
                )}
              </div>
            </TableCell>
            <TableCell>
              <ScoreBadge score={lead.score} priority={lead.priority} />
            </TableCell>
            <TableCell>
              <Badge variant="outline" className="text-xs capitalize">
                {lead.status.toLowerCase().replace(/_/g, ' ')}
              </Badge>
            </TableCell>
            <TableCell className="text-sm capitalize text-gray-500">
              {lead.source}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
