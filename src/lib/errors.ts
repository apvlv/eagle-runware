export type ErrorBucket =
  | 'auth'
  | 'validation'
  | 'provider'
  | 'network'
  | 'quota'
  | 'timeout'
  | 'cancelled'
  | 'unknown';

export interface MappedError {
  bucket: ErrorBucket;
  title: string;
  message: string;
  parameter?: string;
  code?: string;
  retryable: boolean;
  retryAfterMs?: number;
}

interface RawFields {
  code: string;
  message: string;
  parameter?: string;
  type?: string;
}

function asObj(x: unknown): Record<string, unknown> | null {
  return x && typeof x === 'object' ? (x as Record<string, unknown>) : null;
}

function strField(o: Record<string, unknown> | null, key: string): string | undefined {
  if (!o) return undefined;
  const v = o[key];
  return typeof v === 'string' ? v : undefined;
}

function extractFields(err: unknown): RawFields {
  if (err == null) return { code: '', message: 'Unknown error.' };
  if (typeof err === 'string') return { code: '', message: err };

  if (err instanceof Error) {
    const code = (err as Error & { code?: unknown }).code;
    return {
      code: typeof code === 'string' ? code : '',
      message: err.message || 'Request failed.',
    };
  }

  const outer = asObj(err);
  const inner = asObj(outer?.error);
  const errors = Array.isArray(outer?.errors) ? (outer!.errors as unknown[]) : null;
  const firstErr = errors && errors.length > 0 ? asObj(errors[0]) : null;
  const src = inner ?? firstErr ?? outer;

  return {
    code: strField(src, 'code') ?? '',
    message:
      strField(src, 'message') ??
      strField(src, 'errorMessage') ??
      strField(src, 'error') ??
      'Request failed.',
    parameter: strField(src, 'parameter'),
    type: strField(src, 'type'),
  };
}

function lc(s: string): string {
  return s.toLowerCase();
}

function matches(haystack: string, needles: readonly string[]): boolean {
  const h = lc(haystack);
  return needles.some((n) => h.includes(n));
}

const AUTH_CODES: readonly string[] = [
  'invalidapikey',
  'invalid_api_key',
  'unauthorized',
  'autherror',
  'authenticationfailed',
  'authentication_failed',
  'forbidden',
];

const QUOTA_CODES: readonly string[] = [
  'ratelimit',
  'rate_limit',
  'rate_limit_exceeded',
  'toomanyrequests',
  'too_many_requests',
  'quotaexceeded',
  'quota_exceeded',
  'insufficientcredits',
  'insufficient_credits',
  'creditsexceeded',
  'credits_exceeded',
  'billingerror',
  'paymentrequired',
];

const PROVIDER_CODES: readonly string[] = [
  'contentpolicyviolation',
  'content_policy',
  'safetyviolation',
  'safety_violation',
  'moderationblocked',
  'moderation_blocked',
  'flaggedcontent',
  'flagged_content',
  'providerblocked',
  'provider_blocked',
];

const VALIDATION_CODES: readonly string[] = [
  'invalidparameter',
  'invalid_parameter',
  'missingparameter',
  'missing_parameter',
  'badrequest',
  'bad_request',
  'invalidrequest',
  'invalid_request',
  'validationerror',
  'validation_error',
];

const NETWORK_HINTS: readonly string[] = [
  'websocket',
  'ehostdown',
  'enotfound',
  'econnreset',
  'econnrefused',
  'network',
  'fetch failed',
  'failed to fetch',
  'socket',
  'connection',
];

const TIMEOUT_HINTS: readonly string[] = [
  'timed out',
  'timeout',
  'response could not be received',
];

const TITLES: Record<ErrorBucket, string> = {
  auth: 'Invalid API key',
  validation: 'Request is invalid',
  provider: 'Provider rejected the request',
  network: 'Network error',
  quota: 'Rate limit or quota reached',
  timeout: 'Request timed out',
  cancelled: 'Cancelled',
  unknown: 'Generation failed',
};

function parseRetryAfterMs(haystack: string): number | undefined {
  const m = /retry[- ]?after[^0-9]*(\d+(?:\.\d+)?)\s*(ms|s|sec|seconds|min|minutes)?/i.exec(haystack);
  if (!m) return undefined;
  const value = Number(m[1]);
  if (!Number.isFinite(value)) return undefined;
  const unit = (m[2] ?? 's').toLowerCase();
  if (unit === 'ms') return value;
  if (unit.startsWith('min')) return value * 60_000;
  return value * 1000;
}

export function mapRunwareError(err: unknown): MappedError {
  if (err && typeof err === 'object' && (err as { __bucket?: ErrorBucket }).__bucket) {
    return err as unknown as MappedError;
  }

  const { code, message, parameter, type } = extractFields(err);
  const blob = `${code} ${type ?? ''} ${message}`;

  let bucket: ErrorBucket = 'unknown';
  if (matches(blob, AUTH_CODES) || /\b401\b/.test(blob)) {
    bucket = 'auth';
  } else if (matches(blob, QUOTA_CODES) || /\b429\b/.test(blob)) {
    bucket = 'quota';
  } else if (matches(blob, PROVIDER_CODES) || matches(blob, ['safety', 'moderation', 'nsfw'])) {
    bucket = 'provider';
  } else if (matches(blob, VALIDATION_CODES) || /\b4\d\d\b/.test(blob)) {
    bucket = 'validation';
  } else if (matches(blob, TIMEOUT_HINTS)) {
    bucket = 'timeout';
  } else if (matches(blob, NETWORK_HINTS)) {
    bucket = 'network';
  }

  const retryAfterMs = bucket === 'quota' ? parseRetryAfterMs(blob) : undefined;
  const retryable = bucket === 'network' || bucket === 'timeout' || bucket === 'quota' || bucket === 'unknown';

  return {
    bucket,
    title: TITLES[bucket],
    message: message || TITLES[bucket],
    parameter,
    code: code || undefined,
    retryable,
    retryAfterMs,
  };
}

export function cancelledError(): MappedError {
  return {
    bucket: 'cancelled',
    title: 'Cancelled',
    message: 'Cancelled by user.',
    retryable: true,
  };
}
