import type { ReactNode } from 'react';
import type { Diagnostic } from '../lib/types';
import { t } from './player/i18n';

interface Props {
  title: string;
  message: string;
  diagnostics?: Diagnostic[];
  artwork?: ReactNode;
  onTryAnother: () => void;
  onReload: () => void;
}

export function ErrorState({ title, message, diagnostics, artwork, onTryAnother, onReload }: Props) {
  const failures = (diagnostics ?? []).filter((item) => !item.ok);

  return (
    <div className={`error-layer${artwork ? ' has-artwork' : ''}`} role="alert">
      {artwork ? <div className="error-artwork">{artwork}</div> : null}
      <div className="error-card">
        <span className="error-mark">!</span>
        <h2>{title}</h2>
        <p>{message}</p>
        <div className="error-actions">
          <button type="button" className="button primary" onClick={onTryAnother}>
            {t('try-another')}
          </button>
          <button type="button" className="button ghost" onClick={onReload}>
            {t('reload')}
          </button>
        </div>
        {failures.length > 0 && (
          <details className="diagnostics">
            <summary>{t('provider-diagnostics')}</summary>
            <ul>
              {failures.map((failure, index) => (
                <li key={`${failure.provider}-${failure.latencyMs}-${index}`}>
                  <strong>{failure.provider}</strong> — {failure.error ?? t('failed')}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
}
