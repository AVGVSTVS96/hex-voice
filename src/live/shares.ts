import type { CallId } from "./calls";
import type { MediaId, Picked, Shared, Shown } from "./media";
import type { TranscriptEntry } from "./types";

export interface Sent {
  call: CallId;
  batch: string;
  picked: Picked;
  id?: MediaId;
  entry: TranscriptEntry & { media: Shown };
}

export interface ShareAPI {
  upload: (picked: Picked) => Promise<Shared>;
  media: (call: CallId, ids: MediaId[]) => Promise<void>;
}

export interface Outcome {
  shared: (Shared | undefined)[];
  error?: unknown;
}

export const batchOf = (call: CallId, at: number, picked: Picked[], key: string): Sent[] => {
  const batch = `${call} ${at} ${key}`;

  return picked.map((media, i) => ({
    call,
    batch,
    picked: media,
    entry: { id: `sent ${batch} ${i}`, role: "user", text: "", startMs: at, media, sending: true },
  }));
};

export const deliver = async (call: CallId, batch: Sent[], api: ShareAPI): Promise<Outcome> => {
  const uploads = await Promise.allSettled(
    batch.map(async ({ id, picked }) =>
      id ? { id, kind: picked.kind } : await api.upload(picked),
    ),
  );

  const shared = uploads.map((one) => (one.status === "fulfilled" ? one.value : undefined));
  const lost = uploads.find((one) => one.status === "rejected");

  if (lost) {
    return { shared, error: lost.reason };
  }

  try {
    await api.media(
      call,
      shared.flatMap((one) => (one === undefined ? [] : [one.id])),
    );

    return { shared };
  } catch (error) {
    return { shared, error };
  }
};

export const settle = (sent: Sent[], batch: Sent[], { shared, error }: Outcome): Sent[] => {
  const why = error instanceof Error ? error.message : "Not sent";
  const failed = error === undefined ? undefined : why;

  return sent.map((one) => {
    const i = batch.findIndex(({ entry }) => entry.id === one.entry.id);

    if (i === -1) {
      return one;
    }

    const kept = shared[i];
    const still = kept && one.picked.kind === "video" ? { media: kept } : {};

    return {
      ...one,
      id: kept?.id ?? one.id,
      entry: { ...one.entry, ...still, sending: false, failed },
    };
  });
};

export const retrying = (sent: Sent[], entry: string): Sent[] => {
  const batch = sent.find((one) => one.entry.id === entry)?.batch;

  return sent.flatMap((one) =>
    one.batch === batch && (one.entry.failed ?? "") !== ""
      ? [{ ...one, entry: { ...one.entry, sending: true, failed: undefined } }]
      : [],
  );
};
