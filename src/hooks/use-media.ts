import { hex } from "@/hex";
import type { MediaId, Shown } from "@/live/media";

export const mediaSource = (media: Shown) =>
  "uri" in media ? { uri: media.uri } : hex.media.image(media.id);

export const pictureOf = (id: MediaId) => hex.media.image(id);
