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
  const old = all[where]?.trim() ? undefined : from.find((key) => all[key]?.trim());

  if (old === undefined || old === "") {
    return all[where] ?? "";
  }

  const { [old]: text, ...rest } = all;
  Settings.set({ [KEY]: { ...rest, [where]: text } });

  return text;
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
