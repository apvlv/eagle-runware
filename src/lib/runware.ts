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
          // Any other data response means the WS is open and the key wasn't rejected.
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
