import type { SessionAPI } from './types';

type Options = {
  fetch: typeof globalThis.fetch;
  hexUrl?: string;
  timeoutMs?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function createSessionAPI(options: Options): SessionAPI {
  function endpoint() {
    const origin = options.hexUrl?.trim().replace(/\/+$/, '');
    if (!origin) {
      throw new Error('Set EXPO_PUBLIC_HEX_URL to your hex voice address, then rebuild the app.');
    }
    return `${origin}/session`;
  }

  async function request(method: 'POST' | 'DELETE', body: unknown) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 35_000);
    try {
      const response = await options.fetch(endpoint(), {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (response.status === 204) return null;
      const text = await response.text();
      if (!response.ok) {
        let message = text.trim();
        try {
          const result: unknown = JSON.parse(text);
          const error = isRecord(result) ? result.error : undefined;
          if (isRecord(error) && typeof error.message === 'string') message = error.message;
        } catch {}
        throw new Error(message.slice(0, 300) || `hex answered HTTP ${response.status}.`);
      }
      return JSON.parse(text) as unknown;
    } catch (error) {
      if (
        controller.signal.aborted ||
        (error instanceof Error && ['AbortError', 'NetworkError'].includes(error.name)) ||
        (error instanceof Error &&
          ['Network request failed', 'Failed to fetch', 'fetch failed'].includes(error.message))
      ) {
        throw new Error('Cannot reach hex. Check that Tailscale is on, then try again.');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    prepare() {
      endpoint();
    },
    async create(sdp, voice) {
      const result = await request('POST', { sdp, voice });
      const session = isRecord(result) && isRecord(result.session) ? result.session : {};
      const transport = isRecord(result) && isRecord(result.transport) ? result.transport : {};
      if (typeof session.id !== 'string' || typeof transport.sdp !== 'string') {
        throw new Error('hex returned an invalid connection. Check EXPO_PUBLIC_HEX_URL.');
      }
      return { sdp: transport.sdp, sessionId: session.id };
    },
    async close(sessionId) {
      await request('DELETE', { sessionId });
    },
  };
}
