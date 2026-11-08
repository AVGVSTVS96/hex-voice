import { hex } from '@/hex';
import type { Shown } from '@/live/media';

// Where an image view reads a photo or clip from: the file on this phone, or hex's still of it.
export const mediaSource = (media: Shown) =>
  'uri' in media ? { uri: media.uri } : hex.media.image(media.id);
