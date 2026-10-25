import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';

interface BorderBeamProps {
  className?: string;
  colorFrom?: string;
  colorTo?: string;
  delay?: number;
  duration?: number;
  size?: number;
}

export function BorderBeam({
  className,
  colorFrom = 'var(--color-accent)',
  colorTo = 'var(--color-accent)',
  delay = 0,
  duration = 8,
  size = 180,
}: BorderBeamProps) {
  return (
    <span
      aria-hidden="true"
      className={cn('peak-border-beam', className)}
      style={
        {
          '--peak-beam-from': colorFrom,
          '--peak-beam-to': colorTo,
          '--peak-beam-delay': `${delay}s`,
          '--peak-beam-duration': `${duration}s`,
          '--peak-beam-size': `${size}px`,
        } as CSSProperties
      }
    >
      <span />
    </span>
  );
}
