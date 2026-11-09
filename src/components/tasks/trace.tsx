import { Column, Icon, Row, ScrollView, Spacer } from "@expo/ui";
import { Background, Rectangle } from "@expo/ui/swift-ui";
import {
  accessibilityLabel,
  contentShape,
  foregroundStyle,
  frame,
  monospacedDigit,
  padding,
  scrollClipDisabled,
  shapes,
} from "@expo/ui/swift-ui/modifiers";
import { useState } from "react";
import type { ReactElement, ReactNode } from "react";
import type { SFSymbol } from "sf-symbols-typescript";

import { Header } from "@/components/tasks/bar";
import { Mark } from "@/components/tasks/mark";
import { Faded, SectionHead, Sections, Waiting } from "@/components/tasks/parts";
import { useNow } from "@/hooks/use-now";
import type { Answered } from "@/hooks/use-watch";
import { PLACES, placeOf } from "@/live/inbox";
import {
  STATE_WORDS,
  agentCounts,
  agentMeta,
  agentSteps,
  agentsInOrder,
  stepMark,
  stepTimes,
  taskTime,
} from "@/live/tasks";
import type { AgentTrail, StepKind, Task, TaskAgent, TaskStep } from "@/live/tasks";
import { theme } from "@/theme";
import { Text } from "@/ui/text";
import { metrics, space } from "@/ui/tokens";
import type { Tone } from "@/ui/tokens";

export const KIND: Record<StepKind, SFSymbol> = {
  think: "lightbulb",
  say: "text.bubble",
  plan: "list.bullet",
  run: "terminal",
  read: "doc.text",
  edit: "pencil",
  search: "magnifyingglass",
  web: "globe",
  agent: "arrow.triangle.branch",
  tool: "wrench.and.screwdriver",
};

const PLANNED = { done: "done", running: "working", pending: "pending" } as const;
const TEXT = metrics.list.inset - space[0.5] + metrics.list.mark + metrics.list.gap;

const RAIL_TOP = space[2] + metrics.list.line + space[0.5];
const RAIL_FOOT = space[2] + metrics.list.line / 2;

export const StepsLoading = (answered: Answered) => (
  <Column
    alignment="center"
    spacing={0}
    modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: "top" })]}
  >
    <Header title="Steps" subtitle=" " />
    <Waiting {...answered} gone="These steps aren’t there any more." />
  </Column>
);

export const Trace = ({ task, onOpen }: { task: Task; onOpen: (link: string) => void }) => {
  const working = task.state === "working";
  const done = task.plan.filter((item) => item.state === "done").length;
  const { shown, tries } = agentsInOrder(task.agents);
  const place = PLACES[placeOf(task.app)];

  return (
    <Column
      alignment="center"
      spacing={0}
      modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: "top" })]}
    >
      <Header
        title="Steps"
        subtitle={`${task.place || task.name} · ${place} · ${working ? `working for ${taskTime(task)}` : STATE_WORDS[task.state]}`}
      />
      <Faded>
        <ScrollView
          showsIndicators={false}
          modifiers={[
            scrollClipDisabled(),
            frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: "top" }),
          ]}
        >
          <Column alignment="start" spacing={0} modifiers={[padding({ bottom: space[10] })]}>
            <Sections>
              {task.plan.length ? (
                <Column key="plan" alignment="start" spacing={0}>
                  <SectionHead title="Plan" count={`${done} of ${task.plan.length}`} />
                  {task.plan.map((item, i) => (
                    <TraceLine
                      key={`${i} ${item.text}`}
                      lead={<Mark state={PLANNED[item.state]} />}
                      text={item.text}
                      tone={item.state === "pending" ? "secondary" : undefined}
                    />
                  ))}
                </Column>
              ) : null}
              {shown.length ? (
                <Column key="agents" alignment="start" spacing={0}>
                  <SectionHead title="Agents" count={agentCounts(shown)} />
                  {shown.map((agent) => (
                    <Agent key={agent.id} agent={agent} onOpen={onOpen} />
                  ))}
                  {tries.length ? <Tries tries={tries} onOpen={onOpen} /> : null}
                </Column>
              ) : null}
              <Column key="steps" alignment="start" spacing={0}>
                <SectionHead title="Steps" count={task.steps.length ? "newest first" : undefined} />
                {task.steps.length ? (
                  <Steps steps={task.steps} agents={task.agents} />
                ) : (
                  <Quiet text={working ? "No steps yet" : "Steps show while it works"} />
                )}
              </Column>
            </Sections>
          </Column>
        </ScrollView>
      </Faded>
    </Column>
  );
};

export const Steps = ({
  steps,
  agents,
  indent = 0,
  opens = true,
}: {
  steps: TaskStep[];
  agents?: TaskAgent[];
  indent?: number;
  opens?: boolean;
}) => {
  const [open, setOpen] = useState<string | null>(null);
  const now = useNow(steps.some((step) => step.state === "running"));
  const times = stepTimes(steps, now);

  return (
    <Column alignment="start" spacing={0}>
      {steps.map((step, i) => {
        const key = step.id ?? `${step.at} ${step.text}`;
        const words = step.kind === "think" || step.kind === "say";
        const opened = open === key;
        const mark = stepMark(step);
        const agent = agentOf(step, agents);

        const folded = words ? 3 : 1;
        const detail = step.detail ?? "";
        const result = step.result ?? "";

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
            lines={opened ? 0 : folded}
            time={agent ? undefined : times[i]}
            after={agent ? <Mark state={agent.state} /> : undefined}
            indent={indent}
            onPress={
              opens && (words || detail || result)
                ? () => {
                    setOpen(opened ? null : key);
                  }
                : undefined
            }
          >
            {opened && detail ? <Output lines={[detail]} wraps={4} tone="secondary" /> : null}
            {opened && result ? (
              <Output
                lines={result.split("\n").slice(0, 6)}
                wraps={1}
                tone={step.state === "failed" ? "danger" : "tertiary"}
              />
            ) : null}
          </TraceLine>
        );
      })}
    </Column>
  );
};

const agentOf = (step: TaskStep, agents: TaskAgent[] | undefined) =>
  (step.agent ?? "") === "" ? undefined : agents?.find((one) => one.id === step.agent);

const Output = ({ lines, wraps, tone }: { lines: string[]; wraps: number; tone: Tone }) => (
  <Column alignment="start" spacing={0} modifiers={[padding({ top: space[1] })]}>
    {lines.map((line, i) => (
      <Text
        key={i}
        numberOfLines={wraps}
        variant="code"
        tone={tone}
        modifiers={[frame({ maxWidth: Infinity, alignment: "leading" })]}
      >
        {line}
      </Text>
    ))}
  </Column>
);

const agentShows = (agent: AgentTrail, open: boolean) => {
  const working = agent.state === "working";

  return {
    newest: working && !open ? (agent.line ?? agent.steps[0]?.text ?? "") : "",
    result: open && !working ? (agent.result ?? "") : "",
    steps: open ? agentSteps(agent) : [],
    link: open ? (agent.link ?? "") : "",
  };
};

const Agent = ({ agent, onOpen }: { agent: AgentTrail; onOpen: (link: string) => void }) => {
  const [open, setOpen] = useState(false);
  const [whole, setWhole] = useState(false);
  const { newest, result, steps, link } = agentShows(agent, open);
  const meta = agentMeta(agent);

  return (
    <Background alignment="topLeading">
      <Column alignment="start" spacing={0}>
        <TraceLine
          lead={<Mark state={agent.state} />}
          text={agent.label}
          tone={agent.state === "stopped" ? "secondary" : undefined}
          time={meta}
          onPress={() => {
            setOpen(!open);
          }}
          label={`${agent.label}, ${meta || agent.state}${newest ? `: ${newest}` : ""}. ${open ? "Hides" : "Shows"} what it did`}
        >
          {newest ? <Under text={newest} /> : null}
        </TraceLine>
        {result ? (
          <Row
            alignment="start"
            spacing={0}
            onPress={() => {
              setWhole(!whole);
            }}
            modifiers={[
              padding({
                leading: TEXT,
                trailing: metrics.list.inset - space[0.5],
                top: -space[2],
                bottom: space[2],
              }),
              contentShape(shapes.rectangle()),
            ]}
          >
            <Under
              text={result}
              lines={whole ? 0 : 3}
              tone={agent.state === "failed" ? "danger" : "secondary"}
            />
          </Row>
        ) : null}
        {steps.length ? (
          <Steps steps={steps} indent={metrics.list.mark + metrics.list.gap} />
        ) : null}
        {link ? (
          <TraceLine
            lead={null}
            text="Open in T3 Code ↗"
            tone="secondary"
            onPress={() => {
              onOpen(link);
            }}
          />
        ) : null}
      </Column>
      <Background.Content>
        {result || steps.length || link ? (
          <Rectangle
            modifiers={[
              frame({ width: 1 }),
              foregroundStyle(theme.edge),
              padding({
                leading: metrics.list.inset - space[0.5] + metrics.list.mark / 2,
                top: RAIL_TOP,
                bottom: RAIL_FOOT,
              }),
            ]}
          />
        ) : null}
      </Background.Content>
    </Background>
  );
};

const Tries = ({ tries, onOpen }: { tries: AgentTrail[]; onOpen: (link: string) => void }) => {
  const [open, setOpen] = useState(false);
  const words = `${tries.length} earlier ${tries.length === 1 ? "try" : "tries"}, stopped`;

  return (
    <Column alignment="start" spacing={0}>
      <TraceLine
        lead={<Mark state="stopped" />}
        text={words}
        tone="tertiary"
        chevron={open ? "chevron.down" : "chevron.right"}
        onPress={() => {
          setOpen(!open);
        }}
        label={`${words}. ${open ? "Hides" : "Shows"} them`}
      />
      {open ? tries.map((agent) => <Agent key={agent.id} agent={agent} onOpen={onOpen} />) : null}
    </Column>
  );
};

const Under = ({
  text,
  lines = 1,
  tone = "secondary",
}: {
  text: string;
  lines?: number;
  tone?: Tone;
}) => (
  <Text
    {...(lines !== undefined && lines !== 0 && { numberOfLines: lines })}
    variant="detail"
    tone={tone}
    paragraph
    modifiers={[frame({ maxWidth: Infinity, alignment: "leading" })]}
  >
    {text}
  </Text>
);

export const TraceLine = ({
  lead,
  text,
  lines = 1,
  time = "",
  tone = "text",
  indent = 0,
  after,
  chevron,
  onPress,
  label = "",
  children,
}: {
  lead: ReactNode;
  text: string;
  lines?: number;
  time?: string | undefined;
  tone?: Tone | undefined;
  indent?: number;
  after?: ReactElement | undefined;
  chevron?: "chevron.down" | "chevron.right";
  onPress?: (() => void) | undefined;
  label?: string;
  children?: ReactNode;
}) => (
  <Row
    alignment="start"
    spacing={metrics.list.gap}
    {...(onPress && { onPress })}
    modifiers={[
      padding({
        leading: metrics.list.inset - space[0.5] + indent,
        trailing: metrics.list.inset - space[0.5],
        top: space[2],
        bottom: space[2],
      }),
      frame({ maxWidth: Infinity, alignment: "leading" }),
      contentShape(shapes.rectangle()),
      ...(label ? [accessibilityLabel(label)] : []),
    ]}
  >
    <Row
      alignment="center"
      spacing={0}
      modifiers={[frame({ width: metrics.list.mark, height: metrics.list.line })]}
    >
      {lead}
    </Row>
    <Column alignment="start" spacing={0} modifiers={[frame({ maxWidth: Infinity })]}>
      <Text
        {...(lines !== undefined && lines !== 0 && { numberOfLines: lines })}
        variant="detail"
        tone={tone}
        paragraph
        modifiers={[frame({ maxWidth: Infinity, alignment: "leading" })]}
      >
        {text}
      </Text>
      {children}
    </Column>
    {time ? (
      <Text numberOfLines={1} variant="caption" tone="tertiary" modifiers={[monospacedDigit()]}>
        {time}
      </Text>
    ) : null}
    {after ? (
      <Row alignment="center" spacing={0} modifiers={[frame({ height: metrics.list.line })]}>
        {after}
      </Row>
    ) : null}
    {chevron ? (
      <Row alignment="center" spacing={0} modifiers={[frame({ height: metrics.list.line })]}>
        <Icon name={chevron} size={11} color={theme.tertiary} />
      </Row>
    ) : null}
  </Row>
);

const Quiet = ({ text }: { text: string }) => (
  <Row
    alignment="center"
    spacing={0}
    modifiers={[padding({ leading: metrics.list.inset, top: space[2] })]}
  >
    <Text variant="detail" tone="tertiary">
      {text}
    </Text>
    <Spacer flexible />
  </Row>
);
