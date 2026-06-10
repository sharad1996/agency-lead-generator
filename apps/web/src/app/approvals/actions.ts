'use server';

import { revalidatePath } from 'next/cache';
import { approveStep, rejectStep } from '@/lib/api-client';

export async function approveAction(stepId: string) {
  await approveStep(stepId);
  revalidatePath('/approvals');
}

export async function rejectAction(stepId: string) {
  await rejectStep(stepId);
  revalidatePath('/approvals');
}
