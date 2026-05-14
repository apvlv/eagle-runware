import {
  KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  DEFAULT_MODELS,
  OUTPUT_FORMATS,
  Settings,
  useSettings,
  type DefaultModel,
  type OutputFormat,
} from '../lib/settings';
import { testRunwareConnection, type TestConnectionResult } from '../lib/runware';

interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
}

interface FlatFolder {
  id: string;
  label: string;
}

function flattenFolders(folders: EagleFolder[] | undefined, depth = 0, acc: FlatFolder[] = []): FlatFolder[] {
  if (!folders) return acc;
  for (const f of folders) {
    acc.push({ id: f.id, label: `${'— '.repeat(depth)}${f.name}` });
    if (f.children && f.children.length > 0) {
      flattenFolders(f.children, depth + 1, acc);
    }
  }
  return acc;
}

const MODEL_LABELS: Record<DefaultModel, string> = {
  'nano-banana-pro': 'Nano Banana Pro',
  'gpt-image-2': 'GPT Image 2',
};

export function SettingsDrawer({ open, onClose }: SettingsDrawerProps) {
  const [settings, updateSettings] = useSettings();

  // Local draft state — we only persist on explicit Save so the user can cancel.
  const [draft, setDraft] = useState<Settings>(settings);
  const [showKey, setShowKey] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [folders, setFolders] = useState<FlatFolder[]>([]);
  const [foldersError, setFoldersError] = useState<string | null>(null);
  const [foldersLoading, setFoldersLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestConnectionResult | null>(null);

  const apiKeyInputRef = useRef<HTMLInputElement | null>(null);

  // Resync draft whenever the drawer opens (or persisted settings change while closed).
  useEffect(() => {
    if (open) {
      setDraft(settings);
      setTestResult(null);
      setTagInput('');
      // Defer focus to next tick so the drawer transition doesn't fight it.
      const t = window.setTimeout(() => apiKeyInputRef.current?.focus(), 50);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [open, settings]);

  // Esc closes the drawer.
  useEffect(() => {
    if (!open) return undefined;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Load Eagle folders when the drawer opens.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const eagleFolder = typeof eagle !== 'undefined' ? eagle?.folder : undefined;
    if (!eagleFolder?.getAll) {
      setFolders([]);
      setFoldersError('Eagle folder API unavailable (running outside Eagle).');
      return;
    }
    setFoldersLoading(true);
    setFoldersError(null);
    eagleFolder
      .getAll()
      .then((all) => {
        if (cancelled) return;
        setFolders(flattenFolders(all));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setFoldersError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setFoldersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(settings), [draft, settings]);

  const handleSave = useCallback(() => {
    updateSettings(draft);
    onClose();
  }, [draft, updateSettings, onClose]);

  const handleAddTag = useCallback(() => {
    const value = tagInput.trim();
    if (!value) return;
    if (draft.defaultTags.includes(value)) {
      setTagInput('');
      return;
    }
    setDraft((d) => ({ ...d, defaultTags: [...d.defaultTags, value] }));
    setTagInput('');
  }, [tagInput, draft.defaultTags]);

  const handleTagKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        handleAddTag();
      } else if (e.key === 'Backspace' && tagInput === '' && draft.defaultTags.length > 0) {
        setDraft((d) => ({ ...d, defaultTags: d.defaultTags.slice(0, -1) }));
      }
    },
    [handleAddTag, tagInput, draft.defaultTags.length],
  );

  const removeTag = useCallback((tag: string) => {
    setDraft((d) => ({ ...d, defaultTags: d.defaultTags.filter((t) => t !== tag) }));
  }, []);

  const handleTest = useCallback(async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testRunwareConnection(draft.apiKey);
      setTestResult(result);
    } catch (err) {
      setTestResult({ ok: false, message: err instanceof Error ? err.message : String(err) });
    } finally {
      setTesting(false);
    }
  }, [draft.apiKey]);

  const handleClearKey = useCallback(() => {
    setDraft((d) => ({ ...d, apiKey: '' }));
    setTestResult(null);
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-label="Settings">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Close settings"
        onClick={onClose}
      />
      <aside className="relative z-10 flex h-full w-full max-w-md flex-col bg-bg-panel text-zinc-100 shadow-2xl">
        <header className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <h2 className="text-base font-semibold">Settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
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

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="space-y-6">
            <section className="space-y-2">
              <label htmlFor="rw-api-key" className="block text-xs font-medium uppercase tracking-wide text-zinc-400">
                Runware API key
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    id="rw-api-key"
                    ref={apiKeyInputRef}
                    type={showKey ? 'text' : 'password'}
                    autoComplete="off"
                    spellCheck={false}
                    value={draft.apiKey}
                    onChange={(e) => {
                      setDraft((d) => ({ ...d, apiKey: e.target.value }));
                      setTestResult(null);
                    }}
                    placeholder="rw-…"
                    className="block w-full rounded border border-zinc-700 bg-bg px-3 py-2 pr-20 font-mono text-sm placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((v) => !v)}
                    className="absolute inset-y-0 right-1 my-1 rounded px-2 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                    aria-label={showKey ? 'Hide API key' : 'Show API key'}
                  >
                    {showKey ? 'Hide' : 'Show'}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleClearKey}
                  disabled={!draft.apiKey}
                  className="rounded border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Clear
                </button>
              </div>
              <p className="text-xs text-zinc-500">
                API key is stored locally in this plugin window and sent directly to Runware. It never leaves your
                machine except to call the Runware API.
              </p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleTest}
                  disabled={testing || !draft.apiKey.trim()}
                  className="rounded bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-900 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {testing ? 'Testing…' : 'Test connection'}
                </button>
                {testResult && (
                  <span
                    role="status"
                    className={`text-xs ${testResult.ok ? 'text-emerald-400' : 'text-rose-400'}`}
                  >
                    {testResult.ok ? '✓ ' : '✗ '}
                    {testResult.message}
                  </span>
                )}
              </div>
            </section>

            <section className="space-y-2">
              <label htmlFor="rw-default-model" className="block text-xs font-medium uppercase tracking-wide text-zinc-400">
                Default model
              </label>
              <select
                id="rw-default-model"
                value={draft.defaultModel}
                onChange={(e) => setDraft((d) => ({ ...d, defaultModel: e.target.value as DefaultModel }))}
                className="block w-full rounded border border-zinc-700 bg-bg px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
              >
                {DEFAULT_MODELS.map((m) => (
                  <option key={m} value={m}>
                    {MODEL_LABELS[m]}
                  </option>
                ))}
              </select>
            </section>

            <section className="space-y-2">
              <label htmlFor="rw-output-format" className="block text-xs font-medium uppercase tracking-wide text-zinc-400">
                Default output format
              </label>
              <select
                id="rw-output-format"
                value={draft.outputFormat}
                onChange={(e) => setDraft((d) => ({ ...d, outputFormat: e.target.value as OutputFormat }))}
                className="block w-full rounded border border-zinc-700 bg-bg px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
              >
                {OUTPUT_FORMATS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </section>

            <section className="space-y-2">
              <label htmlFor="rw-num-results" className="block text-xs font-medium uppercase tracking-wide text-zinc-400">
                Default number of results
              </label>
              <input
                id="rw-num-results"
                type="number"
                min={1}
                max={20}
                step={1}
                value={draft.numberResults}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setDraft((d) => ({
                    ...d,
                    numberResults: Number.isFinite(n) ? Math.min(20, Math.max(1, Math.floor(n))) : 1,
                  }));
                }}
                className="block w-32 rounded border border-zinc-700 bg-bg px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
              />
            </section>

            <section className="space-y-2">
              <label htmlFor="rw-tags" className="block text-xs font-medium uppercase tracking-wide text-zinc-400">
                Default tags
              </label>
              <div className="flex flex-wrap gap-1.5 rounded border border-zinc-700 bg-bg p-2">
                {draft.defaultTags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-100"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="text-zinc-400 hover:text-zinc-100"
                      aria-label={`Remove tag ${tag}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
                <input
                  id="rw-tags"
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  onBlur={handleAddTag}
                  placeholder={draft.defaultTags.length === 0 ? 'Add tag and press Enter' : ''}
                  className="min-w-[8rem] flex-1 bg-transparent px-1 text-sm placeholder:text-zinc-600 focus:outline-none"
                />
              </div>
              <p className="text-xs text-zinc-500">Applied to every generated image saved to Eagle.</p>
            </section>

            <section className="space-y-2">
              <label htmlFor="rw-folder" className="block text-xs font-medium uppercase tracking-wide text-zinc-400">
                Default save folder
              </label>
              <select
                id="rw-folder"
                value={draft.defaultFolderId ?? ''}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    defaultFolderId: e.target.value === '' ? undefined : e.target.value,
                  }))
                }
                disabled={foldersLoading || folders.length === 0}
                className="block w-full rounded border border-zinc-700 bg-bg px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none disabled:opacity-50"
              >
                <option value="">No default — choose at save time</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
              {foldersLoading && <p className="text-xs text-zinc-500">Loading folders…</p>}
              {foldersError && <p className="text-xs text-rose-400">{foldersError}</p>}
              {!foldersLoading && !foldersError && folders.length === 0 && (
                <p className="text-xs text-zinc-500">No folders found in this Eagle library.</p>
              )}
            </section>
          </div>
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-zinc-800 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!dirty}
            className="rounded bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Save
          </button>
        </footer>
      </aside>
    </div>
  );
}
