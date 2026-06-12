'use server';

import { revalidatePath } from 'next/cache';
import { createCaseStudy, deleteCaseStudy, upsertRateCard, deleteRateCard } from '@/lib/api-client';

export async function createCaseStudyAction(formData: FormData) {
  const techStackRaw = formData.get('techStack') as string;
  await createCaseStudy({
    title: formData.get('title') as string,
    client: formData.get('client') as string,
    industry: (formData.get('industry') as string) || null,
    techStack: techStackRaw.split(',').map((s) => s.trim()).filter(Boolean),
    challenge: formData.get('challenge') as string,
    solution: formData.get('solution') as string,
    result: formData.get('result') as string,
  });
  revalidatePath('/content');
}

export async function deleteCaseStudyAction(id: string) {
  await deleteCaseStudy(id);
  revalidatePath('/content');
}

export async function upsertRateCardAction(formData: FormData) {
  await upsertRateCard({
    role: formData.get('role') as string,
    seniorityLevel: formData.get('seniorityLevel') as string,
    monthlyRate: parseFloat(formData.get('monthlyRate') as string),
    hourlyRate: parseFloat(formData.get('hourlyRate') as string),
    currency: 'USD',
  });
  revalidatePath('/content');
}

export async function deleteRateCardAction(id: string) {
  await deleteRateCard(id);
  revalidatePath('/content');
}
