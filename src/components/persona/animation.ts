import type { PersonaVariant } from "./variants";

export type PersonaState = "idle" | "listening" | "thinking" | "speaking" | "asleep";

export interface PersonaProps {
  variant?: PersonaVariant;
  state?: PersonaState;
  size?: number;
  color?: string;
  palette?: number;
  paused?: boolean;
  drawn?: boolean;
}

export const PERSONA_STATE_MACHINE = "default";
export const PERSONA_INPUTS = ["listening", "thinking", "speaking", "asleep"] as const;

export const PERSONA_MODELS: Record<PersonaVariant, { dynamicColor: boolean }> = {
  obsidian: { dynamicColor: true },
  mana: { dynamicColor: false },
  opal: { dynamicColor: false },
  halo: { dynamicColor: true },
  glint: { dynamicColor: true },
  command: { dynamicColor: true },
};

export const personaInputValues = (state: PersonaState) =>
  PERSONA_INPUTS.map((name) => ({ name, value: name === state }));
