import { clsx } from 'clsx';
import type { ReactNode } from 'react';

/**
 * CodeBlock — syntax-highlighted code for the landing page.
 *
 * Uses a lightweight CSS-based approach with class-based highlighting.
 * For production, replace with Shiki or Monaco if available.
 *
 * @see docs/superpowers/specs/2026-10-28-docs-overhaul-spec.md §9
 */

const LANGUAGE_LABELS: Record<string, string> = {
  bash: 'Bash',
  sh: 'Shell',
  json: 'JSON',
  js: 'JavaScript',
  ts: 'TypeScript',
  tsx: 'TypeScript React',
  html: 'HTML',
  css: 'CSS',
  python: 'Python',
  go: 'Go',
  rust: 'Rust',
};

export function CodeBlock({
  children,
  language = 'text',
  showCopy = false,
  compact = false,
}: {
  children: ReactNode;
  language?: string;
  showCopy?: boolean;
  compact?: boolean;
}) {
  const code = typeof children === 'string' ? children : String(children);
  const label = LANGUAGE_LABELS[language] || language;

  return (
    <div className={clsx('peak-code-block', compact && 'peak-code-block-compact')}>
      {showCopy && (
        <div className="peak-code-head">
          <span>{label}</span>
        </div>
      )}
      <pre className={`language-${language}`} data-language={language}>
        <code className={`language-${language}`}>{code}</code>
      </pre>
    </div>
  );
}

/** Inline code component for short snippets. */
export function InlineCode({ children, className }: { children: ReactNode; className?: string }) {
  return <code className={clsx('peak-inline-code', className)}>{children}</code>;
}
