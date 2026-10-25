import type { Metadata } from 'next';
import { Bricolage_Grotesque, DM_Sans } from 'next/font/google';
import { RootProvider } from 'fumadocs-ui/provider';
import type { ReactNode } from 'react';
import './global.css';

const display = Bricolage_Grotesque({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display',
  weight: ['400', '500', '600', '700', '800'],
});

const ui = DM_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-ui',
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: {
    default: 'Peak Docs — embed platform',
    template: '%s · Peak Docs',
  },
  description:
    'Integrate Peak’s embeddable player: signed sessions, source validation, failover, live TV, and the postMessage SDK.',
  icons: {
    icon: '/logo.svg',
    shortcut: '/logo.svg',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${ui.variable}`} suppressHydrationWarning>
      <body>
        <RootProvider
          theme={{ enabled: true, defaultTheme: 'system' }}
          search={{ enabled: true }}
        >
          {children}
        </RootProvider>
      </body>
    </html>
  );
}
