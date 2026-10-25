'use client';

import { useEffect, useRef, useState } from 'react';
import { animate, useInView, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/utils';

interface NumberTickerProps {
  className?: string;
  decimals?: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  value: number;
}

export function NumberTicker({
  className,
  decimals = 0,
  duration = 1.6,
  prefix = '',
  suffix = '',
  value,
}: NumberTickerProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { margin: '0px 0px -12% 0px', once: true });
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;

    if (reduceMotion) {
      setDisplay(value);
      return;
    }

    const controls = animate(0, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => setDisplay(latest),
    });

    return () => controls.stop();
  }, [duration, inView, reduceMotion, value]);

  return (
    <span ref={ref} className={cn('peak-ticker', className)}>
      {prefix}
      {display.toFixed(decimals)}
      {suffix}
    </span>
  );
}
