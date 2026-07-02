import { NextResponse } from 'next/server';
import { withAuth } from 'next-auth/middleware';

const isDev = process.env.NODE_ENV === 'development';

// In local development, skip the auth gate entirely so you don't need to
// sign in to reach protected routes. Production still enforces auth.
export default isDev
  ? () => NextResponse.next()
  : withAuth({
      pages: {
        signIn: '/login',
      },
    });

export const config = {
  matcher: ['/((?!api/auth|login|_next/static|_next/image|favicon.ico).*)'],
};
