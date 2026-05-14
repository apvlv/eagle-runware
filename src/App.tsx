import { useCallback, useEffect, useState } from 'react';
import { SettingsDrawer } from './components/SettingsDrawer';
import { TopBar } from './components/TopBar';
import { PromptPanel } from './components/PromptPanel';
import { ResultsGrid } from './components/ResultsGrid';
import { CenterPanel } from './components/CenterPanel';
import { Toaster } from './components/Toaster';
import { useSettings, setSettings } from './lib/settings';
import { initTheme } from './lib/theme';
import { toast } from './lib/toast';
import { generate, type GenerationRequest } from './lib/runware';
import { dimsFromPreset, type ModelId } from './lib/models';
import {
  getSelectedItems,
  itemToDataURI,
  saveGeneratedToLibrary,
  setItemStar,
} from './lib/eagle';
import type { StatusKind } from './components/StatusBar';

const SMOKE_PROMPT =
  'A wide cinematic photograph of a single glass orb resting on weathered driftwood at sunrise, ' +
  'shallow tide rolling in around it, soft pastel sky with thin cirrus clouds, golden rim-light ' +
  'catching the wood grain, salt spray suspended in the air, photorealistic textures, 35mm film ' +
  'grain, gentle vignetting, calm minimalist composition, no people, no text.';

async function runSmoke(model: ModelId): Promise<void> {
  const dims = dimsFromPreset(model, '1K', '1:1');
  const req: GenerationRequest = {
    model,
    positivePrompt: SMOKE_PROMPT,
    numberResults: 1,
    width: dims.width,
    height: dims.height,
    outputFormat: 'PNG',
  };
  console.log(`[Runware:smoke] ${model} request`, req);
  try {
    const results = await generate(req);
    console.log(`[Runware:smoke] ${model} response`, results);
  } catch (err) {
    console.error(`[Runware:smoke] ${model} failed`, err);
  }
}

const TRANSPARENT_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

async function runEagleSmoke(): Promise<void> {
  console.log('[Eagle:smoke] starting');
  try {
    const selected = await getSelectedItems();
    console.log(`[Eagle:smoke] selected items: ${selected.length}`);
    if (selected.length > 0) {
      const item = selected[0];
      try {
        const { dataURI, bytes, mime } = itemToDataURI(item);
        const base64Length = dataURI.length - dataURI.indexOf(',') - 1;
        console.log(
          `[Eagle:smoke] selected item ${item.id} (${item.name}.${item.ext}) → ${mime}, ` +
            `${bytes} bytes, base64 length ${base64Length}`,
        );
      } catch (err) {
        console.warn('[Eagle:smoke] could not build data URI:', err);
      }
    } else {
      console.log('[Eagle:smoke] no items selected — skipping data URI test.');
    }

    const itemId = await saveGeneratedToLibrary(
      { imageBase64Data: TRANSPARENT_PNG_BASE64, outputFormat: 'PNG' },
      {
        name: `Runware smoke ${new Date().toISOString()}`,
        tags: ['runware-smoke'],
        annotation: 'Created by the Eagle integration smoke test.',
      },
    );
    console.log(`[Eagle:smoke] created item ${itemId}`);
    await setItemStar(itemId, 4);
    console.log(`[Eagle:smoke] rated item ${itemId} with 4 stars`);
  } catch (err) {
    console.error('[Eagle:smoke] failed:', err);
  }
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [smokeRunning, setSmokeRunning] = useState(false);
  const [eagleSmokeRunning, setEagleSmokeRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<StatusKind>('idle');
  const [statusMessage, setStatusMessage] = useState<string | undefined>(undefined);
  const [settings] = useSettings();
  const hasApiKey = settings.apiKey.trim().length > 0;
  const isDev = import.meta.env.DEV;

  useEffect(() => {
    initTheme();
  }, []);

  useEffect(() => {
    if (typeof eagle === 'undefined') {
      console.warn('[Runware] Eagle API not available — running outside Eagle.');
      setReady(true);
      return;
    }

    eagle.onPluginCreate((plugin) => {
      const stamp = new Date().toISOString();
      const msg = `[Runware] Plugin created at ${stamp}`;
      console.log(msg, plugin);
      eagle?.log?.info?.(msg);
      setReady(true);
    });
  }, []);

  const handleGenerate = useCallback(() => {
    if (!hasApiKey) {
      toast.warn('API key required', { description: 'Set your Runware API key in Settings to generate.' });
      setDrawerOpen(true);
      return;
    }
    if (busy) return;
    // Generation pipeline is wired up in a later task. For now we surface the
    // shortcut working and reflect a transient busy state so the layout is
    // exercised end-to-end.
    setBusy(true);
    setStatus('busy');
    setStatusMessage('Generation pipeline not yet wired.');
    toast.info('Generation will be wired in the next task.');
    window.setTimeout(() => {
      setBusy(false);
      setStatus('idle');
      setStatusMessage(undefined);
    }, 1200);
  }, [hasApiKey, busy]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isGenerate = (e.metaKey || e.ctrlKey) && e.key === 'Enter';
      if (!isGenerate) return;
      e.preventDefault();
      handleGenerate();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleGenerate]);

  useEffect(() => {
    if (!drawerOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [drawerOpen]);

  const handleSmoke = async () => {
    setSmokeRunning(true);
    try {
      await runSmoke('nano-banana-pro');
      await runSmoke('gpt-image-2');
    } finally {
      setSmokeRunning(false);
    }
  };

  const handleEagleSmoke = async () => {
    setEagleSmokeRunning(true);
    try {
      await runEagleSmoke();
    } finally {
      setEagleSmokeRunning(false);
    }
  };

  const devActions =
    isDev && (
      <>
        {hasApiKey && (
          <button
            type="button"
            onClick={handleSmoke}
            disabled={smokeRunning}
            data-testid="dev-smoke"
            className="rounded border border-warn/50 px-2.5 py-1 text-[11px] text-warn hover:bg-warn/10 disabled:cursor-not-allowed disabled:opacity-50"
            title="Dev only — runs a 1-image generation against each model and logs the response."
          >
            {smokeRunning ? 'Smoke…' : '__dev__ smoke'}
          </button>
        )}
        <button
          type="button"
          onClick={handleEagleSmoke}
          disabled={eagleSmokeRunning}
          data-testid="dev-eagle-smoke"
          className="rounded border border-success/50 px-2.5 py-1 text-[11px] text-success hover:bg-success/10 disabled:cursor-not-allowed disabled:opacity-50"
          title="Dev only — reads the currently selected Eagle item, then creates a tagged 4-star item."
        >
          {eagleSmokeRunning ? 'Eagle…' : '__dev__ eagle'}
        </button>
      </>
    );

  const canGenerate = ready && !busy;
  const statusHint = !ready
    ? 'Waiting for Eagle…'
    : !hasApiKey
      ? 'Set your API key in Settings.'
      : busy
        ? undefined
        : 'Idle.';

  return (
    <div className="flex h-full w-full flex-col bg-bg text-fg">
      <TopBar
        model={settings.defaultModel}
        onModelChange={(m) => setSettings({ defaultModel: m })}
        onOpenSettings={() => setDrawerOpen(true)}
        hasApiKey={hasApiKey}
        devActions={devActions}
      />
      <main className="flex min-h-0 flex-1">
        <PromptPanel loading={!ready} />
        <CenterPanel
          onGenerate={handleGenerate}
          canGenerate={canGenerate}
          busy={busy}
          status={status}
          statusMessage={statusMessage}
          statusHint={statusHint}
          loading={!ready}
        />
        <ResultsGrid loading={!ready} />
      </main>
      <Toaster />
      <SettingsDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  );
}
