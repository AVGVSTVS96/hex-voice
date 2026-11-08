import * as z from 'zod/mini';

export const MediaKind = z.enum(['photo', 'video']);

export type MediaKind = z.infer<typeof MediaKind>;

export const MediaId = z.string().brand<'MediaId'>();

export type MediaId = z.infer<typeof MediaId>;

// A photo or clip hex keeps, by the id it gave it.
export const Shared = z.object({ id: MediaId, kind: MediaKind });

export type Shared = z.infer<typeof Shared>;

// A photo or clip on this phone, shot or picked, before it goes to hex. `type` is its file's
// Content-Type.
export interface Picked {
  uri: string;
  kind: MediaKind;
  type: string;
}

// What a thumbnail draws: one on this phone, or one hex keeps.
export type Shown = Picked | Shared;

// The most picked at once, as ChatGPT's picker allows, and the longest clip the camera records.
export const MOST = 4;
export const CLIP_SECONDS = 60;

// How a turn that's only media reads where its words would: "Photo", "2 videos", "2 photos and a video".
export const mediaWords = (media: readonly { kind: MediaKind }[]) => {
  const words = MediaKind.options
    .flatMap((kind) => {
      const count = media.filter((one) => one.kind === kind).length;

      if (count > 1) {
        return [`${count} ${kind}s`];
      }

      return count === 1 ? [media.length > 1 ? `a ${kind}` : kind] : [];
    })
    .join(' and ');

  return words.charAt(0).toUpperCase() + words.slice(1);
};
