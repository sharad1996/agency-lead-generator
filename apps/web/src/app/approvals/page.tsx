import { fetchPendingApprovals, PendingApproval } from '@/lib/api-client';
import { approveAction, rejectAction, editAction } from './actions';
import ApprovalCard from './approval';


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
            <ApprovalCard
              key={item.stepId}
              item={item}
              approveAction={approveAction}
              rejectAction={rejectAction}
              editAction={editAction}
            />

          ))}
        </div>
      )}
    </main>
  );
}
