import { useEffect, useRef } from 'react';
import {
  MODELS,
  MODEL_LABELS,
  type AspectRatio,
  type ModelId,
  type OpenAiModeration,
  type OpenAiQuality,
  type ResolutionPreset,
  type SafetyTolerance,
} from '../lib/models';
import {
  GPT_PRESETS,
  MODERATION_VALUES,
  QUALITY_VALUES,
  SAFETY_VALUES,
  snapDim,
  type UsePromptFormResult,
} from '../lib/promptForm';
import { OUTPUT_FORMATS, type OutputFormat } from '../lib/settings';
import { Skeleton } from './Skeleton';

interface PromptPanelProps {
  loading?: boolean;
  model: ModelId;
  form: UsePromptFormResult;
}

const TEXTAREA_MAX_HEIGHT = 360;

function autoSize(el: HTMLTextAreaElement | null): void {
  if (!el) return;
  el.style.height = '0px';
  el.style.height = `${Math.min(el.scrollHeight, TEXTAREA_MAX_HEIGHT)}px`;
}

const RESOLUTION_LABELS: Record<ResolutionPreset, string> = {
  '1K': '1K',
  '2K': '2K',
  '4K': '4K',
};

const SAFETY_LABELS: Record<SafetyTolerance, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  none: 'None',
  off: 'Off',
};

const QUALITY_LABELS: Record<OpenAiQuality, string> = {
  auto: 'Auto',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

const MODERATION_LABELS: Record<OpenAiModeration, string> = {
  auto: 'Auto',
  low: 'Low',
};

export function PromptPanel({ loading = false, model, form }: PromptPanelProps) {
  const positiveRef = useRef<HTMLTextAreaElement | null>(null);
  const negativeRef = useRef<HTMLTextAreaElement | null>(null);
  const systemRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    autoSize(positiveRef.current);
  }, [form.positivePrompt]);
  useEffect(() => {
    autoSize(negativeRef.current);
  }, [form.negativePrompt, form.showAdvanced]);
  useEffect(() => {
    autoSize(systemRef.current);
  }, [form.systemPrompt, form.showAdvanced, model]);

  if (loading) {
    return (
      <aside
        aria-label="Prompt"
        className="flex h-full w-80 flex-none flex-col border-r border-border bg-bg-panel"
      >
        <header className="flex flex-none items-center justify-between border-b border-border px-4 py-2.5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-fg-muted">Prompt</h2>
        </header>
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-9 w-full" />
        </div>
      </aside>
    );
  }

  const spec = MODELS[model];
  const maxChars = spec.maxPromptChars;
  const length = form.positivePrompt.length;
  const overLimit = length > maxChars;
  const nearLimit = !overLimit && length > maxChars * 0.9;
  const counterClass = overLimit
    ? 'text-danger'
    : nearLimit
      ? 'text-warn'
      : 'text-fg-subtle';

  const showInlineError =
    form.validationError !== null && form.positivePrompt.trim().length > 0;

  return (
    <aside
      aria-label="Prompt"
      className="flex h-full w-80 flex-none flex-col border-r border-border bg-bg-panel"
    >
      <header className="flex flex-none items-center justify-between border-b border-border px-4 py-2.5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-fg-muted">Prompt</h2>
        <span className="text-[10px] uppercase tracking-wide text-fg-subtle">
          {MODEL_LABELS[model]}
        </span>
      </header>

      <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-4 py-4">
        <section className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="rw-positive"
              className="text-xs font-medium uppercase tracking-wide text-fg-muted"
            >
              Prompt
            </label>
            <span aria-live="polite" className={`text-[11px] ${counterClass}`}>
              {length.toLocaleString()} / {maxChars.toLocaleString()}
            </span>
          </div>
          <textarea
            id="rw-positive"
            ref={positiveRef}
            value={form.positivePrompt}
            onChange={(e) => form.setPositivePrompt(e.target.value)}
            placeholder="Describe the image you want…"
            rows={4}
            className="block w-full resize-none rounded border border-border bg-bg px-3 py-2 text-sm leading-relaxed text-fg placeholder:text-fg-subtle focus:border-focus focus:outline-none"
          />
        </section>

        <CommonControls form={form} />

        {model === 'nano-banana-pro' ? (
          <NbpControls form={form} />
        ) : (
          <GptControls form={form} />
        )}

        <section className="space-y-2">
          <button
            type="button"
            onClick={() => form.setShowAdvanced(!form.showAdvanced)}
            aria-expanded={form.showAdvanced}
            aria-controls="rw-advanced"
            className="flex w-full items-center justify-between rounded border border-border bg-bg px-3 py-1.5 text-xs font-medium text-fg-muted hover:bg-bg-elevated"
          >
            <span>Advanced</span>
            <svg
              viewBox="0 0 16 16"
              width="12"
              height="12"
              aria-hidden="true"
              className={`transition-transform ${form.showAdvanced ? 'rotate-90' : ''}`}
            >
              <path d="M5 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
            </svg>
          </button>
          {form.showAdvanced && (
            <div id="rw-advanced" className="space-y-3 rounded border border-border bg-bg/40 p-3">
              <div className="space-y-1.5">
                <label
                  htmlFor="rw-negative"
                  className="text-xs font-medium uppercase tracking-wide text-fg-muted"
                >
                  Negative prompt
                </label>
                <textarea
                  id="rw-negative"
                  ref={negativeRef}
                  value={form.negativePrompt}
                  onChange={(e) => form.setNegativePrompt(e.target.value)}
                  placeholder="What to avoid (optional)…"
                  rows={2}
                  className="block w-full resize-none rounded border border-border bg-bg px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus:border-focus focus:outline-none"
                />
              </div>
              {model === 'nano-banana-pro' && (
                <div className="space-y-1.5">
                  <label
                    htmlFor="rw-system"
                    className="text-xs font-medium uppercase tracking-wide text-fg-muted"
                  >
                    System prompt
                  </label>
                  <textarea
                    id="rw-system"
                    ref={systemRef}
                    value={form.systemPrompt}
                    onChange={(e) => form.setSystemPrompt(e.target.value)}
                    placeholder="High-level instructions for the model (optional)…"
                    rows={2}
                    className="block w-full resize-none rounded border border-border bg-bg px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus:border-focus focus:outline-none"
                  />
                </div>
              )}
            </div>
          )}
        </section>

        {showInlineError && (
          <p
            role="alert"
            data-testid="prompt-validation-error"
            className="rounded border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger"
          >
            {form.validationError}
          </p>
        )}
      </div>
    </aside>
  );
}

function CommonControls({ form }: { form: UsePromptFormResult }) {
  return (
    <section className="space-y-3">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label
            htmlFor="rw-nr"
            className="text-xs font-medium uppercase tracking-wide text-fg-muted"
          >
            Results
          </label>
          <span className="font-mono text-xs text-fg">{form.numberResults}</span>
        </div>
        <input
          id="rw-nr"
          type="range"
          min={1}
          max={10}
          step={1}
          value={form.numberResults}
          onChange={(e) => {
            const n = Number(e.target.value);
            form.setNumberResults(Math.max(1, Math.min(10, Math.floor(n))));
          }}
          className="block w-full accent-accent"
        />
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="rw-seed"
          className="text-xs font-medium uppercase tracking-wide text-fg-muted"
        >
          Seed
        </label>
        <div className="flex gap-2">
          <input
            id="rw-seed"
            type="number"
            inputMode="numeric"
            value={form.seed ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              if (v === '') {
                form.setSeed(null);
                return;
              }
              const n = Number(v);
              if (Number.isFinite(n)) form.setSeed(Math.floor(n));
            }}
            placeholder="random"
            className="block w-full rounded border border-border bg-bg px-3 py-1.5 font-mono text-sm text-fg placeholder:text-fg-subtle focus:border-focus focus:outline-none"
          />
          <button
            type="button"
            onClick={form.randomizeSeed}
            aria-label="Randomize seed"
            title="Randomize seed"
            className="inline-flex items-center justify-center rounded border border-border bg-bg px-2 text-fg hover:bg-bg-elevated"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
              <rect
                x="3"
                y="3"
                width="18"
                height="18"
                rx="3"
                stroke="currentColor"
                strokeWidth="1.5"
                fill="none"
              />
              <circle cx="8" cy="8" r="1.2" fill="currentColor" />
              <circle cx="16" cy="8" r="1.2" fill="currentColor" />
              <circle cx="12" cy="12" r="1.2" fill="currentColor" />
              <circle cx="8" cy="16" r="1.2" fill="currentColor" />
              <circle cx="16" cy="16" r="1.2" fill="currentColor" />
            </svg>
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="rw-format"
          className="text-xs font-medium uppercase tracking-wide text-fg-muted"
        >
          Output format
        </label>
        <select
          id="rw-format"
          value={form.outputFormat}
          onChange={(e) => form.setOutputFormat(e.target.value as OutputFormat)}
          className="block w-full rounded border border-border bg-bg px-2 py-1.5 text-sm text-fg focus:border-focus focus:outline-none"
        >
          {OUTPUT_FORMATS.map((fmt) => (
            <option key={fmt} value={fmt}>
              {fmt}
            </option>
          ))}
        </select>
      </div>
    </section>
  );
}

function NbpControls({ form }: { form: UsePromptFormResult }) {
  const { nbp } = form;
  const resolutions = MODELS['nano-banana-pro'].resolutions;
  const aspectRatios = MODELS['nano-banana-pro'].aspectRatios;

  return (
    <section className="space-y-3 border-t border-border pt-4">
      <h3 className="text-[10px] font-semibold uppercase tracking-wide text-fg-subtle">
        Nano Banana Pro
      </h3>

      <div className="space-y-1.5">
        <label className="text-xs font-medium uppercase tracking-wide text-fg-muted">
          Resolution
        </label>
        <div className="grid grid-cols-3 gap-1.5">
          {resolutions.map((r) => {
            const active = r === nbp.resolution;
            return (
              <button
                key={r}
                type="button"
                onClick={() => form.setNbp('resolution', r)}
                aria-pressed={active}
                className={
                  'rounded border px-2 py-1 text-xs font-medium ' +
                  (active
                    ? 'border-accent bg-accent text-accent-fg'
                    : 'border-border bg-bg text-fg hover:bg-bg-elevated')
                }
              >
                {RESOLUTION_LABELS[r]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="rw-nbp-aspect"
          className="text-xs font-medium uppercase tracking-wide text-fg-muted"
        >
          Aspect ratio
        </label>
        <select
          id="rw-nbp-aspect"
          value={nbp.aspect}
          onChange={(e) => form.setNbp('aspect', e.target.value as AspectRatio)}
          className="block w-full rounded border border-border bg-bg px-2 py-1.5 text-sm text-fg focus:border-focus focus:outline-none"
        >
          {aspectRatios.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label
            htmlFor="rw-nbp-temp"
            className="text-xs font-medium uppercase tracking-wide text-fg-muted"
          >
            Temperature
          </label>
          <span className="font-mono text-xs text-fg">{nbp.temperature.toFixed(2)}</span>
        </div>
        <input
          id="rw-nbp-temp"
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={nbp.temperature}
          onChange={(e) => form.setNbp('temperature', Number(e.target.value))}
          className="block w-full accent-accent"
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label
            htmlFor="rw-nbp-topp"
            className="text-xs font-medium uppercase tracking-wide text-fg-muted"
          >
            Top P
          </label>
          <span className="font-mono text-xs text-fg">{nbp.topP.toFixed(2)}</span>
        </div>
        <input
          id="rw-nbp-topp"
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={nbp.topP}
          onChange={(e) => form.setNbp('topP', Number(e.target.value))}
          className="block w-full accent-accent"
        />
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="rw-nbp-safety"
          className="text-xs font-medium uppercase tracking-wide text-fg-muted"
        >
          Safety tolerance
        </label>
        <select
          id="rw-nbp-safety"
          value={nbp.safetyTolerance}
          onChange={(e) => form.setNbp('safetyTolerance', e.target.value as SafetyTolerance)}
          className="block w-full rounded border border-border bg-bg px-2 py-1.5 text-sm text-fg focus:border-focus focus:outline-none"
        >
          {SAFETY_VALUES.map((v) => (
            <option key={v} value={v}>
              {SAFETY_LABELS[v]}
            </option>
          ))}
        </select>
      </div>

      <label className="flex cursor-pointer items-center justify-between rounded border border-border bg-bg px-3 py-1.5 text-xs text-fg">
        <span>Web search</span>
        <input
          type="checkbox"
          checked={nbp.webSearch}
          onChange={(e) => form.setNbp('webSearch', e.target.checked)}
          className="h-4 w-4 accent-accent"
        />
      </label>
    </section>
  );
}

function GptControls({ form }: { form: UsePromptFormResult }) {
  const { gpt } = form;
  const dim = MODELS['gpt-image-2'].dim;
  const w = gpt.width;
  const h = gpt.height;
  const hasValidDims = Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0;
  const aspect = hasValidDims ? Math.max(w / h, h / w) : NaN;

  return (
    <section className="space-y-3 border-t border-border pt-4">
      <h3 className="text-[10px] font-semibold uppercase tracking-wide text-fg-subtle">
        GPT Image 2
      </h3>

      <div className="space-y-1.5">
        <label className="text-xs font-medium uppercase tracking-wide text-fg-muted">
          Quick presets
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          {GPT_PRESETS.map((p) => {
            const active = p.width === gpt.width && p.height === gpt.height;
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => form.applyGptPreset(p)}
                aria-pressed={active}
                className={
                  'rounded border px-2 py-1 text-xs font-medium ' +
                  (active
                    ? 'border-accent bg-accent text-accent-fg'
                    : 'border-border bg-bg text-fg hover:bg-bg-elevated')
                }
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label
            htmlFor="rw-gpt-w"
            className="text-xs font-medium uppercase tracking-wide text-fg-muted"
          >
            Width
          </label>
          <input
            id="rw-gpt-w"
            type="number"
            min={dim.min}
            max={dim.max}
            step={dim.step}
            value={Number.isFinite(gpt.width) ? gpt.width : ''}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === '') {
                form.setGpt('width', Number.NaN);
                return;
              }
              const n = Number(raw);
              if (Number.isFinite(n)) form.setGpt('width', Math.floor(n));
            }}
            onBlur={(e) => {
              const n = Number(e.target.value);
              if (!Number.isFinite(n)) return;
              form.setGpt('width', snapDim(n, dim.step, dim.min, dim.max));
            }}
            className="block w-full rounded border border-border bg-bg px-2 py-1.5 font-mono text-sm text-fg focus:border-focus focus:outline-none"
          />
        </div>
        <div className="space-y-1">
          <label
            htmlFor="rw-gpt-h"
            className="text-xs font-medium uppercase tracking-wide text-fg-muted"
          >
            Height
          </label>
          <input
            id="rw-gpt-h"
            type="number"
            min={dim.min}
            max={dim.max}
            step={dim.step}
            value={Number.isFinite(gpt.height) ? gpt.height : ''}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === '') {
                form.setGpt('height', Number.NaN);
                return;
              }
              const n = Number(raw);
              if (Number.isFinite(n)) form.setGpt('height', Math.floor(n));
            }}
            onBlur={(e) => {
              const n = Number(e.target.value);
              if (!Number.isFinite(n)) return;
              form.setGpt('height', snapDim(n, dim.step, dim.min, dim.max));
            }}
            className="block w-full rounded border border-border bg-bg px-2 py-1.5 font-mono text-sm text-fg focus:border-focus focus:outline-none"
          />
        </div>
      </div>
      <p className="text-[11px] text-fg-subtle">
        Snaps to {dim.step}px · range {dim.min}–{dim.max}px
        {hasValidDims && ` · aspect ${aspect.toFixed(2)}:1 (max ${dim.maxAspect}:1)`}
      </p>

      <div className="space-y-1.5">
        <label
          htmlFor="rw-gpt-quality"
          className="text-xs font-medium uppercase tracking-wide text-fg-muted"
        >
          Quality
        </label>
        <select
          id="rw-gpt-quality"
          value={gpt.quality}
          onChange={(e) => form.setGpt('quality', e.target.value as OpenAiQuality)}
          className="block w-full rounded border border-border bg-bg px-2 py-1.5 text-sm text-fg focus:border-focus focus:outline-none"
        >
          {QUALITY_VALUES.map((v) => (
            <option key={v} value={v}>
              {QUALITY_LABELS[v]}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="rw-gpt-mod"
          className="text-xs font-medium uppercase tracking-wide text-fg-muted"
        >
          Moderation
        </label>
        <select
          id="rw-gpt-mod"
          value={gpt.moderation}
          onChange={(e) => form.setGpt('moderation', e.target.value as OpenAiModeration)}
          className="block w-full rounded border border-border bg-bg px-2 py-1.5 text-sm text-fg focus:border-focus focus:outline-none"
        >
          {MODERATION_VALUES.map((v) => (
            <option key={v} value={v}>
              {MODERATION_LABELS[v]}
            </option>
          ))}
        </select>
      </div>
    </section>
  );
}
