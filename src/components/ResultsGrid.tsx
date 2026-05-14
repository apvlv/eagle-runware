import { useEffect, useMemo, useState } from 'react';
import { Skeleton } from './Skeleton';
import { MODEL_LABELS } from '../lib/models';
import type { GenerationResult } from '../lib/runware';
import type { Job } from '../state/jobs';
import { useJobsState } from '../state/jobs';

interface ResultsGridProps {
  loading?: boolean;
  onVariation: (job: Job) => void;
  onUseAsReference: (job: Job, result: GenerationResult) => void;
  refBusyKey: string | null;
}

interface FlatItem {
  job: Job;
  result: GenerationResult;
  key: string;
}

function imgSrc(r: GenerationResult): string | null {
  if (r.imageURL) return r.imageURL;
  if (r.imageDataURI) return r.imageDataURI;
  if (r.imageBase64Data) return `data:image/png;base64,${r.imageBase64Data}`;
  return null;
}

function itemKey(job: Job, r: GenerationResult, idx: number): string {
  return r.imageUUID ?? r.imageURL ?? `${job.id}-${idx}-${r.taskUUID ?? ''}`;
}

export function resultBusyKey(job: Job, r: GenerationResult): string {
  return r.imageUUID ?? r.imageURL ?? `${job.id}-${r.taskUUID ?? ''}`;
}

function formatCost(cost?: number): string | null {
  if (typeof cost !== 'number' || !Number.isFinite(cost)) return null;
  if (cost === 0) return '$0.00';
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(3)}`;
}

export function ResultsGrid({
  loading = false,
  onVariation,
  onUseAsReference,
  refBusyKey,
}: ResultsGridProps) {
  const { jobs } = useJobsState();
  const [lightbox, setLightbox] = useState<FlatItem | null>(null);

  const items = useMemo<FlatItem[]>(() => {
    const out: FlatItem[] = [];
    for (let i = jobs.length - 1; i >= 0; i--) {
      const j = jobs[i];
      for (let k = j.results.length - 1; k >= 0; k--) {
        const r = j.results[k];
        out.push({ job: j, result: r, key: itemKey(j, r, k) });
      }
    }
    return out;
  }, [jobs]);

  useEffect(() => {
    if (!lightbox) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightbox]);

  const count = items.length;

  return (
    <aside
      aria-label="Results"
      className="flex h-full w-80 flex-none flex-col border-l border-border bg-bg-panel"
    >
      <header className="flex flex-none items-center justify-between border-b border-border px-4 py-2.5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-fg-muted">Results</h2>
        <span className="text-[11px] text-fg-subtle" data-testid="results-count">
          {count} {count === 1 ? 'image' : 'images'}
        </span>
      </header>
      <div className="flex-1 overflow-y-auto p-3">
        {loading ? (
          <div className="grid grid-cols-2 gap-2">
            <Skeleton className="aspect-square w-full" />
            <Skeleton className="aspect-square w-full" />
            <Skeleton className="aspect-square w-full" />
            <Skeleton className="aspect-square w-full" />
          </div>
        ) : items.length === 0 ? (
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
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {items.map((item) => (
              <ResultCard
                key={item.key}
                item={item}
                onOpen={() => setLightbox(item)}
                onVariation={() => onVariation(item.job)}
                onUseAsReference={() => onUseAsReference(item.job, item.result)}
                refBusy={refBusyKey === resultBusyKey(item.job, item.result)}
              />
            ))}
          </div>
        )}
      </div>
      {lightbox && <Lightbox item={lightbox} onClose={() => setLightbox(null)} />}
    </aside>
  );
}

interface ResultCardProps {
  item: FlatItem;
  onOpen: () => void;
  onVariation: () => void;
  onUseAsReference: () => void;
  refBusy: boolean;
}

function ResultCard({ item, onOpen, onVariation, onUseAsReference, refBusy }: ResultCardProps) {
  const { job, result } = item;
  const src = imgSrc(result);
  const cost = formatCost(result.cost);
  const modelLabel = MODEL_LABELS[job.model];

  return (
    <div
      className="group relative overflow-hidden rounded-md border border-border bg-bg"
      data-testid="result-card"
      data-job-id={job.id}
    >
      <button
        type="button"
        onClick={onOpen}
        className="block w-full focus:outline-none"
        aria-label={`Open result, seed ${result.seed ?? 'unknown'}`}
      >
        {src ? (
          <img
            src={src}
            alt={`Result seed ${result.seed ?? ''}`}
            className="aspect-square w-full object-cover transition-transform group-hover:scale-[1.02]"
            draggable={false}
          />
        ) : (
          <div className="flex aspect-square w-full items-center justify-center bg-bg-elevated text-[10px] text-fg-subtle">
            No image
          </div>
        )}
      </button>
      <span
        className="pointer-events-none absolute left-1 top-1 rounded bg-bg-overlay/70 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-fg-inverse"
        data-testid="result-model"
      >
        {modelLabel}
      </span>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-1 bg-gradient-to-t from-bg-overlay/80 to-transparent px-1.5 pb-1 pt-6 font-mono text-[9px] text-fg-inverse">
        <span data-testid="result-seed">
          {result.seed != null ? `seed ${result.seed}` : ''}
        </span>
        {cost && <span data-testid="result-cost">{cost}</span>}
      </div>
      <div className="absolute inset-x-1 top-1 flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <button
          type="button"
          onClick={onVariation}
          title="Variation (new seed)"
          aria-label="Generate variation"
          className="rounded bg-bg-panel/95 px-1.5 py-0.5 text-[10px] font-medium text-fg shadow-sm hover:bg-bg-elevated"
        >
          Variation
        </button>
        <button
          type="button"
          onClick={onUseAsReference}
          disabled={refBusy || !src}
          title="Use as reference image"
          aria-label="Use as reference"
          className="rounded bg-bg-panel/95 px-1.5 py-0.5 text-[10px] font-medium text-fg shadow-sm hover:bg-bg-elevated disabled:cursor-wait disabled:opacity-60"
        >
          {refBusy ? '…' : 'Use as ref'}
        </button>
      </div>
    </div>
  );
}

interface LightboxProps {
  item: FlatItem;
  onClose: () => void;
}

function Lightbox({ item, onClose }: LightboxProps) {
  const { job, result } = item;
  const src = imgSrc(result);
  const cost = formatCost(result.cost);
  const modelLabel = MODEL_LABELS[job.model];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg-overlay/80 p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Result preview"
      data-testid="result-lightbox"
      onClick={onClose}
    >
      <div
        className="flex max-h-full w-full max-w-4xl flex-col items-center gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        {src ? (
          <img
            src={src}
            alt={`Result seed ${result.seed ?? ''}`}
            className="max-h-[75vh] w-auto max-w-full rounded-md border border-border bg-bg shadow-2xl"
            draggable={false}
          />
        ) : (
          <div className="flex h-64 w-64 items-center justify-center rounded-md border border-border bg-bg-panel text-sm text-fg-muted">
            No image
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3 rounded bg-bg-panel px-3 py-2 font-mono text-[11px] text-fg shadow-md">
          <span className="font-sans font-semibold">{modelLabel}</span>
          {result.seed != null && <span>seed {result.seed}</span>}
          {cost && <span>{cost}</span>}
          <button
            type="button"
            onClick={onClose}
            className="ml-2 rounded border border-border bg-bg px-2 py-0.5 font-sans text-[11px] text-fg-muted hover:bg-bg-elevated hover:text-fg"
            aria-label="Close preview"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
