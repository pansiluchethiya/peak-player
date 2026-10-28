import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono, Roboto } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
  weight: ['400', '500', '600', '700', '800'],
});

/* Player chrome uses Roboto, the face YouTube's own player UI is built on, so
 * titles, menus, timecodes, and controls read as one system without borrowing
 * the marketing face or a monospace timecode. */
const roboto = Roboto({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-player',
  weight: ['400', '500', '700'],
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono',
  weight: ['400', '500', '600', '700'],
});

/* Blocking theme script: the player is dark-first (AMOLED #000000). We read a
 * saved preference from localStorage, otherwise default to "dark", and set
 * data-theme on <html> before the page paints to avoid a theme flash.
 * suppressHydrationWarning on <html> lets React skip the attribute mismatch. */
const themeScript = `
(function(){try{var t=localStorage.getItem('peak-theme');if(t!=='light'&&t!=='dark'){t='dark';}document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();
`.trim();

export const metadata: Metadata = {
  title: {
    default: 'Peak — the embeddable player for every source',
    template: '%s · Peak',
  },
  description:
    'A custom player with validated sources, automatic failover, signed URLs, and a partner SDK. Embed movies, TV, and live TV without leaking upstream URLs.',
  openGraph: {
    type: 'website',
    locale: 'en-US',
    url: 'https://app.peak-player.com',
    siteName: 'Peak Player',
    images: [
      {
        url: 'https://peak-player.com/og-player.png',
        width: 1200,
        height: 630,
        alt: 'Peak — the embeddable player for every source',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Peak — the embeddable player',
    description:
      'Validated sources, automatic failover, signed URLs, and a partner SDK for movies, TV, and live TV.',
    images: ['https://peak-player.com/og-player.png'],
    creator: '@peakplayer',
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: 'https://app.peak-player.com',
  },
  icons: {
    icon: '/logo.svg',
    shortcut: '/logo.svg',
    apple: '/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { color: '#000000', media: '(prefers-color-scheme: dark)' },
    { color: '#ffffff', media: '(prefers-color-scheme: light)' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} ${roboto.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'SoftwareApplication',
              name: 'Peak Player',
              applicationCategory: 'VideoApplication',
              operatingSystem: 'Any',
              offers: { '@type': 'Offer', price: '0' },
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebApplication',
              name: 'Peak Embed Player',
              url: 'https://app.peak-player.com',
              applicationCategory: 'VideoApplication',
              operatingSystem: 'Any',
              browserRequirements: 'Modern browser with HLS.js support',
            }),
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
