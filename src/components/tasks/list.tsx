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
import { CollapseButton, Search, SearchButton, Tabs } from '@/components/tasks/list-head';
import type { Pages, Spot } from '@/components/tasks/pages';
import { Empty, Faded, asks, ios, type Feel } from '@/components/tasks/parts';
import { EntryRow, ProjectRow, QuietRow } from '@/components/tasks/rows';
import type { TasksAt } from '@/components/tasks/tasks-view';
import type { useAsks } from '@/hooks/use-asks';
import { useSavedPreference } from '@/hooks/use-saved-preference';
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

// Held wide, the list folds each project to one row, or shows every task.
type Listing = 'tasks' | 'projects';
const isListing = (value: unknown): value is Listing => value === 'tasks' || value === 'projects';

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
  wide,
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
  // The list sits beside a topic's page, side by side, so it can fold to its projects.
  wide: boolean;
  tasks: TaskRow[] | undefined;
  offline: boolean;
  yours: ReturnType<typeof useAsks>;
  feel: Feel;
  onAnswer: (ask: Ask, option: AskOption) => void;
  onUndo: (ask: Ask) => void;
  onOpenTile: (tile: Tile) => void;
  onGoThrough: () => void;
}) {
  const { back } = useChrome();
  const [stage, setStage] = useState<Stage>('needs');
  const [query, setQuery] = useState<string | null>(null);
  const folding = useSavedPreference('tasks.list', 'projects', isListing);
  const projects = wide && folding.value === 'projects';
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
  const first = shown.map(taskOf).find(Boolean);
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
  const compact = spot.width >= TABS_WITH_BAR;
  const collapse = wide ? (
    <CollapseButton
      collapsed={projects}
      disabled={stage === 'quiet' && query === null}
      onPress={() => {
        feel.tick();
        folding.setValue(projects ? 'tasks' : 'projects');
      }}
    />
  ) : null;
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
          onChange={setQuery}
          onCancel={() => {
            feel.tick();
            setQuery(null);
          }}
        />
      ) : (
        <Column alignment="start" spacing={0} modifiers={[frame({ maxWidth: Infinity })]}>
          {compact ? null : (
            <PageBar
              title="Tasks"
              back={back}
              trailing={
                <Row alignment="center" spacing={8}>
                  {collapse}
                  <SearchButton onPress={startSearch} />
                </Row>
              }
            />
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
            if (projects && !searching)
              return [
                <ProjectRow
                  key={topic.name}
                  topic={topic}
                  stage={stage}
                  width={width}
                  selected={!!lead && lead === pages.task}
                  onOpen={() => lead && openTask(lead, topic.entries[0]?.id)}
                />,
              ];
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
        ...(ios ? [accessibilityLabel(`Go through ${asks(count)} with hex, on a call`)] : []),
      ]}
    >
      <Spacer flexible />
      <Icon name="waveform" size={16} color={theme.onProminent} />
      <Text
        textStyle={{ fontSize: 17, fontWeight: '600' }}
        modifiers={[foregroundStyle(theme.onProminent)]}
      >
        {`Go through ${asks(count)} with hex`}
      </Text>
      <Spacer flexible />
    </Row>
  );
}
