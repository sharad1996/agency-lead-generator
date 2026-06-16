'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { updateUserRole } from '@/lib/api-client';
import { revalidatePath } from 'next/cache';

export async function changeUserRole(userId: string, role: 'ADMIN' | 'MEMBER') {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN') {
    throw new Error('Unauthorized');
  }
  await updateUserRole(userId, role);
  revalidatePath('/admin/users');
}
