import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Peak Player',
  description: 'The custom Peak streaming player.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
