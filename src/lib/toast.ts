import { useEffect, useState } from 'react';

export type ToastVariant = 'info' | 'success' | 'error' | 'warn';

export interface Toast {
  id: string;
  variant: ToastVariant;
  message: string;
  description?: string;
  durationMs: number;
  createdAt: number;
}

export interface ToastInput {
  variant?: ToastVariant;
  message: string;
  description?: string;
  durationMs?: number;
}

const DEFAULT_DURATION: Record<ToastVariant, number> = {
  info: 3500,
  success: 3500,
  warn: 5000,
  error: 6500,
};

let toasts: Toast[] = [];
const listeners = new Set<(t: Toast[]) => void>();
const timers = new Map<string, number>();

function emit(): void {
  for (const l of listeners) l(toasts);
}

function genId(): string {
  return `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function addToast(input: ToastInput): string {
  const variant = input.variant ?? 'info';
  const id = genId();
  const t: Toast = {
    id,
    variant,
    message: input.message,
    description: input.description,
    durationMs: input.durationMs ?? DEFAULT_DURATION[variant],
    createdAt: Date.now(),
  };
  toasts = [...toasts, t];
  emit();
  if (t.durationMs > 0 && typeof window !== 'undefined') {
    const handle = window.setTimeout(() => removeToast(id), t.durationMs);
    timers.set(id, handle);
  }
  return id;
}

export function removeToast(id: string): void {
  const handle = timers.get(id);
  if (handle != null) {
    window.clearTimeout(handle);
    timers.delete(id);
  }
  const before = toasts.length;
  toasts = toasts.filter((t) => t.id !== id);
  if (toasts.length !== before) emit();
}

export function clearToasts(): void {
  for (const handle of timers.values()) window.clearTimeout(handle);
  timers.clear();
  toasts = [];
  emit();
}

export const toast = {
  info: (message: string, opts?: Omit<ToastInput, 'message' | 'variant'>) =>
    addToast({ ...opts, message, variant: 'info' }),
  success: (message: string, opts?: Omit<ToastInput, 'message' | 'variant'>) =>
    addToast({ ...opts, message, variant: 'success' }),
  error: (message: string, opts?: Omit<ToastInput, 'message' | 'variant'>) =>
    addToast({ ...opts, message, variant: 'error' }),
  warn: (message: string, opts?: Omit<ToastInput, 'message' | 'variant'>) =>
    addToast({ ...opts, message, variant: 'warn' }),
  dismiss: removeToast,
  clear: clearToasts,
};

export function useToasts(): Toast[] {
  const [state, setState] = useState<Toast[]>(toasts);
  useEffect(() => {
    listeners.add(setState);
    return () => {
      listeners.delete(setState);
    };
  }, []);
  return state;
}
