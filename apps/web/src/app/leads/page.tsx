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

async function triggerPeopleDataLabsAction() {
  'use server';
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1'}/discovery/run-peopledatalabs`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ limit: 50 }),
    },
  );
  console.log(res, "////////res")
  if (!res.ok) throw new Error('PeopleDataLabs discovery trigger failed');
  revalidatePath('/leads');
}

export default async function LeadsPage() {
  let data: LeadsResponse = { leads: [], total: 0 };
  try {
    data = await fetchLeads({ limit: 100 });
    console.log(data, "////////data")
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
        <div className="flex gap-2">
          <form action={triggerDiscoveryAction}>
            <Button type="submit">Get Leads from apollo</Button>
          </form>
          <form action={triggerPeopleDataLabsAction}>
            <Button type="submit" variant="outline">Get Leads from peopledatalabs</Button>
          </form>
        </div>
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
