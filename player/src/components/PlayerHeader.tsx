'use client';

import { useRouter } from 'next/navigation';
import type { Branding } from '../lib/types';

interface Props {
  branding: Branding;
  title?: string;
  subtitle?: string;
  currentProvider?: string;
  visible: boolean;
  onBack?: () => void;
}

export function PlayerHeader({ branding, title, subtitle, currentProvider, visible, onBack }: Props) {
  const router = useRouter();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  return (
    <div className={`player-header ${visible ? 'visible' : 'hidden'}`}>
      <div className="player-header-left">
        <button
          type="button"
          className="header-back-button"
          onClick={handleBack}
          aria-label="Back"
        >
          <svg viewBox="0 0 24 24" className="header-back-icon">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2Z" />
          </svg>
        </button>

        {branding.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={branding.logoUrl} alt={branding.name} className="header-brand-logo" />
        )}

        <div className="header-meta">
          <span className="header-brand-name">{branding.name}</span>
          {title && <h1 className="header-title">{title}</h1>}
          {subtitle && <span className="header-subtitle">{subtitle}</span>}
          {currentProvider && (
            <span className="header-provider" style={{
              fontSize: '0.65rem',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              padding: '2px 8px',
              borderRadius: '4px',
              backgroundColor: 'rgba(255,255,255,0.1)',
              backdropFilter: 'blur(4px)',
            }}>{currentProvider}</span>
          )}
        </div>
      </div>
    </div>
  );
}
