import { fetchPendingApprovals, PendingApproval } from '@/lib/api-client';
import { approveAction, rejectAction } from './actions';

export default async function ApprovalsPage() {
  let approvals: PendingApproval[] = [];
  try {
    approvals = await fetchPendingApprovals();
  } catch {
    // API not running during build — show empty state
  }

  return (
    <main className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Approval Queue</h1>
          <p className="text-sm text-gray-500 mt-1">
            {approvals.length} email{approvals.length !== 1 ? 's' : ''} pending review
          </p>
        </div>
        <a href="/leads" className="text-sm text-blue-600 hover:underline">← Back to Leads</a>
      </div>

      {approvals.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-gray-400">
          No emails pending approval
        </div>
      ) : (
        <div className="space-y-4">
          {approvals.map((item) => (
            <div key={item.stepId} className="rounded-lg border bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-semibold">{item.contactName}</div>
                  <div className="text-sm text-gray-500">
                    {item.contactTitle ? `${item.contactTitle} · ` : ''}
                    {item.companyName} · {item.contactEmail}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <form action={approveAction.bind(null, item.stepId)}>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700"
                    >
                      Approve &amp; Send
                    </button>
                  </form>
                  <form action={rejectAction.bind(null, item.stepId)}>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-red-100 text-red-700 rounded-md text-sm font-medium hover:bg-red-200"
                    >
                      Reject
                    </button>
                  </form>
                </div>
              </div>

              <div className="mt-4 rounded-md bg-gray-50 p-4 text-sm">
                <div className="font-medium mb-1">Subject: {item.subject}</div>
                <div className="whitespace-pre-wrap text-gray-700">{item.body}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
