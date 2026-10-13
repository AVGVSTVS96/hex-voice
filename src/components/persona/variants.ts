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

export const PERSONA_COLORS = [
  { id: '#FFFFFF', label: 'White' },
  { id: '#C4F3E5', label: 'Mint' },
  { id: '#A9CCFF', label: 'Sky' },
  { id: '#CDB8FF', label: 'Lilac' },
  { id: '#FFCDA8', label: 'Peach' },
  { id: '#FFB3C7', label: 'Rose' },
] as const;

export const DEFAULT_PERSONA_COLOR = '#FFFFFF';

export function isPersonaColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9A-F]{6}$/.test(value);
}
