import { useCallback, useEffect, useRef, useState } from 'react';
import { MODEL_LABELS } from '../lib/models';
import type { GenerationResult } from '../lib/runware';
import type { Job } from '../state/jobs';
import { getSave } from '../state/saves';
import type { Reference } from '../lib/promptForm';

export type LightboxItem =
  | { kind: 'result'; job: Job; result: GenerationResult }
  | { kind: 'reference'; reference: Reference };

interface LightboxProps {
  item: LightboxItem;
  onClose: () => void;
}

export function resultImgSrc(r: GenerationResult): string | null {
  if (r.imageURL) return r.imageURL;
  if (r.imageDataURI) return r.imageDataURI;
  if (r.imageBase64Data) return `data:image/png;base64,${r.imageBase64Data}`;
  return null;
}

export function lightboxItemSrc(item: LightboxItem): string | null {
  if (item.kind === 'result') return resultImgSrc(item.result);
  return item.reference.dataURI || null;
}

// Back-compat alias used by callers that already have a GenerationResult in hand.
export const lightboxImgSrc = resultImgSrc;

export function lightboxSaveKey(job: Job, r: GenerationResult): string {
  return r.imageUUID ?? r.imageURL ?? `${job.id}-${r.taskUUID ?? ''}`;
}

function formatCost(cost?: number): string | null {
  if (typeof cost !== 'number' || !Number.isFinite(cost)) return null;
  if (cost === 0) return '$0.00';
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(3)}`;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

const MIN_SCALE = 1;
const MAX_SCALE = 12;

interface Transform {
  scale: number;
  tx: number;
  ty: number;
}

const IDENTITY: Transform = { scale: 1, tx: 0, ty: 0 };

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

interface LightboxInfoProps {
  item: LightboxItem;
}

function LightboxInfo({ item }: LightboxInfoProps) {
  if (item.kind === 'result') {
    const { job, result } = item;
    const cost = formatCost(result.cost);
    const modelLabel = MODEL_LABELS[job.model];
    const saved = getSave(lightboxSaveKey(job, result));
    return (
      <>
        <span className="font-sans font-semibold">{modelLabel}</span>
        {result.seed != null && <span>seed {result.seed}</span>}
        {cost && <span>{cost}</span>}
        {saved && <span className="font-sans text-success">Saved · {saved.name}</span>}
      </>
    );
  }
  const r = item.reference;
  const kindLabel = r.kind === 'library' ? 'Library' : 'Upload';
  return (
    <>
      <span className="font-sans font-semibold">Reference</span>
      <span className="font-sans text-fg-muted">{kindLabel}</span>
      <span className="max-w-[28rem] truncate font-sans">{r.name}</span>
      <span>{formatBytes(r.bytes)}</span>
    </>
  );
}

function lightboxAltText(item: LightboxItem): string {
  if (item.kind === 'result') {
    return `Result seed ${item.result.seed ?? ''}`;
  }
  return item.reference.name;
}

export function Lightbox({ item, onClose }: LightboxProps) {
  const src = lightboxItemSrc(item);
  const altText = lightboxAltText(item);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [transform, setTransform] = useState<Transform>(IDENTITY);
  const [dragging, setDragging] = useState(false);
  const transformRef = useRef(transform);
  transformRef.current = transform;

  // Reset zoom/pan whenever the previewed item changes.
  useEffect(() => {
    setTransform(IDENTITY);
  }, [item]);

  // Escape closes; '0' resets transform.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === '0') setTransform(IDENTITY);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Native (non-passive) wheel listener so preventDefault works.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - (rect.left + rect.width / 2);
      const cy = e.clientY - (rect.top + rect.height / 2);
      const sensitivity = e.ctrlKey ? 0.01 : 0.0015;
      const rawFactor = Math.exp(-e.deltaY * sensitivity);
      setTransform((t) => {
        const next = clamp(t.scale * rawFactor, MIN_SCALE, MAX_SCALE);
        const realFactor = next / t.scale;
        return {
          scale: next,
          tx: cx - (cx - t.tx) * realFactor,
          ty: cy - (cy - t.ty) * realFactor,
        };
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const reset = useCallback(() => setTransform(IDENTITY), []);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, textarea, select')) return;
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const start = transformRef.current;
    setDragging(true);
    const onMove = (ev: MouseEvent) => {
      setTransform({
        scale: start.scale,
        tx: start.tx + (ev.clientX - startX),
        ty: start.ty + (ev.clientY - startY),
      });
    };
    const onUp = () => {
      setDragging(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, []);

  const zoomPct = Math.round(transform.scale * 100);
  const transformed =
    transform.scale !== 1 || transform.tx !== 0 || transform.ty !== 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg-overlay/80 p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
      data-testid="result-lightbox"
      onClick={onClose}
    >
      <div
        ref={containerRef}
        className="flex max-h-full w-full max-w-6xl select-none flex-col items-center gap-3 overflow-hidden"
        onClick={(e) => {
          // Dead space inside the wrapper (beside the image / info bar) closes
          // the lightbox, matching the backdrop. Clicks on children stay
          // contained so the image and the info-bar buttons keep working.
          if (e.target === e.currentTarget) {
            onClose();
            return;
          }
          e.stopPropagation();
        }}
        onMouseDown={handleMouseDown}
        onDoubleClick={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest('button')) return;
          reset();
        }}
        style={{ cursor: dragging ? 'grabbing' : src ? 'grab' : 'default' }}
      >
        {src ? (
          <img
            src={src}
            alt={altText}
            className="max-h-[85vh] w-auto max-w-full rounded-md border border-border bg-bg shadow-2xl"
            draggable={false}
            style={{
              transform: `translate(${transform.tx}px, ${transform.ty}px) scale(${transform.scale})`,
              transformOrigin: 'center',
              transition: dragging ? 'none' : 'transform 60ms linear',
              willChange: 'transform',
            }}
          />
        ) : (
          <div className="flex h-64 w-64 items-center justify-center rounded-md border border-border bg-bg-panel text-sm text-fg-muted">
            No image
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3 rounded bg-bg-panel px-3 py-2 font-mono text-[11px] text-fg shadow-md">
          <LightboxInfo item={item} />
          <span className="text-fg-subtle">{zoomPct}%</span>
          {transformed && (
            <button
              type="button"
              onClick={reset}
              className="rounded border border-border bg-bg px-2 py-0.5 font-sans text-[11px] text-fg-muted hover:bg-bg-elevated hover:text-fg"
              aria-label="Reset zoom and pan"
              title="Reset zoom (double-click or press 0)"
            >
              Reset
            </button>
          )}
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
