// The app's look: every color, text style, gap and size a component draws with. A component picks
// a name from these tables, never a value of its own, so it looks the same wherever it sits.

// Every color keeps its job in both appearances, and there are few: grounds, fills, three grays of
// text, and one color per meaning. Mint is what needs you, and nothing else; blue is what hex has
// under way; red is what went wrong.
export const color = {
  // The call's ground, and the panes and sheets that list things over it: Muse's off-white.
  ground: { dark: '#000000', light: '#FCFCFC' },
  sheet: { dark: '#1C1C1E', light: '#FCFCFC' },
  // A grouped page, like settings, and the cards its rows sit in.
  grouped: { dark: '#1C1C1E', light: '#F2F3F5' },
  card: { dark: '#000000', light: '#FFFFFF' },
  // Something drawn on the ground: a bubble, a block of code, a placeholder; stronger, once chosen.
  fill: { dark: '#2C2C2E', light: '#EDEEF0' },
  fillStrong: { dark: '#3A3A3C', light: '#E2E3E6' },
  edge: { dark: '#2C2C2E', light: '#E3E3E5' },
  text: { dark: '#F5F5F5', light: '#0A0A0A' },
  secondary: { dark: '#98989F', light: '#65676B' },
  tertiary: { dark: '#636366', light: '#A2A4A8' },
  // The one filled button on a screen, like the call button, and what's drawn on it.
  prominent: { dark: '#F9F9F9', light: '#0A0A0A' },
  onProminent: { dark: '#080808', light: '#FAFAFA' },
  accent: { dark: '#C4F3E5', light: '#1F8A6D' },
  accentFill: { dark: '#1B3534', light: '#D7F2EA' },
  // The mint that holds white words, for a swipe's button in either appearance.
  accentSolid: { dark: '#1F8A6D', light: '#1F8A6D' },
  progress: { dark: '#8DB8FF', light: '#0A66D2' },
  progressFill: { dark: '#1E2C44', light: '#DCE9FA' },
  danger: { dark: '#F0A5A8', light: '#D93A42' },
  dangerFill: { dark: '#3A2224', light: '#FBE3E4' },
  // A switch that's on, as iOS draws one.
  switchOn: { dark: '#30D158', light: '#34C759' },
  // The soft shadow under a floating button, only where the ground is light.
  lift: { dark: '#00000000', light: '#00000014' },
} as const;

// A mask shows what it covers where it's opaque, and hides it where it's clear.
export const mask = { shown: '#000000', hidden: '#00000000' } as const;

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

export type Tone = keyof typeof color;

// Two weights: regular reads, semibold names.
export type Weight = 'regular' | 'semibold';

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

// Four sizes, as Muse sets its screens: a page's title, a name and what you read, the detail under
// it, and the small print beside it.
export const size = { title: 28, body: 17, detail: 15, caption: 13 } as const;

export const type = {
  title: { textStyle: 'title', fontSize: size.title, lineHeight: 34, weight: 'semibold' },
  // A name: a row's, a page's in its bar, a question's.
  headline: { textStyle: 'headline', fontSize: size.body, lineHeight: 22, weight: 'semibold' },
  body: { textStyle: 'body', fontSize: size.body, lineHeight: 22, lineSpacing: 5 },
  // The call's words, with room between their lines to read along as they come.
  words: { textStyle: 'body', fontSize: size.body, lineHeight: 25 },
  detail: { textStyle: 'subheadline', fontSize: size.detail, lineHeight: 20, lineSpacing: 4 },
  caption: { textStyle: 'footnote', fontSize: size.caption, lineHeight: 18, lineSpacing: 4 },
  code: { textStyle: 'footnote', fontSize: size.caption, lineSpacing: 4, design: 'monospaced' },
} as const satisfies Record<string, TextStyle>;

export type TextVariant = keyof typeof type;

const fontWeights = { regular: '400', semibold: '600' } as const;

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
  12: 48,
} as const;

// A glass button's diameter, by what it is.
const glass = { tool: 48, docked: 52, mute: 60, call: 64 } as const;

export type GlassSize = keyof typeof glass;

export const metrics = {
  ...glass,
  // Symbols, by what they sit beside: a mark's glyph, a caption or detail line, a name or a bar
  // button, a glass button, the call button, and an empty page's.
  symbol: { mark: 10, small: 13, bar: 17, regular: 22, prominent: 27, hero: 28 },
  // Thin line symbols, as Muse draws its buttons'.
  stroke: 'light' as const,
  // The shadow under a floating button: how soft, and how far down.
  lift: { radius: 12, y: 4 },
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
  groupSpacing: space[6],
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
  // The prominent pill at the foot of Tasks' list, Go through: its height and the gap after its
  // symbol.
  pill: { height: 52, gap: space[2] },
  // A thread's composer: its field's least height, and its send button's.
  field: 50,
  // iOS 26's bar buttons in Tasks: 44pt glass, and a capsule's room either side of its symbol and
  // name, a little more after the name so the two look even.
  bar: { button: 44, capsule: { leading: space[3], trailing: space[4], gap: space[2] } },
  // Tasks' stage tabs: the gap between a tab's dot, name and count, the room under them, and the
  // selected tab's dot and the tinted badge it sits on.
  tabs: { gap: space[2], under: space[3], badge: 18, dot: 7 },
  // A row's tile, holding its symbol, as Muse sets one before each row of its history.
  tile: 40,
  // An app's tile rounds its corners by this share of its size, as iOS rounds app icons.
  tileCorner: 0.27,
  // Tasks' lists: how far their rows keep in from the sides, a row's mark and the gap after it,
  // and how far content fades as it meets a bar and rests in from that edge (together with a
  // row's own top padding, nothing at rest sits in the fade). Then a row's padding above and below
  // its content, and a place's.
  list: {
    inset: space[4],
    mark: 20,
    // A to-do's square inside its mark.
    todo: 18,
    gap: space[3],
    fade: space[6],
    rest: space[3],
    row: { top: space[3], bottom: space[3] },
    place: space[3],
    // A step's first line, which its mark, time and chevron center on.
    line: 20,
    // The gap between a row's time, its count and its tiles.
    meta: space[2],
  },
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
  // A to-do's square mark in Tasks, as Muse draws its checkboxes.
  mark: 5,
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
