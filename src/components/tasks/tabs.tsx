import { Picker, Text } from '@expo/ui/swift-ui';
import {
  accessibilityHidden,
  animation,
  frame,
  opacity,
  padding,
  pickerStyle,
  tag,
} from '@expo/ui/swift-ui/modifiers';
import type { ReactNode } from 'react';

import { INSET, Scroll } from '@/components/tasks/parts';
import { TABS, type Tab } from '@/live/tabs';
import { motion } from '@/motion';

// Yours, Working and Done as one segmented control under the title, each with its count.
export function TabBar({
  tab,
  counts,
  onChange,
}: {
  tab: Tab;
  counts: Record<Tab, number>;
  onChange: (tab: Tab) => void;
}) {
  return (
    <Picker
      selection={tab}
      onSelectionChange={onChange}
      testID="tasks-tabs"
      modifiers={[
        pickerStyle('segmented'),
        padding({ leading: INSET - 6, trailing: INSET - 6, top: 6, bottom: 4 }),
        frame({ maxWidth: Infinity }),
      ]}
    >
      {TABS.map(({ key, title }) => (
        <Text key={key} modifiers={[tag(key)]}>
          {counts[key] ? `${title} ${counts[key]}` : title}
        </Text>
      ))}
    </Picker>
  );
}

// One tab's list. Every tab keeps its own scroll, and switching cross-fades between them.
export function TabPane({ shown, children }: { shown: boolean; children: ReactNode }) {
  return (
    <Scroll
      modifiers={[
        opacity(shown ? 1 : 0),
        animation(motion.tab, shown),
        accessibilityHidden(!shown),
      ]}
    >
      {children}
    </Scroll>
  );
}
