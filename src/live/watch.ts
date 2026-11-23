const RETRY = 2000;

export interface Following {
  signal: AbortSignal;
  version: { current: number | undefined };
  retry?: number;
}

export const follow = async <T extends { version?: number | undefined }>(
  ask: (after: number | undefined, signal: AbortSignal) => Promise<T>,
  heard: (answer: T) => void,
  lost: () => void,
  { signal, version, retry = RETRY }: Following,
) => {
  while (!signal.aborted) {
    try {
      // oxlint-disable-next-line no-await-in-loop -- a long poll asks again only once its last question is answered
      const answer = await ask(version.current, signal);

      if (signal.aborted) {
        return;
      }

      heard(answer);

      if (answer.version === undefined) {
        return;
      }

      version.current = answer.version;
    } catch {
      if (signal.aborted) {
        return;
      }

      lost();
      version.current = undefined;
      // oxlint-disable-next-line no-await-in-loop, promise/avoid-new -- waits before asking again; React Native's setTimeout has no promise form
      await new Promise<void>((resolve) => {
        setTimeout(resolve, retry);
      });
    }
  }
};
