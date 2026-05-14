import { useEffect, useState } from 'react';
import { SettingsDrawer } from './components/SettingsDrawer';
import { useSettings } from './lib/settings';

export default function App() {
  const [ready, setReady] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [settings] = useSettings();
  const hasApiKey = settings.apiKey.trim().length > 0;

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
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="rounded border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
        >
          Settings
        </button>
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
