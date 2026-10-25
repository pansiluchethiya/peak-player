'use client';

import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface MarqueeProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  reverse?: boolean;
  pauseOnHover?: boolean;
  repeat?: number;
}

export function Marquee({
  children,
  className,
  reverse = false,
  pauseOnHover = true,
  repeat = 4,
  ...props
}: MarqueeProps) {
  return (
    <div
      className={cn('peak-marquee', pauseOnHover && 'peak-marquee-pause', className)}
      {...props}
    >
      <div
        className="peak-marquee-track"
        style={
          {
            '--peak-marquee-direction': reverse ? 'reverse' : 'normal',
          } as CSSProperties
        }
      >
        {Array.from({ length: repeat }, (_, index) => (
          <div className="peak-marquee-group" aria-hidden={index > 0} key={index}>
            {children}
          </div>
        ))}
      </div>
    </div>
  );
}
