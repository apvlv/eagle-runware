import { useCallback, useEffect, useRef, useState, type DragEvent as ReactDragEvent } from 'react';
import { MODELS, MODEL_LABELS, type ModelId } from '../lib/models';
import { fileToDataURI, getSelectedItems, itemToDataURI } from '../lib/eagle';
import { toast } from '../lib/toast';
import type { Reference } from '../lib/promptForm';
import { Skeleton } from './Skeleton';

interface ReferenceStripProps {
  loading?: boolean;
  model: ModelId;
  references: Reference[];
  setReferences: (next: Reference[] | ((prev: Reference[]) => Reference[])) => void;
}

function uploadId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return `up-${c.randomUUID()}`;
  return `up-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function approxBytesFromDataURI(dataURI: string): number {
  const comma = dataURI.indexOf(',');
  if (comma < 0) return 0;
  const base64Length = dataURI.length - comma - 1;
  return Math.floor((base64Length * 3) / 4);
}

export function ReferenceStrip({
  loading = false,
  model,
  references,
  setReferences,
}: ReferenceStripProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [pendingEagle, setPendingEagle] = useState(false);
  const stripRef = useRef<HTMLElement | null>(null);

  const cap = MODELS[model].maxRefImages;
  const modelLabel = MODEL_LABELS[model];

  // Trim trailing extras when the cap shrinks (model change).
  useEffect(() => {
    if (references.length <= cap) return;
    const dropped = references.length - cap;
    setReferences((prev) => (prev.length > cap ? prev.slice(0, cap) : prev));
    toast.warn(`${modelLabel} accepts at most ${cap} references — dropped ${dropped}.`);
  }, [cap, modelLabel, references.length, setReferences]);

  const appendRefs = useCallback(
    (incoming: Reference[]) => {
      if (incoming.length === 0) return;
      let pendingToast: { kind: 'warn' | 'info'; msg: string } | null = null;
      setReferences((prev) => {
        const existingLibIds = new Set(
          prev.filter((r) => r.kind === 'library' && r.sourceItemId).map((r) => r.sourceItemId!),
        );
        const filtered: Reference[] = [];
        let deduped = 0;
        for (const r of incoming) {
          if (r.kind === 'library' && r.sourceItemId && existingLibIds.has(r.sourceItemId)) {
            deduped += 1;
            continue;
          }
          filtered.push(r);
          if (r.kind === 'library' && r.sourceItemId) existingLibIds.add(r.sourceItemId);
        }
        const available = Math.max(0, cap - prev.length);
        const accepted = filtered.slice(0, available);
        const rejected = filtered.length - accepted.length;
        if (rejected > 0) {
          pendingToast = {
            kind: 'warn',
            msg: `${modelLabel} accepts at most ${cap} references — dropped ${rejected}.`,
          };
        } else if (deduped > 0 && accepted.length === 0) {
          pendingToast = {
            kind: 'info',
            msg: `Already in references — skipped ${deduped} duplicate${deduped === 1 ? '' : 's'}.`,
          };
        }
        return accepted.length > 0 ? [...prev, ...accepted] : prev;
      });
      if (pendingToast) {
        const t = pendingToast as { kind: 'warn' | 'info'; msg: string };
        if (t.kind === 'warn') toast.warn(t.msg);
        else toast.info(t.msg);
      }
    },
    [cap, modelLabel, setReferences],
  );

  const addFromFiles = useCallback(
    async (files: File[]) => {
      const images = files.filter((f) => f.type.startsWith('image/'));
      const skipped = files.length - images.length;
      if (skipped > 0) {
        toast.warn(`Ignored ${skipped} non-image file${skipped === 1 ? '' : 's'}.`);
      }
      if (images.length === 0) return;
      const built: Reference[] = [];
      for (const f of images) {
        try {
          const dataURI = await fileToDataURI(f);
          built.push({
            id: uploadId(),
            kind: 'upload',
            dataURI,
            name: f.name || 'pasted-image',
            bytes: f.size || approxBytesFromDataURI(dataURI),
          });
        } catch (err) {
          console.warn('[ReferenceStrip] could not read file:', err);
          toast.error(`Could not read ${f.name || 'file'}: ${(err as Error).message}`);
        }
      }
      appendRefs(built);
    },
    [appendRefs],
  );

  const addFromEagle = useCallback(async () => {
    setPendingEagle(true);
    try {
      const selected = await getSelectedItems();
      console.log(
        `[ReferenceStrip] Eagle.getSelected returned ${selected.length} item(s):`,
        selected.map((i) => ({ id: i.id, name: i.name, ext: i.ext, hasFilePath: !!i.filePath })),
      );
      if (selected.length === 0) {
        toast.info('No Eagle items selected.');
        return;
      }
      const built: Reference[] = [];
      for (const item of selected) {
        try {
          const { dataURI, bytes } = itemToDataURI(item);
          built.push({
            id: `lib-${item.id}`,
            kind: 'library',
            sourceItemId: item.id,
            dataURI,
            name: item.name ? `${item.name}.${item.ext}` : item.id,
            bytes,
          });
        } catch (err) {
          console.warn('[ReferenceStrip] could not read item', item.id, err);
          toast.error(`Could not read ${item.name ?? item.id}: ${(err as Error).message}`);
        }
      }
      console.log(
        `[ReferenceStrip] Built ${built.length} reference(s) from ${selected.length} selected item(s).`,
      );
      appendRefs(built);
    } catch (err) {
      console.warn('[ReferenceStrip] eagle selection failed:', err);
      toast.error(`Eagle selection failed: ${(err as Error).message}`);
    } finally {
      setPendingEagle(false);
    }
  }, [appendRefs]);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const data = e.clipboardData;
      if (!data) return;
      const files: File[] = [];
      for (const item of data.items) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const f = item.getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length === 0) return;
      e.preventDefault();
      void addFromFiles(files);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [addFromFiles]);

  const onDragOver = (e: ReactDragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    if (!dragOver) setDragOver(true);
  };
  const onDragLeave = (e: ReactDragEvent) => {
    if (e.currentTarget === stripRef.current && e.relatedTarget instanceof Node) {
      if (stripRef.current?.contains(e.relatedTarget)) return;
    }
    setDragOver(false);
  };
  const onDrop = (e: ReactDragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;
    void addFromFiles(files);
  };

  const handleRemove = useCallback(
    (id: string) => {
      setReferences((prev) => prev.filter((r) => r.id !== id));
    },
    [setReferences],
  );

  const handleClear = useCallback(() => {
    setReferences([]);
  }, [setReferences]);

  const atCap = references.length >= cap;
  const count = references.length;

  return (
    <section
      ref={stripRef}
      aria-label="Reference images"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={
        'flex flex-none items-center gap-3 border-b border-border bg-bg-panel px-3 py-3 transition-colors ' +
        (dragOver ? 'bg-focus/10 ring-1 ring-inset ring-focus' : '')
      }
    >
      <div className="flex shrink-0 flex-col">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-fg-muted">
          References
        </span>
        <span
          className={
            'text-[10px] font-mono ' + (atCap ? 'text-warn' : 'text-fg-subtle')
          }
        >
          {count} / {cap}
        </span>
      </div>

      <div className="flex flex-1 items-center gap-3 overflow-x-auto py-1">
        {loading ? (
          <>
            <Skeleton className="h-24 w-24 flex-none" />
            <Skeleton className="h-24 w-24 flex-none" />
            <Skeleton className="h-24 w-24 flex-none" />
          </>
        ) : references.length === 0 ? (
          <p className="truncate text-xs text-fg-subtle">
            Drop or paste images, or pull from Eagle selection.
          </p>
        ) : (
          references.map((r) => <ReferenceTile key={r.id} item={r} onRemove={handleRemove} />)
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = e.target.files ? Array.from(e.target.files) : [];
          e.target.value = '';
          if (files.length > 0) void addFromFiles(files);
        }}
      />

      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={addFromEagle}
          disabled={pendingEagle || atCap}
          aria-label="Add from Eagle selection"
          title={atCap ? `Cap reached (${cap})` : 'Add from Eagle selection'}
          className="flex h-9 flex-none items-center gap-1 rounded border border-border bg-bg px-2.5 text-xs text-fg hover:bg-bg-elevated disabled:cursor-not-allowed disabled:opacity-50"
        >
          <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
            <path
              d="M2 4h4l1 2h7v6H2z"
              stroke="currentColor"
              strokeWidth="1.3"
              fill="none"
              strokeLinejoin="round"
            />
          </svg>
          {pendingEagle ? 'Eagle…' : 'From Eagle'}
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={atCap}
          aria-label="Upload reference images"
          title={atCap ? `Cap reached (${cap})` : 'Upload from disk'}
          className="flex h-9 flex-none items-center gap-1 rounded border border-dashed border-border-strong px-2.5 text-xs text-fg hover:bg-bg-elevated disabled:cursor-not-allowed disabled:opacity-50"
        >
          <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
          </svg>
          Add
        </button>
        {references.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear all references"
            title="Clear all"
            className="flex h-9 flex-none items-center rounded border border-border bg-bg px-2 text-xs text-fg-muted hover:bg-bg-elevated hover:text-fg"
          >
            Clear
          </button>
        )}
      </div>
    </section>
  );
}

interface ReferenceTileProps {
  item: Reference;
  onRemove: (id: string) => void;
}

function ReferenceTile({ item: r, onRemove }: ReferenceTileProps) {
  const badge = r.kind === 'library' ? 'Library' : 'Upload';
  const sizeText = formatBytes(r.bytes);
  return (
    <div
      className="group relative flex-none"
      title={`${r.name} · ${badge} · ${sizeText}`}
      data-testid="reference-tile"
      data-ref-kind={r.kind}
    >
      <img
        src={r.dataURI}
        alt={r.name}
        className="h-24 w-24 rounded border border-border object-cover"
        draggable={false}
      />
      <span
        className={
          'pointer-events-none absolute left-1 top-1 rounded px-1 py-0 text-[9px] font-semibold uppercase tracking-wide ' +
          (r.kind === 'library'
            ? 'bg-accent text-accent-fg'
            : 'bg-bg-overlay/70 text-fg-inverse')
        }
      >
        {badge}
      </span>
      <button
        type="button"
        onClick={() => onRemove(r.id)}
        aria-label={`Remove ${r.name}`}
        title="Remove"
        className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full border border-border bg-bg-panel text-fg-muted opacity-0 shadow-sm transition-opacity hover:text-danger group-hover:opacity-100 focus:opacity-100"
      >
        <svg viewBox="0 0 12 12" width="8" height="8" aria-hidden="true">
          <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
      <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 group-hover:block">
        <div className="overflow-hidden rounded-md border border-border bg-bg-panel p-1 shadow-lg">
          <img
            src={r.dataURI}
            alt=""
            className="h-40 w-40 rounded object-contain"
            draggable={false}
          />
          <div className="mt-1 max-w-[160px] truncate px-1 text-[10px] text-fg-muted">
            {r.name}
          </div>
        </div>
      </div>
    </div>
  );
}
