import { MODEL_LABELS, type ModelId } from './models';
import type { GenerationResult } from './runware';
import type { Job } from '../state/jobs';

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

export function formatDateForName(d: Date = new Date()): string {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

export function shortSeed(seed: number | null | undefined): string {
  if (seed == null || !Number.isFinite(seed)) return 'noseed';
  const s = Math.trunc(Math.abs(seed)).toString();
  return s.length <= 6 ? s : s.slice(-6);
}

export function autoNameFor(job: Job, result: GenerationResult, now: Date = new Date()): string {
  return `${job.model}-${shortSeed(result.seed ?? null)}-${formatDateForName(now)}`;
}

export function modelAutoTags(model: ModelId): string[] {
  return ['runware', model];
}

function normalizeTag(tag: string): string {
  return tag.trim();
}

export function buildInitialTags(model: ModelId, baseTags: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (raw: string) => {
    const t = normalizeTag(raw);
    if (!t) return;
    const k = t.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    out.push(t);
  };
  for (const t of baseTags) push(t);
  for (const t of modelAutoTags(model)) push(t);
  return out;
}

function formatCostForAnnotation(cost?: number): string | null {
  if (typeof cost !== 'number' || !Number.isFinite(cost)) return null;
  if (cost === 0) return '$0.00';
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(3)}`;
}

interface MaybeNegative {
  negativePrompt?: string;
}

export function buildAnnotation(job: Job, result: GenerationResult): string {
  const lines: string[] = [];
  const positive = job.request.positivePrompt?.trim();
  if (positive) {
    lines.push('Prompt:');
    lines.push(positive);
    lines.push('');
  }
  const negCandidate = (job.request as unknown as MaybeNegative).negativePrompt;
  const neg = typeof negCandidate === 'string' ? negCandidate.trim() : '';
  if (neg) {
    lines.push('Negative prompt:');
    lines.push(neg);
    lines.push('');
  }
  lines.push(`Model: ${MODEL_LABELS[job.model]}`);
  if (result.seed != null) lines.push(`Seed: ${result.seed}`);
  const w = job.request.width;
  const h = job.request.height;
  if (w && h) lines.push(`Size: ${w}×${h}`);
  const cost = formatCostForAnnotation(result.cost);
  if (cost) lines.push(`Cost: ${cost}`);
  return lines.join('\n').trim();
}
