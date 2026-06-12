import { fetchCaseStudies, fetchRateCards } from '@/lib/api-client';
import {
  createCaseStudyAction,
  deleteCaseStudyAction,
  upsertRateCardAction,
  deleteRateCardAction,
} from './actions';

export default async function ContentPage() {
  let caseStudies: Awaited<ReturnType<typeof fetchCaseStudies>> = [];
  let rateCards: Awaited<ReturnType<typeof fetchRateCards>> = [];
  try {
    [caseStudies, rateCards] = await Promise.all([fetchCaseStudies(), fetchRateCards()]);
  } catch {
    // API not running
  }

  return (
    <main className="p-8 max-w-5xl mx-auto space-y-12">
      {/* Case Studies */}
      <section>
        <h1 className="text-2xl font-bold mb-6">Case Studies</h1>

        <form action={createCaseStudyAction} className="rounded-lg border bg-white p-6 mb-6 space-y-3">
          <h2 className="font-semibold text-gray-800 mb-2">Add Case Study</h2>
          <div className="grid grid-cols-2 gap-3">
            <input name="title" placeholder="Title" required className="col-span-2 border rounded-md px-3 py-2 text-sm" />
            <input name="client" placeholder="Client name" required className="border rounded-md px-3 py-2 text-sm" />
            <input name="industry" placeholder="Industry (optional)" className="border rounded-md px-3 py-2 text-sm" />
            <input name="techStack" placeholder="Tech stack (comma separated)" className="col-span-2 border rounded-md px-3 py-2 text-sm" />
            <textarea name="challenge" placeholder="Challenge" required className="border rounded-md px-3 py-2 text-sm" rows={2} />
            <textarea name="solution" placeholder="Solution" required className="border rounded-md px-3 py-2 text-sm" rows={2} />
            <textarea name="result" placeholder="Result / outcome" required className="col-span-2 border rounded-md px-3 py-2 text-sm" rows={2} />
          </div>
          <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700">
            Add Case Study
          </button>
        </form>

        {caseStudies.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-gray-400 text-sm">No case studies yet</div>
        ) : (
          <div className="space-y-3">
            {caseStudies.map((cs) => (
              <div key={cs.id} className="rounded-lg border bg-white p-4 flex items-start justify-between gap-4">
                <div>
                  <div className="font-semibold">{cs.title}</div>
                  <div className="text-sm text-gray-500">{cs.client}{cs.industry ? ` · ${cs.industry}` : ''}</div>
                  <div className="text-sm text-gray-600 mt-1">{cs.result}</div>
                  <div className="text-xs text-gray-400 mt-1">{cs.techStack.join(', ')}</div>
                </div>
                <form action={deleteCaseStudyAction.bind(null, cs.id)}>
                  <button type="submit" className="text-sm text-red-600 hover:text-red-800 shrink-0">Delete</button>
                </form>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Rate Cards */}
      <section>
        <h1 className="text-2xl font-bold mb-6">Rate Cards</h1>

        <form action={upsertRateCardAction} className="rounded-lg border bg-white p-6 mb-6 space-y-3">
          <h2 className="font-semibold text-gray-800 mb-2">Add / Update Rate</h2>
          <div className="grid grid-cols-2 gap-3">
            <input name="role" placeholder="Role (e.g. Frontend Developer)" required className="border rounded-md px-3 py-2 text-sm" />
            <input name="seniorityLevel" placeholder="Seniority (e.g. Senior)" required className="border rounded-md px-3 py-2 text-sm" />
            <input name="monthlyRate" type="number" placeholder="Monthly rate (USD)" required className="border rounded-md px-3 py-2 text-sm" />
            <input name="hourlyRate" type="number" placeholder="Hourly rate (USD)" required className="border rounded-md px-3 py-2 text-sm" />
          </div>
          <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700">
            Save Rate
          </button>
        </form>

        {rateCards.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-gray-400 text-sm">No rates configured yet</div>
        ) : (
          <div className="rounded-lg border bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Role</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Seniority</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Monthly</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Hourly</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {rateCards.map((rc) => (
                  <tr key={rc.id} className="border-b last:border-0">
                    <td className="px-4 py-3">{rc.role}</td>
                    <td className="px-4 py-3">{rc.seniorityLevel}</td>
                    <td className="px-4 py-3 text-right">${rc.monthlyRate.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">${rc.hourlyRate}/hr</td>
                    <td className="px-4 py-3 text-right">
                      <form action={deleteRateCardAction.bind(null, rc.id)}>
                        <button type="submit" className="text-sm text-red-600 hover:text-red-800">Delete</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
