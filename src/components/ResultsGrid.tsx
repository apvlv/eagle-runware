import { useCallback, useEffect, useMemo, useState } from 'react';
import { Skeleton } from './Skeleton';
import { MODEL_LABELS } from '../lib/models';
import type { GenerationResult } from '../lib/runware';
import type { Job } from '../state/jobs';
import { isActiveStatus, useJobsState } from '../state/jobs';
import {
  patchSave,
  recordSave,
  useSavesState,
  type SavedItem,
} from '../state/saves';
import { openItemInEagle, saveGeneratedToLibrary, setItemStar } from '../lib/eagle';
import {
  autoNameFor,
  buildAnnotation,
  buildInitialTags,
  inputImageTags,
} from '../lib/saveTemplates';
import { useSettings } from '../lib/settings';
import { toast } from '../lib/toast';
import { StarRating } from './StarRating';
import { SaveToEagleModal } from './SaveToEagleModal';
import type { LightboxItem } from './Lightbox';

interface ResultsGridProps {
  loading?: boolean;
  onVariation: (job: Job) => void;
  onUseAsReference: (job: Job, result: GenerationResult) => void;
  onOpenLightbox: (item: LightboxItem) => void;
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
  onOpenLightbox,
  refBusyKey,
}: ResultsGridProps) {
  const { jobs } = useJobsState();
  const saves = useSavesState();
  const [settings] = useSettings();
  const [savingAll, setSavingAll] = useState(false);

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

  const pendingCount = useMemo(() => {
    const active = jobs.find((j) => isActiveStatus(j.status));
    if (!active) return 0;
    return Math.max(0, active.expected - active.results.length);
  }, [jobs]);

  const unsavedCount = useMemo(
    () => items.filter((it) => !saves.byKey[resultBusyKey(it.job, it.result)]).length,
    [items, saves.byKey],
  );

  const handleSaveAll = useCallback(async () => {
    if (savingAll) return;
    const targets = items
      .filter((it) => !saves.byKey[resultBusyKey(it.job, it.result)])
      .map((it) => ({ ...it, saveKey: resultBusyKey(it.job, it.result) }));
    if (targets.length === 0) {
      toast.info('Nothing to save — every result is already in Eagle.');
      return;
    }
    setSavingAll(true);
    let ok = 0;
    let firstError: string | null = null;
    for (const t of targets) {
      try {
        const tags = buildInitialTags(
          t.job.model,
          settings.defaultTags,
          inputImageTags(t.job.referenceNames),
        );
        const name = autoNameFor(t.job, t.result);
        const annotation = buildAnnotation(t.job, t.result);
        const folderId = settings.defaultFolderId ?? null;
        const itemId = await saveGeneratedToLibrary(
          {
            imageURL: t.result.imageURL,
            imageBase64Data: t.result.imageBase64Data,
            imageDataURI: t.result.imageDataURI,
            outputFormat: t.job.request.outputFormat,
          },
          {
            name,
            tags,
            folderId: folderId ?? undefined,
            annotation,
          },
        );
        recordSave({
          resultKey: t.saveKey,
          jobId: t.job.id,
          itemId,
          name,
          tags,
          folderId,
          annotation,
          star: 0,
          savedAt: Date.now(),
        });
        ok += 1;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (firstError == null) firstError = msg;
      }
    }
    setSavingAll(false);
    const failed = targets.length - ok;
    if (failed === 0) {
      toast.success(`Saved ${ok} ${ok === 1 ? 'image' : 'images'} to Eagle.`);
    } else if (ok === 0) {
      toast.error('Save to Eagle failed', { description: firstError ?? 'Unknown error.' });
    } else {
      toast.warn(`Saved ${ok}/${targets.length} — first error: ${firstError ?? 'unknown'}`);
    }
  }, [savingAll, items, saves.byKey, settings.defaultFolderId, settings.defaultTags]);

  const count = items.length;

  return (
    <aside
      aria-label="Results"
      className="flex h-full w-[28rem] flex-none flex-col border-l border-border bg-bg-panel"
    >
      <header className="flex flex-none items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <div className="flex min-w-0 flex-col">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-fg-muted">Results</h2>
          <span className="text-[11px] text-fg-subtle" data-testid="results-count">
            {count} {count === 1 ? 'image' : 'images'}
            {unsavedCount > 0 && count > 0 && (
              <span className="ml-1 text-fg-subtle">· {unsavedCount} unsaved</span>
            )}
          </span>
        </div>
        {unsavedCount > 0 && (
          <button
            type="button"
            onClick={handleSaveAll}
            disabled={savingAll}
            data-testid="save-all"
            className="rounded border border-border bg-bg px-2 py-1 text-[11px] font-medium text-fg hover:bg-bg-elevated disabled:cursor-not-allowed disabled:opacity-50"
          >
            {savingAll ? `Saving…` : `Save all (${unsavedCount})`}
          </button>
        )}
      </header>
      <div className="flex-1 overflow-y-auto p-3">
        {loading ? (
          <div className="grid grid-cols-2 gap-2">
            <Skeleton className="aspect-square w-full" />
            <Skeleton className="aspect-square w-full" />
            <Skeleton className="aspect-square w-full" />
            <Skeleton className="aspect-square w-full" />
          </div>
        ) : items.length === 0 && pendingCount === 0 ? (
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
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: pendingCount }).map((_, i) => (
              <div
                key={`pending-${i}`}
                className="relative aspect-square w-full overflow-hidden rounded-md border border-dashed border-border"
                aria-label="Result pending"
                data-testid="result-pending"
              >
                <Skeleton className="h-full w-full rounded-none" />
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[10px] uppercase tracking-wide text-fg-subtle">
                  Pending…
                </span>
              </div>
            ))}
            {items.map((item) => (
              <ResultCard
                key={item.key}
                item={item}
                onOpen={() => onOpenLightbox({ kind: 'result', job: item.job, result: item.result })}
                onVariation={() => onVariation(item.job)}
                onUseAsReference={() => onUseAsReference(item.job, item.result)}
                refBusy={refBusyKey === resultBusyKey(item.job, item.result)}
              />
            ))}
          </div>
        )}
      </div>
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
  const saveKey = resultBusyKey(job, result);
  const saves = useSavesState();
  const saved: SavedItem | undefined = saves.byKey[saveKey];

  const [pendingStar, setPendingStar] = useState<number>(saved?.star ?? 0);
  const [starBusy, setStarBusy] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  // Keep pendingStar in sync if the saved record changes externally (e.g. modal update).
  useEffect(() => {
    if (saved) setPendingStar(saved.star);
  }, [saved]);

  const displayStar = saved?.star ?? pendingStar;

  const handleStarChange = useCallback(
    async (next: number) => {
      if (starBusy) return;
      if (saved) {
        setStarBusy(true);
        try {
          await setItemStar(saved.itemId, next);
          patchSave(saveKey, { star: next });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          toast.error('Could not update rating', { description: msg });
        } finally {
          setStarBusy(false);
        }
      } else {
        setPendingStar(next);
      }
    },
    [starBusy, saved, saveKey],
  );

  const handleOpenInEagle = useCallback(async () => {
    if (!saved) return;
    const ok = await openItemInEagle(saved.itemId);
    if (ok) {
      toast.info('Opened in Eagle');
      return;
    }
    let copied = false;
    try {
      const nav = (globalThis as { navigator?: { clipboard?: { writeText?: (s: string) => Promise<void> } } })
        .navigator;
      if (nav?.clipboard?.writeText) {
        void nav.clipboard.writeText(saved.itemId);
        copied = true;
      }
    } catch {
      /* ignore */
    }
    toast.info(copied ? `Item id copied: ${saved.itemId}` : `Item id: ${saved.itemId}`);
  }, [saved]);

  return (
    <div
      className="group relative overflow-hidden rounded-md border border-border bg-bg"
      data-testid="result-card"
      data-job-id={job.id}
      data-saved={saved ? 'true' : 'false'}
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

      {saved && (
        <span
          className="pointer-events-none absolute right-1 top-1 rounded bg-success/85 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-fg-inverse"
          data-testid="result-saved-badge"
          title={`Saved: ${saved.name}`}
        >
          Saved
        </span>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-1 bg-gradient-to-t from-bg-overlay/85 to-transparent px-1.5 pb-1.5 pt-6 text-fg-inverse">
        <div className="pointer-events-auto flex items-center justify-between">
          <StarRating
            value={displayStar}
            onChange={handleStarChange}
            disabled={starBusy}
            size={12}
            label="Rating"
          />
          {saved ? (
            <button
              type="button"
              onClick={handleOpenInEagle}
              title={`Saved: ${saved.name} — open in Eagle`}
              data-testid="result-saved-link"
              className="pointer-events-auto max-w-[7rem] truncate rounded bg-bg-panel/90 px-1.5 py-0.5 text-[10px] font-medium text-fg shadow-sm hover:bg-bg-elevated"
            >
              ↗ {saved.name}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              title="Save to Eagle"
              data-testid="result-save-btn"
              className="pointer-events-auto rounded bg-bg-panel/90 px-1.5 py-0.5 text-[10px] font-medium text-fg shadow-sm hover:bg-bg-elevated"
            >
              Save to Eagle
            </button>
          )}
        </div>
        <div className="flex items-end justify-between gap-1 font-mono text-[9px]">
          <span data-testid="result-seed">{result.seed != null ? `seed ${result.seed}` : ''}</span>
          {cost && <span data-testid="result-cost">{cost}</span>}
        </div>
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
        {saved && (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            title="Edit tags / rating"
            aria-label="Edit save"
            className="rounded bg-bg-panel/95 px-1.5 py-0.5 text-[10px] font-medium text-fg shadow-sm hover:bg-bg-elevated"
          >
            Edit
          </button>
        )}
      </div>

      {modalOpen && (
        <SaveToEagleModal
          open={modalOpen}
          job={job}
          result={result}
          resultKey={saveKey}
          imgSrc={src}
          initialStar={displayStar}
          onClose={() => setModalOpen(false)}
          onStarChange={(next) => setPendingStar(next)}
        />
      )}
    </div>
  );
}

