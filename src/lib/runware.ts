import { Runware, type IImage, type IError, type ITextToImage } from '@runware/sdk-js';
import {
  MODELS,
  validateRequest,
  type GptImage2Extras,
  type ModelId,
  type NanoBananaProExtras,
} from './models';
import { getSettings, subscribeSettings } from './settings';

export interface TestConnectionResult {
  ok: boolean;
  message: string;
}

const WS_URL = 'wss://ws-api.runware.ai/v1';
const DEFAULT_TIMEOUT_MS = 8000;

interface RunwareEnvelope {
  data?: Array<Record<string, unknown>>;
  errors?: Array<Record<string, unknown>>;
}

function extractErrorMessage(payload: RunwareEnvelope): string | null {
  if (!payload.errors || payload.errors.length === 0) return null;
  const first = payload.errors[0];
  const candidate =
    first?.message ?? first?.errorMessage ?? first?.error ?? first?.code ?? 'Authentication failed.';
  return typeof candidate === 'string' ? candidate : JSON.stringify(candidate);
}

export async function testRunwareConnection(
  apiKey: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<TestConnectionResult> {
  const trimmed = apiKey.trim();
  if (!trimmed) return { ok: false, message: 'API key is empty.' };

  return new Promise<TestConnectionResult>((resolve) => {
    let settled = false;
    let socket: WebSocket | null = null;

    const finish = (result: TestConnectionResult) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      try {
        socket?.close();
      } catch {
        /* ignore */
      }
      resolve(result);
    };

    const timer = window.setTimeout(() => {
      finish({ ok: false, message: `Timed out after ${timeoutMs}ms waiting for Runware response.` });
    }, timeoutMs);

    try {
      socket = new WebSocket(WS_URL);
    } catch (err) {
      finish({ ok: false, message: `Failed to open WebSocket: ${(err as Error).message}` });
      return;
    }

    socket.onopen = () => {
      try {
        socket?.send(JSON.stringify([{ taskType: 'authentication', apiKey: trimmed }]));
      } catch (err) {
        finish({ ok: false, message: `Failed to send auth task: ${(err as Error).message}` });
      }
    };

    socket.onmessage = (ev) => {
      try {
        const raw = typeof ev.data === 'string' ? ev.data : '';
        const parsed = JSON.parse(raw) as RunwareEnvelope;
        const errorMsg = extractErrorMessage(parsed);
        if (errorMsg) {
          finish({ ok: false, message: errorMsg });
          return;
        }
        if (Array.isArray(parsed.data)) {
          const authTask = parsed.data.find((t) => t?.taskType === 'authentication');
          if (authTask) {
            finish({ ok: true, message: 'Connection successful.' });
            return;
          }
          finish({ ok: true, message: 'Connection successful.' });
        }
      } catch (err) {
        finish({ ok: false, message: `Bad response from Runware: ${(err as Error).message}` });
      }
    };

    socket.onerror = () => {
      finish({ ok: false, message: 'WebSocket error connecting to Runware.' });
    };

    socket.onclose = (ev) => {
      if (settled) return;
      finish({
        ok: false,
        message: ev.reason
          ? `WebSocket closed before authentication: ${ev.reason} (code ${ev.code}).`
          : `WebSocket closed before authentication (code ${ev.code}).`,
      });
    };
  });
}

export type ImageRefKind = 'dataURI' | 'url' | 'uuid';
export interface ImageRef {
  kind: ImageRefKind;
  value: string;
}

export type OutputFormat = 'PNG' | 'JPG' | 'WEBP';

export interface GenerationRequestBase {
  positivePrompt: string;
  referenceImages?: ImageRef[];
  width?: number;
  height?: number;
  numberResults?: number;
  seed?: number;
  outputFormat?: OutputFormat;
}

export type GenerationRequest =
  | (GenerationRequestBase & { model: 'nano-banana-pro'; providerSettings?: NanoBananaProExtras })
  | (GenerationRequestBase & { model: 'gpt-image-2'; providerSettings?: GptImage2Extras });

export type GenerationResult = ITextToImage;

type RunwareClientInstance = InstanceType<typeof Runware>;

let _client: RunwareClientInstance | null = null;
let _clientApiKey: string | null = null;

// Maps a reference-image value (data URI or raw base64) to the imageUUID
// returned by a prior `imageUpload`. Cleared when the client is reset.
const refUploadCache = new Map<string, string>();

subscribeSettings((s) => {
  if (_client && s.apiKey !== _clientApiKey) {
    try {
      _client.disconnect?.();
    } catch {
      /* ignore */
    }
    _client = null;
    _clientApiKey = null;
    refUploadCache.clear();
  }
});

export function getClient(): RunwareClientInstance {
  const { apiKey } = getSettings();
  const trimmed = apiKey.trim();
  if (!trimmed) {
    throw { error: { code: 'invalidApiKey', message: 'Runware API key is not set.' } };
  }
  if (_client && _clientApiKey === trimmed) return _client;
  if (_client) {
    try {
      _client.disconnect?.();
    } catch {
      /* ignore */
    }
  }
  // The SDK's default per-request timeout is 60s. Provider-routed models
  // (Nano Banana Pro, GPT Image 2) regularly take 60–180s per result, and
  // multi-result jobs with references can run several minutes. Use a 10-minute
  // ceiling so the SDK keeps waiting for partial images instead of throwing
  // "Response could not be received from server" while the job is still
  // generating server-side.
  _client = new Runware({ apiKey: trimmed, timeoutDuration: 10 * 60 * 1000 });
  _clientApiKey = trimmed;
  return _client;
}

export async function disconnectClient(): Promise<void> {
  const client = _client;
  _client = null;
  _clientApiKey = null;
  refUploadCache.clear();
  if (!client) return;
  try {
    await client.disconnect?.();
  } catch (err) {
    console.warn('[Runware] disconnect failed:', err);
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function stripDataUriPrefix(value: string): string {
  return value.replace(/^data:[^;]+;base64,/, '');
}

async function uploadReferenceImage(
  client: RunwareClientInstance,
  ref: ImageRef,
): Promise<string> {
  // URLs and pre-existing UUIDs can be passed through unchanged.
  if (ref.kind === 'url' || ref.kind === 'uuid') return ref.value;
  if (/^https?:\/\//i.test(ref.value)) return ref.value;

  const cached = refUploadCache.get(ref.value);
  if (cached) return cached;

  const uploadFn = (client as unknown as {
    imageUpload?: (p: { image: string }) => Promise<{
      imageUUID?: unknown;
      imageURL?: unknown;
    }>;
  }).imageUpload;
  if (typeof uploadFn !== 'function') {
    throw new Error('Runware SDK is missing imageUpload — cannot upload reference image.');
  }

  // Runware's imageUpload task wants raw base64, not a data URI with the
  // `data:image/...;base64,` prefix.
  const payload = stripDataUriPrefix(ref.value);
  const result = await uploadFn.call(client, { image: payload });
  console.log('[Runware] imageUpload response:', result);

  // Prefer the public URL — the typed `imageUUID` field is sometimes a numeric
  // internal id that Runware does not accept as a referenceImages value.
  // Fall back to imageUUID only when it looks like a real UUID string.
  let value = '';
  if (typeof result?.imageURL === 'string' && /^https?:\/\//i.test(result.imageURL)) {
    value = result.imageURL;
  } else if (typeof result?.imageUUID === 'string' && UUID_RE.test(result.imageUUID)) {
    value = result.imageUUID;
  } else if (typeof result?.imageUUID === 'string' && result.imageUUID) {
    value = result.imageUUID;
  }
  if (!value) {
    throw new Error(
      `Reference image upload returned no usable URL or UUID (got ${JSON.stringify(result)}).`,
    );
  }
  refUploadCache.set(ref.value, value);
  return value;
}

const DEFAULT_SDK_RETRY = 2;

function buildSdkPayload(req: GenerationRequest): Record<string, unknown> {
  const spec = MODELS[req.model];
  const payload: Record<string, unknown> = {
    model: spec.air,
    positivePrompt: req.positivePrompt,
    numberResults: req.numberResults ?? 1,
    outputType: 'URL',
    includeCost: true,
    retry: DEFAULT_SDK_RETRY,
  };

  if (req.width != null) payload.width = req.width;
  if (req.height != null) payload.height = req.height;
  if (req.seed != null) payload.seed = req.seed;
  if (req.outputFormat) payload.outputFormat = req.outputFormat;
  // referenceImages are uploaded separately in generate() to keep the inference
  // payload small enough for Runware's WebSocket; populated after upload.

  if (req.model === 'nano-banana-pro' && req.providerSettings) {
    const ps = req.providerSettings;
    const google: Record<string, unknown> = {};
    if (ps.safetyTolerance !== undefined) google.safetyTolerance = ps.safetyTolerance;
    if (ps.webSearch !== undefined) google.webSearch = ps.webSearch;
    if (Object.keys(google).length > 0) payload.providerSettings = { google };

    const settings: Record<string, unknown> = {};
    if (ps.temperature !== undefined) settings.temperature = ps.temperature;
    if (ps.topP !== undefined) settings.topP = ps.topP;
    if (ps.systemPrompt !== undefined) settings.systemPrompt = ps.systemPrompt;
    if (Object.keys(settings).length > 0) payload.settings = settings;
  } else if (req.model === 'gpt-image-2' && req.providerSettings) {
    const ps = req.providerSettings;
    const openai: Record<string, unknown> = {};
    if (ps.quality !== undefined) openai.quality = ps.quality;
    if (ps.moderation !== undefined) openai.moderation = ps.moderation;
    if (Object.keys(openai).length > 0) payload.providerSettings = { openai };
  }

  return payload;
}

export async function generate(
  req: GenerationRequest,
  onPartial?: (images: GenerationResult[]) => void,
): Promise<GenerationResult[]> {
  const error = validateRequest(req.model as ModelId, req);
  if (error) throw new Error(error);

  const payload = buildSdkPayload(req);
  if (onPartial) {
    payload.onPartialImages = (images: IImage[], err?: IError) => {
      if (err) {
        console.warn('[Runware] onPartialImages error:', err);
        return;
      }
      onPartial(images as GenerationResult[]);
    };
  }

  const client = getClient();

  if (req.referenceImages && req.referenceImages.length > 0) {
    try {
      const uuids = await Promise.all(
        req.referenceImages.map((ref) => uploadReferenceImage(client, ref)),
      );
      payload.referenceImages = uuids;
    } catch (err) {
      console.warn('[Runware] reference image upload failed:', err);
      throw err;
    }
  }

  // The SDK's typed signature requires IRequestImage, but providerSettings has a
  // narrower union than what we send. The interface allows extra keys, so cast.
  const result = await client.requestImages(payload as never);
  return result ?? [];
}
