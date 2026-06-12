import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <nav className="border-b bg-white px-8 py-3 flex gap-6 text-sm font-medium">
          <a href="/dashboard" className="text-gray-700 hover:text-gray-900">Dashboard</a>
          <a href="/leads" className="text-gray-700 hover:text-gray-900">Leads</a>
          <a href="/approvals" className="text-gray-700 hover:text-gray-900">Approvals</a>
          <a href="/proposals" className="text-gray-700 hover:text-gray-900">Proposals</a>
          <a href="/content" className="text-gray-700 hover:text-gray-900">Content</a>
        </nav>
        {children}
      </body>
    </html>
  );
}
