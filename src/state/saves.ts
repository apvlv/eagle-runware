import { useSyncExternalStore } from 'react';

export interface SavedItem {
  resultKey: string;
  jobId: string;
  itemId: string;
  name: string;
  tags: string[];
  folderId: string | null;
  annotation: string;
  star: number;
  savedAt: number;
}

export interface SavesState {
  byKey: Record<string, SavedItem>;
}

let state: SavesState = { byKey: {} };
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

export function getSavesState(): SavesState {
  return state;
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function useSavesState(): SavesState {
  return useSyncExternalStore(subscribe, getSavesState, getSavesState);
}

export function recordSave(saved: SavedItem): void {
  state = {
    ...state,
    byKey: { ...state.byKey, [saved.resultKey]: saved },
  };
  emit();
}

export function patchSave(resultKey: string, patch: Partial<SavedItem>): void {
  const prev = state.byKey[resultKey];
  if (!prev) return;
  state = {
    ...state,
    byKey: { ...state.byKey, [resultKey]: { ...prev, ...patch } },
  };
  emit();
}

export function getSave(resultKey: string): SavedItem | undefined {
  return state.byKey[resultKey];
}
