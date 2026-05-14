import { useEffect, useState } from 'react';

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof eagle === 'undefined') {
      console.warn('[Runware] Eagle API not available — running outside Eagle.');
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
    <main className="flex h-full w-full flex-col items-center justify-center gap-3 bg-bg text-zinc-100">
      <h1 className="text-2xl font-semibold tracking-tight">Runware AI Generator</h1>
      <p className="text-sm text-zinc-400">
        {ready ? 'Plugin initialized.' : 'Waiting for eagle.onPluginCreate…'}
      </p>
    </main>
  );
}
