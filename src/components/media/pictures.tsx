import { frame } from "@expo/ui/swift-ui/modifiers";

import { theme } from "@/theme";
import { radius, space } from "@/ui/tokens";

import { ShotsView } from "../../../modules/shots";

export interface Picture {
  uri: string;
  headers: Record<string, string>;
  shape: number;
  label: string;
}

export const Pictures = ({ pictures, height }: { pictures: Picture[]; height: number }) => {
  const [lead] = pictures;

  if (!lead) {
    return null;
  }

  const gap = space[2];

  const wide = pictures.reduce(
    (sum, { shape }) => sum + shape * height,
    gap * (pictures.length - 1),
  );

  return (
    <ShotsView
      uris={pictures.map((picture) => picture.uri)}
      shapes={pictures.map((picture) => picture.shape)}
      labels={pictures.map((picture) => picture.label)}
      headers={lead.headers}
      height={height}
      gap={gap}
      radius={radius.inner}
      secondary={theme.secondary}
      surface={theme.fill}
      edge={theme.edge}
      modifiers={[frame({ maxWidth: wide })]}
    />
  );
};
