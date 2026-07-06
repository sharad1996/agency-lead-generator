import { fetchLeads, LeadsResponse, triggerDiscovery } from '@/lib/api-client';
import { LeadsTable } from '@/components/leads/leads-table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { revalidatePath } from 'next/cache';
import { LeadsPagination } from './leads-pagination';

async function triggerDiscoveryAction() {
  'use server';
  await triggerDiscovery(50);
  revalidatePath('/leads');
}

interface Props {
  searchParams: Promise<{
    page?: string;
  }>;
}

export default async function LeadsPage({ searchParams }: Props) {
  const params = await searchParams;

  const page = Number(params.page ?? 1);


  let data = {
    leads: [],
    pagination: {
      total: 0,
      page: 1,
      limit: 50,
      totalPages: 1,
    },
  };
  try {
    data = await fetchLeads({
      page,
      limit: 50,
    });
  } catch { }
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Leads</h1>
          <p className="text-gray-500">{data.pagination.total} total leads discovered</p>
        </div>
        <form action={triggerDiscoveryAction}>
          <Button type="submit">Run Discovery (50 leads)</Button>
        </form>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Leads</CardTitle>
        </CardHeader>
        <CardContent>
          <LeadsTable leads={data.leads} />
          {data.pagination.total > 50 && (
            <LeadsPagination
              page={data.pagination.page}
              totalPages={data.pagination.totalPages}
            />
          )}

        </CardContent>
      </Card>
    </div>
  );
}
