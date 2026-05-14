import { useEffect, useState } from 'react';
import type { ErrorBucket, MappedError } from '../lib/errors';

interface ErrorBannerProps {
  error: MappedError;
  onRetry?: () => void;
  onDismiss?: () => void;
  onOpenSettings?: () => void;
}

const BUCKET_STYLES: Record<ErrorBucket, { ring: string; tint: string; text: string }> = {
  auth: {
    ring: 'border-danger/50',
    tint: 'bg-danger/10',
    text: 'text-danger',
  },
  validation: {
    ring: 'border-warn/50',
    tint: 'bg-warn/10',
    text: 'text-warn',
  },
  provider: {
    ring: 'border-warn/50',
    tint: 'bg-warn/10',
    text: 'text-warn',
  },
  network: {
    ring: 'border-warn/50',
    tint: 'bg-warn/10',
    text: 'text-warn',
  },
  quota: {
    ring: 'border-warn/50',
    tint: 'bg-warn/10',
    text: 'text-warn',
  },
  timeout: {
    ring: 'border-warn/50',
    tint: 'bg-warn/10',
    text: 'text-warn',
  },
  cancelled: {
    ring: 'border-border',
    tint: 'bg-bg-elevated',
    text: 'text-fg-muted',
  },
  unknown: {
    ring: 'border-danger/50',
    tint: 'bg-danger/10',
    text: 'text-danger',
  },
};

function useCountdown(targetMs?: number): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!targetMs) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [targetMs]);
  if (!targetMs) return null;
  const remaining = Math.max(0, Math.ceil((targetMs - now) / 1000));
  return remaining;
}

export function ErrorBanner({ error, onRetry, onDismiss, onOpenSettings }: ErrorBannerProps) {
  const style = BUCKET_STYLES[error.bucket];
  const targetMs = error.retryAfterMs ? Date.now() + error.retryAfterMs : undefined;
  const secondsLeft = useCountdown(targetMs);
  const cooldownActive = secondsLeft != null && secondsLeft > 0;

  const showSettingsCTA = error.bucket === 'auth';
  const retryLabel = cooldownActive ? `Retry in ${secondsLeft}s` : 'Retry';

  return (
    <div
      role="alert"
      data-testid="error-banner"
      data-bucket={error.bucket}
      className={`w-full rounded-md border ${style.ring} ${style.tint} px-3 py-2.5 text-left text-xs`}
    >
      <div className="flex items-start gap-2">
        <span className={`mt-0.5 flex-none ${style.text}`} aria-hidden="true">
          {error.bucket === 'auth' ? (
            <svg viewBox="0 0 16 16" width="14" height="14">
              <path
                d="M5 7V5a3 3 0 0 1 6 0v2M3.5 7h9v6h-9z"
                stroke="currentColor"
                strokeWidth="1.4"
                fill="none"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <svg viewBox="0 0 16 16" width="14" height="14">
              <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.4" fill="none" />
              <path d="M8 5v4M8 11v.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className={`font-semibold ${style.text}`}>{error.title}</p>
            {error.parameter && (
              <span className="font-mono text-[10px] text-fg-subtle" data-testid="error-parameter">
                field: {error.parameter}
              </span>
            )}
          </div>
          <p className="mt-0.5 break-words text-fg" data-testid="error-message">
            {error.message}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {showSettingsCTA && onOpenSettings && (
              <button
                type="button"
                onClick={onOpenSettings}
                data-testid="error-open-settings"
                className="rounded border border-border bg-bg px-2 py-0.5 text-[11px] font-medium text-fg hover:bg-bg-elevated"
              >
                Open Settings
              </button>
            )}
            {onRetry && error.retryable && (
              <button
                type="button"
                onClick={onRetry}
                disabled={cooldownActive}
                data-testid="error-retry"
                className="rounded border border-border bg-bg px-2 py-0.5 text-[11px] font-medium text-fg hover:bg-bg-elevated disabled:cursor-not-allowed disabled:opacity-60"
              >
                {retryLabel}
              </button>
            )}
            {onDismiss && (
              <button
                type="button"
                onClick={onDismiss}
                data-testid="error-dismiss"
                className="rounded px-2 py-0.5 text-[11px] font-medium text-fg-muted hover:bg-bg-elevated hover:text-fg"
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
