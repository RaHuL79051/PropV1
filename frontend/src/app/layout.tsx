import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import ClientInitializer from './ClientInitializer';
import ToastContainer from '../components/ToastContainer';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: 'PropTenant - Premium Property & Tenant Management System',
  description: 'Manage co-living hubs, shared apartments, rent agreements, Aadhaar background verifications, and monthly invoices with executive precision.',
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable}`} suppressHydrationWarning>
      <body className="antialiased bg-background text-foreground min-h-screen" suppressHydrationWarning>
        <ClientInitializer />
        <ToastContainer />
        {children}
      </body>
    </html>
  );
}
