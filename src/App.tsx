import { useEffect, useState } from 'react';
import { SettingsDrawer } from './components/SettingsDrawer';
import { useSettings } from './lib/settings';
import { generate, type GenerationRequest } from './lib/runware';
import { dimsFromPreset, type ModelId } from './lib/models';

const SMOKE_PROMPT =
  'A wide cinematic photograph of a single glass orb resting on weathered driftwood at sunrise, ' +
  'shallow tide rolling in around it, soft pastel sky with thin cirrus clouds, golden rim-light ' +
  'catching the wood grain, salt spray suspended in the air, photorealistic textures, 35mm film ' +
  'grain, gentle vignetting, calm minimalist composition, no people, no text.';

async function runSmoke(model: ModelId): Promise<void> {
  const dims =
    model === 'nano-banana-pro'
      ? dimsFromPreset(model, '1K', '1:1')
      : dimsFromPreset(model, '1K', '1:1');
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

export default function App() {
  const [ready, setReady] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [smokeRunning, setSmokeRunning] = useState(false);
  const [settings] = useSettings();
  const hasApiKey = settings.apiKey.trim().length > 0;
  const isDev = import.meta.env.DEV;

  const handleSmoke = async () => {
    setSmokeRunning(true);
    try {
      await runSmoke('nano-banana-pro');
      await runSmoke('gpt-image-2');
    } finally {
      setSmokeRunning(false);
    }
  };

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

  return (
    <main className="flex h-full w-full flex-col bg-bg text-zinc-100">
      <header className="flex items-center justify-between border-b border-zinc-800 px-5 py-3">
        <h1 className="text-sm font-semibold tracking-tight">Runware AI Generator</h1>
        <div className="flex items-center gap-2">
          {isDev && hasApiKey && (
            <button
              type="button"
              onClick={handleSmoke}
              disabled={smokeRunning}
              data-testid="dev-smoke"
              className="rounded border border-amber-700/60 px-3 py-1 text-xs text-amber-300 hover:bg-amber-900/30 disabled:cursor-not-allowed disabled:opacity-50"
              title="Dev only — runs a 1-image generation against each model and logs the response."
            >
              {smokeRunning ? 'Smoke testing…' : '__dev__ smoke'}
            </button>
          )}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="rounded border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
          >
            Settings
          </button>
        </div>
      </header>

      <section className="flex flex-1 items-center justify-center px-6">
        {!ready ? (
          <p className="text-sm text-zinc-400">Waiting for eagle.onPluginCreate…</p>
        ) : !hasApiKey ? (
          <div className="flex max-w-md flex-col items-center gap-3 text-center">
            <h2 className="text-xl font-semibold">Set your Runware API key</h2>
            <p className="text-sm text-zinc-400">
              You need an API key from Runware to generate images. The key is stored locally in this plugin window and
              sent directly to Runware.
            </p>
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="mt-2 rounded bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white"
            >
              Set your API key
            </button>
          </div>
        ) : (
          <p className="text-sm text-zinc-400">Plugin initialized — ready to generate.</p>
        )}
      </section>

      <SettingsDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </main>
  );
}
