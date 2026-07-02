'use client';

import { useTransition } from 'react';
import { changeUserRole } from './actions';

interface RoleSelectorProps {
  userId: string;
  currentRole: string;
}

export function RoleSelector({ userId, currentRole }: RoleSelectorProps) {
  const [isPending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const role = e.target.value as 'ADMIN' | 'MEMBER';
    startTransition(() => {
      changeUserRole(userId, role).catch(console.error);
    });
  }

  return (
    <select
      defaultValue={currentRole}
      onChange={handleChange}
      disabled={isPending}
      className="rounded border border-gray-300 px-2 py-1 text-sm disabled:opacity-50"
    >
      <option value="ADMIN">Admin</option>
      <option value="MEMBER">Member</option>
    </select>
  );
}
