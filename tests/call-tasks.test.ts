import assert from "node:assert/strict";
import test from "node:test";

import { CallSteps, callTrace } from "../src/live/call-tasks";
import { CallRecord } from "../src/live/calls";
import { agentsInOrder } from "../src/live/tasks";
import { nth } from "./nth";

const call = CallRecord.parse({
  id: "call_1",
  started: "2026-11-25T10:00:00.000Z",
  from: "app",
  title: "Voice apps",
  turns: [],
  tasks: [
    { id: "search", state: "running", text: "Searching for voice apps", at: 2000, agent: "a1" },
    { id: "chat", state: "running", text: "Asking Telegram", at: 3000 },
    { id: "search", state: "done", text: "Found three voice apps", at: 9000 },
  ],
});

const steps = CallSteps.parse({
  version: 812,
  tasks: [
    {
      id: "search",
      steps: [
        {
          id: "t1",
          at: "2026-11-25T10:00:02.500Z",
          end: "2026-11-25T10:00:04.000Z",
          kind: "web",
          text: "Searching the web for voice apps",
          state: "done",
          result: "3 hits",
        },
        { id: "a4:0", at: "2026-11-25T10:00:08.000Z", kind: "say", text: "Found three." },
      ],
    },
  ],
});

test("a call's tasks read as the agents of one task, each with its steps newest first", () => {
  const task = callTrace(call, steps);

  assert.equal(task.name, "Voice apps");
  assert.equal(task.state, "working");
  assert.deepEqual(
    task.agents.map(({ id, label, state }) => ({ id, label, state })),
    [
      { id: "search", label: "Found three voice apps", state: "done" },
      { id: "chat", label: "Asking Telegram", state: "working" },
    ],
  );

  const search = nth(task.agents, 0);

  assert.equal(search.since, "2026-11-25T10:00:02.000Z");
  assert.equal(search.end, "2026-11-25T10:00:09.000Z");
  assert.deepEqual(
    search.steps.map((step) => step.id),
    ["a4:0", "t1"],
  );
  assert.equal(search.line, "Found three.");
  assert.deepEqual(nth(task.agents, 1).steps, []);
  assert.equal(nth(agentsInOrder(task.agents).shown, 0).id, "chat");
});

test("before any steps arrive, the call's tasks still show, with nothing to open", () => {
  const task = callTrace(call, undefined);

  assert.deepEqual(
    task.agents.map((agent) => agent.steps.length),
    [0, 0],
  );
  assert.equal(nth(task.agents, 1).line, undefined);
});

test("a call whose tasks all finished reads done, or failed when one failed", () => {
  const done = CallRecord.parse({
    ...call,
    tasks: [{ id: "search", state: "done", text: "Found", at: 2000 }],
  });

  const failed = CallRecord.parse({
    ...call,
    tasks: [
      { id: "search", state: "done", text: "Found", at: 2000 },
      { id: "build", state: "failed", text: "Build broke", at: 4000 },
    ],
  });

  assert.equal(callTrace(done, undefined).state, "done");
  assert.equal(callTrace(failed, undefined).state, "failed");
  assert.equal(callTrace(failed, undefined).at, "2026-11-25T10:00:04.000Z");
});
