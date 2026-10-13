import type { LiveVoice } from './voices';

// Each voice introducing itself, rendered once from GPT-Live by scripts/voice-previews.mts.
export const VOICE_PREVIEWS: Record<LiveVoice, number> = {
  marin: require('@/assets/voices/marin.m4a'),
  alloy: require('@/assets/voices/alloy.m4a'),
  ash: require('@/assets/voices/ash.m4a'),
  ballad: require('@/assets/voices/ballad.m4a'),
  beacon: require('@/assets/voices/beacon.m4a'),
  bossa: require('@/assets/voices/bossa.m4a'),
  cedar: require('@/assets/voices/cedar.m4a'),
  cinder: require('@/assets/voices/cinder.m4a'),
  coral: require('@/assets/voices/coral.m4a'),
  delta: require('@/assets/voices/delta.m4a'),
  echo: require('@/assets/voices/echo.m4a'),
  gleam: require('@/assets/voices/gleam.m4a'),
  meridian: require('@/assets/voices/meridian.m4a'),
  quartz: require('@/assets/voices/quartz.m4a'),
  ripple: require('@/assets/voices/ripple.m4a'),
  sage: require('@/assets/voices/sage.m4a'),
  shimmer: require('@/assets/voices/shimmer.m4a'),
  stone: require('@/assets/voices/stone.m4a'),
  tempo: require('@/assets/voices/tempo.m4a'),
  verse: require('@/assets/voices/verse.m4a'),
  vesper: require('@/assets/voices/vesper.m4a'),
  willow: require('@/assets/voices/willow.m4a'),
};
