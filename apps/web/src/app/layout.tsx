import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SessionProviderWrapper } from "@/components/SessionProviderWrapper";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Lead Generator",
  description: "AI Sales Automation Platform",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession(authOptions);
  const isAdmin = session?.user?.role === 'ADMIN';

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SessionProviderWrapper>
          <nav className="border-b bg-white px-8 py-3 flex items-center gap-6 text-sm font-medium">
            <a href="/dashboard" className="text-gray-700 hover:text-gray-900">Dashboard</a>
            <a href="/leads" className="text-gray-700 hover:text-gray-900">Leads</a>
            <a href="/approvals" className="text-gray-700 hover:text-gray-900">Approvals</a>
            <a href="/proposals" className="text-gray-700 hover:text-gray-900">Proposals</a>
            <a href="/content" className="text-gray-700 hover:text-gray-900">Content</a>
            {isAdmin && (
              <a href="/admin/users" className="text-gray-700 hover:text-gray-900">Users</a>
            )}
            {session?.user?.email && (
              <span className="ml-auto text-gray-400">{session.user.email}</span>
            )}
          </nav>
          {children}
        </SessionProviderWrapper>
      </body>
    </html>
  );
}
