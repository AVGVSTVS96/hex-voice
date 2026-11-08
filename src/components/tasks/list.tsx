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
import { useEffect, useMemo } from 'react';

import { PageBar, useChrome } from '@/components/tasks/bar';
import type { Back } from '@/components/tasks/bar';
import { CheckRow, PicksRow, TopicHead } from '@/components/tasks/inbox';
import { Search, SearchButton, Tabs } from '@/components/tasks/list-head';
import { useField } from '@/components/tasks/pages';
import type { Pages, Spot } from '@/components/tasks/pages';
import { Empty, Faded, Loading, UNREACHED, listRow } from '@/components/tasks/parts';
import type { Feel } from '@/components/tasks/parts';
import { EntryRow, ProjectRow } from '@/components/tasks/rows';
import type { useAsks } from '@/hooks/use-asks';
import type { Ask, AskOption } from '@/live/asks';
import type { Counts } from '@/hooks/use-tasks';
import {
  doneIn,
  picksOf,
  search,
  whyOf,
  stageCounts,
  stageTopics,
  tabEntries,
  pageOf,
  taskOf,
  topicIn,
  topicsOf,
} from '@/live/inbox';
import type { Entry, PageId, Stage, Tab, Tile, Topic } from '@/live/inbox';
import type { TaskRow } from '@/live/tasks';
import { motion, rowsKey } from '@/motion';
import { theme } from '@/theme';
import { Text } from '@/ui/text';
import { breakpoint, metrics, space } from '@/ui/tokens';

import { Fits } from '../../../modules/rows';

const EMPTY: Record<Tab, string> = {
  all: 'Nothing from hex yet',
  needs: 'Nothing waits on you',
  working: 'Nothing is working',
  done: 'Nothing done in the last day',
  quiet: 'Nothing is quiet',
};

type Yours = ReturnType<typeof useAsks>;

export const ListPage = ({
  open,
  stage,
  pages,
  spot,
  tasks,
  entries,
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
  stage: Tab;
  pages: Pages;
  spot: Spot;
  tasks: TaskRow[] | undefined;
  entries: Entry[];
  offline: boolean;
  // hex has answered since this list showed what was kept on this device, and nothing failed since.
  current: boolean;
  yours: Yours;
  feel: Feel;
  onAnswer: (ask: Ask, option: AskOption) => void;
  onUndo: (ask: Ask) => void;
  onOpenTile: (tile: Tile) => void;
  onGoThrough: () => void;
  onCounts: (counts: Counts | undefined) => void;
}) => {
  const { back } = useChrome();
  const { query } = pages;

  const setQuery = (next: string | null) => {
    pages.go({ to: 'search', query: next });
  };

  const counts = stageCounts(entries, yours.answered);
  const { loaded, behind, unreachable } = statusOf(yours, tasks, offline);
  const { needs, working } = counts;
  const counted = open && loaded && current && yours.current;
  useEffect(() => {
    if (counted) {
      onCounts({ needs, working });
    }

    return () => {
      if (counted) {
        onCounts(undefined);
      }
    };
  }, [counted, needs, working, onCounts]);

  const shown = useMemo(
    () => (query === null ? tabEntries(entries, stage) : search(entries, query)),
    [entries, stage, query],
  );

  const topics = useMemo(
    () => (query === null ? stageTopics(entries, stage) : topicsOf(shown, entries)),
    [shown, entries, query, stage],
  );

  const picks = picksOf(entries, yours.answered);
  const searching = query !== null;
  const needsTab = !searching && stage === 'needs';
  const first = firstPage(searching, shown, topics);
  // The first project is picked beside the list whatever the width, so the moment SwiftUI lays Tasks
  // out as two pages it's already there; on one page it waits unpicked behind the list.
  useEffect(() => {
    if (open && (pages.task ?? '') === '' && first !== undefined && first !== '') {
      pages.go({ to: 'beside', id: first });
    }
  }, [open, pages.task, first]);
  const { beside, apart, selected, openTopic } = besideOf(pages, shown, entries);

  const searchField = useField();

  const openPage = (page: PageId, row?: string) => {
    feel.tick();
    searchField.current?.blur();
    pages.go({ to: 'topic', id: page, row });
  };

  // A new tab picks its first project beside the list in the same move, so the page beside never
  // empties between them.
  const chooseStage = (next: Tab) => {
    feel.tick();
    pages.go({ to: 'stage', stage: next });
    const lead = stageTopics(entries, next).at(0);

    if (beside) {
      pages.go({ to: 'beside', id: lead ? pageOf(lead) : null });
    }
  };

  const startSearch = () => {
    feel.tick();
    setQuery('');
  };

  const actions = {
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
    onAct: (item: string) => {
      feel.tap();
      void yours.act(item);
    },
    onRead: (item: string) => {
      feel.tick();
      void yours.read(item);
    },
  };

  const loading = loaded ? null : <Loading />;
  // A page as wide as a landscape phone holds back, its title, the stages and search in one row,
  // where they fit; a narrower one gives back, its title and search a bar of their own above the
  // stages. SwiftUI picks from the width it lays the page out at.
  const tabs = { counts, stage, unknown: !loaded, onChange: chooseStage };

  const goThrough =
    needsTab && yours.open.length > 0 ? (
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
        <Fits>
          <Tabs
            {...tabs}
            title="Tasks"
            back={back}
            onSearch={startSearch}
            modifiers={[frame({ minWidth: breakpoint.beside })]}
          />
          <Column alignment="start" spacing={0} modifiers={[frame({ maxWidth: Infinity })]}>
            <PageBar
              title="Tasks"
              large
              back={back}
              trailing={<SearchButton onPress={startSearch} />}
            />
            <Tabs {...tabs} />
          </Column>
        </Fits>
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
          {behind ? <Behind /> : null}
          {needsTab && picks.length > 1 ? (
            <PicksRow
              n={picks.length}
              selected={apart === 'picks'}
              onOpen={() => {
                feel.tick();
                pages.go({ to: 'picks' });
              }}
            />
          ) : null}
          {topics.flatMap((topic) => {
            if (!searching) {
              return [
                <ProjectRow
                  key={stage === 'done' ? topic.entries[0].id : topic.name}
                  topic={topic}
                  selected={
                    stage === 'done' ? pageOf(topic) === pages.task : topic.name === openTopic
                  }
                  onOpen={() => {
                    openPage(pageOf(topic), topic.entries[0]?.id);
                  }}
                />,
              ];
            }

            const lead = topic.entries.map(taskOf).find(Boolean);

            return [
              <TopicHead
                key={`${topic.name}:head`}
                topic={topic}
                onPress={() => {
                  openPage(lead ?? pageOf(topic));
                }}
              />,
              ...topic.entries.map((entry) => (
                <EntryRow key={entry.id} entry={entry} why={whyOf(entry, query)} {...actions} />
              )),
            ];
          })}
          {needsTab && yours.list?.check ? (
            <CheckRow
              check={yours.list.check}
              selected={apart === 'check'}
              onPress={() => {
                feel.tick();
                pages.go({ to: 'check' });
              }}
            />
          ) : null}
          {loaded && !topics.length ? <Empty text={emptyText(query, stage)} /> : null}
          {unreachable ? <Empty text={UNREACHED} /> : loading}
        </List>
      </Faded>
      {goThrough}
    </Column>
  );
};

const statusOf = (yours: Yours, tasks: TaskRow[] | undefined, offline: boolean) => {
  const loaded = !!(yours.list && tasks);
  const away = offline || yours.offline;

  return { loaded, behind: loaded && away, unreachable: away && !loaded };
};

const besideOf = (pages: Pages, shown: Entry[], entries: Entry[]) => {
  const beside = pages.shape !== 'one';
  const [lead] = pages.path;
  // hex's picks or the last check open beside the list in place of a project's page.
  const apart = beside && (lead === 'picks' || lead === 'check') ? lead : undefined;

  if (!beside || apart !== undefined) {
    return { beside, apart, selected: null, openTopic: undefined };
  }

  return {
    beside,
    apart,
    selected: selectedIn(shown, pages),
    // The project open beside the list, by what its page shows.
    openTopic: entries.find((entry) => taskOf(entry) === pages.task)?.topic ?? topicIn(pages.task),
  };
};

const firstPage = (searching: boolean, shown: Entry[], topics: Topic[]) => {
  const top = topics.at(0);

  return searching ? shown.map(taskOf).find(Boolean) : top && pageOf(top);
};

const selectedIn = (shown: Entry[], { task, row }: Pages) =>
  (
    shown.find((entry) => entry.id === doneIn(task)) ??
    shown.find((entry) => entry.id === row && taskOf(entry) === task) ??
    shown.find((entry) => taskOf(entry) === task)
  )?.id ?? null;

const emptyText = (query: string | null, stage: Tab) =>
  query === null || query === '' ? EMPTY[stage] : 'Nothing matches';

// While hex is slow or out of reach, what's shown is what it last sent, and says so quietly.
const Behind = () => (
  <Text
    variant="caption"
    tone="tertiary"
    modifiers={[
      padding({ leading: metrics.list.inset, top: space[2], bottom: space[2] }),
      frame({ maxWidth: Infinity, alignment: 'leading' }),
      ...listRow(),
    ]}
  >
    Last from hex · waiting for an update
  </Text>
);

const GoThrough = ({ foot, onPress }: { foot: number; onPress: () => void }) => (
  <Row
    alignment="center"
    spacing={metrics.pill.gap}
    onPress={onPress}
    modifiers={[
      frame({ height: metrics.pill.height }),
      frame({ maxWidth: metrics.readable }),
      background(theme.fill),
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
    <Icon name="bubble.left.and.bubble.right" size={metrics.symbol.bar} color={theme.text} />
    <Text variant="headline">Go through them with hex</Text>
    <Spacer flexible />
  </Row>
);
