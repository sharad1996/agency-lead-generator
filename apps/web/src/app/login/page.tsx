'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { Button } from '@/components/ui/button';

const isDev = process.env.NODE_ENV === 'development';

export default function LoginPage() {
  const [email, setEmail] = useState('dev@localhost');

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-xl shadow-sm border p-10 w-full max-w-sm flex flex-col items-center gap-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-gray-900">Lead Generator</h1>
          <p className="text-sm text-gray-500 mt-1">AI Sales Automation Platform</p>
        </div>
        {isDev ? (
          <div className="w-full flex flex-col gap-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="dev@localhost"
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
            <Button
              className="w-full"
              onClick={() => signIn('dev', { email, callbackUrl: '/' })}
            >
              Dev sign in
            </Button>
            <p className="text-xs text-gray-400 text-center">
              Local development only
            </p>
          </div>
        ) : (
          <Button
            className="w-full"
            onClick={() => signIn('google', { callbackUrl: '/' })}
          >
            Sign in with Google
          </Button>
        )}
      </div>
    </div>
  );
}
