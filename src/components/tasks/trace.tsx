import { Column, Icon, Row, ScrollView, Spacer, Text } from '@expo/ui';
import { Background, Rectangle } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  contentShape,
  font,
  foregroundStyle,
  frame,
  monospacedDigit,
  padding,
  shapes,
} from '@expo/ui/swift-ui/modifiers';
import { useState, type ReactNode } from 'react';
import type { ColorValue } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

import { GAP, Header, INSET, MARK, Mark, SectionHead, ios } from '@/components/tasks/parts';
import { useNow } from '@/hooks/use-now';
import { PLACES, placeOf } from '@/live/inbox';
import {
  STATE_WORDS,
  agentCounts,
  agentMeta,
  agentSteps,
  agentsInOrder,
  stepMark,
  stepTimes,
  taskTime,
  type AgentTrail,
  type StepKind,
  type Task,
  type TaskAgent,
  type TaskStep,
} from '@/live/tasks';
import { theme } from '@/theme';

// Each kind of step's icon, as shadcn's Trace marks what a line did.
export const KIND: Record<StepKind, SFSymbol> = {
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
// Where a row's words start, past its mark.
const TEXT = INSET - 2 + MARK + GAP;
// An open agent's rail runs from just under its mark to the middle of its last line.
const RAIL_TOP = 30;
const RAIL_FOOT = 18;

// A thread a level down, drawn the way shadcn's Trace draws an agent's work: its plan with how far
// it got, the agents it handed work to, who's at work first, then its steps newest first, each a
// line with what it did and how long it took, thoughts in their own words. Agents and steps open
// into what they did and what came back.
export function Trace({
  task,
  onBack,
  onOpen,
}: {
  task: Task;
  onBack?: () => void;
  onOpen: (link: string) => void;
}) {
  const working = task.state === 'working';
  const done = task.plan.filter((item) => item.state === 'done').length;
  const { shown, tries } = agentsInOrder(task.agents);
  const place = PLACES[placeOf(task.app)];
  return (
    <Column
      alignment="center"
      spacing={0}
      modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'top' })]}
    >
      <Header
        title={task.place || task.name}
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
                  color={item.state === 'pending' ? theme.secondary : undefined}
                />
              ))}
            </Column>
          ) : null}
          {shown.length ? (
            <Column alignment="start" spacing={0}>
              <SectionHead title="Agents" count={agentCounts(shown)} />
              {shown.map((agent) => (
                <Agent key={agent.id} agent={agent} onOpen={onOpen} />
              ))}
              {tries.length ? <Tries tries={tries} onOpen={onOpen} /> : null}
            </Column>
          ) : null}
          <SectionHead title="Steps" count={task.steps.length ? 'newest first' : undefined} />
          {task.steps.length ? (
            <Steps steps={task.steps} agents={task.agents} />
          ) : (
            <Quiet text={working ? 'No steps yet' : 'Steps show while it works'} />
          )}
        </Column>
      </ScrollView>
    </Column>
  );
}

// Each step newest first. A thought or a reply shows three lines; any other step one, and where it
// `opens`, a tap shows a thought or a reply whole, or what a step acted on and what came back. A
// step that started an agent shows how that agent is doing instead of a time.
export function Steps({
  steps,
  agents = [],
  indent = 0,
  opens = true,
}: {
  steps: TaskStep[];
  agents?: TaskAgent[];
  indent?: number;
  opens?: boolean;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const now = useNow(steps.some((step) => step.state === 'running'));
  const times = stepTimes(steps, now);
  return (
    <Column alignment="start" spacing={0}>
      {steps.map((step, i) => {
        const key = step.id ?? `${step.at} ${step.text}`;
        const words = step.kind === 'think' || step.kind === 'say';
        const opened = open === key;
        const mark = stepMark(step);
        const agent = step.agent && agents.find((one) => one.id === step.agent);
        return (
          <TraceLine
            key={key}
            lead={
              mark ? (
                <Mark state={mark} />
              ) : (
                <Icon name={KIND[step.kind]} size={13} color={theme.secondary} />
              )
            }
            text={step.text}
            lines={opened ? 0 : words ? 3 : 1}
            time={agent ? undefined : times[i]}
            after={agent ? <Mark state={agent.state} /> : undefined}
            indent={indent}
            onPress={
              opens && (words || step.detail || step.result)
                ? () => setOpen(opened ? null : key)
                : undefined
            }
          >
            {opened && step.detail ? (
              <Output lines={[step.detail]} wraps={4} color={theme.secondary} />
            ) : null}
            {opened && step.result ? (
              <Output
                lines={step.result.split('\n').slice(0, 6)}
                wraps={1}
                color={step.state === 'failed' ? theme.danger : theme.tertiary}
              />
            ) : null}
          </TraceLine>
        );
      })}
    </Column>
  );
}

// What a step acted on, or what came back from it line by line, as the tool wrote it.
function Output({ lines, wraps, color }: { lines: string[]; wraps: number; color: ColorValue }) {
  return (
    <Column alignment="start" spacing={0} modifiers={[padding({ top: 4 })]}>
      {lines.map((line, i) => (
        <Text
          key={i}
          numberOfLines={wraps}
          modifiers={[
            font({ design: 'monospaced', size: 13 }),
            foregroundStyle(color),
            frame({ maxWidth: Infinity, alignment: 'leading' }),
          ]}
        >
          {line}
        </Text>
      ))}
    </Column>
  );
}

// An agent the thread handed work to: what it's on, who it is and how long it's taken, and while it
// works its newest step under it. A tap opens what it handed back (red when it failed; another tap
// shows it whole), then its steps on a rail down from its mark, then a way into it in T3 Code.
function Agent({ agent, onOpen }: { agent: AgentTrail; onOpen: (link: string) => void }) {
  const [open, setOpen] = useState(false);
  const [whole, setWhole] = useState(false);
  const working = agent.state === 'working';
  const newest = working && !open ? (agent.line ?? agent.steps[0]?.text) : undefined;
  const result = open && !working ? agent.result : undefined;
  const steps = open ? agentSteps(agent) : [];
  const meta = agentMeta(agent);
  const link = open ? agent.link : undefined;
  return (
    <Background alignment="topLeading">
      <Column alignment="start" spacing={0}>
        <TraceLine
          lead={<Mark state={agent.state} />}
          text={agent.label}
          color={agent.state === 'stopped' ? theme.secondary : undefined}
          time={meta}
          onPress={() => setOpen(!open)}
          label={`${agent.label}, ${meta || agent.state}${newest ? `: ${newest}` : ''}. ${open ? 'Hides' : 'Shows'} what it did`}
        >
          {newest ? <Under text={newest} /> : null}
        </TraceLine>
        {result ? (
          <Row
            alignment="start"
            spacing={0}
            onPress={() => setWhole(!whole)}
            modifiers={[
              padding({ leading: TEXT, trailing: INSET - 2, top: -8, bottom: 8 }),
              contentShape(shapes.rectangle()),
            ]}
          >
            <Under
              text={result}
              lines={whole ? 0 : 3}
              color={agent.state === 'failed' ? theme.danger : theme.secondary}
            />
          </Row>
        ) : null}
        {steps.length ? <Steps steps={steps} indent={MARK + GAP} /> : null}
        {link ? (
          <TraceLine
            lead={null}
            text="Open in T3 Code ↗"
            color={theme.secondary}
            onPress={() => onOpen(link)}
          />
        ) : null}
      </Column>
      <Background.Content>
        {result || steps.length || link ? (
          <Rectangle
            modifiers={[
              frame({ width: 1 }),
              foregroundStyle(theme.edge),
              padding({ leading: INSET - 2 + MARK / 2, top: RAIL_TOP, bottom: RAIL_FOOT }),
            ]}
          />
        ) : null}
      </Background.Content>
    </Background>
  );
}

// Agents that stopped and were run again under the same name, folded into one quiet line that
// opens to them.
function Tries({ tries, onOpen }: { tries: AgentTrail[]; onOpen: (link: string) => void }) {
  const [open, setOpen] = useState(false);
  const words = `${tries.length} earlier ${tries.length === 1 ? 'try' : 'tries'}, stopped`;
  return (
    <Column alignment="start" spacing={0}>
      <TraceLine
        lead={<Mark state="stopped" />}
        text={words}
        color={theme.tertiary}
        chevron={open ? 'chevron.down' : 'chevron.right'}
        onPress={() => setOpen(!open)}
        label={`${words}. ${open ? 'Hides' : 'Shows'} them`}
      />
      {open ? tries.map((agent) => <Agent key={agent.id} agent={agent} onOpen={onOpen} />) : null}
    </Column>
  );
}

// A line under a row's words, a step quieter.
function Under({
  text,
  lines = 1,
  color = theme.secondary,
}: {
  text: string;
  lines?: number;
  color?: ColorValue;
}) {
  return (
    <Text
      numberOfLines={lines || undefined}
      textStyle={{ fontSize: 15, lineHeight: 20 }}
      modifiers={[foregroundStyle(color), frame({ maxWidth: Infinity, alignment: 'leading' })]}
    >
      {text}
    </Text>
  );
}

// One line: what it did, one sentence (a thought or a reply keeps up to three), what it opened into
// under it, and on the right how long or how far.
export function TraceLine({
  lead,
  text,
  lines = 1,
  time,
  color = theme.text,
  indent = 0,
  after,
  chevron,
  onPress,
  label,
  children,
}: {
  lead: ReactNode;
  text: string;
  lines?: number;
  time?: string;
  color?: ColorValue;
  indent?: number;
  after?: ReactNode;
  chevron?: 'chevron.down' | 'chevron.right';
  onPress?: () => void;
  label?: string;
  children?: ReactNode;
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
      <Column alignment="start" spacing={0} modifiers={[frame({ maxWidth: Infinity })]}>
        <Text
          numberOfLines={lines || undefined}
          textStyle={{ fontSize: 15, lineHeight: 20 }}
          modifiers={[foregroundStyle(color), frame({ maxWidth: Infinity, alignment: 'leading' })]}
        >
          {text}
        </Text>
        {children}
      </Column>
      {time ? (
        <Text
          numberOfLines={1}
          textStyle={{ fontSize: 13, lineHeight: 20 }}
          modifiers={[monospacedDigit(), foregroundStyle(theme.tertiary)]}
        >
          {time}
        </Text>
      ) : null}
      {after ? (
        <Row alignment="center" spacing={0} modifiers={[frame({ height: 20 })]}>
          {after}
        </Row>
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
