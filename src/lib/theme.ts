import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';
export type ThemeSource = 'eagle' | 'system';

const LIGHT_EAGLE_THEMES = new Set(['LIGHT', 'LIGHTGRAY']);

function eagleToTheme(name: string | undefined): Theme | null {
  if (!name) return null;
  return LIGHT_EAGLE_THEMES.has(name) ? 'light' : 'dark';
}

function systemTheme(): Theme {
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.dataset.theme = theme;
}

interface ThemeState {
  theme: Theme;
  source: ThemeSource;
}

let state: ThemeState = { theme: systemTheme(), source: 'system' };
let initialized = false;
const listeners = new Set<(s: ThemeState) => void>();

function emit(): void {
  for (const l of listeners) l(state);
}

function setState(next: ThemeState): void {
  if (next.theme === state.theme && next.source === state.source) return;
  state = next;
  applyTheme(state.theme);
  emit();
}

export function initTheme(): void {
  if (initialized) return;
  initialized = true;

  applyTheme(state.theme);

  if (typeof eagle !== 'undefined' && eagle) {
    const initial = eagleToTheme(eagle.app?.theme);
    if (initial) {
      state = { theme: initial, source: 'eagle' };
      applyTheme(state.theme);
    }
    eagle.onThemeChanged?.((name) => {
      const next = eagleToTheme(name);
      if (next) setState({ theme: next, source: 'eagle' });
    });
  }

  if (typeof window !== 'undefined' && window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const handler = (e: MediaQueryListEvent) => {
      if (state.source !== 'system') return;
      setState({ theme: e.matches ? 'light' : 'dark', source: 'system' });
    };
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', handler);
    } else if (typeof mq.addListener === 'function') {
      mq.addListener(handler);
    }
  }
}

export function getTheme(): Theme {
  return state.theme;
}

export function subscribeTheme(listener: (s: ThemeState) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useTheme(): ThemeState {
  const [s, setS] = useState<ThemeState>(state);
  useEffect(() => subscribeTheme(setS), []);
  return s;
}
