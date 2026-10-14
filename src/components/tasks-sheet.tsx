import { Column, Host, RNHostView, Row, ScrollView, Spacer, Text } from '@expo/ui';
import {
  BottomSheet,
  Button as NativeButton,
  Group as SheetContent,
  ZStack,
} from '@expo/ui/swift-ui';
import {
  accessibilityHidden,
  accessibilityLabel,
  animation,
  background,
  buttonBorderShape,
  buttonStyle,
  clipShape,
  contentShape,
  controlSize,
  foregroundStyle,
  frame,
  labelStyle,
  offset,
  padding,
  presentationBackground,
  presentationBackgroundInteraction,
  presentationDetents,
  presentationDragIndicator,
  shapes,
  type PresentationDetent,
} from '@expo/ui/swift-ui/modifiers';
import * as Haptics from 'expo-haptics';
import { useEffect, useState, type ReactNode } from 'react';
import { Linking, View, useWindowDimensions } from 'react-native';

import { Glyph } from '@/components/agent-line';
import { useTask, useTasks } from '@/hooks/use-tasks';
import {
  STATE_WORDS,
  activityOf,
  clock,
  groupTasks,
  idleLine,
  openLabel,
  taskTime,
  tasksSubtitle,
  type Task,
  type TaskAgent,
  type TaskRow,
  type TaskState,
} from '@/live/tasks';
import { motion } from '@/motion';
import { theme } from '@/theme';

const ios = process.env.EXPO_OS === 'ios';
const INSET = 22;
const HEADER = 44;

type Props = {
  isPresented: boolean;
  onDismiss: () => void;
  onCall: boolean;
  haptics: boolean;
  onTalk: (task: TaskRow) => void;
};

// The pages pushed over the list: a task's own page, and one agent's steps, which opens from the
// task's page or straight from its row in the list.
type Pushed = 'task' | 'activity';

// Every hex task in one sheet: what needs you, what's working with its newest step, what finished
// today, and the rest folded into one Idle line. Before a call it opens full height; on a call it
// opens half height so the call goes on behind it. Pages push in like the voice page in Settings,
// and each keeps what it showed while it slides back out.
export function TasksSheet({ isPresented, onDismiss, onCall, haptics, onTalk }: Props) {
  const { width } = useWindowDimensions();
  const { tasks, version, offline } = useTasks(isPresented);
  const [path, setPath] = useState<Pushed[]>([]);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [agent, setAgent] = useState<string | null>(null);
  const task = useTask(taskId, version);
  const [detent, setDetent] = useState<PresentationDetent>(onCall ? 'medium' : 'large');
  useEffect(() => {
    if (isPresented) setDetent(onCall ? 'medium' : 'large');
  }, [isPresented, onCall]);

  const tick = () => {
    if (ios && haptics) void Haptics.selectionAsync();
  };
  const openTask = (row: TaskRow) => {
    tick();
    setTaskId(row.id);
    setPath(['task']);
  };
  const openActivity = (id: string, who: string | null) => {
    tick();
    setTaskId(id);
    setAgent(who);
    setPath((now) => (now.at(-1) === 'task' ? ['task', 'activity'] : ['activity']));
  };
  const back = () => {
    tick();
    setPath((now) => now.slice(0, -1));
  };
  const groups = groupTasks(tasks ?? []);
  const front = path.at(-1);
  const x = (slot: Pushed | 'list') =>
    slot === (front ?? 'list') ? 0 : slot === 'list' || path.includes(slot) ? -width / 3 : width;
  const page = (slot: Pushed | 'list') => [
    frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'top' }),
    background(theme.sheet),
    offset({ x: x(slot) }),
    animation(motion.page, x(slot)),
    accessibilityHidden(x(slot) !== 0),
  ];
  const shown = task ?? tasks?.find((row) => row.id === taskId);

  return (
    <Host seedColor={theme.tint} style={{ position: 'absolute' }}>
      <BottomSheet
        isPresented={isPresented}
        onIsPresentedChange={(presented) => {
          if (!presented) onDismiss();
        }}
        onDismiss={() => setPath([])}
        testID="tasks-sheet"
      >
        <SheetContent
          modifiers={[
            presentationDragIndicator('visible'),
            presentationDetents(onCall ? ['medium', 'large'] : ['large'], {
              selection: detent,
              onSelectionChange: setDetent,
            }),
            ...(onCall
              ? [presentationBackgroundInteraction({ type: 'enabledUpThrough', detent: 'medium' })]
              : []),
            presentationBackground(theme.sheet),
          ]}
        >
          <ZStack
            alignment="top"
            modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'top' })]}
          >
            <Column alignment="center" spacing={6} modifiers={page('list')}>
              <Header
                title="Tasks"
                subtitle={
                  offline && !tasks
                    ? 'Can’t reach hex'
                    : tasks
                      ? tasksSubtitle(groups, onCall)
                      : ' '
                }
              />
              <Scroll>
                {groups.map((group) => (
                  <Column key={group.key} alignment="start" spacing={0}>
                    <GroupHead title={group.title} count={group.tasks.length} />
                    {group.key === 'idle' ? (
                      <Text
                        textStyle={{ fontSize: 15, lineHeight: 20 }}
                        modifiers={[
                          foregroundStyle(theme.tertiary),
                          padding({ leading: INSET, trailing: INSET, top: 6, bottom: 14 }),
                          frame({ maxWidth: Infinity, alignment: 'leading' }),
                        ]}
                      >
                        {idleLine(group.tasks)}
                      </Text>
                    ) : (
                      group.tasks.map((row) => (
                        <Column key={row.id} alignment="start" spacing={0}>
                          <Line
                            state={row.state}
                            title={row.name}
                            where={row.where}
                            time={taskTime(row)}
                            text={row.line}
                            onPress={() => openTask(row)}
                          />
                          {row.state === 'working' &&
                            row.agents.map((agent) => (
                              <AgentRow
                                key={agent.id}
                                agent={agent}
                                onPress={() => openActivity(row.id, agent.id)}
                              />
                            ))}
                        </Column>
                      ))
                    )}
                  </Column>
                ))}
              </Scroll>
            </Column>
            <Column alignment="center" spacing={0} modifiers={page('task')}>
              {shown ? (
                <Detail
                  task={shown}
                  onBack={back}
                  onActivity={(who) => openActivity(shown.id, who)}
                  onTalk={() => {
                    tick();
                    onTalk(shown);
                  }}
                />
              ) : (
                <Spacer />
              )}
            </Column>
            <Column alignment="center" spacing={0} modifiers={page('activity')}>
              {task ? <Steps task={task} agent={agent} onBack={back} /> : <Spacer />}
            </Column>
          </ZStack>
        </SheetContent>
      </BottomSheet>
    </Host>
  );
}

function Header({
  title,
  subtitle,
  onBack,
}: {
  title: string;
  subtitle: string;
  onBack?: () => void;
}) {
  return (
    <Row
      alignment="center"
      spacing={12}
      style={{ height: HEADER }}
      modifiers={[padding({ top: 14, leading: 16, trailing: 16 }), frame({ maxWidth: Infinity })]}
    >
      {onBack ? (
        <NativeButton
          label="Back"
          systemImage="chevron.left"
          onPress={onBack}
          testID="task-back"
          modifiers={[
            labelStyle('iconOnly'),
            buttonStyle('glass'),
            buttonBorderShape('circle'),
            controlSize('large'),
          ]}
        />
      ) : (
        <Spacer style={{ width: HEADER }} />
      )}
      <Spacer flexible />
      <Column alignment="center" spacing={1}>
        <Text
          numberOfLines={1}
          textStyle={{ fontSize: 17, fontWeight: '600' }}
          modifiers={[foregroundStyle(theme.text)]}
        >
          {title}
        </Text>
        <Text
          numberOfLines={1}
          textStyle={{ fontSize: 13 }}
          modifiers={[foregroundStyle(theme.secondary)]}
        >
          {subtitle}
        </Text>
      </Column>
      <Spacer flexible />
      <Spacer style={{ width: HEADER }} />
    </Row>
  );
}

function Scroll({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      showsIndicators={false}
      modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'top' })]}
    >
      <Column alignment="start" spacing={0} modifiers={[padding({ bottom: 40 })]}>
        {children}
      </Column>
    </ScrollView>
  );
}

function GroupHead({ title, count }: { title: string; count: number }) {
  return (
    <Row
      alignment="center"
      spacing={0}
      modifiers={[
        padding({ leading: INSET, trailing: INSET, top: 16, bottom: 4 }),
        frame({ maxWidth: Infinity }),
      ]}
    >
      <Text
        textStyle={{ fontSize: 13, fontWeight: '600' }}
        modifiers={[foregroundStyle(theme.secondary)]}
      >
        {title}
      </Text>
      <Spacer flexible />
      <Text textStyle={{ fontSize: 13 }} modifiers={[foregroundStyle(theme.tertiary)]}>
        {String(count)}
      </Text>
    </Row>
  );
}

function Mark({ state, quiet = false }: { state: TaskState; quiet?: boolean }) {
  return (
    <RNHostView matchContents>
      <View>
        <Glyph state={state === 'working' ? 'running' : state} quiet={quiet} />
      </View>
    </RNHostView>
  );
}

// A row: its mark, a name and where it lives, when, then one line in its own words: the newest
// step while it works, what it's waiting on when it needs you, its last status once it's settled.
function Line({
  state,
  title,
  where,
  time,
  text,
  sub = false,
  onPress,
}: {
  state: TaskState;
  title: string;
  where?: string;
  time?: string;
  text: string;
  sub?: boolean;
  onPress: () => void;
}) {
  const live = state === 'working' || state === 'needs';
  return (
    <Row
      alignment="start"
      spacing={12}
      onPress={onPress}
      modifiers={[
        padding({ leading: sub ? INSET + 32 : INSET, trailing: INSET, top: 10, bottom: 10 }),
        frame({ maxWidth: Infinity, alignment: 'leading' }),
        contentShape(shapes.rectangle()),
        ...(ios
          ? [
              accessibilityLabel(
                `${title}${where ? `, ${where}` : ''}, ${STATE_WORDS[state]}${text ? `: ${text}` : ''}`,
              ),
            ]
          : []),
      ]}
    >
      <Mark state={state} />
      <Column
        alignment="start"
        spacing={2}
        modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
      >
        <Row alignment="center" spacing={6} modifiers={[frame({ maxWidth: Infinity })]}>
          <Text
            numberOfLines={1}
            textStyle={{ fontSize: 16, fontWeight: sub ? '400' : '500' }}
            modifiers={[foregroundStyle(theme.text)]}
          >
            {title}
          </Text>
          {where ? (
            <Text
              numberOfLines={1}
              textStyle={{ fontSize: 14 }}
              modifiers={[foregroundStyle(theme.secondary)]}
            >
              {where}
            </Text>
          ) : null}
          <Spacer flexible />
          {time ? (
            <Text textStyle={{ fontSize: 13 }} modifiers={[foregroundStyle(theme.tertiary)]}>
              {time}
            </Text>
          ) : null}
        </Row>
        {text ? (
          <Text
            numberOfLines={2}
            textStyle={{
              fontSize: 15,
              lineHeight: 17,
              fontWeight: state === 'working' && !sub ? '500' : '400',
            }}
            modifiers={[
              foregroundStyle(
                state === 'failed' ? theme.danger : live ? theme.text : theme.secondary,
              ),
            ]}
          >
            {text}
          </Text>
        ) : null}
      </Column>
    </Row>
  );
}

function AgentRow({ agent, onPress }: { agent: TaskAgent; onPress: () => void }) {
  return (
    <Line sub state={agent.state} title={agent.label} text={agent.line ?? ''} onPress={onPress} />
  );
}

type HistoryEntry = { state: TaskState; newest: boolean; text: string; at: string };

// One entry of a history, newest first: the newest wears its own mark, and everything before it
// is marked quietly as done, failed or moved on from.
function Entry({ state, newest, text, at }: HistoryEntry) {
  return (
    <Row
      alignment="start"
      spacing={12}
      modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
    >
      <Mark state={state} quiet={!newest} />
      <Text
        textStyle={{ fontSize: 15, lineHeight: 17 }}
        modifiers={[
          foregroundStyle(newest ? theme.text : theme.secondary),
          frame({ maxWidth: Infinity, alignment: 'leading' }),
        ]}
      >
        {text}
      </Text>
      <Text textStyle={{ fontSize: 13 }} modifiers={[foregroundStyle(theme.tertiary)]}>
        {clock(new Date(at))}
      </Text>
    </Row>
  );
}

function History({ title, entries }: { title?: string; entries: HistoryEntry[] }) {
  return (
    <Column
      alignment="start"
      spacing={14}
      modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
    >
      {title ? (
        <Text
          textStyle={{ fontSize: 13, fontWeight: '600' }}
          modifiers={[foregroundStyle(theme.secondary)]}
        >
          {title}
        </Text>
      ) : null}
      {entries.map((entry, i) => (
        <Entry key={`${entry.at} ${i}`} {...entry} />
      ))}
    </Column>
  );
}

// A task's own page: what it's waiting on or what's working on it, what it did lately, and two
// ways to answer. Each line of work opens that agent's steps.
function Detail({
  task,
  onBack,
  onActivity,
  onTalk,
}: {
  task: TaskRow | Task;
  onBack: () => void;
  onActivity: (agent: string | null) => void;
  onTalk: () => void;
}) {
  const full = 'lately' in task ? task : undefined;
  const needs = task.state === 'needs' ? (full?.needs ?? task.line) : undefined;
  const lately = (full?.lately ?? []).filter((moment, i) => !(i === 0 && moment.text === needs));
  const open = openLabel(task);
  return (
    <Column
      alignment="center"
      spacing={0}
      modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'top' })]}
    >
      <Header
        title={task.name}
        subtitle={`${task.where} · ${STATE_WORDS[task.state]}`}
        onBack={onBack}
      />
      <ScrollView
        showsIndicators={false}
        modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'top' })]}
      >
        <Column alignment="start" spacing={22} modifiers={[padding({ top: 22, bottom: 40 })]}>
          {needs ? (
            <Inset>
              <Column
                alignment="start"
                spacing={8}
                style={{
                  backgroundColor: theme.group,
                  borderRadius: 22,
                  paddingHorizontal: 18,
                  paddingVertical: 16,
                }}
                modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
              >
                <Row alignment="center" spacing={8}>
                  <Mark state="needs" />
                  <Text
                    textStyle={{ fontSize: 13, fontWeight: '600' }}
                    modifiers={[foregroundStyle(theme.accent)]}
                  >
                    {`Waiting on you since ${clock(new Date(task.since))}`}
                  </Text>
                </Row>
                <Text
                  textStyle={{ fontSize: 17, lineHeight: 20 }}
                  modifiers={[foregroundStyle(theme.text)]}
                >
                  {needs}
                </Text>
              </Column>
            </Inset>
          ) : task.state === 'working' ? (
            <Column
              alignment="start"
              spacing={0}
              modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
            >
              <Line
                state="working"
                title="Working now"
                text={task.line}
                onPress={() => onActivity(null)}
              />
              {task.agents.map((agent) => (
                <AgentRow key={agent.id} agent={agent} onPress={() => onActivity(agent.id)} />
              ))}
            </Column>
          ) : null}
          {lately.length ? (
            <Inset>
              <History
                title="Lately"
                entries={lately.map((moment, i) => ({ ...moment, newest: i === 0 }))}
              />
            </Inset>
          ) : null}
          <Inset>
            <Row alignment="center" spacing={10} modifiers={[frame({ maxWidth: Infinity })]}>
              <Pill label="Talk it through" prominent onPress={onTalk} />
              {open ? <Pill label={open} onPress={() => void Linking.openURL(task.link!)} /> : null}
            </Row>
          </Inset>
        </Column>
      </ScrollView>
    </Column>
  );
}

// One agent's steps, zoomed in from its line: the newest turns while it works, and every step
// before it is done.
function Steps({ task, agent, onBack }: { task: Task; agent: string | null; onBack: () => void }) {
  const activity = activityOf(task, agent);
  const state: TaskState = activity?.state ?? 'done';
  return (
    <Column
      alignment="center"
      spacing={0}
      modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'top' })]}
    >
      <Header
        title={activity?.title ?? task.name}
        subtitle={`${agent === null ? task.where : task.name} · ${STATE_WORDS[state]}`}
        onBack={onBack}
      />
      <ScrollView
        showsIndicators={false}
        modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'top' })]}
      >
        <Column
          alignment="start"
          spacing={0}
          modifiers={[padding({ leading: INSET, trailing: INSET, top: 22, bottom: 40 })]}
        >
          {activity?.steps.length ? (
            <History
              entries={activity.steps.map((step, i) => ({
                ...step,
                state: i === 0 ? state : 'done',
                newest: i === 0,
              }))}
            />
          ) : (
            <Text
              textStyle={{ fontSize: 15, lineHeight: 20 }}
              modifiers={[foregroundStyle(theme.tertiary)]}
            >
              {state === 'working' ? 'No steps yet' : 'Steps show while it works'}
            </Text>
          )}
        </Column>
      </ScrollView>
    </Column>
  );
}

function Inset({ children }: { children: ReactNode }) {
  return (
    <Column
      alignment="start"
      spacing={0}
      modifiers={[
        padding({ leading: INSET, trailing: INSET }),
        frame({ maxWidth: Infinity, alignment: 'leading' }),
      ]}
    >
      {children}
    </Column>
  );
}

function Pill({
  label,
  prominent = false,
  onPress,
}: {
  label: string;
  prominent?: boolean;
  onPress: () => void;
}) {
  return (
    <Row
      alignment="center"
      spacing={0}
      onPress={onPress}
      modifiers={[
        frame({ height: 52 }),
        frame({ maxWidth: Infinity }),
        background(prominent ? theme.prominent : theme.surface),
        clipShape('capsule'),
        contentShape(shapes.capsule()),
        ...(ios ? [accessibilityLabel(label)] : []),
      ]}
    >
      <Spacer flexible />
      <Text
        textStyle={{ fontSize: 17, fontWeight: prominent ? '600' : '500' }}
        modifiers={[foregroundStyle(prominent ? theme.onProminent : theme.text)]}
      >
        {label}
      </Text>
      <Spacer flexible />
    </Row>
  );
}
