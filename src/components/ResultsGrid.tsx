import { Skeleton } from './Skeleton';

interface ResultsGridProps {
  loading?: boolean;
}

export function ResultsGrid({ loading = false }: ResultsGridProps) {
  return (
    <aside
      aria-label="Results"
      className="flex h-full w-80 flex-none flex-col border-l border-border bg-bg-panel"
    >
      <header className="flex flex-none items-center justify-between border-b border-border px-4 py-2.5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-fg-muted">Results</h2>
        <span className="text-[11px] text-fg-subtle">0 images</span>
      </header>
      <div className="flex-1 overflow-y-auto p-3">
        {loading ? (
          <div className="grid grid-cols-2 gap-2">
            <Skeleton className="aspect-square w-full" />
            <Skeleton className="aspect-square w-full" />
            <Skeleton className="aspect-square w-full" />
            <Skeleton className="aspect-square w-full" />
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 rounded border border-dashed border-border px-4 py-10 text-center">
            <svg viewBox="0 0 24 24" width="22" height="22" className="text-fg-subtle" aria-hidden="true">
              <rect x="3" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
              <rect x="13" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
              <rect x="3" y="13" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
              <rect x="13" y="13" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
            </svg>
            <p className="text-sm font-medium text-fg">No generations yet</p>
            <p className="text-xs text-fg-muted">Generated images will appear here in a grid.</p>
          </div>
        )}
      </div>
    </aside>
  );
}
