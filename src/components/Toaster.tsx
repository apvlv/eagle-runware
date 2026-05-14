import { removeToast, useToasts, type ToastVariant } from '../lib/toast';

const VARIANT_STYLES: Record<ToastVariant, { ring: string; icon: string; iconBg: string }> = {
  info: {
    ring: 'ring-border-strong',
    icon: 'text-fg-muted',
    iconBg: 'bg-bg-elevated',
  },
  success: {
    ring: 'ring-success/40',
    icon: 'text-success',
    iconBg: 'bg-success/10',
  },
  error: {
    ring: 'ring-danger/40',
    icon: 'text-danger',
    iconBg: 'bg-danger/10',
  },
  warn: {
    ring: 'ring-warn/40',
    icon: 'text-warn',
    iconBg: 'bg-warn/10',
  },
};

function VariantIcon({ variant }: { variant: ToastVariant }) {
  const common = 'h-3.5 w-3.5';
  switch (variant) {
    case 'success':
      return (
        <svg viewBox="0 0 16 16" className={common} aria-hidden="true">
          <path
            d="M3 8.5l3 3 7-7"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      );
    case 'error':
      return (
        <svg viewBox="0 0 16 16" className={common} aria-hidden="true">
          <path
            d="M4 4l8 8M12 4l-8 8"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      );
    case 'warn':
      return (
        <svg viewBox="0 0 16 16" className={common} aria-hidden="true">
          <path d="M8 3v6M8 12v.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" fill="none" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 16 16" className={common} aria-hidden="true">
          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" fill="none" />
          <path d="M8 6.5v4M8 4.5v.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
      );
  }
}

export function Toaster() {
  const toasts = useToasts();
  if (toasts.length === 0) return null;
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2"
    >
      {toasts.map((t) => {
        const styles = VARIANT_STYLES[t.variant];
        return (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-2.5 rounded-md bg-bg-panel px-3 py-2.5 text-sm text-fg shadow-lg ring-1 animate-toast-in ${styles.ring}`}
          >
            <span
              className={`mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full ${styles.iconBg} ${styles.icon}`}
            >
              <VariantIcon variant={t.variant} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{t.message}</p>
              {t.description && <p className="mt-0.5 text-xs text-fg-muted">{t.description}</p>}
            </div>
            <button
              type="button"
              onClick={() => removeToast(t.id)}
              className="-mr-1 -mt-1 rounded p-1 text-fg-subtle hover:bg-bg-elevated hover:text-fg"
              aria-label="Dismiss"
            >
              <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
                <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}
