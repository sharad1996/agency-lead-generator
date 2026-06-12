import { fetchDashboardMetrics, DashboardMetrics } from '@/lib/api-client';

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-lg border bg-white p-6 shadow-sm">
      <div className="text-sm text-gray-500 font-medium mb-1">{label}</div>
      <div className="text-3xl font-bold text-gray-900">{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}

export default async function DashboardPage() {
  let metrics: DashboardMetrics | null = null;
  try {
    metrics = await fetchDashboardMetrics();
  } catch {
    // API not running
  }

  const m = metrics;

  return (
    <main className="p-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      {!m ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-gray-400">
          Could not load metrics — is the API running?
        </div>
      ) : (
        <div className="space-y-8">
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Leads</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Total Leads" value={m.leads.total} />
              <StatCard label="New" value={m.leads.byStatus['NEW'] ?? 0} />
              <StatCard label="Outreach Sent" value={m.leads.byStatus['OUTREACH_SENT'] ?? 0} />
              <StatCard label="Replied" value={m.leads.byStatus['REPLIED'] ?? 0} />
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Emails</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <StatCard label="Sent Today" value={m.emails.sentToday} sub="/ 25 daily limit" />
              <StatCard label="Sent This Week" value={m.emails.sentThisWeek} />
              <StatCard label="Reply Rate" value={`${m.emails.replyRate.toFixed(1)}%`} />
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Meetings</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <StatCard label="Scheduled" value={m.meetings.scheduled} />
              <StatCard label="Total Booked" value={m.meetings.total} />
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Proposals</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <StatCard label="Draft" value={m.proposals.draft} />
              <StatCard label="Sent" value={m.proposals.sent} />
            </div>
          </section>

          {Object.keys(m.leads.byStatus).length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Pipeline Breakdown</h2>
              <div className="rounded-lg border bg-white overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-600">Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(m.leads.byStatus).map(([status, count]) => (
                      <tr key={status} className="border-b last:border-0">
                        <td className="px-4 py-3 text-gray-700">{status.replace(/_/g, ' ')}</td>
                        <td className="px-4 py-3 text-right font-medium">{count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}
    </main>
  );
}
