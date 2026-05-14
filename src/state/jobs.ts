import { useSyncExternalStore } from 'react';
import {
  disconnectClient,
  generate,
  type GenerationRequest,
  type GenerationResult,
} from '../lib/runware';
import { validateRequest, type ModelId } from '../lib/models';

export type JobStatus = 'running' | 'partial' | 'done' | 'error' | 'cancelled';

export interface Job {
  id: string;
  model: ModelId;
  request: GenerationRequest;
  status: JobStatus;
  results: GenerationResult[];
  error?: string;
  costUSD?: number;
  startedAt: number;
  finishedAt?: number;
  expected: number;
}

export interface JobsState {
  jobs: Job[];
  currentJobId: string | null;
}

let state: JobsState = { jobs: [], currentJobId: null };
const listeners = new Set<() => void>();
const cancelers = new Map<string, () => void>();

function emit(): void {
  for (const l of listeners) l();
}

function setState(updater: (s: JobsState) => JobsState): void {
  state = updater(state);
  emit();
}

export function getJobsState(): JobsState {
  return state;
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function useJobsState(): JobsState {
  return useSyncExternalStore(subscribe, getJobsState, getJobsState);
}

function genJobId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return `job-${c.randomUUID()}`;
  return `job-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function patchJob(id: string, fn: (j: Job) => Job): void {
  setState((s) => ({
    ...s,
    jobs: s.jobs.map((j) => (j.id === id ? fn(j) : j)),
  }));
}

function keyOf(r: GenerationResult): string {
  if (r.imageUUID) return r.imageUUID;
  if (r.imageURL) return r.imageURL;
  if (r.imageDataURI) return r.imageDataURI.slice(0, 96);
  return `${r.taskUUID}-${r.seed ?? 'no-seed'}`;
}

function mergeResults(
  prev: GenerationResult[],
  incoming: GenerationResult[],
): GenerationResult[] {
  const order: string[] = [];
  const map = new Map<string, GenerationResult>();
  for (const r of prev) {
    const k = keyOf(r);
    if (!map.has(k)) order.push(k);
    map.set(k, r);
  }
  for (const r of incoming) {
    const k = keyOf(r);
    if (!map.has(k)) order.push(k);
    map.set(k, r);
  }
  return order.map((k) => map.get(k)!);
}

function sumCost(results: GenerationResult[]): number | undefined {
  let total = 0;
  let any = false;
  for (const r of results) {
    if (typeof r.cost === 'number' && Number.isFinite(r.cost)) {
      total += r.cost;
      any = true;
    }
  }
  return any ? total : undefined;
}

export function isActiveStatus(status: JobStatus): boolean {
  return status === 'running' || status === 'partial';
}

export function getCurrentJob(s: JobsState = state): Job | null {
  if (!s.currentJobId) return null;
  return s.jobs.find((j) => j.id === s.currentJobId) ?? null;
}

export interface StartJobResult {
  jobId: string;
  promise: Promise<void>;
}

export function startJob(request: GenerationRequest): StartJobResult {
  const err = validateRequest(request.model, request);
  if (err) throw new Error(err);

  const id = genJobId();
  const job: Job = {
    id,
    model: request.model,
    request,
    status: 'running',
    results: [],
    expected: Math.max(1, request.numberResults ?? 1),
    startedAt: Date.now(),
  };
  setState((s) => ({ ...s, jobs: [...s.jobs, job], currentJobId: id }));

  let cancelled = false;
  cancelers.set(id, () => {
    if (cancelled) return;
    cancelled = true;
    void disconnectClient();
    patchJob(id, (j) =>
      isActiveStatus(j.status)
        ? { ...j, status: 'cancelled', finishedAt: Date.now() }
        : j,
    );
  });

  const promise = (async () => {
    try {
      const results = await generate(request, (partial) => {
        if (cancelled) return;
        patchJob(id, (j) => {
          const merged = mergeResults(j.results, partial as GenerationResult[]);
          const cost = sumCost(merged);
          return {
            ...j,
            results: merged,
            costUSD: cost ?? j.costUSD,
            status: 'partial',
          };
        });
      });
      if (cancelled) return;
      patchJob(id, (j) => {
        const merged = mergeResults(j.results, results);
        return {
          ...j,
          results: merged,
          costUSD: sumCost(merged) ?? j.costUSD,
          status: 'done',
          finishedAt: Date.now(),
        };
      });
    } catch (e) {
      if (cancelled) return;
      const msg = e instanceof Error ? e.message : String(e);
      patchJob(id, (j) => ({
        ...j,
        status: 'error',
        error: msg,
        finishedAt: Date.now(),
      }));
    } finally {
      cancelers.delete(id);
    }
  })();

  return { jobId: id, promise };
}

export function cancelJob(jobId: string): void {
  const c = cancelers.get(jobId);
  c?.();
}

export function clearJobs(): void {
  for (const id of cancelers.keys()) cancelJob(id);
  setState(() => ({ jobs: [], currentJobId: null }));
}
