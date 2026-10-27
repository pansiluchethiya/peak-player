'use client';
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { usePlayerContext } from '../PlayerProvider';

export interface MenuOption {
  value: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
}

export interface MenuRootProps {
  trigger: ReactNode;
  options: MenuOption[];
  onSelect: (value: string) => void;
  selected?: string | null;
  label?: string;
}

const FALLBACK_RECT = { top: 0, left: 0, bottom: 0, right: 0 };

function useOutsideClick(
  ref: React.RefObject<HTMLElement | null>,
  handler: (event: MouseEvent | TouchEvent) => void,
) {
  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        handler(event);
      }
    };
    document.addEventListener('pointerdown', listener, { passive: true });
    document.addEventListener('touchstart', listener, { passive: true });
    return () => {
      document.removeEventListener('pointerdown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [handler]);
}

/** Dropdown menu primitive: a trigger slot and a floating option list. */
export function MenuRoot({ trigger, options, onSelect, selected, label }: MenuRootProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  useOutsideClick(containerRef, () => setOpen(false));

  useEffect(() => {
    if (open && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect() || FALLBACK_RECT;
      setPosition({ top: rect.bottom + window.scrollY, left: rect.left + window.scrollX });
    }
  }, [open]);

  const handleSelect = useCallback(
    (value: string) => {
      onSelect(value);
      setOpen(false);
    },
    [onSelect],
  );

  return (
    <div className="peak-menu" ref={containerRef}>
      <button
        type="button"
        className="peak-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((value) => !value)}
      >
        {trigger}
      </button>
      {open && (
        <div
          className="peak-menu-list"
          role="menu"
          style={{ position: 'fixed', top: position.top, left: position.left, zIndex: 100 }}
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="menuitemradio"
              className="peak-menu-item"
              disabled={option.disabled}
              data-selected={selected === option.value}
              onClick={() => handleSelect(option.value)}
            >
              {option.icon}
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
