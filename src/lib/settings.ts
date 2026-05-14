import { useCallback, useEffect, useState } from 'react';

export type OutputFormat = 'PNG' | 'WEBP' | 'JPG';
export type DefaultModel = 'nano-banana-pro' | 'gpt-image-2';

export type ModelParams = Record<string, unknown>;

export interface PromptPreset {
  id: string;
  name: string;
  text: string;
}

export interface Settings {
  apiKey: string;
  defaultModel: DefaultModel;
  defaultTags: string[];
  defaultFolderId?: string;
  outputFormat: OutputFormat;
  numberResults: number;
  lastUsedModelParams: Partial<Record<DefaultModel, ModelParams>>;
  shotTag?: string;
  promptPresets: PromptPreset[];
  selectedPresetId?: string;
}

export const SETTINGS_STORAGE_KEY = 'runware-plugin:settings:v1';

export const DEFAULT_SETTINGS: Settings = {
  apiKey: '',
  defaultModel: 'nano-banana-pro',
  defaultTags: [],
  defaultFolderId: undefined,
  outputFormat: 'PNG',
  numberResults: 1,
  lastUsedModelParams: {},
  shotTag: undefined,
  promptPresets: [],
  selectedPresetId: undefined,
};

export const OUTPUT_FORMATS: OutputFormat[] = ['PNG', 'WEBP', 'JPG'];
export const DEFAULT_MODELS: DefaultModel[] = ['nano-banana-pro', 'gpt-image-2'];

function isOutputFormat(v: unknown): v is OutputFormat {
  return v === 'PNG' || v === 'WEBP' || v === 'JPG';
}

function isDefaultModel(v: unknown): v is DefaultModel {
  return v === 'nano-banana-pro' || v === 'gpt-image-2';
}

function sanitizePresets(raw: unknown): PromptPreset[] {
  if (!Array.isArray(raw)) return [];
  const out: PromptPreset[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const o = entry as Record<string, unknown>;
    const id = typeof o.id === 'string' ? o.id : '';
    const name = typeof o.name === 'string' ? o.name : '';
    const text = typeof o.text === 'string' ? o.text : '';
    if (!id) continue;
    out.push({ id, name, text });
  }
  return out;
}

function sanitize(raw: unknown): Settings {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_SETTINGS };
  const r = raw as Record<string, unknown>;
  const tags = Array.isArray(r.defaultTags)
    ? r.defaultTags.filter((t): t is string => typeof t === 'string')
    : DEFAULT_SETTINGS.defaultTags;
  const numberResults =
    typeof r.numberResults === 'number' && Number.isFinite(r.numberResults) && r.numberResults > 0
      ? Math.min(Math.floor(r.numberResults), 20)
      : DEFAULT_SETTINGS.numberResults;
  const lastUsedModelParams =
    r.lastUsedModelParams && typeof r.lastUsedModelParams === 'object'
      ? (r.lastUsedModelParams as Settings['lastUsedModelParams'])
      : {};
  const promptPresets = sanitizePresets(r.promptPresets);
  const selectedPresetId =
    typeof r.selectedPresetId === 'string' && promptPresets.some((p) => p.id === r.selectedPresetId)
      ? r.selectedPresetId
      : undefined;
  return {
    apiKey: typeof r.apiKey === 'string' ? r.apiKey : DEFAULT_SETTINGS.apiKey,
    defaultModel: isDefaultModel(r.defaultModel) ? r.defaultModel : DEFAULT_SETTINGS.defaultModel,
    defaultTags: tags,
    defaultFolderId: typeof r.defaultFolderId === 'string' ? r.defaultFolderId : undefined,
    outputFormat: isOutputFormat(r.outputFormat) ? r.outputFormat : DEFAULT_SETTINGS.outputFormat,
    numberResults,
    lastUsedModelParams,
    shotTag: typeof r.shotTag === 'string' && r.shotTag.trim() ? r.shotTag : undefined,
    promptPresets,
    selectedPresetId,
  };
}

function readFromStorage(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return sanitize(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function writeToStorage(s: Settings): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(s));
  } catch (err) {
    console.warn('[Runware] Failed to persist settings:', err);
  }
}

let cache: Settings | null = null;
const listeners = new Set<(s: Settings) => void>();

export function getSettings(): Settings {
  if (!cache) cache = readFromStorage();
  return cache;
}

export type SettingsUpdate = Partial<Settings> | ((prev: Settings) => Settings);

export function setSettings(update: SettingsUpdate): Settings {
  const prev = getSettings();
  const next = typeof update === 'function' ? update(prev) : { ...prev, ...update };
  cache = next;
  writeToStorage(next);
  for (const l of listeners) l(next);
  return next;
}

export function clearSettings(): void {
  cache = { ...DEFAULT_SETTINGS };
  try {
    localStorage.removeItem(SETTINGS_STORAGE_KEY);
  } catch (err) {
    console.warn('[Runware] Failed to clear settings:', err);
  }
  for (const l of listeners) l(cache);
}

export function subscribeSettings(listener: (s: Settings) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useSettings(): readonly [Settings, (u: SettingsUpdate) => void] {
  const [state, setState] = useState<Settings>(() => getSettings());

  useEffect(() => {
    const unsub = subscribeSettings(setState);
    return unsub;
  }, []);

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key !== SETTINGS_STORAGE_KEY) return;
      cache = null;
      setState(getSettings());
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const update = useCallback((u: SettingsUpdate) => {
    setSettings(u);
  }, []);

  return [state, update] as const;
}
