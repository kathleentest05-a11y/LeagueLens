import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import ApolloWrapper from '@/components/ApolloWrapper';
import AppShell from '@/components/AppShell';
import ThemeRegistry from '@/components/ThemeRegistry';
import { ConnectionProvider } from '@/lib/ConnectionContext';
import './globals.css';

export const metadata: Metadata = {
  title: 'LeagueLens',
  description: 'View your fantasy rosters across sports + providers in one hub',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ThemeRegistry>
          <ApolloWrapper>
            <ConnectionProvider>
              <AppShell>{children}</AppShell>
            </ConnectionProvider>
          </ApolloWrapper>
        </ThemeRegistry>
      </body>
    </html>
  );
}
