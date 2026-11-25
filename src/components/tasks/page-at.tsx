import { Column } from "@expo/ui";
import { background, frame } from "@expo/ui/swift-ui/modifiers";
import type { ReactNode } from "react";

import { TASKS } from "@/call/stage";
import { COLUMNS } from "@/components/tasks/pages";
import { theme } from "@/theme";

export const PAGED = { page: TASKS, column: { ...COLUMNS, from: Infinity }, behind: 1 };

export const STACKED = { page: Infinity, column: COLUMNS, behind: 1 / 3 };

export const PageAt = ({ paged, children }: { paged: boolean; children: ReactNode }) => (
  <Column
    alignment="center"
    spacing={0}
    modifiers={[
      frame({ maxWidth: Infinity, alignment: "top" }),
      upTo(),
      ...(paged ? [] : [background(theme.sheet)]),
    ]}
  >
    {children}
  </Column>
);

export const upTo = () => frame({ minHeight: 0, maxHeight: Infinity, alignment: "top" });
