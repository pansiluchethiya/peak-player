import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { RootProvider } from 'fumadocs-ui/provider';
import type { ReactNode } from 'react';
import './global.css';

const geistSans = Geist({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
  weight: ['400', '500', '600', '700', '800'],
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono',
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: {
    default: 'Peak Docs — embed platform',
    template: '%s · Peak Docs',
  },
  description:
    "Integrate Peak's embeddable player: signed sessions, source validation, failover, live TV, and the postMessage SDK.",
  openGraph: {
    type: 'website',
    locale: 'en-US',
    url: 'https://docs.peak-player.com',
    siteName: 'Peak Docs',
    images: [
      {
        url: 'https://peak-player.com/og-docs.png',
        width: 1200,
        height: 630,
        alt: 'Peak Docs — embed platform documentation',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Peak Docs — embed platform',
    description:
      "Integrate Peak's embeddable player: signed sessions, source validation, failover, live TV, and the postMessage SDK.",
    images: ['https://peak-player.com/og-docs.png'],
    creator: '@peakplayer',
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: 'https://docs.peak-player.com',
  },
  icons: {
    icon: '/logo.svg',
    shortcut: '/logo.svg',
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebSite',
              name: 'Peak Docs',
              url: 'https://docs.peak-player.com',
              description: "Integrate Peak's embeddable player: signed sessions, source validation, failover, live TV, and the postMessage SDK.",
              publisher: {
                '@type': 'Organization',
                name: 'Peak',
                logo: { '@type': 'ImageObject', url: 'https://peak-player.com/logo.svg' },
              },
            }),
          }}
        />
      </head>
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
