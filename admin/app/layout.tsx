import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ThemeProvider } from '@/components/ThemeProvider';

const themeBootstrap = `(function(){const K='peak_theme',L='ns_theme';let t;try{t=localStorage.getItem(K)||localStorage.getItem(L)}catch(e){}if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}try{localStorage.setItem(K,t);localStorage.removeItem(L)}catch(e){}const r=document.documentElement;r.dataset.theme=t;r.classList.toggle('dark',t==='dark');r.style.colorScheme=t;let m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content',t==='dark'?'#000000':'#ffffff')})()`;

export const metadata: Metadata = {
  title: {
    default: 'Admin · Peak',
    template: '%s · Peak Admin',
  },
  description:
    'Peak administration portal — monitor providers, tune filtering, manage tokens, proxies, and feature toggles.',
  openGraph: {
    type: 'website',
    locale: 'en-US',
    url: 'https://admin.peak-player.com',
    siteName: 'Peak Admin',
    images: [
      {
        url: 'https://peak-player.com/og-admin.png',
        width: 1200,
        height: 630,
        alt: 'Peak Admin — streaming control panel',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Peak Admin · streaming control panel',
    description: 'Monitor providers, manage tokens, proxies, and feature toggles.',
    images: ['https://peak-player.com/og-admin.png'],
  },
  robots: {
    index: false,
    follow: false,
  },
  alternates: {
    canonical: 'https://admin.peak-player.com',
  },
  icons: {
    icon: '/assets/favicon.svg',
    shortcut: '/assets/favicon.svg',
    apple: '/assets/apple-touch-icon.png',
  },
};

export const viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  // AMOLED dark is the default; suppress the hydration mismatch when the
  // blocking bootstrap script resolves a different stored preference.
  return (
    <html lang="en" data-theme="dark" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
