import { Column, Row, ScrollView, Text } from '@expo/ui';
import { foregroundStyle, frame, padding } from '@expo/ui/swift-ui/modifiers';
import { Linking } from 'react-native';

import { AgentRow, Header, INSET, Inset, Line, Mark, Pill } from '@/components/tasks/parts';
import { Pinned, YourCall } from '@/components/tasks/pinned';
import type { Ask, AskOption } from '@/live/asks';
import {
  STATE_WORDS,
  activityOf,
  clock,
  openLabel,
  type Task,
  type TaskRow,
  type TaskState,
} from '@/live/tasks';
import { theme } from '@/theme';

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

// A task's own page: what's working on it, its asks answered right here, its pinned status post
// drawn natively, what it did lately, and two ways to talk. Each line of work opens that agent's
// steps. Without asks or a pinned post, what it waits on shows as it said it.
export function Detail({
  task,
  onBack,
  onActivity,
  onAnswer,
  onTalk,
}: {
  task: TaskRow | Task;
  onBack: () => void;
  onActivity: (agent: string | null) => void;
  onAnswer: (ask: Ask, option: AskOption) => void;
  onTalk: () => void;
}) {
  const full = 'lately' in task ? task : undefined;
  const asks = full?.asks ?? [];
  const pinned = !!(asks.length || full?.pin);
  const needs = task.state === 'needs' && !pinned ? (full?.needs ?? task.line) : undefined;
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
          <YourCall asks={asks} onAnswer={onAnswer} />
          {full?.pin ? <Pinned text={full.pin} /> : null}
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
export function Steps({
  task,
  agent,
  onBack,
}: {
  task: Task;
  agent: string | null;
  onBack: () => void;
}) {
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
