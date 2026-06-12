import { createProposalAction } from '../actions';

export default function NewProposalPage() {
  return (
    <main className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Generate Proposal</h1>
      <div className="text-sm text-gray-500 mb-6">
        Generates a professional proposal PDF using AI. Make sure you have added case studies and rate cards in{' '}
        <a href="/content" className="text-indigo-600 hover:underline">Content Admin</a>.
      </div>

      <form action={createProposalAction} className="rounded-lg border bg-white p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Opportunity ID</label>
          <input
            name="opportunityId"
            required
            placeholder="Paste the Opportunity UUID"
            className="w-full border rounded-md px-3 py-2 text-sm"
          />
          <p className="text-xs text-gray-400 mt-1">Created automatically when a Cal.com meeting is booked.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Project Description</label>
          <textarea
            name="projectDescription"
            required
            rows={3}
            placeholder="Describe what the client needs"
            className="w-full border rounded-md px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tech Stack Needed</label>
          <input
            name="techStackNeeded"
            required
            placeholder="React, NestJS, PostgreSQL"
            className="w-full border rounded-md px-3 py-2 text-sm"
          />
          <p className="text-xs text-gray-400 mt-1">Comma separated</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Duration (months)</label>
            <input name="durationMonths" type="number" min="1" max="36" defaultValue="3" required className="w-full border rounded-md px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Team Size</label>
            <input name="teamSize" type="number" min="1" max="20" defaultValue="2" required className="w-full border rounded-md px-3 py-2 text-sm" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Seniority Mix</label>
          <select name="seniorityMix" className="w-full border rounded-md px-3 py-2 text-sm">
            <option value="senior">Senior (highest quality)</option>
            <option value="mixed">Mixed (balanced)</option>
            <option value="junior">Junior (cost-optimised)</option>
          </select>
        </div>

        <button
          type="submit"
          className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700"
        >
          Generate Proposal (takes ~10s)
        </button>
      </form>
    </main>
  );
}
