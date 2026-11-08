import { hex } from "@/hex";
import type { Shown } from "@/live/media";

export const mediaSource = (media: Shown) =>
  "uri" in media ? { uri: media.uri } : hex.media.image(media.id);
