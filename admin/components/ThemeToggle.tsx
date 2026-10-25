'use client';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import { clsx } from 'clsx';

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      className={clsx('theme-toggle-btn', { dark: theme === 'dark', light: theme === 'light' })}
    >
      <Sun className="icon icon-sun" aria-hidden={theme !== 'dark'} />
      <Moon className="icon icon-moon" aria-hidden={theme === 'dark'} />
    </button>
  );
}
