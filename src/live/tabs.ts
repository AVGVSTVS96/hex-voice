import type { Fresh } from './asks';
import type { TaskGroup } from './tasks';

// The Tasks sheet's three tabs: what needs your hand, what hex is working on, and what finished.
export type Tab = 'yours' | 'working' | 'done';
export const TABS: { key: Tab; title: string }[] = [
  { key: 'yours', title: 'Yours' },
  { key: 'working', title: 'Working' },
  { key: 'done', title: 'Done' },
];

export function tabCounts(
  asks: number,
  stuck: number,
  groups: TaskGroup[],
  fresh: Fresh[],
): Record<Tab, number> {
  const count = (key: TaskGroup['key']) =>
    groups.find((group) => group.key === key)?.tasks.length ?? 0;
  return {
    yours: asks + stuck + count('needs'),
    working: count('working'),
    done: fresh.filter((item) => !item.read).length + count('done'),
  };
}

// The sheet opens on the first tab with something in it, Yours before Working before Done.
export function firstTab(counts: Record<Tab, number>): Tab {
  return TABS.find(({ key }) => counts[key])?.key ?? 'yours';
}
