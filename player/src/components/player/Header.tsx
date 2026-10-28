'use client';

export interface HeaderProps {
  title?: string;
  year?: string | number;
  /** Retained for call-site compatibility; the title is the only chrome text. */
  runtime?: number;
  quality?: string;
  locale?: string;
}

/** Just the title. The media facts live in the details pages, not the stage. */
export function Header({ title }: HeaderProps) {
  if (!title) return null;
  return (
    <header className="peak-player-header">
      <h1 className="peak-player-header-title">{title}</h1>
    </header>
  );
}
