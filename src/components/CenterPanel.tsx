import { ReferenceStrip } from './ReferenceStrip';
import { GenerateButton } from './GenerateButton';
import { StatusBar, type StatusKind } from './StatusBar';

interface CenterPanelProps {
  onGenerate: () => void;
  canGenerate: boolean;
  busy: boolean;
  status: StatusKind;
  statusMessage?: string;
  statusHint?: string;
  loading?: boolean;
}

export function CenterPanel({
  onGenerate,
  canGenerate,
  busy,
  status,
  statusMessage,
  statusHint,
  loading,
}: CenterPanelProps) {
  return (
    <section className="flex min-w-0 flex-1 flex-col bg-bg">
      <ReferenceStrip loading={loading} />
      <div className="flex flex-1 flex-col items-center justify-center gap-4 overflow-y-auto px-6 py-6">
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
        <div className="w-full max-w-md">
          <GenerateButton onClick={onGenerate} disabled={!canGenerate} busy={busy} />
        </div>
      </div>
      <StatusBar kind={status} message={statusMessage} hint={statusHint} />
    </section>
  );
}
