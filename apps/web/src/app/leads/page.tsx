import { fetchLeads, LeadsResponse, triggerDiscovery } from '@/lib/api-client';
import { LeadsTable } from '@/components/leads/leads-table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { revalidatePath } from 'next/cache';

async function triggerDiscoveryAction() {
  'use server';
  await triggerDiscovery(50);
  revalidatePath('/leads');
}

export default async function LeadsPage() {
  let data: LeadsResponse = { leads: [], total: 0 };
  try {
    data = await fetchLeads({ limit: 50 });
  } catch {
    // API may not be running during build — show empty state
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Leads</h1>
          <p className="text-gray-500">{data.total} total leads discovered</p>
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
        </CardContent>
      </Card>
    </div>
  );
}
