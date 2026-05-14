import { Skeleton } from './Skeleton';

interface ReferenceStripProps {
  loading?: boolean;
}

export function ReferenceStrip({ loading = false }: ReferenceStripProps) {
  return (
    <section
      aria-label="Reference images"
      className="flex flex-none items-center gap-2 border-b border-border bg-bg-panel px-3 py-2"
    >
      <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-fg-muted">
        References
      </span>
      <div className="flex flex-1 items-center gap-2 overflow-x-auto">
        {loading ? (
          <>
            <Skeleton className="h-14 w-14 flex-none" />
            <Skeleton className="h-14 w-14 flex-none" />
            <Skeleton className="h-14 w-14 flex-none" />
          </>
        ) : (
          <p className="truncate text-xs text-fg-subtle">
            Drop images here or pull from Eagle selection.
          </p>
        )}
      </div>
      <button
        type="button"
        disabled
        className="flex h-9 flex-none items-center gap-1 rounded border border-dashed border-border-strong px-2.5 text-xs text-fg-subtle"
        aria-label="Add reference image"
      >
        <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
          <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        </svg>
        Add
      </button>
    </section>
  );
}
