import { Circle } from "@expo/ui/swift-ui";
import {
  Animation,
  animation,
  foregroundStyle,
  frame,
  offset,
  opacity,
  scaleEffect,
  strokeBorder,
} from "@expo/ui/swift-ui/modifiers";

import { theme } from "@/theme";
import { GlassButton } from "@/ui/glass-button";
import { metrics } from "@/ui/tokens";

const DOT = 14;
const LINE = 2;

export const TasksButton = ({
  needs,
  working,
  selected,
  onPress,
}: {
  needs: number;
  working: number;
  selected: boolean;
  onPress: () => void;
}) => {
  const label = [
    "Tasks",
    needs ? `${needs} need${needs === 1 ? "s" : ""} you` : "",
    working ? `${working} working` : "",
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <GlassButton
      bare
      icon="tasks"
      label={label}
      testID="tasks-button"
      selected={selected}
      onPress={onPress}
    />
  );
};

export const NeedsDot = ({ needs }: { needs: number }) => (
  <Circle
    modifiers={[
      foregroundStyle(theme.accent),
      frame({ width: DOT, height: DOT }),
      strokeBorder({ content: theme.background, style: { lineWidth: LINE }, shape: "circle" }),
      offset({ x: metrics.tool - DOT }),
      scaleEffect(needs > 0 ? 1 : 0.01),
      opacity(needs > 0 ? 1 : 0),
      animation(Animation.bouncy(), needs > 0),
    ]}
  />
);
