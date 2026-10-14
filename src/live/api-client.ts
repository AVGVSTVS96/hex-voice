import type { AskList, AsksAPI, Check } from './asks';
import type { CallRecord, CallsAPI, CallSummary } from './calls';
import type { Task, TaskCounts, TaskList, TasksAPI } from './tasks';
import type { SessionAPI } from './types';

type Options = {
  fetch: typeof globalThis.fetch;
  hexUrl?: string;
  token?: string;
  timeoutMs?: number;
};

type Request = {
  method: 'GET' | 'POST' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  timeoutMs?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function createHexClient(options: Options) {
  function origin() {
    const origin = options.hexUrl?.trim().replace(/\/+$/, '');
    if (!origin) {
      throw new Error('Set EXPO_PUBLIC_HEX_URL to your hex voice address, then rebuild the app.');
    }
    return origin;
  }

  async function request(path: string, { method, body, signal, timeoutMs }: Request) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort);
    const timeout = setTimeout(abort, timeoutMs ?? options.timeoutMs ?? 35_000);
    try {
      const response = await options.fetch(`${origin()}${path}`, {
        method,
        headers: {
          ...(options.token && { Authorization: `Bearer ${options.token}` }),
          ...(body !== undefined && { 'Content-Type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
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
      if (signal?.aborted) throw error;
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
      signal?.removeEventListener('abort', abort);
    }
  }

  return { origin, request };
}

export function createSessionAPI(options: Options): SessionAPI {
  const hex = createHexClient(options);
  return {
    prepare() {
      hex.origin();
    },
    async create(sdp, voice, about) {
      const result = await hex.request('/session', {
        method: 'POST',
        body: { sdp, voice, from: 'app', ...(about && { about }) },
      });
      const session = isRecord(result) && isRecord(result.session) ? result.session : {};
      const transport = isRecord(result) && isRecord(result.transport) ? result.transport : {};
      if (typeof session.id !== 'string' || typeof transport.sdp !== 'string') {
        throw new Error('hex returned an invalid connection. Check EXPO_PUBLIC_HEX_URL.');
      }
      return { sdp: transport.sdp, sessionId: session.id };
    },
    async close(sessionId) {
      await hex.request('/session', { method: 'DELETE', body: { sessionId } });
    },
    async mark(sessionId, kind) {
      await hex.request(`/calls/${encodeURIComponent(sessionId)}/moments`, {
        method: 'POST',
        body: { kind },
        timeoutMs: 10_000,
      });
    },
  };
}

export function createCallsAPI(options: Options): CallsAPI {
  const hex = createHexClient(options);
  return {
    async list(after, signal) {
      const result = await hex.request(after === undefined ? '/calls' : `/calls?after=${after}`, {
        method: 'GET',
        signal,
        timeoutMs: after === undefined ? undefined : 40_000,
      });
      if (!isRecord(result) || typeof result.version !== 'number' || !Array.isArray(result.calls))
        throw new Error('hex sent a call list this app can’t read.');
      return {
        version: result.version,
        live: typeof result.live === 'string' ? result.live : undefined,
        calls: result.calls as CallSummary[],
      };
    },
    async get(id, after, signal) {
      const path = `/calls/${encodeURIComponent(id)}`;
      return (await hex.request(after === undefined ? path : `${path}?after=${after}`, {
        method: 'GET',
        signal,
        timeoutMs: after === undefined ? undefined : 40_000,
      })) as CallRecord;
    },
    async remove(id) {
      await hex.request(`/calls/${encodeURIComponent(id)}`, { method: 'DELETE' });
    },
  };
}

export function createTasksAPI(options: Options): TasksAPI {
  const hex = createHexClient(options);
  const watch = async (path: string, after?: number, signal?: AbortSignal) => {
    const result = await hex.request(after === undefined ? path : `${path}?after=${after}`, {
      method: 'GET',
      signal,
      timeoutMs: after === undefined ? undefined : 40_000,
    });
    if (!isRecord(result) || typeof result.version !== 'number')
      throw new Error('hex sent tasks this app can’t read.');
    return result;
  };
  return {
    async list(after, signal) {
      const result = await watch('/tasks', after, signal);
      if (!Array.isArray(result.tasks)) throw new Error('hex sent tasks this app can’t read.');
      return result as TaskList;
    },
    async counts(after, signal) {
      return (await watch('/tasks/summary', after, signal)) as TaskCounts;
    },
    async get(id) {
      return (await hex.request(`/tasks/${encodeURIComponent(id)}`, { method: 'GET' })) as Task;
    },
    async talk(id) {
      await hex.request(`/tasks/${encodeURIComponent(id)}/talk`, {
        method: 'POST',
        timeoutMs: 10_000,
      });
    },
  };
}

export function createAsksAPI(options: Options): AsksAPI {
  const hex = createHexClient(options);
  const post = async (path: string, body?: unknown) => {
    await hex.request(path, { method: 'POST', body, timeoutMs: 10_000 });
  };
  return {
    async list(after, signal) {
      const result = await hex.request(after === undefined ? '/asks' : `/asks?after=${after}`, {
        method: 'GET',
        signal,
        timeoutMs: after === undefined ? undefined : 40_000,
      });
      if (!isRecord(result) || typeof result.version !== 'number' || !Array.isArray(result.asks))
        throw new Error('hex sent asks this app can’t read.');
      return result as AskList;
    },
    async check() {
      return (await hex.request('/asks/check', { method: 'GET' })) as Check;
    },
    answer: (id, label) => post(`/asks/${encodeURIComponent(id)}/answer`, { label }),
    undo: (id) => post(`/asks/${encodeURIComponent(id)}/undo`),
    act: (id) => post(`/stuck/${encodeURIComponent(id)}/act`),
    read: (id) => post(`/fresh/${encodeURIComponent(id)}/read`),
    talk: () => post('/asks/talk'),
  };
}
