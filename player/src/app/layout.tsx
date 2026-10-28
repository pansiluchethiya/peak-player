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
  title: 'Peak — the embeddable player for every source',
  description:
    'A custom player with validated sources, automatic failover, signed URLs, and a partner SDK. Embed movies, TV, and live TV without leaking upstream URLs.',
  icons: {
    icon: '/logo.svg',
    shortcut: '/logo.svg',
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
      </head>
      <body>{children}</body>
    </html>
  );
}
