import { AuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { SignJWT, jwtVerify } from 'jose';

const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!);
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export const authOptions: AuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: { strategy: 'jwt' },
  jwt: {
    async encode({ token }) {
      return new SignJWT(token as Record<string, unknown>)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('30d')
        .sign(secret);
    },
    async decode({ token }) {
      if (!token) return null;
      try {
        const { payload } = await jwtVerify(token, secret);
        return payload as Record<string, unknown>;
      } catch {
        return null;
      }
    },
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const res = await fetch(`${API_BASE}/users/upsert`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-secret': process.env.INTERNAL_API_SECRET!,
          },
          body: JSON.stringify({
            email: user.email,
            name: user.name,
            googleId: user.id,
          }),
        });
        if (res.ok) {
          const data = (await res.json()) as { id: string; role: string };
          token.userId = data.id;
          token.role = data.role;
        }
      }
      return token;
    },
    async session({ session, token }) {
      session.user.userId = token.userId ?? '';
      session.user.role = token.role ?? 'MEMBER';
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
};
