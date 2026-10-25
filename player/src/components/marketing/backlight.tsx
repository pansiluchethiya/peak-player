'use client';

import { useRef, type MouseEvent, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface BacklightProps {
  children: ReactNode;
  className?: string;
  color?: string;
  size?: number;
}

export function Backlight({
  children,
  className,
  color = 'rgba(201, 242, 109, 0.16)',
  size = 420,
}: BacklightProps) {
  const ref = useRef<HTMLDivElement>(null);

  function onMouseMove(event: MouseEvent<HTMLDivElement>) {
    const node = ref.current;
    if (!node) return;
    const bounds = node.getBoundingClientRect();
    node.style.setProperty('--peak-pointer-x', `${event.clientX - bounds.left}px`);
    node.style.setProperty('--peak-pointer-y', `${event.clientY - bounds.top}px`);
  }

  return (
    <div
      ref={ref}
      className={cn('peak-backlight', className)}
      onMouseMove={onMouseMove}
      style={
        {
          '--peak-backlight-color': color,
          '--peak-backlight-size': `${size}px`,
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}
