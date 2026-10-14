import { DynamicColorIOS, Platform, type ColorValue } from 'react-native';

// Every token keeps its job in both appearances; iOS picks the side that matches the system.
const tokens = {
  background: { dark: '#000000', light: '#FFFFFF' },
  sheet: { dark: '#1C1C1C', light: '#F2F2F7' },
  group: { dark: '#000000', light: '#FFFFFF' },
  surface: { dark: '#202020', light: '#EEEEF0' },
  surfaceSelected: { dark: '#363636', light: '#D9D9DE' },
  bubble: { dark: '#303032', light: '#ECECEE' },
  skeleton: { dark: '#2C2C2E', light: '#E3E3E8' },
  edge: { dark: '#262628', light: '#D9D9DE' },
  prominent: { dark: '#F9F9F9', light: '#0A0A0A' },
  onProminent: { dark: '#080808', light: '#FAFAFA' },
  tint: { dark: '#FFFFFF', light: '#0A0A0A' },
  text: { dark: '#F5F5F5', light: '#0A0A0A' },
  secondary: { dark: '#98989F', light: '#6E6E73' },
  tertiary: { dark: '#5E5E62', light: '#AEAEB2' },
  switchOn: { dark: '#30D158', light: '#34C759' },
  accent: { dark: '#C4F3E5', light: '#1F8A6D' },
  accentMuted: { dark: '#1B3534', light: '#D7F2EA' },
  accentTrack: { dark: '#2F5552', light: '#A8DCCB' },
  danger: { dark: '#F0A5A8', light: '#D93A42' },
  dangerMuted: { dark: '#3A2224', light: '#FBE3E4' },
} as const;

type Token = keyof typeof tokens;

export const theme = Object.fromEntries(
  Object.entries(tokens).map(([token, pair]) => [
    token,
    Platform.OS === 'ios' ? DynamicColorIOS(pair) : pair.dark,
  ]),
) as Record<Token, ColorValue>;

export const metrics = {
  gutter: 24,
  row: 58,
  rowInset: 18,
  rowSpacing: 14,
  rowIcon: 26,
  groupSpacing: 18,
  groupRadius: 26,
  body: 17,
} as const;
