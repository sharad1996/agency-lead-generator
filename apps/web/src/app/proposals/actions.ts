'use server';

import { redirect } from 'next/navigation';
import { createProposal } from '@/lib/api-client';

export async function createProposalAction(formData: FormData) {
  const techStackRaw = formData.get('techStackNeeded') as string;

  await createProposal({
    opportunityId: formData.get('opportunityId') as string,
    projectDescription: formData.get('projectDescription') as string,
    techStackNeeded: techStackRaw.split(',').map((s) => s.trim()).filter(Boolean),
    durationMonths: parseInt(formData.get('durationMonths') as string, 10),
    teamSize: parseInt(formData.get('teamSize') as string, 10),
    seniorityMix: formData.get('seniorityMix') as 'senior' | 'mixed' | 'junior',
  });

  redirect('/proposals');
}
