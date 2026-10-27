'use client';
import { type ButtonHTMLAttributes } from 'react';

export interface ControlButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label?: string;
  icon?: string;
}

/** Shared button primitive for the AMOLED control bar. */
export function ControlButton({ onClick, disabled, icon, children, 'aria-label': label, ...rest }: ControlButtonProps) {
  return (
    <button
      type="button"
      className="peak-control-btn"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      {...rest}
    >
      {icon ? <span aria-hidden="true">{icon}</span> : null}
      {children}
    </button>
  );
}
