import * as z from "zod/mini";

export const MediaKind = z.enum(["photo", "video"]);

export type MediaKind = z.infer<typeof MediaKind>;

export const MediaId = z.string().brand<"MediaId">();

export type MediaId = z.infer<typeof MediaId>;

export const Shared = z.object({ id: MediaId, kind: MediaKind });

export type Shared = z.infer<typeof Shared>;

export interface Picked {
  uri: string;
  kind: MediaKind;
  type: string;
}

export type Shown = Picked | Shared;

export const MOST = 4;
export const CLIP_SECONDS = 60;

export const mediaWords = (media: readonly { kind: MediaKind }[]) => {
  const words = MediaKind.options
    .flatMap((kind) => {
      const count = media.filter((one) => one.kind === kind).length;

      if (count > 1) {
        return [`${count} ${kind}s`];
      }

      return count === 1 ? [media.length > 1 ? `a ${kind}` : kind] : [];
    })
    .join(" and ");

  return words.charAt(0).toUpperCase() + words.slice(1);
};
