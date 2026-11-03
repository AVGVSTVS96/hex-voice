import { Column, Icon, Row, Spacer, Text } from '@expo/ui';
import { List } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  animation,
  background,
  clipShape,
  contentShape,
  foregroundStyle,
  frame,
  listStyle,
  padding,
  scrollClipDisabled,
  scrollContentBackground,
  shapes,
} from '@expo/ui/swift-ui/modifiers';
import { useEffect, useMemo, useState } from 'react';

import { PageBar, useChrome } from '@/components/tasks/bar';
import { CheckRow, PicksRow, TopicHead } from '@/components/tasks/inbox';
import { ListHead, Search, SearchButton, Tabs } from '@/components/tasks/list-head';
import type { Pages, Spot } from '@/components/tasks/pages';
import { Empty, Faded, ios, listRow, type Feel } from '@/components/tasks/parts';
import { EntryRow, QuietRow } from '@/components/tasks/rows';
import type { TasksAt } from '@/components/tasks/tasks-view';
import type { useAsks } from '@/hooks/use-asks';
import type { Ask, AskOption } from '@/live/asks';
import {
  inboxEntries,
  picksOf,
  search,
  stageCounts,
  taskOf,
  topicsOf,
  type Stage,
  type Tile,
} from '@/live/inbox';
import type { TaskRow } from '@/live/tasks';
import { motion, rowsKey } from '@/motion';
import { theme } from '@/theme';

const TABS_WITH_BAR = 600;

const EMPTY: Record<Stage, string> = {
  needs: 'Nothing waits on you',
  working: 'Nothing is working',
  done: 'Nothing finished today',
  quiet: 'Nothing is quiet',
};

export function ListPage({
  open,
  at,
  pages,
  spot,
  paged,
  toolbarLine,
  tasks,
  offline,
  yours,
  feel,
  onAnswer,
  onUndo,
  onOpenTile,
  onGoThrough,
}: {
  open: boolean;
  at: TasksAt;
  pages: Pages;
  spot: Spot;
  paged: boolean;
  toolbarLine?: number;
  tasks: TaskRow[] | undefined;
  offline: boolean;
  yours: ReturnType<typeof useAsks>;
  feel: Feel;
  onAnswer: (ask: Ask, option: AskOption) => void;
  onUndo: (ask: Ask) => void;
  onOpenTile: (tile: Tile) => void;
  onGoThrough: () => void;
}) {
  const { bar, back } = useChrome();
  const [stage, setStage] = useState<Stage>('needs');
  const [query, setQuery] = useState<string | null>(null);
  const entries = useMemo(
    () => inboxEntries(tasks ?? [], yours.list, yours.shown),
    [tasks, yours.list, yours.shown],
  );
  const counts = stageCounts(entries, yours.answered);
  const loaded = !!(yours.list && tasks);
  useEffect(() => {
    if (open) setQuery(null);
  }, [open, at]);
  useEffect(() => {
    if (open && loaded) setStage(at.stage ?? (counts.needs ? 'needs' : 'working'));
  }, [open, loaded, at]);

  const shown = useMemo(
    () =>
      query !== null ? search(entries, query) : entries.filter((entry) => entry.stage === stage),
    [entries, stage, query],
  );
  const topics = useMemo(() => topicsOf(shown, entries, tasks ?? []), [shown, entries, tasks]);
  const picks = picksOf(entries, yours.answered);
  const beside = pages.shape !== 'one';
  const first = shown.map(taskOf).find((id) => id && tasks?.some((row) => row.id === id));
  useEffect(() => {
    if (beside && open && !pages.task && first) pages.go({ to: 'beside', id: first });
  }, [beside, open, pages.task, first]);
  const selected = beside
    ? ((
        shown.find((entry) => entry.id === pages.row && taskOf(entry) === pages.task) ??
        shown.find((entry) => taskOf(entry) === pages.task)
      )?.id ?? null)
    : null;

  const openTask = (id: string, row?: string) => {
    feel.tick();
    pages.go({ to: 'topic', id, row });
  };
  const chooseStage = (next: Stage) => {
    feel.tick();
    setStage(next);
    if (beside) pages.go({ to: 'beside', id: null });
  };
  const startSearch = () => {
    feel.tick();
    setQuery('');
  };
  const width = spot.width;
  const actions = {
    width,
    selected,
    answered: yours.answered,
    onOpen: openTask,
    onOpenTile,
    onAnswer,
    onUndo,
    onAct: (id: string) => {
      feel.tap();
      void yours.act(id);
    },
    onRead: (id: string) => {
      feel.tick();
      void yours.read(id);
    },
  };
  const unreachable = (offline || yours.offline) && !loaded;
  // A page as wide as a landscape phone holds back, the stages and search in one row; a narrower
  // one gives back, its title and search a bar of their own above the stages.
  const compact = bar === 'inline' && spot.width >= TABS_WITH_BAR;
  const searching = query !== null;
  const goThrough =
    !searching && stage === 'needs' && yours.open.length > 0 ? (
      <GoThrough
        count={yours.open.length}
        foot={spot.foot}
        onPress={() => {
          feel.tick();
          onGoThrough();
        }}
      />
    ) : null;
  // The list ends above the pill, so no row ever shows cut beneath it.
  return (
    <Column
      alignment="start"
      spacing={0}
      modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'top' })]}
    >
      {searching ? (
        <Search
          query={query}
          glass={paged}
          onChange={setQuery}
          onCancel={() => {
            feel.tick();
            setQuery(null);
          }}
        />
      ) : (
        <Column alignment="start" spacing={0} modifiers={[frame({ maxWidth: Infinity })]}>
          {compact ? null : bar === 'center' ? (
            <ListHead toolbarLine={toolbarLine} onSearch={startSearch} />
          ) : (
            <PageBar title="Tasks" back={back} trailing={<SearchButton onPress={startSearch} />} />
          )}
          <Tabs
            counts={counts}
            stage={stage}
            offline={unreachable}
            onChange={chooseStage}
            back={compact ? back : undefined}
            onSearch={compact ? startSearch : undefined}
          />
        </Column>
      )}
      <Faded>
        <List
          modifiers={[
            listStyle('plain'),
            scrollContentBackground('hidden'),
            scrollClipDisabled(),
            ...(paged ? [] : [background(theme.sheet)]),
            frame({ maxWidth: Infinity, maxHeight: Infinity }),
            animation(
              motion.list,
              rowsKey(shown.map((entry) => `${entry.id}:${yours.answered[entry.id] ?? ''}`)),
            ),
          ]}
        >
          {!searching && stage === 'needs' && picks.length > 1 ? (
            <PicksRow
              picks={picks}
              width={width}
              onTake={() => {
                feel.tap();
                for (const { ask, option } of picks) yours.answer(ask, option);
              }}
            />
          ) : null}
          {topics.flatMap((topic) => {
            if (!searching && stage === 'quiet')
              return [<QuietRow key={topic.name} topic={topic} width={width} onOpen={openTask} />];
            const lead = topic.entries.map(taskOf).find(Boolean);
            return [
              <TopicHead
                key={`${topic.name}:head`}
                topic={topic}
                width={width}
                onPress={lead ? () => openTask(lead) : undefined}
              />,
              ...topic.entries.map((entry, i) => (
                <EntryRow key={entry.id} entry={entry} first={i === 0} {...actions} />
              )),
            ];
          })}
          {!searching && stage === 'needs' && yours.list?.check ? (
            <CheckRow
              check={yours.list.check}
              width={width}
              onPress={() => {
                feel.tick();
                pages.go({ to: 'check' });
              }}
            />
          ) : null}
          {loaded && !topics.length ? (
            <Empty text={query ? 'Nothing matches' : EMPTY[stage]} width={width} />
          ) : null}
          {unreachable ? <Empty text="Can’t reach hex" width={width} /> : null}
        </List>
      </Faded>
      {goThrough}
    </Column>
  );
}

function GoThrough({ count, foot, onPress }: { count: number; foot: number; onPress: () => void }) {
  return (
    <Row
      alignment="center"
      spacing={9}
      onPress={onPress}
      modifiers={[
        frame({ height: 52 }),
        frame({ maxWidth: Infinity }),
        background(theme.prominent),
        clipShape('capsule'),
        contentShape(shapes.capsule()),
        padding({ leading: 16, trailing: 16, top: 12, bottom: Math.max(16, foot) }),
        ...(ios ? [accessibilityLabel(`Go through ${count} with hex, on a call`)] : []),
      ]}
    >
      <Spacer flexible />
      <Icon name="waveform" size={16} color={theme.onProminent} />
      <Text
        textStyle={{ fontSize: 17, fontWeight: '600' }}
        modifiers={[foregroundStyle(theme.onProminent)]}
      >
        {`Go through ${count} with hex`}
      </Text>
      <Spacer flexible />
    </Row>
  );
}
