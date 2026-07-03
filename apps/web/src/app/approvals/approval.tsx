"use client";

import { PendingApproval } from "@/lib/api-client";
import { useState } from "react";

type ApprovalCardProps = {
  item: PendingApproval;
  approveAction: (stepId: string) => Promise<void>;
  rejectAction: (stepId: string) => Promise<void>;
  editAction: (stepId: string, subject: string, body: string) => Promise<void>;
};

export default function ApprovalCard({
  item,
  approveAction,
  rejectAction,
  editAction,
}: ApprovalCardProps) {

  const [editing, setEditing] = useState(false);

  const [subject, setSubject] = useState(item.subject);

  const [body, setBody] = useState(item.body);

  const [loading, setLoading] = useState(false);



  return (

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
          {editing && (

            <button

              onClick={() => {
                editAction(item.stepId, subject, body)
                setEditing(false);
                setSubject(item.subject)
                setBody(item.body)
              }}

              disabled={loading}

              className="bg-blue-600 text-white px-4 py-2 rounded cursor-pointer"

            >

              Save
            </button>

          )}
          <button
            className="px-4 py-2 bg-white shadow-sm text-black rounded-md text-sm font-medium cursor-pointer"
            onClick={() => setEditing(!editing)}

          >

            {editing ? "Cancel" : "Edit"}

          </button>

          <form action={approveAction.bind(null, item.stepId)}>
            <button
              type="submit"
              className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 cursor-pointer"
            >
              Approve &amp; Send
            </button>
          </form>
          <form action={rejectAction.bind(null, item.stepId)}>
            <button
              type="submit"
              className="px-4 py-2 bg-red-100 text-red-700 rounded-md text-sm font-medium hover:bg-red-200 cursor-pointer"
            >
              Reject
            </button>
          </form>
        </div>
      </div>

      <div className="mt-4 rounded-md bg-gray-50 p-4 text-sm">
        <div className="font-medium mb-1">Subject:
          {editing ? <input
            disabled={!editing}
            className="w-80"
            value={subject}

            onChange={(e) =>

              setSubject(e.target.value)

            } /> : item.subject}
        </div>
        <div className="whitespace-pre-wrap text-gray-700">
          {editing ? (
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="border rounded p-2 w-full"
              rows={4}
            />
          ) : (
            item.body
          )}
        </div>
      </div>
    </div>

    // <div className="rounded-lg border bg-white p-6">

    //   <div className="flex justify-between">

    //     <h2>{item.contactName}</h2>

    //     <button

    //       onClick={() => setEditing(!editing)}

    //     >

    //       {editing ? "Cancel" : "Edit"}

    //     </button>

    //   </div>

    //   <div className="mt-5">

    //     <label>Subject</label>

    //     <input

    //       disabled={!editing}

    //       value={subject}

    //       onChange={(e) =>

    //         setSubject(e.target.value)

    //       }

    //       className="border rounded p-2 w-full"

    //     />

    //   </div>

    //   <div className="mt-4">

    //     <label>Body</label>

    //     <textarea

    //       rows={12}

    //       disabled={!editing}

    //       value={body}

    //       onChange={(e) =>

    //         setBody(e.target.value)

    //       }

    //       className="border rounded p-2 w-full"

    //     />

    //   </div>

    //   <div className="mt-5 flex gap-3">

    //     {editing && (

    //       <button

    //         onClick={() => editAction(item.stepId, subject, body)}

    //         disabled={loading}

    //         className="bg-blue-600 text-white px-4 py-2 rounded"

    //       >

    //         Save

    //       </button>

    //     )}

    //     <form

    //       action={approveAction.bind(

    //         null,

    //         item.stepId,

    //       )}

    //     >

    //       <button

    //         className="bg-green-600 text-white px-4 py-2 rounded"

    //       >

    //         Approve

    //       </button>

    //     </form>

    //     <form

    //       action={rejectAction.bind(

    //         null,

    //         item.stepId,

    //       )}

    //     >

    //       <button

    //         className="bg-red-600 text-white px-4 py-2 rounded"

    //       >

    //         Reject

    //       </button>

    //     </form>

    //   </div>

    // </div>

  );

}
