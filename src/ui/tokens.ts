export const color = {
  background: { dark: "#000000", light: "#FFFFFF" },
  sheet: { dark: "#1C1C1C", light: "#F2F2F7" },
  surface: { dark: "#202020", light: "#EEEEF0" },
  surfaceSelected: { dark: "#363636", light: "#D9D9DE" },
  card: { dark: "#2C2C2E", light: "#FFFFFF" },
  fill: { dark: "#3A3A3C", light: "#E9E9EE" },
  bubble: { dark: "#303032", light: "#ECECEE" },
  skeleton: { dark: "#2C2C2E", light: "#E3E3E8" },
  edge: { dark: "#262628", light: "#E3E3E6" },
  prominent: { dark: "#F9F9F9", light: "#0A0A0A" },
  onProminent: { dark: "#080808", light: "#FAFAFA" },
  tint: { dark: "#FFFFFF", light: "#0A0A0A" },
  text: { dark: "#F5F5F5", light: "#0A0A0A" },
  secondary: { dark: "#98989F", light: "#6B6B70" },
  tertiary: { dark: "#5E5E62", light: "#A6A6AB" },
  switchOn: { dark: "#30D158", light: "#34C759" },
  accent: { dark: "#C4F3E5", light: "#1F8A6D" },
  accentMuted: { dark: "#1B3534", light: "#D7F2EA" },
  accentSolid: { dark: "#1F8A6D", light: "#1F8A6D" },
  ask: { dark: "#F2C58A", light: "#A35F00" },
  progress: { dark: "#8DB8FF", light: "#0A66D2" },
  progressMuted: { dark: "#1F3354", light: "#CFE0F7" },
  danger: { dark: "#F0A5A8", light: "#D93A42" },
  dangerMuted: { dark: "#3A2224", light: "#FBE3E4" },
} as const;

export type Tone = keyof typeof color;

export const brand = {
  telegram: "#2AABEE",
  t3: "#3A3A3C",
  buzz: "#E9A23B",
  discord: "#5865F2",
  server: "#636366",
  link: "#8E8E93",
  ink: "#FFFFFF",
} as const;

export const film = {
  ink: "#FFFFFF",
  black: "#000000",
  glass: "#00000073",
  recording: "#FF3B30",
  edge: { light: "#FFFFFF59", side: "#FFFFFF1F", shade: "#0000004D" },
} as const;

export const mask = { shown: "#000000", hidden: "#00000000" } as const;

export type Weight = "regular" | "medium";

export interface TextStyle {
  textStyle?: "title" | "headline" | "body" | "subheadline" | "footnote";
  fontSize: number;
  lineHeight?: number;
  lineSpacing?: number;
  weight?: Weight;
  design?: "monospaced";
}

export const size = { title: 28, body: 17, detail: 15, caption: 13 } as const;

const detailLine = 21;

export const type = {
  title: { textStyle: "title", fontSize: size.title, lineHeight: 34, weight: "medium" },
  headline: { textStyle: "headline", fontSize: size.body, lineHeight: 22, weight: "medium" },
  body: { textStyle: "body", fontSize: size.body, lineHeight: 22, lineSpacing: 5 },
  words: { textStyle: "body", fontSize: size.body, lineHeight: 25 },
  detail: {
    textStyle: "subheadline",
    fontSize: size.detail,
    lineHeight: detailLine,
    lineSpacing: 5,
  },
  caption: { textStyle: "footnote", fontSize: size.caption, lineHeight: 18, lineSpacing: 4 },
  tag: { textStyle: "footnote", fontSize: size.caption, lineHeight: detailLine },
  code: { textStyle: "footnote", fontSize: size.caption, lineSpacing: 4, design: "monospaced" },
} as const satisfies Record<string, TextStyle>;

export type TextVariant = keyof typeof type;

const fontWeights = { regular: "400", medium: "500" } as const;

export const textOf = (variant: TextVariant, weight?: Weight) => {
  const style: TextStyle = type[variant];

  return {
    fontSize: style.fontSize,
    lineHeight: style.lineHeight,
    fontWeight: fontWeights[weight ?? style.weight ?? "regular"],
  };
};

export const labelOf = (variant: TextVariant, weight?: Weight) => {
  const { fontSize, fontWeight } = textOf(variant, weight);

  return { fontSize, fontWeight };
};

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

const glass = { tool: 48, docked: 52, mute: 60, call: 64 } as const;

export type GlassSize = keyof typeof glass;

export const metrics = {
  ...glass,
  symbol: { mark: 10, small: 13, bar: 17, row: 20, regular: 22, prominent: 26, send: 30 },
  stroke: "light" as const,
  controls: {
    regular: { mute: "mute", call: "call", gap: space[3] },
    compact: { mute: "tool", call: "docked", gap: space[2] },
    tool: { mute: "tool", call: "tool", gap: space[3] },
  },
  toolbar: {
    row: space[3],
    regular: { tools: space[8], group: space[4] },
    compact: { tools: space[3], group: space[2] },
  },
  gutter: space[6],
  row: 58,
  rowIcon: 26,
  rowInset: space[4],
  rowSpacing: space[3],
  groupSpacing: space[5],
  bubbleX: space[4],
  bubbleY: space[3],
  bubbleRoom: 52,
  fade: 36,
  pageDots: 38,
  emptyTop: 130,
  footerGap: space[6],
  pill: { height: 52, gap: space[2], regular: 44, small: 32 },
  field: 50,
  media: { turn: 240, line: 120, share: "64%", waiting: 64, shutter: 72, ring: 4 },
  bar: { button: 44, capsule: { leading: space[3], trailing: space[4], gap: space[2] } },
  tabs: { height: 34, gap: space[1], pad: space[2], tightest: 0.8 },
  tileCorner: 0.27,
  list: {
    inset: space[5],
    mark: 20,
    todo: 18,
    arc: 15,
    stroke: 1.5,
    gap: space[3],
    fade: space[6],
    rest: space[3],
    row: { top: space[3], bottom: space[3] },
    place: space[3],
    tile: 28,
    line: 20,
    meta: space[2],
  },
  readable: 640,
  shot: 200,
  badge: { size: 20, dot: 8 },
} as const;

export const radius = {
  card: 44,
  group: 26,
  bubble: 20,
  control: 14,
  field: metrics.field / 2,
  inner: 12,
  option: metrics.pill.regular / 2,
  mark: 6,
  media: 18,
  waiting: 12,
} as const;

export type ControlsSize = keyof typeof metrics.controls;

export type ToolbarGaps = "regular" | "compact";

export const stack = (controls: ControlsSize) => {
  const { mute, call, gap } = metrics.controls[controls];

  return metrics[mute] + gap + metrics[call];
};

export const breakpoint = { beside: 600, besideShort: 540, page: 320 } as const;
