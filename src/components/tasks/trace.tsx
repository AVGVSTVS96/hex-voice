import { Column, Icon, Row, ScrollView, Spacer, Text } from '@expo/ui';
import {
  accessibilityLabel,
  contentShape,
  foregroundStyle,
  frame,
  monospacedDigit,
  padding,
  shapes,
} from '@expo/ui/swift-ui/modifiers';
import { useState, type ReactNode } from 'react';
import type { SFSymbol } from 'sf-symbols-typescript';

import { GAP, Header, INSET, MARK, Mark, SectionHead, ios } from '@/components/tasks/parts';
import { PLACES, placeOf } from '@/live/inbox';
import {
  STATE_WORDS,
  stepTimes,
  taskTime,
  type StepKind,
  type Task,
  type TaskStep,
} from '@/live/tasks';
import { theme } from '@/theme';

// Each kind of step's icon, as shadcn's Trace marks what a line did.
const KIND: Record<StepKind, SFSymbol> = {
  think: 'lightbulb',
  say: 'text.bubble',
  plan: 'list.bullet',
  run: 'terminal',
  read: 'doc.text',
  edit: 'pencil',
  search: 'magnifyingglass',
  web: 'globe',
  agent: 'arrow.triangle.branch',
  tool: 'wrench.and.screwdriver',
};
const PLANNED = { done: 'done', running: 'working', pending: 'pending' } as const;

// A thread a level down, drawn the way shadcn's Trace draws an agent's work: its plan with how far
// it got, then its steps newest first, each a line with what it did and how long it took, thoughts
// in their own words; then each agent it started, opening into its own steps.
export function Trace({ task, onBack }: { task: Task; onBack?: () => void }) {
  const working = task.state === 'working';
  const done = task.plan.filter((item) => item.state === 'done').length;
  const place = PLACES[placeOf(task.app)];
  return (
    <Column
      alignment="center"
      spacing={0}
      modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'top' })]}
    >
      <Header
        title={task.name}
        subtitle={`${place} · ${working ? `working for ${taskTime(task)}` : STATE_WORDS[task.state]}`}
        onBack={onBack}
      />
      <ScrollView
        showsIndicators={false}
        modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'top' })]}
      >
        <Column alignment="start" spacing={0} modifiers={[padding({ bottom: 40 })]}>
          {task.plan.length ? (
            <Column alignment="start" spacing={0}>
              <SectionHead title="Plan" count={`${done} of ${task.plan.length}`} />
              {task.plan.map((item, i) => (
                <TraceLine
                  key={`${i} ${item.text}`}
                  lead={<Mark state={PLANNED[item.state]} />}
                  text={item.text}
                  quiet={item.state === 'pending'}
                />
              ))}
            </Column>
          ) : null}
          <SectionHead title="Steps" count={task.steps.length ? 'newest first' : undefined} />
          {task.steps.length ? (
            <Steps steps={task.steps} working={working} />
          ) : (
            <Quiet text={working ? 'No steps yet' : 'Steps show while it works'} />
          )}
          {task.agents.length ? (
            <Column alignment="start" spacing={0}>
              <SectionHead title="Agents" count={task.agents.length} />
              {task.agents.map((agent) => (
                <Agent key={agent.id} agent={agent} />
              ))}
            </Column>
          ) : null}
        </Column>
      </ScrollView>
    </Column>
  );
}

export function Steps({
  steps,
  working,
  indent = 0,
}: {
  steps: TaskStep[];
  working: boolean;
  indent?: number;
}) {
  const times = stepTimes(steps, working);
  return (
    <Column alignment="start" spacing={0}>
      {steps.map((step, i) => (
        <TraceLine
          key={`${step.at} ${i}`}
          lead={
            i === 0 && working ? (
              <Mark state="working" />
            ) : (
              <Icon name={KIND[step.kind]} size={13} color={theme.secondary} />
            )
          }
          text={step.text}
          lines={step.kind === 'think' || step.kind === 'say' ? 3 : 1}
          time={times[i]}
          indent={indent}
        />
      ))}
    </Column>
  );
}

// An agent the thread started: its line opens into its own steps, and one still at work starts open.
function Agent({ agent }: { agent: Task['agents'][number] }) {
  const working = agent.state === 'working';
  const [open, setOpen] = useState(working);
  return (
    <Column alignment="start" spacing={0}>
      <TraceLine
        lead={
          working ? (
            <Mark state="working" />
          ) : (
            <Icon name={KIND.agent} size={13} color={theme.secondary} />
          )
        }
        text={agent.label}
        time={working ? 'working' : 'done'}
        chevron={agent.steps.length ? (open ? 'chevron.down' : 'chevron.right') : undefined}
        onPress={agent.steps.length ? () => setOpen(!open) : undefined}
        label={`${agent.label}, ${working ? 'working' : 'done'}. ${open ? 'Hides' : 'Shows'} its steps`}
      />
      {open ? <Steps steps={agent.steps} working={working} indent={MARK + GAP} /> : null}
    </Column>
  );
}

// One line: what it did, one sentence (a thought or a reply keeps up to three), and on the right how
// long or how far.
export function TraceLine({
  lead,
  text,
  lines = 1,
  time,
  quiet = false,
  indent = 0,
  chevron,
  onPress,
  label,
}: {
  lead: ReactNode;
  text: string;
  lines?: number;
  time?: string;
  quiet?: boolean;
  indent?: number;
  chevron?: 'chevron.down' | 'chevron.right';
  onPress?: () => void;
  label?: string;
}) {
  return (
    <Row
      alignment="start"
      spacing={GAP}
      onPress={onPress}
      modifiers={[
        padding({ leading: INSET - 2 + indent, trailing: INSET - 2, top: 8, bottom: 8 }),
        frame({ maxWidth: Infinity, alignment: 'leading' }),
        contentShape(shapes.rectangle()),
        ...(ios && label ? [accessibilityLabel(label)] : []),
      ]}
    >
      <Row alignment="center" spacing={0} modifiers={[frame({ width: MARK, height: 20 })]}>
        {lead}
      </Row>
      <Text
        numberOfLines={lines}
        textStyle={{ fontSize: 15, lineHeight: 20 }}
        modifiers={[
          foregroundStyle(quiet ? theme.secondary : theme.text),
          frame({ maxWidth: Infinity, alignment: 'leading' }),
        ]}
      >
        {text}
      </Text>
      {time ? (
        <Text
          numberOfLines={1}
          textStyle={{ fontSize: 13, lineHeight: 20 }}
          modifiers={[monospacedDigit(), foregroundStyle(theme.tertiary)]}
        >
          {time}
        </Text>
      ) : null}
      {chevron ? (
        <Row alignment="center" spacing={0} modifiers={[frame({ height: 20 })]}>
          <Icon name={chevron} size={11} color={theme.tertiary} />
        </Row>
      ) : null}
    </Row>
  );
}

function Quiet({ text }: { text: string }) {
  return (
    <Row alignment="center" spacing={0} modifiers={[padding({ leading: INSET, top: 6 })]}>
      <Text textStyle={{ fontSize: 15 }} modifiers={[foregroundStyle(theme.tertiary)]}>
        {text}
      </Text>
      <Spacer flexible />
    </Row>
  );
}
