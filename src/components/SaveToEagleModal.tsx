import { useCallback, useEffect, useMemo, useState } from 'react';
import { MODEL_LABELS } from '../lib/models';
import {
  getAllExistingTags,
  getSelectedFolder,
  listAllFolders,
  openItemInEagle,
  saveGeneratedToLibrary,
  setItemStar,
  updateItemTags,
  type FlatFolder,
} from '../lib/eagle';
import { autoNameFor, buildAnnotation, buildInitialTags } from '../lib/saveTemplates';
import { toast } from '../lib/toast';
import type { GenerationResult } from '../lib/runware';
import type { Job } from '../state/jobs';
import { getSave, patchSave, recordSave } from '../state/saves';
import { useSettings } from '../lib/settings';
import { StarRating } from './StarRating';
import { TagChipInput } from './TagChipInput';

interface SaveToEagleModalProps {
  open: boolean;
  job: Job;
  result: GenerationResult;
  resultKey: string;
  imgSrc: string | null;
  initialStar: number;
  onClose: () => void;
  onStarChange: (next: number) => void;
}

function copyToClipboard(text: string): boolean {
  try {
    const nav = (globalThis as { navigator?: { clipboard?: { writeText?: (s: string) => Promise<void> } } })
      .navigator;
    if (nav?.clipboard?.writeText) {
      void nav.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

export function SaveToEagleModal({
  open,
  job,
  result,
  resultKey,
  imgSrc,
  initialStar,
  onClose,
  onStarChange,
}: SaveToEagleModalProps) {
  const [settings] = useSettings();
  const existing = getSave(resultKey);
  const isSaved = !!existing;

  const [name, setName] = useState<string>('');
  const [tags, setTags] = useState<string[]>([]);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [annotation, setAnnotation] = useState<string>('');
  const [star, setStar] = useState<number>(initialStar);

  const [folders, setFolders] = useState<FlatFolder[]>([]);
  const [foldersError, setFoldersError] = useState<string | null>(null);
  const [foldersLoading, setFoldersLoading] = useState(false);

  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [working, setWorking] = useState(false);

  // Initialize draft on open.
  useEffect(() => {
    if (!open) return;
    if (existing) {
      setName(existing.name);
      setTags([...existing.tags]);
      setFolderId(existing.folderId);
      setAnnotation(existing.annotation);
      setStar(existing.star);
    } else {
      setName(autoNameFor(job, result));
      const shotTag = settings.shotTag?.trim();
      setTags(buildInitialTags(job.model, settings.defaultTags, shotTag ? [shotTag] : []));
      setAnnotation(buildAnnotation(job, result));
      setStar(initialStar);
      // Folder default resolved async below.
      setFolderId(settings.defaultFolderId ?? null);
    }
  }, [open, resultKey]);

  // Load folders + tag suggestions when the modal opens.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setFoldersError(null);
    setFoldersLoading(true);
    (async () => {
      try {
        const all = await listAllFolders();
        if (cancelled) return;
        setFolders(all);
      } catch (err) {
        if (cancelled) return;
        setFoldersError(err instanceof Error ? err.message : String(err));
        setFolders([]);
      } finally {
        if (!cancelled) setFoldersLoading(false);
      }

      if (!existing) {
        try {
          const selected = await getSelectedFolder();
          if (cancelled) return;
          if (selected?.id) {
            setFolderId(selected.id);
          }
        } catch {
          /* ignore — fall through to default */
        }
      }

      try {
        const sugg = await getAllExistingTags();
        if (cancelled) return;
        setSuggestions(sugg);
      } catch {
        if (!cancelled) setSuggestions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, resultKey]);

  // Esc closes.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !working) onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose, working]);

  const folderOptions = useMemo<FlatFolder[]>(() => folders, [folders]);

  const handleSave = useCallback(async () => {
    if (working) return;
    setWorking(true);
    try {
      const itemId = await saveGeneratedToLibrary(
        {
          imageURL: result.imageURL,
          imageBase64Data: result.imageBase64Data,
          imageDataURI: result.imageDataURI,
          outputFormat: job.request.outputFormat,
        },
        {
          name: name.trim() || autoNameFor(job, result),
          tags,
          folderId: folderId ?? undefined,
          annotation,
        },
      );
      if (star > 0) {
        try {
          await setItemStar(itemId, star);
        } catch (err) {
          console.warn('[Runware] setItemStar after save failed:', err);
          toast.warn('Saved, but rating failed', {
            description: err instanceof Error ? err.message : String(err),
          });
        }
      }
      recordSave({
        resultKey,
        jobId: job.id,
        itemId,
        name: name.trim() || autoNameFor(job, result),
        tags: [...tags],
        folderId,
        annotation,
        star,
        savedAt: Date.now(),
      });
      onStarChange(star);
      toast.success(`Saved to Eagle: ${name.trim() || 'image'}`);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error('Save to Eagle failed', { description: msg });
    } finally {
      setWorking(false);
    }
  }, [working, result, job, name, tags, folderId, annotation, star, resultKey, onStarChange, onClose]);

  const handleUpdate = useCallback(async () => {
    if (working || !existing) return;
    setWorking(true);
    try {
      const tagsChanged =
        tags.length !== existing.tags.length ||
        tags.some((t, i) => t !== existing.tags[i]);
      const starChanged = star !== existing.star;
      if (tagsChanged) {
        await updateItemTags(existing.itemId, tags);
      }
      if (starChanged) {
        await setItemStar(existing.itemId, star);
        onStarChange(star);
      }
      patchSave(resultKey, { tags: [...tags], star });
      toast.success('Updated in Eagle');
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error('Update failed', { description: msg });
    } finally {
      setWorking(false);
    }
  }, [working, existing, tags, star, resultKey, onStarChange, onClose]);

  const handleOpenInEagle = useCallback(async () => {
    if (!existing) return;
    const opened = await openItemInEagle(existing.itemId);
    if (opened) {
      toast.info('Opened in Eagle');
    } else {
      const copied = copyToClipboard(existing.itemId);
      toast.info(
        copied ? 'Eagle cannot open from plugin — item id copied' : `Eagle cannot open from plugin — item id ${existing.itemId}`,
      );
    }
  }, [existing]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg-overlay/80 p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Save to Eagle"
      data-testid="save-to-eagle-modal"
      onClick={() => {
        if (!working) onClose();
      }}
    >
      <div
        className="flex max-h-full w-full max-w-3xl flex-col gap-4 rounded-md border border-border bg-bg-panel p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-fg">
              {isSaved ? 'Saved to Eagle' : 'Save to Eagle'}
            </h2>
            <p className="text-xs text-fg-muted">
              {MODEL_LABELS[job.model]}
              {result.seed != null ? ` · seed ${result.seed}` : ''}
              {job.request.width && job.request.height
                ? ` · ${job.request.width}×${job.request.height}`
                : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!working) onClose();
            }}
            disabled={working}
            className="rounded p-1 text-fg-muted hover:bg-bg-elevated hover:text-fg disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Close"
          >
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
              <path
                d="M3 3l10 10M13 3L3 13"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
          </button>
        </header>

        <div className="grid grid-cols-[160px_1fr] gap-4">
          <div className="flex flex-col items-center gap-2">
            {imgSrc ? (
              <img
                src={imgSrc}
                alt=""
                className="h-40 w-40 rounded border border-border object-cover"
                draggable={false}
              />
            ) : (
              <div className="flex h-40 w-40 items-center justify-center rounded border border-border bg-bg text-[10px] text-fg-subtle">
                No preview
              </div>
            )}
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] uppercase tracking-wide text-fg-muted">Rating</span>
              <StarRating
                value={star}
                onChange={(n) => setStar(n)}
                disabled={working}
                size={18}
                label="Star rating"
              />
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label
                htmlFor="save-name"
                className="text-[11px] font-medium uppercase tracking-wide text-fg-muted"
              >
                Name
              </label>
              <input
                id="save-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={working || isSaved}
                className="rounded border border-border bg-bg px-2.5 py-1.5 text-sm text-fg focus:border-focus focus:outline-none disabled:opacity-60"
              />
            </div>

            <TagChipInput
              label="Tags"
              tags={tags}
              onChange={setTags}
              suggestions={suggestions}
              disabled={working}
            />

            <div className="flex flex-col gap-1">
              <label
                htmlFor="save-folder"
                className="text-[11px] font-medium uppercase tracking-wide text-fg-muted"
              >
                Folder
              </label>
              <select
                id="save-folder"
                value={folderId ?? ''}
                onChange={(e) => setFolderId(e.target.value === '' ? null : e.target.value)}
                disabled={working || foldersLoading || isSaved}
                className="rounded border border-border bg-bg px-2.5 py-1.5 text-sm text-fg focus:border-focus focus:outline-none disabled:opacity-60"
              >
                <option value="">No folder (library root)</option>
                {folderOptions.map((f) => (
                  <option key={f.id} value={f.id}>
                    {'— '.repeat(f.depth)}
                    {f.name}
                  </option>
                ))}
              </select>
              {foldersLoading && (
                <span className="text-[10px] text-fg-subtle">Loading folders…</span>
              )}
              {foldersError && (
                <span className="text-[10px] text-danger">{foldersError}</span>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <label
                htmlFor="save-annotation"
                className="text-[11px] font-medium uppercase tracking-wide text-fg-muted"
              >
                Annotation
              </label>
              <textarea
                id="save-annotation"
                value={annotation}
                onChange={(e) => setAnnotation(e.target.value)}
                disabled={working || isSaved}
                rows={6}
                className="resize-y rounded border border-border bg-bg px-2.5 py-1.5 font-mono text-xs text-fg focus:border-focus focus:outline-none disabled:opacity-60"
              />
            </div>
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {isSaved && (
              <button
                type="button"
                onClick={handleOpenInEagle}
                disabled={working}
                className="rounded border border-border bg-bg px-3 py-1.5 text-sm text-fg hover:bg-bg-elevated disabled:cursor-not-allowed disabled:opacity-50"
              >
                Open in Eagle
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (!working) onClose();
              }}
              disabled={working}
              className="rounded px-3 py-1.5 text-sm text-fg hover:bg-bg-elevated disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={isSaved ? handleUpdate : handleSave}
              disabled={working}
              className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {working ? (isSaved ? 'Updating…' : 'Saving…') : isSaved ? 'Update' : 'Save'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
