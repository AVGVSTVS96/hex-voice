import {
  OPAL_PALETTES,
  PERSONA_COLORS,
  PERSONA_VARIANTS,
  personaColorOnLight,
} from '@/components/persona/variants';
import type { OpalPalette, PersonaVariant } from '@/components/persona/variants';
import { PERSONA_MODELS } from '@/components/persona/animation';

export interface ActivityOrb {
  name: string;
  variant: PersonaVariant;
  color?: string;
  light?: string;
  palette?: number;
}

const named = (variant: PersonaVariant, suffix?: string) =>
  suffix ? `orb-${variant}-${suffix.toLowerCase()}` : `orb-${variant}`;

export const ACTIVITY_ORBS = PERSONA_VARIANTS.flatMap<ActivityOrb>(({ id: variant }) => {
  if (variant === 'opal') {
    return OPAL_PALETTES.map(({ id }) =>
      id === 'original'
        ? { name: named(variant), variant }
        : { name: named(variant, id), variant, palette: Number(id) },
    );
  }
  if (!PERSONA_MODELS[variant].dynamicColor) {
    return [{ name: named(variant), variant }];
  }
  return PERSONA_COLORS.map(({ id: color }) => ({
    name: named(variant, color.slice(1)),
    variant,
    color,
    light: personaColorOnLight(color),
  }));
});

export const activityOrb = (variant: PersonaVariant, color: string, palette: OpalPalette) => {
  const name =
    variant === 'opal'
      ? named(variant, palette === 'original' ? undefined : palette)
      : PERSONA_MODELS[variant].dynamicColor
        ? named(variant, color.slice(1))
        : named(variant);
  return ACTIVITY_ORBS.some((orb) => orb.name === name)
    ? name
    : named(variant, PERSONA_COLORS[0].id.slice(1));
};
