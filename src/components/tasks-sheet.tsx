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
import { useEffect, useState } from 'react';
import { Linking, View, useWindowDimensions } from 'react-native';

import { Glyph, type GlyphState } from '@/components/agent-line';
import { useTask, useTasks } from '@/hooks/use-tasks';
import {
  STATE_WORDS,
  clock,
  groupTasks,
  idleLine,
  openLabel,
  taskTime,
  tasksSubtitle,
  type Task,
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

const glyph = (state: TaskState): GlyphState => (state === 'working' ? 'running' : state);

// Every hex task in one sheet: what needs you, what's working with its newest step, what finished
// today, and the rest folded into one Idle line. Before a call it opens full height; on a call it
// opens half height so the orb stays in view and the call goes on behind it. A row opens its own
// page, pushed in like the voice page in Settings.
export function TasksSheet({ isPresented, onDismiss, onCall, haptics, onTalk }: Props) {
  const { width } = useWindowDimensions();
  const { tasks, version, offline } = useTasks(isPresented);
  const [openId, setOpenId] = useState<string | null>(null);
  const task = useTask(openId, version);
  const [detent, setDetent] = useState<PresentationDetent>(onCall ? 'medium' : 'large');
  useEffect(() => {
    if (isPresented) setDetent(onCall ? 'medium' : 'large');
  }, [isPresented, onCall]);

  const tick = () => {
    if (ios && haptics) void Haptics.selectionAsync();
  };
  const open = (row: TaskRow) => {
    tick();
    setOpenId(row.id);
  };
  const back = () => {
    tick();
    setOpenId(null);
  };
  const groups = groupTasks(tasks ?? []);
  const shown = !!openId;
  const page = (visible: boolean, away: number) => [
    frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'top' }),
    background(theme.sheet),
    offset({ x: visible ? 0 : away }),
    animation(motion.page, shown),
    accessibilityHidden(!visible),
  ];
  const detail = task ?? tasks?.find((row) => row.id === openId);

  return (
    <Host colorScheme="dark" seedColor="#FFFFFF" style={{ position: 'absolute' }}>
      <BottomSheet
        isPresented={isPresented}
        onIsPresentedChange={(presented) => {
          if (!presented) onDismiss();
        }}
        onDismiss={() => setOpenId(null)}
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
            <Column alignment="center" spacing={6} modifiers={page(!shown, -width / 3)}>
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
              <ScrollView
                showsIndicators={false}
                modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'top' })]}
              >
                <Column alignment="start" spacing={0} modifiers={[padding({ bottom: 40 })]}>
                  {groups.map((group) => (
                    <Column key={group.key} alignment="start" spacing={0}>
                      <GroupHead title={group.title} count={group.tasks.length} />
                      {group.key === 'idle' ? (
                        <Text
                          textStyle={{ color: theme.tertiary, fontSize: 15, lineHeight: 20 }}
                          modifiers={[
                            padding({ leading: INSET, trailing: INSET, top: 6, bottom: 14 }),
                            frame({ maxWidth: Infinity, alignment: 'leading' }),
                          ]}
                        >
                          {idleLine(group.tasks)}
                        </Text>
                      ) : (
                        group.tasks.map((row) => (
                          <Column key={row.id} alignment="start" spacing={0}>
                            <TaskLine row={row} onPress={() => open(row)} />
                            {row.state === 'working' &&
                              row.agents.map((agent) => (
                                <TaskLine
                                  key={agent.id}
                                  sub
                                  row={{
                                    ...row,
                                    name: agent.label,
                                    where: '',
                                    line: agent.line ?? '',
                                  }}
                                  onPress={() => open(row)}
                                />
                              ))}
                          </Column>
                        ))
                      )}
                    </Column>
                  ))}
                </Column>
              </ScrollView>
            </Column>
            <Column alignment="center" spacing={0} modifiers={page(shown, width)}>
              {detail ? (
                <Detail
                  task={detail}
                  onBack={back}
                  onTalk={() => {
                    tick();
                    onTalk(detail);
                  }}
                />
              ) : (
                <Spacer />
              )}
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
        <Text numberOfLines={1} textStyle={{ color: theme.text, fontSize: 17, fontWeight: '600' }}>
          {title}
        </Text>
        <Text numberOfLines={1} textStyle={{ color: theme.secondary, fontSize: 13 }}>
          {subtitle}
        </Text>
      </Column>
      <Spacer flexible />
      <Spacer style={{ width: HEADER }} />
    </Row>
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
      <Text textStyle={{ color: theme.secondary, fontSize: 13, fontWeight: '600' }}>{title}</Text>
      <Spacer flexible />
      <Text textStyle={{ color: theme.tertiary, fontSize: 13 }}>{String(count)}</Text>
    </Row>
  );
}

// A row: its mark, the thread's name and app, when, then one line in its own words: the newest
// step while it works, what it's waiting on when it needs you, its last status once it's settled.
function TaskLine({
  row,
  sub = false,
  onPress,
}: {
  row: TaskRow;
  sub?: boolean;
  onPress: () => void;
}) {
  const live = row.state === 'working' || row.state === 'needs';
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
                `${row.name}${row.where ? `, ${row.where}` : ''}, ${STATE_WORDS[row.state]}: ${row.line}`,
              ),
            ]
          : []),
      ]}
    >
      <RNHostView matchContents>
        <View>
          <Glyph state={glyph(row.state)} />
        </View>
      </RNHostView>
      <Column
        alignment="start"
        spacing={2}
        modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
      >
        <Row alignment="center" spacing={6} modifiers={[frame({ maxWidth: Infinity })]}>
          <Text
            numberOfLines={1}
            textStyle={{ color: theme.text, fontSize: 16, fontWeight: sub ? '400' : '500' }}
          >
            {row.name}
          </Text>
          {row.where ? (
            <Text numberOfLines={1} textStyle={{ color: theme.secondary, fontSize: 14 }}>
              {row.where}
            </Text>
          ) : null}
          <Spacer flexible />
          {sub ? null : (
            <Text textStyle={{ color: theme.tertiary, fontSize: 13 }}>{taskTime(row)}</Text>
          )}
        </Row>
        {row.line ? (
          <Text
            numberOfLines={2}
            textStyle={{
              color: row.state === 'failed' ? theme.danger : live ? theme.text : theme.secondary,
              fontSize: 15,
              lineHeight: 17,
              fontWeight: row.state === 'working' && !sub ? '500' : '400',
            }}
          >
            {row.line}
          </Text>
        ) : null}
      </Column>
    </Row>
  );
}

// A task's own page: what it's waiting on, what it did lately, and two ways to answer.
function Detail({
  task,
  onBack,
  onTalk,
}: {
  task: TaskRow | Task;
  onBack: () => void;
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
        <Column
          alignment="start"
          spacing={22}
          modifiers={[padding({ leading: INSET, trailing: INSET, top: 22, bottom: 40 })]}
        >
          {needs ? (
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
                <RNHostView matchContents>
                  <View
                    style={{
                      width: 16,
                      height: 16,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <View
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: theme.accent,
                      }}
                    />
                  </View>
                </RNHostView>
                <Text textStyle={{ color: theme.accent, fontSize: 13, fontWeight: '600' }}>
                  {`Waiting on you since ${clock(new Date(task.since))}`}
                </Text>
              </Row>
              <Text textStyle={{ color: theme.text, fontSize: 17, lineHeight: 20 }}>{needs}</Text>
            </Column>
          ) : task.state === 'working' ? (
            <Column
              alignment="start"
              spacing={10}
              modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
            >
              <TaskLine row={{ ...task, name: 'Working now', where: '' }} onPress={() => {}} />
              {task.agents.map((agent) => (
                <TaskLine
                  key={agent.id}
                  sub
                  row={{ ...task, name: agent.label, where: '', line: agent.line ?? '' }}
                  onPress={() => {}}
                />
              ))}
            </Column>
          ) : null}
          {lately.length ? (
            <Column
              alignment="start"
              spacing={14}
              modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
            >
              <Text textStyle={{ color: theme.secondary, fontSize: 13, fontWeight: '600' }}>
                Lately
              </Text>
              {lately.map((moment, i) => (
                <Row
                  key={`${moment.at} ${i}`}
                  alignment="start"
                  spacing={12}
                  modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
                >
                  <RNHostView matchContents>
                    {i === 0 ? (
                      <View>
                        <Glyph state={glyph(moment.state)} />
                      </View>
                    ) : (
                      <View
                        style={{
                          width: 22,
                          height: 20,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <View
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: 3,
                            backgroundColor: theme.tertiary,
                          }}
                        />
                      </View>
                    )}
                  </RNHostView>
                  <Text
                    textStyle={{
                      color: i === 0 ? theme.text : theme.secondary,
                      fontSize: 15,
                      lineHeight: 17,
                    }}
                    modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
                  >
                    {moment.text}
                  </Text>
                  <Text textStyle={{ color: theme.tertiary, fontSize: 13 }}>
                    {clock(new Date(moment.at))}
                  </Text>
                </Row>
              ))}
            </Column>
          ) : null}
          <Row alignment="center" spacing={10} modifiers={[frame({ maxWidth: Infinity })]}>
            <Pill label="Talk it through" prominent onPress={onTalk} />
            {open ? <Pill label={open} onPress={() => void Linking.openURL(task.link!)} /> : null}
          </Row>
        </Column>
      </ScrollView>
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
        textStyle={{
          color: prominent ? theme.onProminent : theme.text,
          fontSize: 17,
          fontWeight: prominent ? '600' : '500',
        }}
      >
        {label}
      </Text>
      <Spacer flexible />
    </Row>
  );
}
