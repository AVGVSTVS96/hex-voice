// The app's look: every color, text style, gap and size a component draws with. A component picks
// a name from these tables, never a value of its own, so it looks the same wherever it sits.

// Every color keeps its job in both appearances.
export const color = {
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
  // The mint that holds white words, for a swipe's button in either appearance.
  accentSolid: { dark: '#1F8A6D', light: '#1F8A6D' },
  danger: { dark: '#F0A5A8', light: '#D93A42' },
  dangerMuted: { dark: '#3A2224', light: '#FBE3E4' },
} as const;

export type Tone = keyof typeof color;

export type Weight = 'regular' | 'medium' | 'semibold' | 'bold';

export type TextStyle = {
  // Apple's text style: SwiftUI text that has one follows the system's text size.
  textStyle?:
    'title' | 'title2' | 'headline' | 'body' | 'callout' | 'subheadline' | 'footnote' | 'caption';
  fontSize: number;
  // React Native's whole line box.
  lineHeight: number;
  // SwiftUI's gap between a paragraph's lines. A label, or a style without one, keeps the font's
  // own leading.
  lineSpacing?: number;
  weight?: Weight;
};

export const type = {
  title: { textStyle: 'title', fontSize: 28, lineHeight: 34, weight: 'bold' },
  title2: { textStyle: 'title2', fontSize: 22, lineHeight: 28, weight: 'semibold' },
  headline: { textStyle: 'headline', fontSize: 17, lineHeight: 22, weight: 'semibold' },
  body: { textStyle: 'body', fontSize: 17, lineHeight: 22, lineSpacing: 5 },
  callout: { textStyle: 'callout', fontSize: 16, lineHeight: 23 },
  subheadline: { textStyle: 'subheadline', fontSize: 15, lineHeight: 22, lineSpacing: 5 },
  footnote: { textStyle: 'footnote', fontSize: 13, lineHeight: 18, lineSpacing: 5 },
  caption: { textStyle: 'caption', fontSize: 12, lineHeight: 16 },
  // The call's words, with room between their lines to read along as they come.
  words: { textStyle: 'body', fontSize: 17, lineHeight: 25 },
  wordsLarge: { fontSize: 19, lineHeight: 28 },
  // A footnote that ends a subheadline's line, like a time or a place, level with its words.
  tag: { textStyle: 'footnote', fontSize: 13, lineHeight: 22 },
  // A name in a list, like a call's in Calls, and the details under it.
  item: { textStyle: 'callout', fontSize: 16, lineHeight: 21, weight: 'medium' },
  itemDetail: { fontSize: 14, lineHeight: 19, lineSpacing: 5 },
  // What became of something you did, beside its mark, like an answer sent.
  sent: { textStyle: 'callout', fontSize: 16, lineHeight: 22 },
  // The one name a carousel's page shows.
  display: { fontSize: 32, lineHeight: 38, weight: 'semibold' },
  // Under the call: how the last one ended, and what didn't go through.
  ending: { fontSize: 15, lineHeight: 20 },
  trouble: { fontSize: 14, lineHeight: 20 },
} as const satisfies Record<string, TextStyle>;

export type TextVariant = keyof typeof type;

const fontWeights = { regular: '400', medium: '500', semibold: '600', bold: '700' } as const;

// A text style for a React Native StyleSheet.
export function textOf(variant: TextVariant, weight?: Weight) {
  const style: TextStyle = type[variant];
  return {
    fontSize: style.fontSize,
    lineHeight: style.lineHeight,
    fontWeight: fontWeights[weight ?? style.weight ?? 'regular'],
  };
}

// A text style for a React Native label: the variant's size and weight on the font's own line
// height, as a SwiftUI label has.
export function labelOf(variant: TextVariant, weight?: Weight) {
  const { fontSize, fontWeight } = textOf(variant, weight);
  return { fontSize, fontWeight };
}

// Every gap and padding is a step of this scale, in points: a step is 4pt, so space[2.5] is 10.
export const space = {
  0.25: 1,
  0.5: 2,
  1: 4,
  1.5: 6,
  2: 8,
  2.5: 10,
  3: 12,
  3.5: 14,
  4: 16,
  4.5: 18,
  5: 20,
  5.5: 22,
  6: 24,
  7.5: 30,
  8: 32,
  10: 40,
  12: 48,
} as const;

// A glass button's diameter, by what it is.
const glass = { tool: 48, docked: 52, mute: 60, call: 64 } as const;

export type GlassSize = keyof typeof glass;

export const metrics = {
  ...glass,
  // The symbol on a glass button, and on the call button.
  symbol: { regular: 24, prominent: 27, bar: 17 },
  // The call buttons at each size: mute, the call button, and the gap between them.
  controls: {
    regular: { mute: 'mute', call: 'call', gap: space[3] },
    // Where they share iPhone Duo's short side column.
    compact: { mute: 'tool', call: 'docked', gap: space[2.5] },
    // Beside the toolbar's own buttons.
    tool: { mute: 'tool', call: 'tool', gap: space[3] },
  },
  // The toolbar's gaps: inside its Tasks and settings pair across the top, and down a side column
  // from Calls to the pair (`tools`) and inside it (`group`).
  toolbar: {
    row: space[3],
    regular: { tools: space[8], group: space[4] },
    compact: { tools: space[3], group: space[2.5] },
  },
  // How far content keeps in from the screen's sides.
  gutter: space[6],
  // A settings row, its icon's width, its inset and the gap after its icon, and the gap between groups.
  row: 58,
  rowIcon: 26,
  rowInset: space[4.5],
  rowSpacing: space[3.5],
  groupSpacing: space[4.5],
  // What you said, inside its bubble.
  bubbleX: 15,
  bubbleY: 11,
  // How tall the call's words fade at their top and bottom edges, and how far their first and
  // newest lines sit in from those edges, so a line at rest is never under its fade.
  fade: 36,
  // The room a carousel's page dots take under its page.
  pageDots: 38,
  // How far an empty list's message sits below its title.
  emptyTop: 130,
  // Between the wrap-up, how the last call ended and what didn't go through, under the call.
  footerGap: 22,
  // iOS 26's bar buttons in Tasks: 44pt glass, and a capsule's room either side of its symbol and
  // name, a little more after the name so the two look even.
  bar: { button: 44, capsule: { leading: 13, trailing: 15, gap: space[1.5] } },
  // Tasks' lists: how far their rows keep in from the sides, a row's mark and the gap after it,
  // and how far content fades as it meets a bar and rests in from that edge. Together with a
  // row's own top padding, nothing at rest sits in the fade.
  list: { inset: space[5], mark: 16, gap: space[2.5], fade: space[6], rest: space[3] },
} as const;

export type ControlsSize = keyof typeof metrics.controls;
export type ToolbarGaps = 'regular' | 'compact';
