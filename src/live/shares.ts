import type { CallId } from './calls';
import type { MediaId, Picked, Shared, Shown } from './media';
import type { TranscriptEntry } from './types';

// A photo or clip you sent a call from here (`picked`), as its words show it until hex's record has
// it: going, or why it didn't. What's sent together shares a `batch` and goes again together, and
// `id` is hex's for it once it went up.
export interface Sent {
  call: CallId;
  batch: string;
  picked: Picked;
  id?: MediaId;
  entry: TranscriptEntry & { media: Shown };
}

// What hex is asked: keep a file, and give the call the ones it keeps.
export interface ShareAPI {
  upload: (picked: Picked) => Promise<Shared>;
  media: (call: CallId, ids: MediaId[]) => Promise<void>;
}

// How a batch went: what each item went up as, and the first thing that went wrong.
export interface Outcome {
  shared: (Shared | undefined)[];
  error?: unknown;
}

// What you picked, sent together `at` that far into the call, each going.
export const batchOf = (call: CallId, at: number, picked: Picked[], key: string): Sent[] => {
  const batch = `${call} ${at} ${key}`;

  return picked.map((media, i) => ({
    call,
    batch,
    picked: media,
    entry: { id: `sent ${batch} ${i}`, role: 'user', text: '', startMs: at, media, sending: true },
  }));
};

// Each item goes up on its own, then the batch goes to the call in one request, so hex hears of
// them once. What already went up isn't sent again.
export const deliver = async (call: CallId, batch: Sent[], api: ShareAPI): Promise<Outcome> => {
  const uploads = await Promise.allSettled(
    batch.map(async ({ id, picked }) =>
      id ? await Promise.resolve({ id, kind: picked.kind }) : await api.upload(picked),
    ),
  );

  const shared = uploads.map((one) => (one.status === 'fulfilled' ? one.value : undefined));
  const lost = uploads.find((one) => one.status === 'rejected');

  if (lost) {
    return { shared, error: lost.reason };
  }

  try {
    await api.media(
      call,
      shared.map((one) => one!.id),
    );

    return { shared };
  } catch (error) {
    return { shared, error };
  }
};

// The batch as it went: each item keeps hex's id once it went up, and a clip shows hex's still in
// place of its file, which no image view draws. Every item says why when the batch didn't go.
export const settle = (sent: Sent[], batch: Sent[], { shared, error }: Outcome): Sent[] => {
  const why = error instanceof Error ? error.message : 'Not sent';
  const failed = error === undefined ? undefined : why;

  return sent.map((one) => {
    const i = batch.findIndex(({ entry }) => entry.id === one.entry.id);

    if (i === -1) {
      return one;
    }

    const kept = shared[i];
    const still = kept && one.picked.kind === 'video' ? { media: kept } : {};

    return {
      ...one,
      id: kept?.id ?? one.id,
      entry: { ...one.entry, ...still, sending: false, failed },
    };
  });
};

// What a tap on `entry` sends again: whatever of its batch didn't go, going.
export const retrying = (sent: Sent[], entry: string): Sent[] => {
  const batch = sent.find((one) => one.entry.id === entry)?.batch;

  return sent.flatMap((one) =>
    one.batch === batch && (one.entry.failed ?? '') !== ''
      ? [{ ...one, entry: { ...one.entry, sending: true, failed: undefined } }]
      : [],
  );
};
