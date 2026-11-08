import assert from "node:assert/strict";
import test from "node:test";
import { setTimeout as sleep } from "node:timers/promises";

import { demoAPI, demoTransport } from "../src/live/demo-call";
import { LiveSession } from "../src/live/session";

const tick = async () => {
  await sleep(5);
};

test("the demo call connects, talks, mutes and ends like a real one", async () => {
  const session = new LiveSession(demoTransport, demoAPI);
  await session.start();
  await tick();
  assert.equal(session.getSnapshot().status, "connected");
  assert.equal(session.getSnapshot().transcript.length, 4);

  session.toggleMute();
  await tick();
  assert.equal(session.getSnapshot().muted, true);
  assert.equal(session.getSnapshot().status, "connected");

  await session.stop();
  assert.equal(session.getSnapshot().status, "idle");
});
