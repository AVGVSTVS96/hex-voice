import { frame, ignoreSafeArea } from "@expo/ui/swift-ui/modifiers";
import type { ModifierConfig } from "@expo/ui/swift-ui/modifiers";

export const bleed = (...drawn: ModifierConfig[]): ModifierConfig[] => [
  frame({ maxWidth: Infinity, maxHeight: Infinity }),
  ...drawn,
  ignoreSafeArea(),
];
