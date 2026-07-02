'use client';

import { signIn } from 'next-auth/react';
import { Button } from '@/components/ui/button';

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-xl shadow-sm border p-10 w-full max-w-sm flex flex-col items-center gap-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-gray-900">Lead Generator</h1>
          <p className="text-sm text-gray-500 mt-1">AI Sales Automation Platform</p>
        </div>
        <Button
          className="w-full"
          onClick={() => signIn('google', { callbackUrl: '/' })}
        >
          Sign in with Google
        </Button>
      </div>
    </div>
  );
}
