import assert from "node:assert/strict";
import test from "node:test";

import { AgentList, AgentSteps, agentLine, agentTask, justFinished } from "../src/live/agents";
import type { AgentTask } from "../src/live/agents";

const sent: AgentTask = {
  id: "orb",
  state: "running",
  text: "Your orb-bounce feedback",
  to: "voiceapp",
};

const read: AgentTask = {
  id: "fresh-read",
  state: "running",
  text: "Fresh read",
  line: "Reading transcript.md",
};

test("nothing running and nothing just finished shows no line", () => {
  assert.equal(agentLine([]), null);
  assert.equal(agentLine([{ ...sent, state: "done" }]), null);
});

test("sent work shows what was sent, in grey, until its thread takes a step", () => {
  assert.deepEqual(agentLine([sent]), {
    id: "orb",
    state: "running",
    text: "Your orb-bounce feedback",
    waiting: true,
    where: "voiceapp",
  });
  assert.deepEqual(agentLine([{ ...sent, line: "Editing motion.ts" }]), {
    id: "orb",
    state: "running",
    text: "Editing motion.ts",
    waiting: false,
    where: "voiceapp",
  });
});

test("the agent with the latest step leads, and the rest are counted", () => {
  const line = agentLine([
    read,
    { ...sent, line: "Editing motion.ts" },
    { ...sent, id: "done", state: "done" },
  ]);

  assert.equal(line?.text, "Reading transcript.md");
  assert.equal(line?.where, "+1");
});

test("a task that just finished holds the line: done says what it was, failed says what went wrong", () => {
  assert.deepEqual(agentLine([], { ...sent, state: "done", line: "Pushed" }), {
    id: "orb",
    state: "done",
    text: "Your orb-bounce feedback",
    waiting: false,
    where: "done",
  });
  assert.equal(
    agentLine([], { ...sent, state: "failed", line: "You've hit your weekly limit" })?.text,
    "You've hit your weekly limit",
  );
  assert.equal(agentLine([read], { ...sent, state: "done" })?.id, "fresh-read");
});

test("a task finishes when it was running in the last snapshot and is not now", () => {
  assert.equal(justFinished([sent, read], [{ ...sent, state: "done" }, read])?.id, "orb");
  assert.equal(justFinished([], [{ ...sent, state: "done" }]), undefined);
  assert.equal(justFinished([sent], [sent]), undefined);
});

test("the line names the agent its task runs in, so a tap opens that agent's steps", () => {
  assert.equal(agentLine([{ ...read, agent: "a1b2" }])?.agent, "a1b2");
  assert.equal(agentLine([], { ...read, state: "done", agent: "a1b2" })?.agent, "a1b2");
});

test("an agent opens as a task titled by what it does, its steps newest first", () => {
  const [agent] = AgentList.parse({
    version: 3,
    agents: [
      {
        id: "a1b2",
        session: "hs_1",
        place: "hex-voice",
        label: "Find voice apps",
        who: "Explore",
        state: "working",
        since: "2026-11-25T10:00:00.000Z",
      },
    ],
  }).agents;

  const { steps } = AgentSteps.parse({
    version: 9,
    steps: [
      { id: "t1", at: "2026-11-25T10:00:01.000Z", kind: "web", text: "Searching", state: "done" },
      { id: "t2", at: "2026-11-25T10:00:02.000Z", kind: "read", text: "Reading", state: "running" },
    ],
  });

  assert.ok(agent);

  const task = agentTask(agent, steps);

  assert.equal(task.state, "working");
  assert.equal(task.place, "Find voice apps");
  assert.equal(task.name, "hex-voice");
  assert.deepEqual(
    task.steps.map((step) => step.id),
    ["t2", "t1"],
  );
});
