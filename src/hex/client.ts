import * as z from 'zod/mini';

// hex heard the request and said no, so sending the same thing again gets the same answer.
export class Refused extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// A file on this phone sent as a request's body, streamed from where it lies.
export type SendFile = (
  url: string,
  file: { uri: string; type: string },
  init: { headers: Record<string, string>; signal: AbortSignal },
) => Promise<{ status: number; text: string }>;

export interface Config {
  url?: string;
  token?: string;
  fetch: typeof globalThis.fetch;
  sendFile?: SendFile;
}

export type Client = ReturnType<typeof createClient>;

interface Options {
  method?: 'GET' | 'POST' | 'DELETE';
  body?: unknown;
  after?: number;
  signal?: AbortSignal;
  timeout?: number;
}

// How long to give hex, which can take a minute to answer when its machine is busy: a read, a
// write, and a watch, which hex holds open until something changes before it answers.
const READ = 90_000;
const WRITE = 60_000;
const WAIT = 120_000;

// A minute of video over a slow link.
const UPLOAD = 300_000;
const UNREACHABLE = new Set(['Network request failed', 'Failed to fetch', 'fetch failed']);

// The one way this app talks to hex: the address and token are read once, every request has a
// deadline, and every answer is parsed before anything sees it.
export const createClient = ({ url, token, fetch, sendFile }: Config) => {
  const origin = url?.trim().replace(/\/+$/u, '');

  const auth: Record<string, string> =
    token === undefined || token === '' ? {} : { Authorization: `Bearer ${token}` };

  // Reaches hex at `path` within `timeout`, through `go`, and reads its answer.
  const reach = async (
    path: string,
    { signal, timeout }: Pick<Options, 'signal' | 'timeout'>,
    go: (href: string, signal: AbortSignal) => Promise<{ status: number; text: string }>,
  ): Promise<string> => {
    if (origin === undefined || origin === '') {
      throw new Error('Set EXPO_PUBLIC_HEX_URL to your hex voice address, then rebuild the app.');
    }

    const controller = new AbortController();

    const abort = () => {
      controller.abort();
    };

    signal?.addEventListener('abort', abort);
    const deadline = setTimeout(abort, timeout);

    try {
      const { status, text } = await go(`${origin}${path}`, controller.signal);

      if (status < 200 || status >= 300) {
        throw refusal(status, text);
      }

      return text;
    } catch (error) {
      if (signal?.aborted === true) {
        throw error;
      }

      if (
        controller.signal.aborted ||
        (error instanceof Error &&
          (['AbortError', 'NetworkError'].includes(error.name) || UNREACHABLE.has(error.message)))
      ) {
        throw new Error('Cannot reach hex. Check that Tailscale is on, then try again.', {
          cause: error,
        });
      }

      throw error;
    } finally {
      clearTimeout(deadline);
      signal?.removeEventListener('abort', abort);
    }
  };

  const call = async (path: string, { method = 'GET', body, after, ...options }: Options) =>
    await reach(
      after === undefined ? path : `${path}?after=${after}`,
      options,
      async (href, signal) => {
        const response = await fetch(href, {
          method,
          headers: body === undefined ? auth : { ...auth, 'Content-Type': 'application/json' },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal,
        });

        return {
          status: response.status,
          text: response.status === 204 ? '' : await response.text(),
        };
      },
    );

  return {
    request: async <S extends z.ZodMiniType>(
      path: string,
      schema: S,
      options: Options = {},
    ): Promise<z.output<S>> =>
      read(
        path,
        schema,
        await call(path, {
          ...options,
          timeout: options.timeout ?? (options.after === undefined ? READ : WAIT),
        }),
      ),
    // A file on this phone as the request's body, under its own Content-Type.
    upload: async <S extends z.ZodMiniType>(
      path: string,
      schema: S,
      file: { uri: string; type: string },
    ): Promise<z.output<S>> => {
      if (!sendFile) {
        throw new Error('This app can’t send files from here.');
      }

      const headers = { ...auth, 'Content-Type': file.type };

      return read(
        path,
        schema,
        await reach(
          path,
          { timeout: UPLOAD },
          async (href, signal) => await sendFile(href, file, { headers, signal }),
        ),
      );
    },
    // A file of hex's for a native view to read itself: its address and the token it takes.
    source: (path: string) => ({ uri: `${origin}${path}`, headers: auth }),
    send: async (path: string, options: Omit<Options, 'after' | 'signal'> = {}) => {
      await call(path, { method: 'POST', ...options, timeout: options.timeout ?? WRITE });
    },
  };
};

const read = <S extends z.ZodMiniType>(path: string, schema: S, text: string): z.output<S> => {
  const parsed = schema.safeParse(text ? JSON.parse(text) : undefined);

  if (parsed.success) {
    return parsed.data;
  }

  const where = parsed.error.issues[0]?.path.join('.');
  throw new Error(`hex sent ${path} in a shape this app can’t read${where ? ` (${where})` : ''}.`);
};

const Said = z.object({ error: z.object({ message: z.string() }) });

const wordsIn = (text: string) => {
  try {
    return Said.parse(JSON.parse(text)).error.message;
  } catch {
    return text.trim();
  }
};

// hex's own words, or OpenAI's error message it passed on. A 4xx is hex turning the request down.
const refusal = (status: number, text: string) => {
  const said = wordsIn(text).slice(0, 300) || `hex answered HTTP ${status}.`;
  const message = said[0].toUpperCase() + said.slice(1);

  return status < 500 ? new Refused(message, status) : new Error(message);
};
