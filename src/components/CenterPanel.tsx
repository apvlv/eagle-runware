import { ReferenceStrip } from './ReferenceStrip';
import { GenerateButton } from './GenerateButton';
import { StatusBar, type StatusKind } from './StatusBar';
import { ErrorBanner } from './ErrorBanner';
import { lightboxImgSrc, type LightboxItem } from './Lightbox';
import { MODEL_LABELS, type ModelId } from '../lib/models';
import type { Reference } from '../lib/promptForm';
import type { MappedError } from '../lib/errors';

interface CenterPanelProps {
  onGenerate: () => void;
  onCancel?: () => void;
  canGenerate: boolean;
  busy: boolean;
  status: StatusKind;
  statusMessage?: string;
  statusHint?: string;
  generateTooltip?: string;
  loading?: boolean;
  model: ModelId;
  references: Reference[];
  setReferences: (next: Reference[] | ((prev: Reference[]) => Reference[])) => void;
  error?: MappedError | null;
  latestItem?: LightboxItem | null;
  onOpenLightbox?: (item: LightboxItem) => void;
  onRetry?: () => void;
  onDismissError?: () => void;
  onOpenSettings?: () => void;
}

function formatCost(cost?: number): string | null {
  if (typeof cost !== 'number' || !Number.isFinite(cost)) return null;
  if (cost === 0) return '$0.00';
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(3)}`;
}

export function CenterPanel({
  onGenerate,
  onCancel,
  canGenerate,
  busy,
  status,
  statusMessage,
  statusHint,
  generateTooltip,
  loading,
  model,
  references,
  setReferences,
  error,
  latestItem,
  onOpenLightbox,
  onRetry,
  onDismissError,
  onOpenSettings,
}: CenterPanelProps) {
  const latestSrc = latestItem ? lightboxImgSrc(latestItem.result) : null;
  const latestCost = latestItem ? formatCost(latestItem.result.cost) : null;
  const latestModelLabel = latestItem ? MODEL_LABELS[latestItem.job.model] : null;

  return (
    <section className="flex min-w-0 flex-1 flex-col bg-bg">
      <ReferenceStrip
        loading={loading}
        model={model}
        references={references}
        setReferences={setReferences}
      />
      <div className="flex flex-1 flex-col items-center justify-center gap-4 overflow-y-auto px-6 py-6">
        {error && (
          <div className="w-full max-w-2xl">
            <ErrorBanner
              error={error}
              onRetry={onRetry}
              onDismiss={onDismissError}
              onOpenSettings={onOpenSettings}
            />
          </div>
        )}
        {latestItem && latestSrc ? (
          <div className="flex w-full flex-1 flex-col items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => onOpenLightbox?.(latestItem)}
              className="group flex max-h-full w-full items-center justify-center focus:outline-none"
              aria-label="Open latest result in lightbox"
              title="Click to open in lightbox"
            >
              <img
                src={latestSrc}
                alt={`Latest result seed ${latestItem.result.seed ?? ''}`}
                className="max-h-[60vh] w-auto max-w-full rounded-md border border-border bg-bg-panel object-contain shadow-lg transition-transform group-hover:scale-[1.01]"
                draggable={false}
              />
            </button>
            <div className="flex flex-wrap items-center gap-3 rounded bg-bg-panel px-3 py-1.5 font-mono text-[11px] text-fg-muted shadow-sm">
              <span className="font-sans font-semibold text-fg">{latestModelLabel}</span>
              {latestItem.result.seed != null && <span>seed {latestItem.result.seed}</span>}
              {latestCost && <span>{latestCost}</span>}
              <span className="font-sans text-[10px] text-fg-subtle">Click to enlarge</span>
            </div>
          </div>
        ) : (
          <div className="flex w-full max-w-md flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-bg-panel/50 px-6 py-10 text-center">
            <svg viewBox="0 0 24 24" width="28" height="28" className="text-fg-subtle" aria-hidden="true">
              <path
                d="M12 4v16M4 12h16"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
            <p className="text-sm font-medium text-fg">Ready when you are</p>
            <p className="max-w-xs text-xs text-fg-muted">
              Compose a prompt on the left, then press <kbd className="rounded border border-border bg-bg px-1 py-0.5 font-mono text-[10px]">⌘ ⏎</kbd> or use the button below to generate.
            </p>
          </div>
        )}
        <div className="flex w-full max-w-md items-center gap-2">
          <GenerateButton
            onClick={onGenerate}
            disabled={!canGenerate}
            busy={busy}
            tooltip={generateTooltip}
          />
          {busy && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              data-testid="cancel-job-inline"
              className="inline-flex h-11 flex-none items-center justify-center rounded-md border border-border bg-bg px-3 text-sm font-medium text-fg hover:bg-bg-elevated"
              aria-label="Cancel generation"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
      <StatusBar
        kind={status}
        message={statusMessage}
        hint={statusHint}
        onCancel={busy ? onCancel : undefined}
      />
    </section>
  );
}
