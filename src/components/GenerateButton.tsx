interface GenerateButtonProps {
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
  label?: string;
}

export function GenerateButton({ onClick, disabled, busy, label = 'Generate' }: GenerateButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-accent text-sm font-semibold text-accent-fg shadow-sm transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
    >
      {busy ? (
        <>
          <svg viewBox="0 0 16 16" width="14" height="14" className="animate-spin" aria-hidden="true">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.25" />
            <path
              d="M14 8a6 6 0 0 0-6-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
          <span>Generating…</span>
        </>
      ) : (
        <>
          <span>{label}</span>
          <span className="rounded bg-accent-fg/10 px-1.5 py-0.5 font-mono text-[10px] text-accent-fg/80">
            ⌘ ⏎
          </span>
        </>
      )}
    </button>
  );
}
