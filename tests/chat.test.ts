import assert from "node:assert/strict";
import test from "node:test";

import { arrived, newKey, said } from "../src/live/chat";
import { MediaId, mediaWords } from "../src/live/media";
import { TaskId } from "../src/live/tasks";
import type { Chat } from "../src/live/tasks";

const chat = (turns: Chat["turns"], waiting: Chat["waiting"] = [], total = turns.length): Chat => ({
  version: 1,
  sends: true,
  total,
  turns,
  waiting,
});

test("what you sent shows until hex has it waiting under its key, or said after you sent it", () => {
  const sent = { id: TaskId.parse("t"), key: "app-abc12345", text: "ship it", media: [], total: 2 };

  const before = [
    { from: "me" as const, text: "ship it" },
    { from: "hex" as const, text: "Shipped." },
  ];

  assert.equal(arrived(chat(before), sent), false);
  assert.equal(
    arrived(chat(before, [{ key: "telegram:app-abc12345", text: "ship it", at: "" }]), sent),
    true,
  );
  assert.equal(arrived(chat([...before, { from: "me", text: "ship it" }]), sent), true);
});

test("a chat cut to its latest turns still finds what you said after you sent it", () => {
  const sent = {
    id: TaskId.parse("t"),
    key: "app-abc12345",
    text: "and the docs",
    media: [],
    total: 150,
  };

  const latest = Array.from({ length: 100 }, (_, i) => ({ from: "hex" as const, text: `${i}` }));
  assert.equal(arrived(chat(latest, [], 150), sent), false);
  assert.equal(
    arrived(chat([...latest.slice(1), { from: "me", text: "and the docs" }], [], 151), sent),
    true,
  );
});

test("a photo sent with no words arrives as your turn holding that many photos", () => {
  const photo = { uri: "file:///shot.jpg", kind: "photo" as const, type: "image/jpeg" };
  const sent = { id: TaskId.parse("t"), key: "app-abc12345", text: "", media: [photo], total: 1 };
  const shared = { id: MediaId.parse("m1"), kind: "photo" as const };
  assert.equal(
    arrived(
      chat([
        { from: "me", text: "" },
        { from: "me", text: "" },
      ]),
      sent,
    ),
    false,
  );
  assert.equal(
    arrived(
      chat([
        { from: "hex", text: "Hi" },
        { from: "me", text: "", media: [shared] },
      ]),
      sent,
    ),
    true,
  );
});

test("a turn that is only media reads as what it holds", () => {
  assert.equal(mediaWords([{ kind: "photo" }]), "Photo");
  assert.equal(mediaWords([{ kind: "video" }, { kind: "video" }]), "2 videos");
  assert.equal(
    mediaWords([{ kind: "photo" }, { kind: "video" }, { kind: "photo" }]),
    "2 photos and a video",
  );
  assert.equal(mediaWords([{ kind: "photo" }, { kind: "video" }]), "A photo and a video");
});

test("app keys fit what hex takes", () => {
  assert.match(newKey(), /^app-[\w-]{8,60}$/u);
});

test("what you did in a thread reads as an event, and a voice message as your words", () => {
  assert.deepEqual(
    said({
      from: "me",
      text: "(asked Siri: reply once, in one short spoken sentence) what's running?",
    }),
    { kind: "event", label: "Asked Siri", text: "what's running?" },
  );
  assert.deepEqual(said({ from: "me", text: "(answered in the app) Ship it?: Yes" }), {
    kind: "event",
    label: "Answered in the app",
    text: "Ship it?: Yes",
  });
  assert.deepEqual(said({ from: "me", text: "(vote: Go)" }), {
    kind: "event",
    label: "Vote: Go",
    text: "",
  });
  assert.deepEqual(said({ from: "me", text: "(voice message) call mom" }), {
    kind: "me",
    text: "call mom",
  });
  assert.deepEqual(said({ from: "me", text: "ship it (later)" }), {
    kind: "me",
    text: "ship it (later)",
  });
  assert.deepEqual(said({ from: "hex", text: "(aside) done" }), {
    kind: "hex",
    text: "(aside) done",
  });
});
