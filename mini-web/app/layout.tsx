import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Peak mini-web - minimal player frontend',
  description: 'A minimal Next.js frontend that always works as a Peak player.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#000' }}>{children}</body>
    </html>
  );
}
