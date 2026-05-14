import { useEffect, useState } from 'react';
import { MODEL_LABELS, type ModelId } from '../lib/models';
import { DEFAULT_MODELS } from '../lib/settings';
import { listAllFolders, type FlatFolder } from '../lib/eagle';

interface TopBarProps {
  model: ModelId;
  onModelChange: (m: ModelId) => void;
  onOpenSettings: () => void;
  hasApiKey: boolean;
  ready: boolean;
  shotFolderId?: string;
  onShotChange: (folderId: string | undefined, folderName: string | undefined) => void;
  devActions?: React.ReactNode;
}

export function TopBar({
  model,
  onModelChange,
  onOpenSettings,
  hasApiKey,
  ready,
  shotFolderId,
  onShotChange,
  devActions,
}: TopBarProps) {
  const [folders, setFolders] = useState<FlatFolder[]>([]);
  const [foldersError, setFoldersError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    listAllFolders()
      .then((all) => {
        if (cancelled) return;
        setFolders(all);
        setFoldersError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setFoldersError(err instanceof Error ? err.message : String(err));
        setFolders([]);
      });
    return () => {
      cancelled = true;
    };
  }, [ready]);

  // If the previously selected shot folder no longer exists, drop it.
  useEffect(() => {
    if (!shotFolderId) return;
    if (folders.length === 0) return;
    if (!folders.some((f) => f.id === shotFolderId)) {
      onShotChange(undefined, undefined);
    }
  }, [folders, shotFolderId, onShotChange]);

  const handleShotChange = (id: string) => {
    if (id === '') {
      onShotChange(undefined, undefined);
      return;
    }
    const folder = folders.find((f) => f.id === id);
    onShotChange(id, folder?.name);
  };

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
        <label className="flex items-center gap-2 text-xs text-fg-muted">
          <span className="hidden sm:inline">Shot</span>
          <select
            value={shotFolderId ?? ''}
            onChange={(e) => handleShotChange(e.target.value)}
            aria-label="Shot (Eagle folder to tag generated images with)"
            title={
              foldersError
                ? `Could not load folders: ${foldersError}`
                : 'Tag generated images with this folder name so they land in matching smart folders.'
            }
            disabled={!ready || folders.length === 0}
            className="max-w-[14rem] truncate rounded border border-border bg-bg px-2 py-1 text-xs font-medium text-fg focus:border-focus focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">No shot</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {'— '.repeat(f.depth)}
                {f.name}
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
