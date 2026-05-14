import { useCallback, useEffect, useMemo, useState } from 'react';
import { SettingsDrawer } from './components/SettingsDrawer';
import { TopBar } from './components/TopBar';
import { PromptPanel } from './components/PromptPanel';
import { ResultsGrid, resultBusyKey } from './components/ResultsGrid';
import { CenterPanel } from './components/CenterPanel';
import { Lightbox, type LightboxItem } from './components/Lightbox';
import { Toaster } from './components/Toaster';
import { useSettings, setSettings } from './lib/settings';
import { initTheme } from './lib/theme';
import { toast } from './lib/toast';
import { generate, type GenerationRequest, type GenerationResult } from './lib/runware';
import { dimsFromPreset, MODEL_LABELS, type ModelId } from './lib/models';
import { usePromptForm, type Reference } from './lib/promptForm';
import {
  getSelectedItems,
  itemToDataURI,
  saveGeneratedToLibrary,
  setItemStar,
  urlToDataURI,
} from './lib/eagle';
import {
  cancelJob,
  isActiveStatus,
  retryJob,
  startJob,
  useJobsState,
  type Job,
} from './state/jobs';
import type { StatusKind } from './components/StatusBar';
import { mapRunwareError, type MappedError } from './lib/errors';

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

function formatElapsed(ms: number): string {
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const rem = Math.round(s - m * 60);
  return `${m}m ${rem}s`;
}

function formatCost(cost?: number): string | null {
  if (typeof cost !== 'number' || !Number.isFinite(cost)) return null;
  if (cost === 0) return '$0.00';
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(3)}`;
}

function newRandomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

function refIdForResult(r: GenerationResult): string {
  return `gen-${r.imageUUID ?? r.imageURL ?? r.taskUUID ?? Math.random().toString(36).slice(2, 10)}`;
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [smokeRunning, setSmokeRunning] = useState(false);
  const [eagleSmokeRunning, setEagleSmokeRunning] = useState(false);
  const [refBusyKey, setRefBusyKey] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [preflightError, setPreflightError] = useState<MappedError | null>(null);
  const [dismissedJobErrorId, setDismissedJobErrorId] = useState<string | null>(null);
  const [autoOpenedForJobId, setAutoOpenedForJobId] = useState<string | null>(null);
  const [settings] = useSettings();
  const hasApiKey = settings.apiKey.trim().length > 0;
  const isDev = import.meta.env.DEV;
  const promptForm = usePromptForm(settings.defaultModel);
  const jobsState = useJobsState();
  const [lightboxItem, setLightboxItem] = useState<LightboxItem | null>(null);

  const currentJob = useMemo<Job | null>(() => {
    if (!jobsState.currentJobId) return null;
    return jobsState.jobs.find((j) => j.id === jobsState.currentJobId) ?? null;
  }, [jobsState]);

  const latestItem = useMemo<LightboxItem | null>(() => {
    for (let i = jobsState.jobs.length - 1; i >= 0; i--) {
      const j = jobsState.jobs[i];
      if (j.results.length === 0) continue;
      return { job: j, result: j.results[j.results.length - 1] };
    }
    return null;
  }, [jobsState.jobs]);

  const busy = !!currentJob && isActiveStatus(currentJob.status);

  const jobError: MappedError | null = useMemo(() => {
    if (!currentJob || currentJob.status !== 'error') return null;
    if (dismissedJobErrorId === currentJob.id) return null;
    return currentJob.errorDetails ?? mapRunwareError(currentJob.error ?? 'Generation failed.');
  }, [currentJob, dismissedJobErrorId]);

  const activeError: MappedError | null = preflightError ?? jobError;

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

  // While a job is active, re-render every second so the elapsed time updates.
  useEffect(() => {
    if (!busy) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [busy]);

  const handleGenerate = useCallback(() => {
    if (!hasApiKey) {
      const mapped = mapRunwareError({
        error: { code: 'invalidApiKey', message: 'Set your Runware API key in Settings to generate.' },
      });
      setPreflightError(mapped);
      setDrawerOpen(true);
      return;
    }
    if (busy) return;
    try {
      const request = promptForm.buildRequest();
      setPreflightError(null);
      startJob(request);
    } catch (err) {
      const mapped = mapRunwareError(err);
      // Local validation lands in the validation bucket; surface inline + toast.
      setPreflightError({ ...mapped, bucket: 'validation', title: 'Request is invalid' });
      toast.error('Cannot generate', { description: mapped.message });
    }
  }, [hasApiKey, busy, promptForm]);

  const handleRetry = useCallback(() => {
    setPreflightError(null);
    if (!hasApiKey) {
      const mapped = mapRunwareError({
        error: { code: 'invalidApiKey', message: 'Set your Runware API key in Settings to generate.' },
      });
      setPreflightError(mapped);
      setDrawerOpen(true);
      return;
    }
    if (currentJob && currentJob.status === 'error') {
      setDismissedJobErrorId(currentJob.id);
      retryJob(currentJob.id);
      return;
    }
    handleGenerate();
  }, [hasApiKey, currentJob, handleGenerate]);

  const handleDismissError = useCallback(() => {
    if (preflightError) setPreflightError(null);
    else if (currentJob) setDismissedJobErrorId(currentJob.id);
  }, [preflightError, currentJob]);

  // Auto-open the settings drawer the first time a job lands in the auth bucket.
  useEffect(() => {
    if (!jobError || jobError.bucket !== 'auth') return;
    if (!currentJob) return;
    if (autoOpenedForJobId === currentJob.id) return;
    setAutoOpenedForJobId(currentJob.id);
    setDrawerOpen(true);
  }, [jobError, currentJob, autoOpenedForJobId]);

  // Clear the preflight error as soon as the user fills in a key.
  useEffect(() => {
    if (hasApiKey && preflightError?.bucket === 'auth') {
      setPreflightError(null);
    }
  }, [hasApiKey, preflightError]);

  const handleCancel = useCallback(() => {
    if (currentJob && isActiveStatus(currentJob.status)) {
      cancelJob(currentJob.id);
    }
  }, [currentJob]);

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

  const handleVariation = useCallback(
    (job: Job) => {
      if (busy) {
        toast.warn('Wait for current generation to finish.');
        return;
      }
      try {
        const next: GenerationRequest = { ...job.request, seed: newRandomSeed() };
        startJob(next);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        toast.error('Cannot generate variation', { description: msg });
      }
    },
    [busy],
  );

  const handleUseAsReference = useCallback(
    async (job: Job, result: GenerationResult) => {
      const id = refIdForResult(result);
      if (promptForm.references.some((r) => r.id === id)) {
        toast.info('Already in references.');
        return;
      }
      const url = result.imageURL;
      const inlineDataURI =
        result.imageDataURI ??
        (result.imageBase64Data ? `data:image/png;base64,${result.imageBase64Data}` : undefined);

      const key = resultBusyKey(job, result);
      setRefBusyKey(key);
      try {
        let dataURI: string;
        let bytes = 0;
        if (inlineDataURI) {
          dataURI = inlineDataURI;
          const comma = dataURI.indexOf(',');
          if (comma >= 0) {
            const base64Length = dataURI.length - comma - 1;
            bytes = Math.floor((base64Length * 3) / 4);
          }
        } else if (url) {
          const fetched = await urlToDataURI(url);
          dataURI = fetched.dataURI;
          bytes = fetched.bytes;
        } else {
          throw new Error('No image data available.');
        }
        const ref: Reference = {
          id,
          kind: 'library',
          sourceItemId: id,
          dataURI,
          name: `Generated ${MODEL_LABELS[job.model]}`,
          bytes,
        };
        promptForm.setReferences((prev) => {
          if (prev.some((r) => r.id === id)) return prev;
          return [...prev, ref];
        });
        toast.success('Added to references.');
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        toast.error('Could not use as reference', { description: msg });
      } finally {
        setRefBusyKey(null);
      }
    },
    [promptForm],
  );

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

  const validationError = promptForm.validationError;
  const canGenerate = ready && !busy && validationError === null;
  const generateTooltip = !ready
    ? 'Waiting for Eagle…'
    : busy
      ? undefined
      : (validationError ?? undefined);

  // Suppress unused-tick warning — tick exists to trigger re-renders for elapsed time.
  void tick;

  const { status, statusMessage, statusHint } = useMemo<{
    status: StatusKind;
    statusMessage?: string;
    statusHint?: string;
  }>(() => {
    if (!ready) {
      return { status: 'idle', statusMessage: 'Waiting for Eagle…' };
    }
    if (currentJob) {
      const got = currentJob.results.length;
      const expected = currentJob.expected;
      const cost = formatCost(currentJob.costUSD);
      if (isActiveStatus(currentJob.status)) {
        const elapsed = formatElapsed(Date.now() - currentJob.startedAt);
        const hintParts = [elapsed, MODEL_LABELS[currentJob.model]];
        if (cost) hintParts.push(cost);
        return {
          status: 'busy',
          statusMessage: `Generating ${Math.min(got, expected)}/${expected}…`,
          statusHint: hintParts.join(' · '),
        };
      }
      if (currentJob.status === 'done') {
        const elapsed = currentJob.finishedAt
          ? formatElapsed(currentJob.finishedAt - currentJob.startedAt)
          : '—';
        return {
          status: 'success',
          statusMessage: `Done · ${elapsed}${cost ? ` · ${cost}` : ''}`,
          statusHint: `${got} ${got === 1 ? 'image' : 'images'} · ${MODEL_LABELS[currentJob.model]}`,
        };
      }
      if (currentJob.status === 'error') {
        const title = currentJob.errorDetails?.title;
        const msg = currentJob.error ?? 'Generation failed.';
        return {
          status: 'error',
          statusMessage: title ? `${title} · ${msg}` : msg,
        };
      }
      if (currentJob.status === 'cancelled') {
        return {
          status: 'idle',
          statusMessage: `Cancelled · ${got}/${expected} delivered${cost ? ` · ${cost}` : ''}`,
        };
      }
    }
    if (!hasApiKey) {
      return { status: 'idle', statusMessage: 'Set your API key in Settings.' };
    }
    return { status: 'idle', statusMessage: undefined, statusHint: validationError ?? 'Idle.' };
  }, [ready, currentJob, hasApiKey, validationError]);

  return (
    <div className="flex h-full w-full flex-col bg-bg text-fg">
      <TopBar
        model={settings.defaultModel}
        onModelChange={(m) => setSettings({ defaultModel: m })}
        onOpenSettings={() => setDrawerOpen(true)}
        hasApiKey={hasApiKey}
        ready={ready}
        shotTag={settings.shotTag}
        onShotChange={(shotTag) => setSettings({ shotTag })}
        devActions={devActions}
      />
      <main className="flex min-h-0 flex-1">
        <PromptPanel loading={!ready} model={settings.defaultModel} form={promptForm} />
        <CenterPanel
          onGenerate={handleGenerate}
          onCancel={handleCancel}
          canGenerate={canGenerate}
          busy={busy}
          status={status}
          statusMessage={statusMessage}
          statusHint={statusHint}
          generateTooltip={generateTooltip}
          loading={!ready}
          model={settings.defaultModel}
          references={promptForm.references}
          setReferences={promptForm.setReferences}
          error={activeError}
          latestItem={latestItem}
          onOpenLightbox={setLightboxItem}
          onRetry={handleRetry}
          onDismissError={handleDismissError}
          onOpenSettings={() => setDrawerOpen(true)}
        />
        <ResultsGrid
          loading={!ready}
          onVariation={handleVariation}
          onUseAsReference={handleUseAsReference}
          onOpenLightbox={setLightboxItem}
          refBusyKey={refBusyKey}
        />
      </main>
      <Toaster />
      {lightboxItem && (
        <Lightbox item={lightboxItem} onClose={() => setLightboxItem(null)} />
      )}
      <SettingsDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  );
}
