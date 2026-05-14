export type StatusKind = 'idle' | 'busy' | 'success' | 'error';

export interface StatusProgress {
  got: number;
  expected: number;
}

interface StatusBarProps {
  kind?: StatusKind;
  message?: string;
  hint?: string;
  onCancel?: () => void;
  progress?: StatusProgress | null;
}

const KIND_DOT: Record<StatusKind, string> = {
  idle: 'bg-fg-subtle',
  busy: 'bg-focus animate-pulse',
  success: 'bg-success',
  error: 'bg-danger',
};

const KIND_LABEL: Record<StatusKind, string> = {
  idle: 'Idle',
  busy: 'Working…',
  success: 'Done',
  error: 'Error',
};

export function StatusBar({ kind = 'idle', message, hint, onCancel, progress }: StatusBarProps) {
  const showBar = kind === 'busy' && progress && progress.expected > 0;
  const pct = showBar
    ? Math.min(100, Math.max(0, (progress!.got / progress!.expected) * 100))
    : 0;
  const indeterminate = showBar && progress!.got === 0;

  return (
    <footer
      role="status"
      aria-live="polite"
      className="relative flex flex-none items-center justify-between gap-3 border-t border-border bg-bg-panel px-3 py-1.5 text-xs"
    >
      {showBar && (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-0.5 overflow-hidden bg-bg-elevated"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={progress!.expected}
          aria-valuenow={indeterminate ? undefined : progress!.got}
          aria-label={`Generated ${progress!.got} of ${progress!.expected}`}
        >
          {indeterminate ? (
            <div className="h-full w-1/3 -translate-x-full animate-progress-indeterminate bg-focus" />
          ) : (
            <div
              className="h-full bg-focus transition-[width] duration-300"
              style={{ width: `${pct}%` }}
            />
          )}
        </div>
      )}
      <div className="flex min-w-0 items-center gap-2">
        {kind === 'busy' ? (
          <svg
            viewBox="0 0 16 16"
            width="11"
            height="11"
            className="flex-none animate-spin text-focus"
            aria-hidden="true"
          >
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.25" />
            <path
              d="M14 8a6 6 0 0 0-6-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
        ) : (
          <span className={`inline-block h-2 w-2 flex-none rounded-full ${KIND_DOT[kind]}`} aria-hidden="true" />
        )}
        <span className="font-medium text-fg">{message ?? KIND_LABEL[kind]}</span>
      </div>
      <div className="flex items-center gap-3">
        {hint && <span className="hidden truncate text-fg-subtle sm:inline">{hint}</span>}
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            data-testid="cancel-job"
            className="rounded border border-border bg-bg px-2 py-0.5 text-[11px] font-medium text-fg-muted hover:bg-bg-elevated hover:text-fg"
          >
            Cancel
          </button>
        ) : (
          <span className="hidden text-fg-subtle md:inline">
            <kbd className="rounded border border-border bg-bg px-1.5 py-0.5 font-mono text-[10px]">⌘ ⏎</kbd>
            <span className="ml-1.5">to generate</span>
          </span>
        )}
      </div>
    </footer>
  );
}
