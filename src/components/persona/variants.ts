export const PERSONA_VARIANTS = [
  { id: 'obsidian', label: 'Obsidian', description: 'Shifting silver' },
  { id: 'mana', label: 'Mana', description: 'Soft blue light' },
  { id: 'opal', label: 'Opal', description: 'Flowing color' },
  { id: 'halo', label: 'Halo', description: 'A ring of light' },
  { id: 'glint', label: 'Glint', description: 'A pair of stars' },
  { id: 'command', label: 'Command', description: 'A simple slash' },
] as const;

export type PersonaVariant = (typeof PERSONA_VARIANTS)[number]['id'];
export const DEFAULT_PERSONA: PersonaVariant = 'opal';

export function isPersonaVariant(value: unknown): value is PersonaVariant {
  return PERSONA_VARIANTS.some((variant) => variant.id === value);
}

// Pastel twins of Opal's palettes, in the same order, so each color sits in the same spot on every
// persona. With the custom color picker they fill as many spots as Opal's palettes.
export const PERSONA_COLORS = [
  { id: '#FFFFFF', label: 'White' },
  { id: '#FFB3C7', label: 'Rose' },
  { id: '#FFCDA8', label: 'Peach' },
  { id: '#FFEDA6', label: 'Lemon' },
  { id: '#D5F2B6', label: 'Lime' },
  { id: '#C4F3E5', label: 'Mint' },
  { id: '#A9CCFF', label: 'Sky' },
  { id: '#CDB8FF', label: 'Lilac' },
] as const;

export const DEFAULT_PERSONA_COLOR = '#FFFFFF';

export function isPersonaColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9A-F]{6}$/.test(value);
}

// Opal's numeric `color` input picks one of these hue palettes; any other value is its original mix.
export const OPAL_PALETTES = [
  { id: 'original', label: 'Original', swatch: null },
  { id: '2', label: 'Red', swatch: '#E5484D' },
  { id: '3', label: 'Orange', swatch: '#F07B3F' },
  { id: '4', label: 'Yellow', swatch: '#E8C547' },
  { id: '5', label: 'Green', swatch: '#46B96C' },
  { id: '6', label: 'Teal', swatch: '#2FB5AD' },
  { id: '7', label: 'Blue', swatch: '#4562DA' },
  { id: '8', label: 'Purple', swatch: '#9B4DD6' },
  { id: '9', label: 'Pink', swatch: '#DE4FA6' },
] as const;

export type OpalPalette = (typeof OPAL_PALETTES)[number]['id'];

export function isOpalPalette(value: unknown): value is OpalPalette {
  return OPAL_PALETTES.some((palette) => palette.id === value);
}

export function opalPaletteInput(palette: OpalPalette) {
  return palette === 'original' ? undefined : Number(palette);
}
