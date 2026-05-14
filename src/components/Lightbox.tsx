import { useEffect } from 'react';
import { MODEL_LABELS } from '../lib/models';
import type { GenerationResult } from '../lib/runware';
import type { Job } from '../state/jobs';
import { getSave } from '../state/saves';

export interface LightboxItem {
  job: Job;
  result: GenerationResult;
}

interface LightboxProps {
  item: LightboxItem;
  onClose: () => void;
}

export function lightboxImgSrc(r: GenerationResult): string | null {
  if (r.imageURL) return r.imageURL;
  if (r.imageDataURI) return r.imageDataURI;
  if (r.imageBase64Data) return `data:image/png;base64,${r.imageBase64Data}`;
  return null;
}

export function lightboxSaveKey(job: Job, r: GenerationResult): string {
  return r.imageUUID ?? r.imageURL ?? `${job.id}-${r.taskUUID ?? ''}`;
}

function formatCost(cost?: number): string | null {
  if (typeof cost !== 'number' || !Number.isFinite(cost)) return null;
  if (cost === 0) return '$0.00';
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(3)}`;
}

export function Lightbox({ item, onClose }: LightboxProps) {
  const { job, result } = item;
  const src = lightboxImgSrc(result);
  const cost = formatCost(result.cost);
  const modelLabel = MODEL_LABELS[job.model];
  const saved = getSave(lightboxSaveKey(job, result));

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

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
        className="flex max-h-full w-full max-w-6xl flex-col items-center gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        {src ? (
          <img
            src={src}
            alt={`Result seed ${result.seed ?? ''}`}
            className="max-h-[85vh] w-auto max-w-full rounded-md border border-border bg-bg shadow-2xl"
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
          {saved && <span className="font-sans text-success">Saved · {saved.name}</span>}
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
