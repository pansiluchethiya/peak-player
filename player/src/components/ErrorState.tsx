import type { Diagnostic } from '../lib/types';
import { t } from './player/i18n';

interface Props {
  title: string;
  message: string;
  diagnostics?: Diagnostic[];
  onTryAnother: () => void;
  onReload: () => void;
}

export function ErrorState({ title, message, diagnostics, onTryAnother, onReload }: Props) {
  const failures = (diagnostics ?? []).filter((item) => !item.ok);

  return (
    <div className="error-layer" role="alert">
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
              {failures.map((failure) => (
                <li key={`${failure.provider}-${failure.latencyMs}`}>
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
