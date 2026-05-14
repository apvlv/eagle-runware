export type ModelId = 'nano-banana-pro' | 'gpt-image-2';

export type ResolutionPreset = '1K' | '2K' | '4K';
export type AspectRatio =
  | '1:1'
  | '3:2'
  | '2:3'
  | '4:3'
  | '3:4'
  | '4:5'
  | '5:4'
  | '9:16'
  | '16:9'
  | '21:9';

export type SafetyTolerance = 'high' | 'medium' | 'low' | 'none' | 'off';
export type OpenAiQuality = 'auto' | 'high' | 'medium' | 'low';
export type OpenAiModeration = 'auto' | 'low';

export interface NanoBananaProExtras {
  temperature?: number;
  topP?: number;
  safetyTolerance?: SafetyTolerance;
  webSearch?: boolean;
  systemPrompt?: string;
}

export interface GptImage2Extras {
  quality?: OpenAiQuality;
  moderation?: OpenAiModeration;
}

export interface NanoBananaProSpec {
  air: 'google:4@2';
  maxRefImages: 14;
  maxPromptChars: 45000;
  resolutions: readonly ResolutionPreset[];
  aspectRatios: readonly AspectRatio[];
  extras: {
    temperature: { min: 0; max: 1; step: 0.01 };
    topP: { min: 0; max: 1; step: 0.01 };
    safetyTolerance: { values: readonly SafetyTolerance[] };
    webSearch: { type: 'boolean' };
    systemPrompt: { maxLength: 50000 };
  };
}

export interface GptImage2Spec {
  air: 'openai:gpt-image@2';
  maxRefImages: 16;
  maxPromptChars: 32000;
  dim: { min: 480; max: 3840; step: 16; maxAspect: 3 };
  extras: {
    quality: { values: readonly OpenAiQuality[] };
    moderation: { values: readonly OpenAiModeration[] };
  };
}

export const MODELS = {
  'nano-banana-pro': {
    air: 'google:4@2',
    maxRefImages: 14,
    maxPromptChars: 45000,
    resolutions: ['1K', '2K', '4K'] as const,
    aspectRatios: [
      '1:1',
      '3:2',
      '2:3',
      '4:3',
      '3:4',
      '4:5',
      '5:4',
      '9:16',
      '16:9',
      '21:9',
    ] as const,
    extras: {
      temperature: { min: 0, max: 1, step: 0.01 },
      topP: { min: 0, max: 1, step: 0.01 },
      safetyTolerance: { values: ['high', 'medium', 'low', 'none', 'off'] as const },
      webSearch: { type: 'boolean' },
      systemPrompt: { maxLength: 50000 },
    },
  },
  'gpt-image-2': {
    air: 'openai:gpt-image@2',
    maxRefImages: 16,
    maxPromptChars: 32000,
    dim: { min: 480, max: 3840, step: 16, maxAspect: 3 },
    extras: {
      quality: { values: ['auto', 'high', 'medium', 'low'] as const },
      moderation: { values: ['auto', 'low'] as const },
    },
  },
} as const;

export const MODEL_LABELS: Record<ModelId, string> = {
  'nano-banana-pro': 'Nano Banana Pro',
  'gpt-image-2': 'GPT Image 2',
};

const PRESET_LONG_EDGE: Record<ResolutionPreset, number> = {
  '1K': 1024,
  '2K': 2048,
  '4K': 3840,
};

function parseAspect(aspect: AspectRatio): [number, number] {
  const [a, b] = aspect.split(':').map((n) => Number(n));
  return [a, b];
}

function snapToStep(value: number, step: number, min: number, max: number): number {
  const snapped = Math.round(value / step) * step;
  return Math.max(min, Math.min(max, snapped));
}

export interface Dims {
  width: number;
  height: number;
}

export function dimsFromPreset(model: ModelId, preset: ResolutionPreset, aspect: AspectRatio): Dims {
  const long = PRESET_LONG_EDGE[preset];
  const [a, b] = parseAspect(aspect);
  const ratio = a / b;

  let width: number;
  let height: number;
  if (ratio >= 1) {
    width = long;
    height = Math.round(long / ratio);
  } else {
    height = long;
    width = Math.round(long * ratio);
  }

  if (model === 'gpt-image-2') {
    const { min, max, step } = MODELS['gpt-image-2'].dim;
    width = snapToStep(width, step, min, max);
    height = snapToStep(height, step, min, max);
  }
  return { width, height };
}

export interface ValidatableRequest {
  positivePrompt: string;
  referenceImages?: { kind: string; value: string }[];
  width?: number;
  height?: number;
  numberResults?: number;
  providerSettings?: NanoBananaProExtras | GptImage2Extras;
}

export function validateRequest(model: ModelId, req: ValidatableRequest): string | null {
  if (!req.positivePrompt || req.positivePrompt.trim().length === 0) {
    return 'Prompt is required.';
  }

  const spec = MODELS[model];
  if (req.positivePrompt.length > spec.maxPromptChars) {
    return `Prompt is too long for ${MODEL_LABELS[model]} (${req.positivePrompt.length}/${spec.maxPromptChars} chars).`;
  }

  if (req.referenceImages && req.referenceImages.length > spec.maxRefImages) {
    return `${MODEL_LABELS[model]} accepts at most ${spec.maxRefImages} reference images (got ${req.referenceImages.length}).`;
  }

  if (req.numberResults != null && (req.numberResults < 1 || req.numberResults > 20)) {
    return 'numberResults must be between 1 and 20.';
  }

  const hasW = req.width != null;
  const hasH = req.height != null;
  if (hasW !== hasH) {
    return 'width and height must be provided together.';
  }

  if (model === 'gpt-image-2') {
    if (!hasW || !hasH) {
      return 'GPT Image 2 requires explicit width and height.';
    }
    const { min, max, step, maxAspect } = MODELS['gpt-image-2'].dim;
    const w = req.width!;
    const h = req.height!;
    if (w < min || w > max || h < min || h > max) {
      return `Dimensions must be between ${min} and ${max}px (got ${w}x${h}).`;
    }
    if (w % step !== 0 || h % step !== 0) {
      return `Dimensions must be multiples of ${step}px.`;
    }
    const aspect = Math.max(w / h, h / w);
    if (aspect > maxAspect) {
      return `Aspect ratio is too extreme (max ${maxAspect}:1, got ${aspect.toFixed(2)}:1).`;
    }
  }

  if (model === 'nano-banana-pro' && req.providerSettings) {
    const ps = req.providerSettings as NanoBananaProExtras;
    if (ps.temperature != null && (ps.temperature < 0 || ps.temperature > 1)) {
      return 'temperature must be between 0 and 1.';
    }
    if (ps.topP != null && (ps.topP < 0 || ps.topP > 1)) {
      return 'topP must be between 0 and 1.';
    }
    if (ps.systemPrompt != null && ps.systemPrompt.length > 50000) {
      return 'systemPrompt is too long (max 50000 chars).';
    }
  }

  return null;
}
