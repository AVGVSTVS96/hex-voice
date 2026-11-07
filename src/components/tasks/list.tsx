import { Column, Icon, Row, Spacer } from '@expo/ui';
import { List } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  animation,
  background,
  clipShape,
  contentShape,
  frame,
  id,
  listStyle,
  padding,
  scrollClipDisabled,
  scrollContentBackground,
  shapes,
} from '@expo/ui/swift-ui/modifiers';
import { useEffect, useMemo, useState } from 'react';

import { PageBar, useChrome } from '@/components/tasks/bar';
import { CheckRow, PicksRow, TopicHead } from '@/components/tasks/inbox';
import { Search, SearchButton, Tabs } from '@/components/tasks/list-head';
import { useField, type Pages, type Spot } from '@/components/tasks/pages';
import { Empty, Faded, Loading, UNREACHED, listRow, type Feel } from '@/components/tasks/parts';
import { EntryRow, ProjectRow } from '@/components/tasks/rows';
import type { TasksAt } from '@/components/tasks/tasks-view';
import type { useAsks } from '@/hooks/use-asks';
import type { Ask, AskOption } from '@/live/asks';
import type { Counts } from '@/hooks/use-tasks';
import {
  inboxEntries,
  picksOf,
  search,
  stageCounts,
  pageOf,
  taskOf,
  topicIn,
  topicsOf,
  type Stage,
  type Tile,
  type PageId,
} from '@/live/inbox';
import type { TaskRow } from '@/live/tasks';
import { motion, rowsKey } from '@/motion';
import { theme } from '@/theme';
import { Text } from '@/ui/text';
import { metrics, space } from '@/ui/tokens';

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
  tasks,
  offline,
  current,
  yours,
  feel,
  onAnswer,
  onUndo,
  onOpenTile,
  onGoThrough,
  onCounts,
}: {
  open: boolean;
  at: TasksAt;
  pages: Pages;
  spot: Spot;
  tasks: TaskRow[] | undefined;
  offline: boolean;
  // hex has answered since this list showed what was kept on this device, and nothing failed since.
  current: boolean;
  yours: ReturnType<typeof useAsks>;
  feel: Feel;
  onAnswer: (ask: Ask, option: AskOption) => void;
  onUndo: (ask: Ask) => void;
  onOpenTile: (tile: Tile) => void;
  onGoThrough: () => void;
  onCounts: (counts: Counts | undefined) => void;
}) {
  const { back } = useChrome();
  const [stage, setStage] = useState<Stage>('needs');
  const [query, setQuery] = useState<string | null>(null);
  const entries = useMemo(
    () => inboxEntries(tasks ?? [], yours.list, yours.shown),
    [tasks, yours.list, yours.shown],
  );
  const counts = stageCounts(entries, yours.answered);
  const loaded = !!(yours.list && tasks);
  const behind = loaded && (offline || yours.offline);
  const { needs, working } = counts;
  const counted = open && loaded && current && yours.current;
  useEffect(() => {
    if (!counted) return;
    onCounts({ needs, working });
    return () => onCounts(undefined);
  }, [counted, needs, working, onCounts]);
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
  const topics = useMemo(() => topicsOf(shown, entries), [shown, entries]);
  const picks = picksOf(entries, yours.answered);
  const beside = pages.shape !== 'one';
  const searching = query !== null;
  const first = searching ? shown.map(taskOf).find(Boolean) : topics[0] && pageOf(topics[0]);
  // The first project is picked beside the list whatever the width, so the moment SwiftUI lays Tasks
  // out as two pages it's already there; on one page it waits unpicked behind the list. Opening
  // starts the pages afresh after this has run (a parent's effect runs after its child's), and the
  // fresh path is what makes it pick again.
  useEffect(() => {
    if (open && !pages.task && first) pages.go({ to: 'beside', id: first });
  }, [open, pages.task, pages.path, first]);
  const selected = beside
    ? ((
        shown.find((entry) => entry.id === pages.row && taskOf(entry) === pages.task) ??
        shown.find((entry) => taskOf(entry) === pages.task)
      )?.id ?? null)
    : null;
  // The project open beside the list, by what its page shows.
  const openTopic = beside
    ? (entries.find((entry) => taskOf(entry) === pages.task)?.topic ?? topicIn(pages.task))
    : undefined;

  const searchField = useField();
  const openPage = (id: PageId, row?: string) => {
    feel.tick();
    searchField.current?.blur();
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
  // Rows keep a readable measure, centered, however wide the page.
  const width = Math.min(spot.width, metrics.readable);
  const actions = {
    width,
    selected,
    answered: yours.answered,
    onOpen: openPage,
    onOpenTile,
    onAnswer,
    onUndo,
    onDismiss: (ask: Ask) => {
      feel.tap();
      yours.dismiss(ask);
    },
    onAgain: (ask: Ask) => {
      feel.tap();
      yours.again(ask);
    },
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
  const goThrough =
    !searching && stage === 'needs' && yours.open.length > 0 ? (
      <GoThrough
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
          field={searchField}
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
              large
              back={back}
              trailing={<SearchButton onPress={startSearch} />}
            />
          )}
          <Tabs
            counts={counts}
            stage={stage}
            unknown={!loaded}
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
            frame({ maxWidth: metrics.readable, maxHeight: Infinity }),
            animation(
              motion.list,
              rowsKey(shown.map((entry) => `${entry.id}:${yours.answered[entry.id] ?? ''}`)),
            ),
            // Rows coming and going within a stage settle; another stage or a search is another
            // list, which swaps in whole instead of fading its rows through this one's.
            id(searching ? 'search' : stage),
          ]}
        >
          {behind ? <Behind width={width} /> : null}
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
            if (!searching)
              return [
                <ProjectRow
                  key={topic.name}
                  topic={topic}
                  stage={stage}
                  width={width}
                  selected={topic.name === openTopic}
                  onOpen={() => openPage(pageOf(topic), topic.entries[0]?.id)}
                />,
              ];
            const lead = topic.entries.map(taskOf).find(Boolean);
            return [
              <TopicHead
                key={`${topic.name}:head`}
                topic={topic}
                width={width}
                onPress={() => openPage(lead ?? pageOf(topic))}
              />,
              ...topic.entries.map((entry) => (
                <EntryRow key={entry.id} entry={entry} {...actions} />
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
          {unreachable ? (
            <Empty text={UNREACHED} width={width} />
          ) : !loaded ? (
            <Loading width={width} />
          ) : null}
        </List>
      </Faded>
      {goThrough}
    </Column>
  );
}

// While hex is slow or out of reach, what's shown is what it last sent, and says so quietly.
function Behind({ width }: { width: number }) {
  return (
    <Text
      variant="caption"
      tone="tertiary"
      modifiers={[
        padding({ leading: metrics.list.inset, top: space[2], bottom: space[2] }),
        frame({ maxWidth: Infinity, alignment: 'leading' }),
        ...listRow(width),
      ]}
    >
      Last from hex · waiting for an update
    </Text>
  );
}

function GoThrough({ foot, onPress }: { foot: number; onPress: () => void }) {
  return (
    <Row
      alignment="center"
      spacing={metrics.pill.gap}
      onPress={onPress}
      modifiers={[
        frame({ height: metrics.pill.height }),
        frame({ maxWidth: metrics.readable }),
        background(theme.prominent),
        clipShape('capsule'),
        contentShape(shapes.capsule()),
        padding({
          leading: space[4],
          trailing: space[4],
          top: space[3],
          bottom: Math.max(space[4], foot),
        }),
        frame({ maxWidth: Infinity }),
        accessibilityLabel('Go through them with hex'),
      ]}
    >
      <Spacer flexible />
      <Icon name="waveform" size={metrics.symbol.bar} color={theme.onProminent} />
      <Text variant="headline" tone="onProminent">
        Go through them with hex
      </Text>
      <Spacer flexible />
    </Row>
  );
}
