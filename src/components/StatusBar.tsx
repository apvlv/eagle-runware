export type StatusKind = 'idle' | 'busy' | 'success' | 'error';

interface StatusBarProps {
  kind?: StatusKind;
  message?: string;
  hint?: string;
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

export function StatusBar({ kind = 'idle', message, hint }: StatusBarProps) {
  return (
    <footer
      role="status"
      aria-live="polite"
      className="flex flex-none items-center justify-between gap-3 border-t border-border bg-bg-panel px-3 py-1.5 text-xs"
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className={`inline-block h-2 w-2 flex-none rounded-full ${KIND_DOT[kind]}`} aria-hidden="true" />
        <span className="font-medium text-fg">{message ?? KIND_LABEL[kind]}</span>
      </div>
      {hint && <span className="hidden truncate text-fg-subtle sm:inline">{hint}</span>}
      <span className="hidden text-fg-subtle md:inline">
        <kbd className="rounded border border-border bg-bg px-1.5 py-0.5 font-mono text-[10px]">⌘ ⏎</kbd>
        <span className="ml-1.5">to generate</span>
      </span>
    </footer>
  );
}
