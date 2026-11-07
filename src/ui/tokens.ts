// The app's look: every color, text style, gap and size a component draws with. A component picks
// a name from these tables, never a value of its own, so it looks the same wherever it sits.

// Every color keeps its job in both appearances, and each color means one thing: mint is what
// needs you and nothing else, blue is what hex has under way, red is what went wrong.
export const color = {
  background: { dark: '#000000', light: '#FFFFFF' },
  sheet: { dark: '#1C1C1C', light: '#F2F2F7' },
  surface: { dark: '#202020', light: '#EEEEF0' },
  surfaceSelected: { dark: '#363636', light: '#D9D9DE' },
  // A card on the sheet, as Muse sets its Connectors: a question, the tab and the row you're on.
  card: { dark: '#2C2C2E', light: '#FFFFFF' },
  // A pill or a block inside a card.
  fill: { dark: '#3A3A3C', light: '#E9E9EE' },
  bubble: { dark: '#303032', light: '#ECECEE' },
  skeleton: { dark: '#2C2C2E', light: '#E3E3E8' },
  edge: { dark: '#262628', light: '#E3E3E6' },
  prominent: { dark: '#F9F9F9', light: '#0A0A0A' },
  onProminent: { dark: '#080808', light: '#FAFAFA' },
  tint: { dark: '#FFFFFF', light: '#0A0A0A' },
  text: { dark: '#F5F5F5', light: '#0A0A0A' },
  secondary: { dark: '#98989F', light: '#6B6B70' },
  tertiary: { dark: '#5E5E62', light: '#A6A6AB' },
  switchOn: { dark: '#30D158', light: '#34C759' },
  accent: { dark: '#C4F3E5', light: '#1F8A6D' },
  accentMuted: { dark: '#1B3534', light: '#D7F2EA' },
  // The mint that holds white words, for a swipe's button in either appearance.
  accentSolid: { dark: '#1F8A6D', light: '#1F8A6D' },
  progress: { dark: '#8DB8FF', light: '#0A66D2' },
  progressMuted: { dark: '#1F3354', light: '#CFE0F7' },
  danger: { dark: '#F0A5A8', light: '#D93A42' },
  dangerMuted: { dark: '#3A2224', light: '#FBE3E4' },
} as const;

export type Tone = keyof typeof color;

// Where a task lives, as a tile in its own app's color with a white symbol, the same in either
// appearance, and a link's tile.
export const brand = {
  telegram: '#2AABEE',
  t3: '#3A3A3C',
  buzz: '#E9A23B',
  discord: '#5865F2',
  server: '#636366',
  link: '#8E8E93',
  ink: '#FFFFFF',
} as const;

// A mask shows what it covers where it's opaque, and hides it where it's clear.
export const mask = { shown: '#000000', hidden: '#00000000' } as const;

// Two weights, as Muse sets its screens: regular reads, medium names.
export type Weight = 'regular' | 'medium';

export type TextStyle = {
  // Apple's text style: SwiftUI text that has one follows the system's text size.
  textStyle?: 'title' | 'headline' | 'body' | 'subheadline' | 'footnote';
  fontSize: number;
  // React Native's whole line box. A style without one keeps the font's own.
  lineHeight?: number;
  // SwiftUI's gap between a paragraph's lines. A label, or a style without one, keeps the font's
  // own leading.
  lineSpacing?: number;
  weight?: Weight;
  design?: 'monospaced';
};

// Four sizes: a page's title, a name and what you read, the detail under it, and the small print
// beside it.
export const size = { title: 28, body: 17, detail: 15, caption: 13 } as const;

export const type = {
  title: { textStyle: 'title', fontSize: size.title, lineHeight: 34, weight: 'medium' },
  // A name: a row's, a question's, a section's.
  headline: { textStyle: 'headline', fontSize: size.body, lineHeight: 22, weight: 'medium' },
  body: { textStyle: 'body', fontSize: size.body, lineHeight: 22, lineSpacing: 5 },
  // The call's words, with room between their lines to read along as they come.
  words: { textStyle: 'body', fontSize: size.body, lineHeight: 25 },
  // What's under a name, in gray, as many lines as it takes.
  detail: { textStyle: 'subheadline', fontSize: size.detail, lineHeight: 21, lineSpacing: 5 },
  caption: { textStyle: 'footnote', fontSize: size.caption, lineHeight: 18, lineSpacing: 4 },
  // A caption that ends a detail's line, like a time, level with its words.
  tag: { textStyle: 'footnote', fontSize: size.caption, lineHeight: 21 },
  code: { textStyle: 'footnote', fontSize: size.caption, lineSpacing: 4, design: 'monospaced' },
} as const satisfies Record<string, TextStyle>;

export type TextVariant = keyof typeof type;

const fontWeights = { regular: '400', medium: '500' } as const;

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

// Every gap and padding is a step of this scale, in points, on a 4pt grid: space[3] is 12.
export const space = {
  0.5: 2,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
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
  symbol: { mark: 10, small: 13, bar: 17, row: 20, regular: 22, prominent: 26, send: 30 },
  // Glass buttons' symbols in a thin line, as Muse draws its buttons'.
  stroke: 'light' as const,
  // The call buttons at each size: mute, the call button, and the gap between them.
  controls: {
    regular: { mute: 'mute', call: 'call', gap: space[3] },
    // Where they share iPhone Duo's short side column.
    compact: { mute: 'tool', call: 'docked', gap: space[2] },
    // Beside the toolbar's own buttons.
    tool: { mute: 'tool', call: 'tool', gap: space[3] },
  },
  // The toolbar's gaps: inside its Tasks and settings pair across the top, and down a side column
  // from Calls to the pair (`tools`) and inside it (`group`).
  toolbar: {
    row: space[3],
    regular: { tools: space[8], group: space[4] },
    compact: { tools: space[3], group: space[2] },
  },
  // How far content keeps in from the screen's sides.
  gutter: space[6],
  // A settings row, its icon's width, its inset and the gap after its icon, and the gap between groups.
  row: 58,
  rowIcon: 26,
  rowInset: space[4],
  rowSpacing: space[3],
  groupSpacing: space[5],
  // What you said, inside its bubble.
  bubbleX: space[4],
  bubbleY: space[3],
  // The room it leaves on its other side in a Tasks thread.
  bubbleRoom: 52,
  // How tall the call's words fade at their top and bottom edges, and how far their first and
  // newest lines sit in from those edges, so a line at rest is never under its fade.
  fade: 36,
  // The room a carousel's page dots take under its page.
  pageDots: 38,
  // How far an empty list's message sits below its title.
  emptyTop: 130,
  // Between the wrap-up, how the last call ended and what didn't go through, under the call.
  footerGap: space[6],
  // The pill at the foot of Tasks' list, Go through: its height and the gap after its
  // symbol.
  pill: { height: 52, gap: space[2], regular: 44, small: 32 },
  // A thread's composer: its field's least height, and its send button's.
  field: 50,
  // iOS 26's bar buttons in Tasks: 44pt glass, and a capsule's room either side of its symbol and
  // name, a little more after the name so the two look even.
  bar: { button: 44, capsule: { leading: space[3], trailing: space[4], gap: space[2] } },
  // Tasks' stage tabs: each a capsule, filled once chosen, the gap between a tab's name and its
  // count, and the most their words may tighten to keep all four in sight.
  tabs: { height: 34, gap: space[1], pad: space[2], tightest: 0.8 },
  // An app's tile rounds its corners by this share of its size, as iOS rounds app icons.
  tileCorner: 0.27,
  // Tasks' lists: how far their rows keep in from the sides, a row's mark and the gap after it,
  // and how far content fades as it meets a bar and rests in from that edge (together with a
  // row's own top padding, nothing at rest sits in the fade). Then a row's padding above and below
  // its content, and a place's.
  list: {
    inset: space[5],
    // A row's mark, the disc or square inside it, the working arc, and their line.
    mark: 20,
    todo: 18,
    arc: 15,
    stroke: 1.5,
    gap: space[3],
    fade: space[6],
    rest: space[3],
    row: { top: space[3], bottom: space[3] },
    place: space[3],
    // A place's or a link's tile on a page.
    tile: 28,
    // A step's first line, which its mark, time and chevron center on.
    line: 20,
    // The gap between a row's time, its count and its tiles.
    meta: space[2],
  },
  // The widest a page's words run before it holds them in a readable column, on the Duo held open
  // and on iPad.
  readable: 640,
  // A section's tinted badge, and the dot inside it.
  badge: { size: 20, dot: 8 },
} as const;

// One corner per kind of shape, the same in every pose and screen. Where something sits never
// changes how it's drawn.
export const radius = {
  // The call, rounding off against Calls or Tasks beside it.
  card: 44,
  // A grouped panel: settings, an ask on the call, the last check.
  group: 26,
  // What you said.
  bubble: 20,
  // A row or button you press, and a field you type in.
  control: 14,
  // A thread's composer, as round as a capsule while it holds one line.
  field: metrics.field / 2,
  // A tag or a block of code inside something else.
  inner: 12,
  // A choice too long for a pill: as round as a one-line pill, so the two read as one kind.
  option: 22,
  // A done row's square mark in Tasks, as Muse draws its checkboxes.
  mark: 6,
} as const;

export type ControlsSize = keyof typeof metrics.controls;
export type ToolbarGaps = 'regular' | 'compact';

// How long the call buttons' stack runs at a size, along its row or column: mute and the call
// button, and with `add` the + before them, drawn as mute is.
export function stack(size: ControlsSize, { add = false } = {}) {
  const { mute, call, gap } = metrics.controls[size];
  return (add ? 2 : 1) * (metrics[mute] + gap) + metrics[call];
}

// Widths from which a sheet lays its content out side by side, and the narrowest a page reads at:
// the fold parts a window only where it leaves a page on each side of it.
export const breakpoint = { beside: 600, besideShort: 540, page: 320 } as const;
