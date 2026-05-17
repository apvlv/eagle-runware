import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  MODELS,
  dimsFromPreset,
  validateRequest,
  type AspectRatio,
  type ModelId,
  type OpenAiModeration,
  type OpenAiQuality,
  type ResolutionPreset,
  type SafetyTolerance,
} from './models';
import { getSettings, setSettings, useSettings, type OutputFormat } from './settings';
import type { GenerationRequest, ImageRef } from './runware';

export interface Reference {
  id: string;
  kind: 'library' | 'upload';
  sourceItemId?: string;
  dataURI: string;
  name: string;
  bytes: number;
}

export interface NbpParams {
  resolution: ResolutionPreset;
  aspect: AspectRatio;
  temperature: number;
  topP: number;
  safetyTolerance: SafetyTolerance;
  webSearch: boolean;
}

export interface GptParams {
  width: number;
  height: number;
  quality: OpenAiQuality;
  moderation: OpenAiModeration;
}

export interface GptPreset {
  label: string;
  width: number;
  height: number;
}

export const GPT_PRESETS: readonly GptPreset[] = [
  { label: '1024×1024', width: 1024, height: 1024 },
  { label: '1536×1024', width: 1536, height: 1024 },
  { label: '1024×1536', width: 1024, height: 1536 },
  { label: '2560×1440', width: 2560, height: 1440 },
];

export const SAFETY_VALUES: readonly SafetyTolerance[] = ['high', 'medium', 'low', 'none', 'off'];
export const QUALITY_VALUES: readonly OpenAiQuality[] = ['auto', 'high', 'medium', 'low'];
export const MODERATION_VALUES: readonly OpenAiModeration[] = ['auto', 'low'];

export const DEFAULT_NBP_PARAMS: NbpParams = {
  resolution: '1K',
  aspect: '1:1',
  temperature: 0.7,
  topP: 0.95,
  safetyTolerance: 'medium',
  webSearch: false,
};

export const DEFAULT_GPT_PARAMS: GptParams = {
  width: 1024,
  height: 1024,
  quality: 'auto',
  moderation: 'auto',
};

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

function pickNbp(raw: unknown): NbpParams {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Partial<NbpParams>;
  const aspects = MODELS['nano-banana-pro'].aspectRatios as readonly AspectRatio[];
  const resolutions = MODELS['nano-banana-pro'].resolutions as readonly ResolutionPreset[];
  return {
    resolution: resolutions.includes(o.resolution as ResolutionPreset)
      ? (o.resolution as ResolutionPreset)
      : DEFAULT_NBP_PARAMS.resolution,
    aspect: aspects.includes(o.aspect as AspectRatio)
      ? (o.aspect as AspectRatio)
      : DEFAULT_NBP_PARAMS.aspect,
    temperature: clamp(Number(o.temperature ?? DEFAULT_NBP_PARAMS.temperature), 0, 1),
    topP: clamp(Number(o.topP ?? DEFAULT_NBP_PARAMS.topP), 0, 1),
    safetyTolerance: SAFETY_VALUES.includes(o.safetyTolerance as SafetyTolerance)
      ? (o.safetyTolerance as SafetyTolerance)
      : DEFAULT_NBP_PARAMS.safetyTolerance,
    webSearch: Boolean(o.webSearch ?? DEFAULT_NBP_PARAMS.webSearch),
  };
}

function pickGpt(raw: unknown): GptParams {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Partial<GptParams>;
  return {
    width: Number.isFinite(o.width) ? (o.width as number) : DEFAULT_GPT_PARAMS.width,
    height: Number.isFinite(o.height) ? (o.height as number) : DEFAULT_GPT_PARAMS.height,
    quality: QUALITY_VALUES.includes(o.quality as OpenAiQuality)
      ? (o.quality as OpenAiQuality)
      : DEFAULT_GPT_PARAMS.quality,
    moderation: MODERATION_VALUES.includes(o.moderation as OpenAiModeration)
      ? (o.moderation as OpenAiModeration)
      : DEFAULT_GPT_PARAMS.moderation,
  };
}

export function snapDim(n: number, step: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return clamp(Math.round(n / step) * step, lo, hi);
}

export interface UsePromptFormResult {
  positivePrompt: string;
  setPositivePrompt: (v: string) => void;
  negativePrompt: string;
  setNegativePrompt: (v: string) => void;
  systemPrompt: string;
  setSystemPrompt: (v: string) => void;
  showAdvanced: boolean;
  setShowAdvanced: (v: boolean) => void;

  numberResults: number;
  setNumberResults: (v: number) => void;
  seed: number | null;
  setSeed: (v: number | null) => void;
  randomizeSeed: () => void;
  outputFormat: OutputFormat;
  setOutputFormat: (v: OutputFormat) => void;

  nbp: NbpParams;
  setNbp: <K extends keyof NbpParams>(key: K, val: NbpParams[K]) => void;

  gpt: GptParams;
  setGpt: <K extends keyof GptParams>(key: K, val: GptParams[K]) => void;
  applyGptPreset: (preset: GptPreset) => void;

  references: Reference[];
  setReferences: (next: Reference[] | ((prev: Reference[]) => Reference[])) => void;

  validationError: string | null;
  buildRequest: () => GenerationRequest;
}

export function usePromptForm(model: ModelId): UsePromptFormResult {
  const initial = getSettings();
  const [settings] = useSettings();
  const [positivePrompt, setPositivePrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [numberResults, setNumberResults] = useState<number>(() =>
    Math.min(10, Math.max(1, initial.numberResults)),
  );
  const [seed, setSeed] = useState<number | null>(null);
  const [outputFormat, setOutputFormat] = useState<OutputFormat>(() => initial.outputFormat);

  const [nbp, setNbpState] = useState<NbpParams>(() =>
    pickNbp(initial.lastUsedModelParams?.['nano-banana-pro']),
  );
  const [gpt, setGptState] = useState<GptParams>(() =>
    pickGpt(initial.lastUsedModelParams?.['gpt-image-2']),
  );

  const [references, setReferences] = useState<Reference[]>([]);

  const isFirstNbp = useRef(true);
  useEffect(() => {
    if (isFirstNbp.current) {
      isFirstNbp.current = false;
      return;
    }
    const t = window.setTimeout(() => {
      setSettings((prev) => ({
        ...prev,
        lastUsedModelParams: {
          ...prev.lastUsedModelParams,
          'nano-banana-pro': { ...nbp },
        },
      }));
    }, 250);
    return () => window.clearTimeout(t);
  }, [nbp]);

  const isFirstGpt = useRef(true);
  useEffect(() => {
    if (isFirstGpt.current) {
      isFirstGpt.current = false;
      return;
    }
    const t = window.setTimeout(() => {
      setSettings((prev) => ({
        ...prev,
        lastUsedModelParams: {
          ...prev.lastUsedModelParams,
          'gpt-image-2': { ...gpt },
        },
      }));
    }, 250);
    return () => window.clearTimeout(t);
  }, [gpt]);

  const setNbp = useCallback(<K extends keyof NbpParams>(key: K, val: NbpParams[K]) => {
    setNbpState((p) => ({ ...p, [key]: val }));
  }, []);

  const setGpt = useCallback(<K extends keyof GptParams>(key: K, val: GptParams[K]) => {
    setGptState((p) => ({ ...p, [key]: val }));
  }, []);

  const applyGptPreset = useCallback((preset: GptPreset) => {
    setGptState((p) => ({ ...p, width: preset.width, height: preset.height }));
  }, []);

  const randomizeSeed = useCallback(() => {
    setSeed(Math.floor(Math.random() * 2 ** 31));
  }, []);

  const selectedPreset = settings.selectedPresetId
    ? settings.promptPresets.find((p) => p.id === settings.selectedPresetId)
    : undefined;
  const presetText = selectedPreset?.text.trim() ?? '';

  const buildRequest = useCallback((): GenerationRequest => {
    const seedValue = seed ?? undefined;
    const refImages: ImageRef[] | undefined =
      references.length > 0
        ? references.map((r) => ({ kind: 'dataURI', value: r.dataURI }))
        : undefined;
    const composedPrompt = presetText
      ? `${presetText}\n\n${positivePrompt.trim()}`.trim()
      : positivePrompt;
    if (model === 'nano-banana-pro') {
      const dims = dimsFromPreset('nano-banana-pro', nbp.resolution, nbp.aspect);
      const sys = systemPrompt.trim();
      return {
        model: 'nano-banana-pro',
        positivePrompt: composedPrompt,
        numberResults,
        seed: seedValue,
        width: dims.width,
        height: dims.height,
        outputFormat,
        referenceImages: refImages,
        providerSettings: {
          temperature: nbp.temperature,
          topP: nbp.topP,
          safetyTolerance: nbp.safetyTolerance,
          webSearch: nbp.webSearch,
          ...(sys ? { systemPrompt: sys } : {}),
        },
      };
    }
    return {
      model: 'gpt-image-2',
      positivePrompt: composedPrompt,
      numberResults,
      seed: seedValue,
      width: gpt.width,
      height: gpt.height,
      outputFormat,
      referenceImages: refImages,
      providerSettings: {
        quality: gpt.quality,
        moderation: gpt.moderation,
      },
    };
  }, [model, positivePrompt, numberResults, seed, outputFormat, systemPrompt, nbp, gpt, references, presetText]);

  const validationError = useMemo(() => {
    return validateRequest(model, buildRequest());
  }, [model, buildRequest]);

  return {
    positivePrompt,
    setPositivePrompt,
    negativePrompt,
    setNegativePrompt,
    systemPrompt,
    setSystemPrompt,
    showAdvanced,
    setShowAdvanced,
    numberResults,
    setNumberResults,
    seed,
    setSeed,
    randomizeSeed,
    outputFormat,
    setOutputFormat,
    nbp,
    setNbp,
    gpt,
    setGpt,
    applyGptPreset,
    references,
    setReferences,
    validationError,
    buildRequest,
  };
}
