import * as z from "zod/mini";

const Choice = z.object({ id: z.string(), label: z.string() });

export type Choice = z.infer<typeof Choice>;

export const Talk = z.object({
  settings: z.object({
    voice: z.optional(z.string()),
    personality: z.optional(z.string()),
    pace: z.optional(z.string()),
    words: z.optional(z.string()),
  }),
  personalities: z.array(Choice),
  paces: z.array(Choice),
});

export type Talk = z.infer<typeof Talk>;

export interface TalkChange {
  voice?: string;
  personality?: string;
  pace?: string;
  words?: string;
}

export const WORDS_LIMIT = 600;

export const UNSET = { personality: "default", pace: "normal" } as const;

export const chosen = (choices: readonly Choice[], id: string) =>
  choices.find((choice) => choice.id === id);
