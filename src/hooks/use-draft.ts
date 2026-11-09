import { useState } from "react";
import { Settings } from "react-native";
import * as z from "zod/mini";

const KEY = "HexDrafts";

const Drafts = z.record(z.string(), z.string());

const saved = () => Drafts.safeParse(Settings.get(KEY)).data ?? {};

export const keepDraft = (where: string, text: string) => {
  const { [where]: _, ...rest } = saved();
  Settings.set({ [KEY]: text.trim() ? { ...rest, [where]: text } : rest });
};

export const sentDraft = (where: string, text: string) => {
  if (saved()[where]?.trim() === text.trim()) {
    keepDraft(where, "");
  }
};

export const carryDraft = (where: string, from: string[]) => {
  const all = saved();
  const here = all[where] ?? "";

  const [old] = here.trim()
    ? []
    : from.flatMap((key) => {
        const text = all[key];

        return text !== undefined && text.trim() !== "" ? [{ key, text }] : [];
      });

  if (!old) {
    return here;
  }

  const { [old.key]: _, ...rest } = all;
  Settings.set({ [KEY]: { ...rest, [where]: old.text } });

  return old.text;
};

export const useDraft = (where: string) => {
  const [first] = useState(() => saved()[where] ?? "");

  return {
    first,
    keep: (text: string) => {
      keepDraft(where, text);
    },
  };
};
