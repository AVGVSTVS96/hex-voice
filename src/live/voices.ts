// BuiltInVoice in the OpenAI Live API. Voice is selected when a session starts.
// https://developers.openai.com/api/reference/typescript/resources/live
// Accents are the regional influences listed in
// https://developers.openai.com/api/docs/guides/live-conversations#voice-options
export const VOICES = [
  { id: 'marin', label: 'Marin' },
  { id: 'alloy', label: 'Alloy' },
  { id: 'ash', label: 'Ash' },
  { id: 'ballad', label: 'Ballad' },
  { id: 'beacon', label: 'Beacon', accent: 'Filipino English' },
  { id: 'bossa', label: 'Bossa', accent: 'Brazilian Portuguese' },
  { id: 'cedar', label: 'Cedar' },
  { id: 'cinder', label: 'Cinder', accent: 'Southern U.S. English' },
  { id: 'coral', label: 'Coral' },
  { id: 'delta', label: 'Delta', accent: 'Southern U.S. English' },
  { id: 'echo', label: 'Echo' },
  { id: 'gleam', label: 'Gleam', accent: 'North American English' },
  { id: 'meridian', label: 'Meridian', accent: 'North American English' },
  { id: 'quartz', label: 'Quartz', accent: 'Australian English' },
  { id: 'ripple', label: 'Ripple', accent: 'Australian English' },
  { id: 'sage', label: 'Sage' },
  { id: 'shimmer', label: 'Shimmer' },
  { id: 'stone', label: 'Stone', accent: 'Irish English' },
  { id: 'tempo', label: 'Tempo', accent: 'Brazilian Portuguese' },
  { id: 'verse', label: 'Verse' },
  { id: 'vesper', label: 'Vesper', accent: 'British English' },
  { id: 'willow', label: 'Willow', accent: 'Irish English' },
] as const;

export type LiveVoice = (typeof VOICES)[number]['id'];
export const DEFAULT_VOICE: LiveVoice = 'marin';

export function isLiveVoice(value: unknown): value is LiveVoice {
  return typeof value === 'string' && VOICES.some((voice) => voice.id === value);
}
