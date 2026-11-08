import command from './assets/command.riv';
import glint from './assets/glint.riv';
import halo from './assets/halo.riv';
import mana from './assets/mana.riv';
import obsidian from './assets/obsidian.riv';
import opal from './assets/opal.riv';
import type { PersonaVariant } from './variants';

export const PERSONA_ASSETS: Record<PersonaVariant, number> = {
  obsidian,
  mana,
  opal,
  halo,
  glint,
  command,
};
