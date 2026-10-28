'use client';
import { Check } from 'lucide-react';
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

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
  /** Extra controls rendered under the option list (e.g. caption settings). */
  footer?: ReactNode;
  /** Wider popup for rows with labels and values. */
  width?: number;
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
export function MenuRoot({ trigger, options, onSelect, selected, label, footer, width = 208 }: MenuRootProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  useOutsideClick(containerRef, () => setOpen(false));

  useEffect(() => {
    if (!open || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect() || FALLBACK_RECT;
    // The list is `position: fixed`, so coordinates are viewport-relative.
    // Flip above the trigger when the list would overflow the bottom edge and
    // clamp horizontally so long option lists stay reachable on phones.
    const height = Math.min(options.length * 34 + 12 + (footer ? 210 : 0), window.innerHeight - 16);
    const top =
      rect.bottom + height + 8 > window.innerHeight
        ? Math.max(8, rect.top - height - 8)
        : rect.bottom + 6;
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    setPosition({ top, left });
  }, [footer, open, options.length, width]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
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
          style={{ position: 'fixed', top: position.top, left: position.left, zIndex: 100, width }}
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="menuitemradio"
              className="peak-menu-item"
              disabled={option.disabled}
              aria-checked={selected === option.value}
              data-selected={selected === option.value}
              onClick={() => handleSelect(option.value)}
            >
              {option.icon ? <span className="peak-menu-option-icon">{option.icon}</span> : null}
              <span className="peak-menu-option-label">{option.label}</span>
              {selected === option.value ? <Check className="peak-menu-check" size={14} /> : null}
            </button>
          ))}
          {footer}
        </div>
      )}
    </div>
  );
}
