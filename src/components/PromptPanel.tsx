import { Skeleton } from './Skeleton';

interface PromptPanelProps {
  loading?: boolean;
}

export function PromptPanel({ loading = false }: PromptPanelProps) {
  return (
    <aside
      aria-label="Prompt"
      className="flex h-full w-72 flex-none flex-col border-r border-border bg-bg-panel"
    >
      <header className="flex flex-none items-center justify-between border-b border-border px-4 py-2.5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-fg-muted">Prompt</h2>
      </header>
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        {loading ? (
          <>
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-9 w-full" />
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 rounded border border-dashed border-border px-4 py-10 text-center">
            <svg viewBox="0 0 24 24" width="22" height="22" className="text-fg-subtle" aria-hidden="true">
              <path
                d="M4 5h16M4 10h16M4 15h10M4 20h6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
            <p className="text-sm font-medium text-fg">Prompt panel</p>
            <p className="text-xs text-fg-muted">
              Wire in the prompt editor, model parameters, and saved presets here.
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
