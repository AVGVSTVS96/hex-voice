import assert from "node:assert/strict";
import test from "node:test";

import { CallId } from "../src/live/calls";
import { LiveSession } from "../src/live/session";
import type {
  AudioStats,
  LiveEvent,
  LiveTransport,
  SessionAPI,
  TransportCallbacks,
  TransportFactory,
} from "../src/live/types";
import type { LiveVoice } from "../src/live/voices";
import { nth } from "./nth";

const settle = async () => {
  for (let i = 0; i < 12; i += 1) {
    // oxlint-disable-next-line no-await-in-loop -- each await is one more microtask turn, so they must run one after another
    await Promise.resolve();
  }
};

const manualClock = () => {
  const savedTimers = { setTimeout, clearTimeout, setInterval, clearInterval };
  const savedNow = Date.now;
  const timers = new Map<number, { callback: () => void; delay: number; interval: boolean }>();
  let lastId = 0;

  const schedule = (callback: () => void, delay: number, interval: boolean) => {
    lastId += 1;
    timers.set(lastId, { callback, delay, interval });

    return lastId;
  };

  const clear = (id: number) => {
    timers.delete(id);
  };

  const clock = {
    now: 1_000_000,
    fire: async (delay: number) => {
      const pending = [...timers].filter(([, timer]) => timer.delay === delay);

      for (const [id, timer] of pending) {
        if (!timers.has(id)) {
          continue;
        }

        if (!timer.interval) {
          timers.delete(id);
        }

        timer.callback();
      }

      await settle();
    },
    restore: () => {
      Object.assign(globalThis, savedTimers);
      Date.now = savedNow;
    },
  };

  Object.assign(globalThis, {
    setTimeout: (callback: () => void, delay = 0) => schedule(callback, delay, false),
    setInterval: (callback: () => void, delay = 0) => schedule(callback, delay, true),
    clearTimeout: clear,
    clearInterval: clear,
  });
  Date.now = () => clock.now;

  return clock;
};

interface Command {
  type: string;
  event_id?: string;
}

const offerAnswer = async () => "offer";

const quietStats = async (): Promise<AudioStats> => ({
  inputLevel: 0.1,
  outputLevel: 0.2,
  sentPackets: 10,
  receivedPackets: 20,
});

class FakeTransport implements LiveTransport {
  readonly callbacks: TransportCallbacks;
  commands: Command[] = [];
  muteChanges: boolean[] = [];
  answers: string[] = [];
  closed = false;
  statsCalls = 0;
  acknowledgeClose: "sync" | "microtask" | "none" = "microtask";
  onCommand?: (event: Command) => void;
  offerResult = offerAnswer;
  statsResult = quietStats;

  constructor(callbacks: TransportCallbacks) {
    this.callbacks = callbacks;
  }

  async offer() {
    return await this.offerResult();
  }
  async answer(sdp: string) {
    this.answers.push(sdp);
    this.emit({ type: "session.started" });
  }
  send(event: Command) {
    this.commands.push(event);
    this.onCommand?.(event);

    if (event.type === "session.close") {
      if (this.acknowledgeClose === "sync") {
        this.emit({ type: "session.closed" });
      }

      if (this.acknowledgeClose === "microtask") {
        queueMicrotask(() => {
          this.emit({ type: "session.closed" });
        });
      }
    }

    return true;
  }
  setMuted(muted: boolean) {
    this.muteChanges.push(muted);
  }
  async stats() {
    this.statsCalls += 1;

    return await this.statsResult();
  }
  close() {
    this.closed = true;
  }
  emit(event: LiveEvent) {
    this.callbacks.onEvent(event);
  }
  acknowledge(command: Command) {
    this.emit({
      type:
        command.type === "session.input_audio.mute"
          ? "session.input_audio.muted"
          : "session.input_audio.unmuted",
      client_event_id: command.event_id,
    });
  }
}

const harness = () => {
  const clock = manualClock();
  const transports: FakeTransport[] = [];
  const created: string[] = [];
  const voices: (LiveVoice | undefined)[] = [];
  const closed: string[] = [];

  const control = {
    create: async (sdp: string) => ({
      sdp: `answer-${sdp}`,
      sessionId: CallId.parse(`live_${created.length}`),
    }),
    close: async (_id: string): Promise<void> => {},
    factory: async (callbacks: TransportCallbacks): Promise<LiveTransport> => {
      const transport = new FakeTransport(callbacks);
      transports.push(transport);

      return transport;
    },
  };

  const factory: TransportFactory = async (callbacks) => await control.factory(callbacks);

  const api: SessionAPI = {
    create: async (sdp, voice) => {
      created.push(sdp);
      voices.push(voice);

      return await control.create(sdp);
    },
    close: async (id) => {
      closed.push(id);
      await control.close(id);
    },
  };

  const session = new LiveSession(factory, api);

  return {
    api,
    session,
    transports,
    created,
    voices,
    closed,
    control,
    clock,
    async cleanup() {
      const stop = session.stop();
      await settle();

      for (const transport of transports) {
        transport.emit({ type: "session.closed" });
      }

      await stop;
      clock.restore();
    },
  };
};

test("a call hex can’t start says why and lets go of the microphone", async () => {
  const h = harness();
  h.control.create = async () => {
    throw new Error("Set EXPO_PUBLIC_HEX_URL to your hex voice address, then rebuild the app.");
  };

  try {
    await h.session.start();
    assert.equal(h.session.getSnapshot().status, "error");
    assert.match(h.session.getSnapshot().error ?? "", /EXPO_PUBLIC_HEX_URL/u);
    assert.equal(nth(h.transports, 0).closed, true);
  } finally {
    await h.cleanup();
  }
});

test("uses the selected voice only when starting a new session and defaults to Marin", async () => {
  const h = harness();

  try {
    await h.session.start("cedar");
    await h.session.start("quartz");
    assert.deepEqual(h.voices, ["cedar"]);
    await h.session.stop();
    await h.session.start("quartz");
    assert.deepEqual(h.voices, ["cedar", "quartz"]);
    await h.session.stop();
    await h.session.start();
    assert.deepEqual(h.voices, ["cedar", "quartz", "marin"]);
  } finally {
    await h.cleanup();
  }
});

test("keeps both audio directions active during assistant speech and overlapping captions", async () => {
  const h = harness();

  try {
    await h.session.start();
    const transport = nth(h.transports, 0);
    transport.emit({
      type: "session.input_transcript.delta",
      delta: "Could you",
      start_ms: 100,
      end_ms: 400,
    });
    transport.emit({
      type: "session.output_transcript.delta",
      delta: "Sure,",
      start_ms: 250,
      end_ms: 450,
    });
    transport.emit({
      type: "session.input_transcript.delta",
      delta: " explain this?",
      start_ms: 400,
      end_ms: 700,
    });
    transport.emit({
      type: "session.output_transcript.delta",
      delta: " tell me more.",
      start_ms: 450,
      end_ms: 900,
    });
    await h.clock.fire(120);
    const snapshot = h.session.getSnapshot();
    assert.equal(snapshot.status, "connected");
    assert.deepEqual(
      snapshot.transcript.map(({ role, text }) => ({ role, text })),
      [
        { role: "user", text: "Could you explain this?" },
        { role: "assistant", text: "Sure, tell me more." },
      ],
    );
    const levels = h.session.getLevels();
    assert.ok(levels.input > 0 && levels.output > 0);
    assert.deepEqual(transport.muteChanges, []);
    assert.deepEqual(transport.commands, []);
  } finally {
    await h.cleanup();
  }
});

test("audio levels move without changing the call, so the call screen redraws only for the call", async () => {
  const h = harness();

  try {
    await h.session.start();
    const call = h.session.getSnapshot();
    let calls = 0;
    let levels = 0;

    const stopCalls = h.session.subscribe(() => {
      calls += 1;
    });

    const stopLevels = h.session.subscribeLevels(() => {
      levels += 1;
    });

    await h.clock.fire(120);
    nth(h.transports, 0).statsResult = async () => ({
      inputLevel: 0.02,
      outputLevel: 0.1,
      sentPackets: 2,
      receivedPackets: 2,
    });
    await h.clock.fire(120);
    stopCalls();
    stopLevels();
    assert.equal(h.session.getSnapshot(), call);
    assert.equal(calls, 0);
    assert.equal(levels, 2);
    assert.deepEqual(h.session.getLevels(), { input: 0.1, output: 0.5 });
  } finally {
    await h.cleanup();
  }
});

test("allows a fresh start after cancellation while microphone permission is pending", async () => {
  const h = harness();
  const ready = Promise.withResolvers<LiveTransport>();
  const originalFactory = h.control.factory;
  let callbacks!: TransportCallbacks;
  h.control.factory = async (value) => {
    callbacks = value;

    return await ready.promise;
  };

  try {
    const starting = h.session.start();
    await h.session.stop();
    assert.equal(h.session.getSnapshot().status, "idle");
    const lateTransport = new FakeTransport(callbacks);
    ready.resolve(lateTransport);
    await starting;
    assert.equal(lateTransport.closed, true);
    assert.equal(h.created.length, 0);
    h.control.factory = originalFactory;
    await h.session.start();
    assert.equal(h.session.getSnapshot().status, "connected");
  } finally {
    await h.cleanup();
  }
});

test("a late session creation is closed without applying its answer after cancellation", async () => {
  const h = harness();
  const response = Promise.withResolvers<{ sdp: string; sessionId: CallId }>();
  h.control.create = async () => await response.promise;

  try {
    const starting = h.session.start();
    await settle();
    const transport = nth(h.transports, 0);
    transport.acknowledgeClose = "none";
    const stopping = h.session.stop();
    response.resolve({ sdp: "late-answer", sessionId: CallId.parse("live_late") });
    await starting;
    assert.deepEqual(transport.answers, []);
    assert.deepEqual(h.closed, ["live_late"]);
    transport.emit({ type: "session.closed" });
    await stopping;
    assert.equal(h.session.getSnapshot().status, "idle");
  } finally {
    await h.cleanup();
  }
});

test("late creation cleanup failure is visible after cancellation has finished", async () => {
  const h = harness();
  const response = Promise.withResolvers<{ sdp: string; sessionId: CallId }>();
  h.control.create = async () => await response.promise;
  h.control.close = async () => {
    throw new Error("Network unavailable");
  };

  try {
    const starting = h.session.start();
    await settle();
    await h.session.stop();
    response.resolve({ sdp: "late-answer", sessionId: CallId.parse("live_late_failure") });
    await starting;
    assert.equal(h.session.getSnapshot().status, "error");
    assert.match(h.session.getSnapshot().error ?? "", /server could not confirm session closure/u);
    assert.deepEqual(h.closed, ["live_late_failure"]);
    assert.equal(nth(h.transports, 0).closed, true);
    assert.deepEqual(nth(h.transports, 0).answers, []);
  } finally {
    await h.cleanup();
  }
});

test("stop finalization cannot erase a late creation cleanup failure", async () => {
  const h = harness();
  const response = Promise.withResolvers<{ sdp: string; sessionId: CallId }>();
  h.control.create = async () => await response.promise;
  h.control.close = async () => {
    throw new Error("Network unavailable");
  };

  try {
    const starting = h.session.start();
    await settle();
    const transport = nth(h.transports, 0);
    transport.acknowledgeClose = "none";
    const stopping = h.session.stop();
    response.resolve({ sdp: "late-answer", sessionId: CallId.parse("live_late_failure") });
    await settle();
    assert.deepEqual(h.closed, ["live_late_failure"]);
    transport.emit({ type: "session.closed" });
    await Promise.all([starting, stopping]);
    assert.equal(h.session.getSnapshot().status, "error");
    assert.match(h.session.getSnapshot().error ?? "", /server could not confirm session closure/u);
    assert.equal(transport.closed, true);
  } finally {
    await h.cleanup();
  }
});

test("late creation cleanup failure preserves a newer connected conversation", async () => {
  const h = harness();
  const response = Promise.withResolvers<{ sdp: string; sessionId: CallId }>();
  const cleanup = Promise.withResolvers<undefined>();
  const originalCreate = h.control.create;
  h.control.create = async () => await response.promise;
  h.control.close = async () => {
    await cleanup.promise;
  };

  const originalWarn = console.warn;
  const warnings: unknown[][] = [];
  console.warn = (...messages: unknown[]) => {
    warnings.push(messages);
  };

  try {
    const starting = h.session.start();
    await settle();
    await h.session.stop();
    response.resolve({ sdp: "late-answer", sessionId: CallId.parse("live_old_failure") });
    await settle();
    assert.deepEqual(h.closed, ["live_old_failure"]);

    h.control.create = originalCreate;
    await h.session.start();
    nth(h.transports, 1).emit({
      type: "session.input_transcript.delta",
      delta: "New conversation",
      start_ms: 0,
      end_ms: 100,
    });
    const current = h.session.getSnapshot();
    cleanup.reject(new Error("Old cleanup failed"));
    await starting;

    assert.strictEqual(h.session.getSnapshot(), current);
    assert.equal(current.status, "connected");
    assert.equal(current.error, null);
    assert.equal(nth(h.transports, 1).closed, false);
    assert.equal(warnings.length, 1);
    assert.match(String(nth(warnings, 0)[0]), /cancelled session could not be confirmed closed/u);
  } finally {
    await h.cleanup();
    console.warn = originalWarn;
  }
});

test("accepts a synchronous close acknowledgment and can restart", async () => {
  const h = harness();

  try {
    await h.session.start();
    nth(h.transports, 0).acknowledgeClose = "sync";
    await h.session.stop();
    assert.equal(h.session.getSnapshot().status, "idle");
    assert.deepEqual(h.closed, []);
    await h.session.start();
    assert.equal(h.session.getSnapshot().status, "connected");
    assert.equal(h.created.length, 2);
  } finally {
    await h.cleanup();
  }
});

test("server-initiated finalization cleans up without another close command or HTTP request", async () => {
  const h = harness();

  try {
    await h.session.start();
    const transport = nth(h.transports, 0);
    transport.emit({ type: "session.closed" });
    await settle();
    assert.equal(h.session.getSnapshot().status, "idle");
    assert.equal(transport.closed, true);
    assert.deepEqual(transport.commands, []);
    assert.deepEqual(h.closed, []);
  } finally {
    await h.cleanup();
  }
});

test("stale mute acknowledgments cannot satisfy the current unmute command", async () => {
  const h = harness();

  try {
    await h.session.start();
    const transport = nth(h.transports, 0);
    h.session.toggleMute();
    h.session.toggleMute();
    const [mute, unmute] = transport.commands;
    assert.ok(mute);
    assert.ok(unmute);
    assert.ok(mute.event_id !== undefined && mute.event_id !== "");
    assert.ok(unmute.event_id !== undefined && unmute.event_id !== "");
    assert.notEqual(mute.event_id, unmute.event_id);
    transport.acknowledge(mute);
    assert.deepEqual(transport.muteChanges, [true]);
    await h.clock.fire(5000);
    assert.equal(h.session.getSnapshot().status, "connected");
    const again = nth(transport.commands, 2);
    assert.equal(again.type, "session.input_audio.unmute");
    assert.notEqual(again.event_id, unmute.event_id);
    transport.acknowledge(again);
    assert.deepEqual(transport.muteChanges, [true, false]);
  } finally {
    await h.cleanup();
  }
});

test("only the newest unmute acknowledgment resumes local microphone capture", async () => {
  const h = harness();

  try {
    await h.session.start();
    const transport = nth(h.transports, 0);
    h.session.toggleMute();
    h.session.toggleMute();
    h.session.toggleMute();
    h.session.toggleMute();
    transport.acknowledge(nth(transport.commands, 1));
    assert.deepEqual(transport.muteChanges, [true, true]);
    transport.acknowledge(nth(transport.commands, 3));
    assert.deepEqual(transport.muteChanges, [true, true, false]);
    await h.clock.fire(5000);
    assert.equal(h.session.getSnapshot().status, "connected");
  } finally {
    await h.cleanup();
  }
});

test("synchronous mute acknowledgment clears the confirmation timeout", async () => {
  const h = harness();

  try {
    await h.session.start();
    const transport = nth(h.transports, 0);
    transport.onCommand = (command) => {
      if (command.type.startsWith("session.input_audio.")) {
        transport.acknowledge(command);
      }
    };

    h.session.toggleMute();
    await h.clock.fire(5000);
    assert.equal(h.session.getSnapshot().status, "connected");
    assert.equal(h.session.getSnapshot().muted, true);
  } finally {
    await h.cleanup();
  }
});

test("backgrounding preserves the live transport and captions while pausing visual stats", async () => {
  const h = harness();

  try {
    await h.session.start();
    const transport = nth(h.transports, 0);
    await h.clock.fire(120);
    assert.equal(transport.statsCalls, 1);
    h.session.setAppActive(false);
    h.clock.now += 45_000;
    transport.emit({
      type: "session.input_transcript.delta",
      delta: "Still here",
      start_ms: 45_000,
      end_ms: 45_400,
    });
    transport.emit({
      type: "session.output_transcript.delta",
      delta: "I can hear you.",
      start_ms: 45_200,
      end_ms: 45_800,
    });
    await h.clock.fire(120);
    assert.equal(h.session.getSnapshot().status, "connected");
    assert.equal(h.session.getSnapshot().transcript.length, 2);
    assert.equal(transport.statsCalls, 1);
    assert.equal(transport.closed, false);
    assert.deepEqual(transport.muteChanges, []);
    assert.deepEqual(transport.commands, []);

    h.session.setAppActive(true);
    await settle();
    assert.equal(h.session.getSnapshot().elapsedSeconds, 45);
    assert.equal(transport.statsCalls, 2);
    assert.equal(h.created.length, 1);
    assert.deepEqual(transport.muteChanges, []);
  } finally {
    await h.cleanup();
  }
});

test("a call hung up from the Lock Screen after a quiet stretch keeps its full length", async () => {
  const h = harness();

  try {
    await h.session.start();
    h.session.setAppActive(false);
    h.clock.now += 200_000;
    const stop = h.session.stop();
    assert.equal(h.session.getSnapshot().elapsedSeconds, 200);
    nth(h.transports, 0).emit({ type: "session.closed" });
    await stop;
    assert.equal(h.session.getSnapshot().elapsedSeconds, 200);
  } finally {
    await h.cleanup();
  }
});

test("a muted microphone stays muted when returning from the background", async () => {
  const h = harness();

  try {
    await h.session.start();
    const transport = nth(h.transports, 0);
    h.session.toggleMute();
    transport.acknowledge(nth(transport.commands, 0));
    h.session.setAppActive(false);
    h.session.setAppActive(true);
    await settle();
    assert.equal(h.session.getSnapshot().muted, true);
    assert.equal(h.session.getLevels().input, 0);
    assert.deepEqual(transport.muteChanges, [true]);
    assert.equal(transport.commands.length, 1);
  } finally {
    await h.cleanup();
  }
});

test("a session connecting during background transition is kept without starting visual stats", async () => {
  const h = harness();
  const response = Promise.withResolvers<{ sdp: string; sessionId: CallId }>();
  h.control.create = async () => await response.promise;

  try {
    const starting = h.session.start();
    await settle();
    h.session.setAppActive(false);
    response.resolve({ sdp: "background-answer", sessionId: CallId.parse("live_background") });
    await starting;
    await h.clock.fire(120);
    assert.equal(h.session.getSnapshot().status, "connected");
    assert.equal(nth(h.transports, 0).statsCalls, 0);
    assert.equal(nth(h.transports, 0).closed, false);
    assert.deepEqual(nth(h.transports, 0).muteChanges, []);
    await h.session.stop();
    assert.equal(nth(h.transports, 0).closed, true);
  } finally {
    await h.cleanup();
  }
});

test("a stats result arriving in the background does not restore visual levels", async () => {
  const h = harness();
  const pending = Promise.withResolvers<AudioStats>();

  try {
    await h.session.start();
    nth(h.transports, 0).statsResult = async () => await pending.promise;
    await h.clock.fire(120);
    h.session.setAppActive(false);
    pending.resolve({ inputLevel: 0.2, outputLevel: 0.3, sentPackets: 10, receivedPackets: 20 });
    await settle();
    assert.deepEqual(h.session.getLevels(), { input: 0, output: 0 });
    assert.equal(h.session.getSnapshot().status, "connected");
  } finally {
    await h.cleanup();
  }
});

test("an earlier stalled stats operation cannot block a new session", async () => {
  const h = harness();

  try {
    await h.session.start();
    const stalled = Promise.withResolvers<AudioStats>();
    nth(h.transports, 0).statsResult = async () => await stalled.promise;
    await h.clock.fire(120);
    await h.session.stop();
    await h.session.start();
    await h.clock.fire(120);
    assert.equal(nth(h.transports, 1).statsCalls, 1);
    assert.ok(h.session.getLevels().output > 0);
  } finally {
    await h.cleanup();
  }
});

test("missing close acknowledgment uses the server fallback once", async () => {
  const h = harness();

  try {
    await h.session.start();
    nth(h.transports, 0).acknowledgeClose = "none";
    const stopping = h.session.stop();
    await settle();
    await h.clock.fire(1500);
    await stopping;
    assert.deepEqual(h.closed, ["live_1"]);
    assert.equal(h.session.getSnapshot().status, "idle");
    assert.equal(nth(h.transports, 0).closed, true);
  } finally {
    await h.cleanup();
  }
});

test("old transport events cannot alter a later conversation", async () => {
  const h = harness();

  try {
    await h.session.start();
    const old = nth(h.transports, 0);
    await h.session.stop();
    await h.session.start();
    old.emit({ type: "session.closed" });
    old.emit({
      type: "session.output_transcript.delta",
      delta: "Old speech",
      start_ms: 10,
      end_ms: 20,
    });
    old.callbacks.onFailure("Old failure");
    await settle();
    assert.equal(h.session.getSnapshot().status, "connected");
    assert.deepEqual(h.session.getSnapshot().transcript, []);
  } finally {
    await h.cleanup();
  }
});

test("a call remembers how it ended: you, hex, or a dropped connection", async () => {
  const h = harness();

  try {
    await h.session.start();
    await settle();
    await h.session.stop();
    assert.equal(h.session.getSnapshot().ending, "you");
    assert.equal(nth(h.transports, 0).commands.at(-1)?.event_id, "close-you-app");

    await h.session.start();
    await settle();
    nth(h.transports, 1).emit({ type: "session.closed", reason: "expired" });
    await settle();
    assert.equal(h.session.getSnapshot().ending, "expired");

    await h.session.start();
    await settle();
    nth(h.transports, 2).callbacks.onFailure("The audio connection failed.");
    await settle();
    assert.equal(h.session.getSnapshot().ending, "dropped");

    await h.session.start();
    assert.equal(h.session.getSnapshot().ending, null);
  } finally {
    await h.cleanup();
  }
});

test("when iOS never hands the audio back, a tap on the microphone ends the pause", async () => {
  const h = harness();

  try {
    await h.session.start();
    await settle();
    const transport = nth(h.transports, 0);
    h.session.interrupt(true);
    h.session.toggleMute();
    assert.equal(h.session.getSnapshot().interrupted, false);
    assert.equal(h.session.getSnapshot().muted, false);
    assert.deepEqual(transport.muteChanges.at(-1), false);
    assert.equal(transport.commands.at(-1)?.type, "session.input_audio.unmute");

    h.session.toggleMute();
    const muting = transport.commands.at(-1);
    assert.ok(muting);
    transport.acknowledge(muting);
    h.session.interrupt(true);
    h.session.toggleMute();
    assert.equal(h.session.getSnapshot().interrupted, false);
    assert.equal(h.session.getSnapshot().muted, false, "muted and paused, one tap unmutes");
  } finally {
    await h.cleanup();
  }
});

test("a phone call or Siri pauses the microphone, tells hex, and gives it back unless you muted", async () => {
  const h = harness();
  const marks: string[] = [];
  h.api.mark = async (id, kind) => {
    marks.push(`${id} ${kind}`);
  };

  try {
    await h.session.start();
    await settle();
    const transport = nth(h.transports, 0);
    h.session.interrupt(true);
    h.session.interrupt(true);
    assert.equal(h.session.getSnapshot().interrupted, true);
    assert.deepEqual(transport.muteChanges.at(-1), true);
    assert.equal(transport.commands.at(-1)?.type, "session.input_audio.mute");
    h.session.interrupt(false);
    assert.equal(h.session.getSnapshot().interrupted, false);
    assert.deepEqual(transport.muteChanges.at(-1), false);
    assert.equal(transport.commands.at(-1)?.type, "session.input_audio.unmute");
    assert.deepEqual(marks, ["live_1 paused", "live_1 resumed"]);

    h.session.toggleMute();
    const muting = transport.commands.at(-1);
    assert.ok(muting);
    transport.acknowledge(muting);
    const changes = transport.muteChanges.length;
    h.session.interrupt(true);
    h.session.interrupt(false);
    assert.equal(transport.muteChanges.length, changes);
    assert.equal(h.session.getSnapshot().muted, true);
  } finally {
    await h.cleanup();
  }
});

test("an error from the voice service leaves the call going", async () => {
  const h = harness();

  try {
    await h.session.start();
    const transport = nth(h.transports, 0);
    transport.emit({ type: "error", error: { message: "Unknown client or Decision delegation." } });
    await settle();
    assert.equal(h.session.getSnapshot().status, "connected");
    assert.equal(transport.closed, false);
    assert.deepEqual(h.closed, []);
  } finally {
    await h.cleanup();
  }
});

test("a call OpenAI closes for a lost connection ends as dropped", async () => {
  const h = harness();

  try {
    await h.session.start();
    nth(h.transports, 0).emit({ type: "session.closed", reason: "connection_lost" });
    await settle();
    assert.equal(h.session.getSnapshot().ending, "dropped");
  } finally {
    await h.cleanup();
  }
});

test("a lost connection carries the call on in a new session: the same call, one clock for captions, the mute kept", async () => {
  const h = harness();
  const carried: string[] = [];
  h.api.carryOn = async (sdp, call) => {
    carried.push(call);

    return { sdp: `answer-${sdp}`, sessionId: call };
  };

  try {
    await h.session.start();
    const first = nth(h.transports, 0);
    first.emit({
      type: "session.input_transcript.delta",
      delta: "hello",
      start_ms: 100,
      end_ms: 400,
    });
    h.session.toggleMute();
    const muting = first.commands.at(-1);
    assert.ok(muting);
    first.acknowledge(muting);
    h.clock.now += 30_000;
    first.callbacks.onFailure("The audio connection failed.");
    await settle();

    const second = nth(h.transports, 1);
    assert.equal(first.closed, true);
    assert.deepEqual(carried, ["live_1"]);
    assert.equal(h.session.getSnapshot().status, "connected");
    assert.equal(h.session.getSnapshot().callId, "live_1");
    assert.equal(h.session.getSnapshot().muted, true);
    assert.equal(second.muteChanges[0], true);
    assert.equal(second.commands.at(-1)?.type, "session.input_audio.mute");

    second.emit({
      type: "session.input_transcript.delta",
      delta: "again",
      start_ms: 100,
      end_ms: 300,
    });
    assert.deepEqual(
      h.session.getSnapshot().transcript.map(({ text, startMs }) => ({ text, startMs })),
      [
        { text: "hello", startMs: 100 },
        { text: "again", startMs: 30_100 },
      ],
    );

    await h.session.stop();
    assert.equal(h.session.getSnapshot().ending, "you");
    assert.deepEqual(h.closed, []);
  } finally {
    await h.cleanup();
  }
});

test("a session OpenAI ends on its time limit carries on, retrying past a failure, and ends as dropped only once hex says the call is over", async () => {
  const h = harness();
  const answers: ("fail" | "over")[] = ["fail", "over"];
  h.api.carryOn = async () => {
    if (answers.shift() === "fail") {
      throw new Error("Network request failed");
    }

    return null;
  };

  try {
    await h.session.start();
    nth(h.transports, 0).emit({ type: "session.closed", reason: "expired" });
    await settle();
    assert.equal(h.session.getSnapshot().status, "reconnecting");
    await h.clock.fire(0);
    await settle();
    assert.equal(h.transports.length, 3);
    assert.equal(h.session.getSnapshot().status, "idle");
    assert.equal(h.session.getSnapshot().ending, "dropped");
    assert.deepEqual(h.closed, []);
  } finally {
    await h.cleanup();
  }
});

test("hanging up while the call reconnects ends it as yours", async () => {
  const h = harness();
  h.api.carryOn = async () => await Promise.withResolvers<never>().promise;

  try {
    await h.session.start();
    nth(h.transports, 0).emit({ type: "session.closed", reason: "connection_lost" });
    await settle();
    assert.equal(h.session.getSnapshot().status, "reconnecting");
    await h.session.stop();
    assert.equal(h.session.getSnapshot().ending, "you");
    assert.equal(h.session.getSnapshot().status, "idle");
  } finally {
    await h.cleanup();
  }
});
