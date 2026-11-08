import { Image } from "@expo/ui/swift-ui";
import type { ColorValue } from "react-native";
import type { SFSymbol } from "sf-symbols-typescript";

import { Host } from "@/ui/host";

export const Glyph = ({
  name,
  size,
  color,
}: {
  name: SFSymbol;
  size: number;
  color: ColorValue;
}) => (
  <Host matchContents>
    <Image systemName={name} size={size} color={color} />
  </Host>
);
