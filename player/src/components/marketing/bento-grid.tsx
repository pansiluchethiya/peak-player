import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface BentoGridProps {
  children: ReactNode;
  className?: string;
}

export function BentoGrid({ children, className }: BentoGridProps) {
  return <div className={cn('peak-bento', className)}>{children}</div>;
}

interface BentoCardProps {
  children?: ReactNode;
  className?: string;
  description: string;
  icon?: ReactNode;
  title: string;
}

export function BentoCard({
  children,
  className,
  description,
  icon,
  title,
}: BentoCardProps) {
  return (
    <article className={cn('peak-bento-card', className)}>
      {icon}
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </article>
  );
}
