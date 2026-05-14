import { MODEL_LABELS, type ModelId } from '../lib/models';
import { DEFAULT_MODELS } from '../lib/settings';

interface TopBarProps {
  model: ModelId;
  onModelChange: (m: ModelId) => void;
  onOpenSettings: () => void;
  hasApiKey: boolean;
  devActions?: React.ReactNode;
}

export function TopBar({ model, onModelChange, onOpenSettings, hasApiKey, devActions }: TopBarProps) {
  return (
    <header className="flex flex-none items-center justify-between gap-3 border-b border-border bg-bg-panel px-4 py-2.5">
      <div className="flex min-w-0 items-center gap-3">
        <h1 className="truncate text-sm font-semibold tracking-tight text-fg">Runware AI Generator</h1>
        <div className="hidden h-4 w-px bg-border sm:block" />
        <label className="flex items-center gap-2 text-xs text-fg-muted">
          <span className="hidden sm:inline">Model</span>
          <select
            value={model}
            onChange={(e) => onModelChange(e.target.value as ModelId)}
            aria-label="Model"
            className="rounded border border-border bg-bg px-2 py-1 text-xs font-medium text-fg focus:border-focus focus:outline-none"
          >
            {DEFAULT_MODELS.map((m) => (
              <option key={m} value={m}>
                {MODEL_LABELS[m]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex items-center gap-2">
        {devActions}
        {!hasApiKey && (
          <span className="hidden rounded bg-warn/10 px-2 py-0.5 text-[11px] font-medium text-warn sm:inline">
            API key required
          </span>
        )}
        <button
          type="button"
          onClick={onOpenSettings}
          className="inline-flex items-center gap-1.5 rounded border border-border px-2.5 py-1 text-xs text-fg hover:bg-bg-elevated"
          aria-label="Settings and API key"
          title="Settings and API key"
        >
          <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
            <circle cx="8" cy="8" r="2.25" stroke="currentColor" strokeWidth="1.4" fill="none" />
            <path
              d="M8 1.5v2M8 12.5v2M14.5 8h-2M3.5 8h-2M12.6 3.4l-1.4 1.4M4.8 11.2l-1.4 1.4M12.6 12.6l-1.4-1.4M4.8 4.8L3.4 3.4"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
          <span>Settings</span>
        </button>
      </div>
    </header>
  );
}
