import type { PersonaState } from "@/components/persona/animation";
import { ENDINGS, SOURCES, callLength, endedSeconds, hushed, liveEntries } from "@/live/calls";
import type { CallEnding, CallId, CallRecord, CallSource } from "@/live/calls";
import type { Sent } from "@/live/shares";
import type { LiveSnapshot, LiveStatus, TranscriptEntry } from "@/live/types";

export interface Mic {
  muted: boolean;
  interrupted: boolean;
}

export interface Ended {
  id?: CallId | undefined;
  from: CallSource;
  ending?: CallEnding | undefined;
  seconds: number;
  error?: string | undefined;
  words: TranscriptEntry[];
}

export type Call =
  | { kind: "none"; last?: Ended }
  | {
      kind: "here";
      phase: "connecting" | "live" | "ending";
      id?: CallId | undefined;
      mic: Mic;
      hushed: boolean;
      seconds: number;
      words: TranscriptEntry[];
    }
  | { kind: "elsewhere"; phase: "live" | "ending"; record: CallRecord; words: TranscriptEntry[] };

export interface Elsewhere {
  record?: CallRecord | undefined;
  leaving: boolean;
}

const HERE: Partial<Record<LiveStatus, "connecting" | "live" | "ending">> = {
  connecting: "connecting",
  connected: "live",
  disconnecting: "ending",
};

export const isHere = (status: LiveStatus) => status in HERE;

export const callOf = (
  session: LiveSnapshot,
  { record, leaving }: Elsewhere,
  own?: Pick<CallRecord, "moments">,
): Call => {
  const phase = HERE[session.status];

  if (phase) {
    return {
      kind: "here",
      phase,
      id: session.callId ?? undefined,
      mic: { muted: session.muted, interrupted: session.interrupted },
      hushed: hushed(own?.moments),
      seconds: session.elapsedSeconds,
      words: session.transcript,
    };
  }

  if (record && (record.ended ?? "") === "") {
    return {
      kind: "elsewhere",
      phase: leaving ? "ending" : "live",
      record,
      words: liveEntries(record),
    };
  }

  if (record) {
    return {
      kind: "none",
      last: {
        id: record.id,
        from: record.from,
        ending: record.end,
        seconds: endedSeconds(record),
        words: liveEntries(record),
      },
    };
  }

  if (!session.callId && (session.error ?? "") === "") {
    return { kind: "none" };
  }

  return {
    kind: "none",
    last: {
      id: session.callId ?? undefined,
      from: "app",
      ending: session.ending ?? undefined,
      seconds: session.elapsedSeconds,
      error: session.error ?? undefined,
      words: session.transcript,
    },
  };
};

export const withSent = (call: Call, sent: Sent[]): Call => {
  if (call.kind === "none") {
    return call;
  }

  const id = callIdOf(call);

  const inRecord = new Set(
    call.kind === "elsewhere" ? (call.record.moments ?? []).map((m) => m.media) : [],
  );

  const ours = sent.flatMap((one) =>
    one.call === id && !(one.id && inRecord.has(one.id)) ? [one.entry] : [],
  );

  if (!ours.length) {
    return call;
  }

  return { ...call, words: [...call.words, ...ours].sort((a, b) => a.startMs - b.startMs) };
};

export const callIdOf = (call: Call): CallId | undefined => {
  if (call.kind === "none") {
    return undefined;
  }

  return call.kind === "here" ? call.id : call.record.id;
};

export const wordsOf = (call: Call) =>
  call.kind === "none" ? (call.last?.words ?? []) : call.words;

export const showsWords = (call: Call, { viewing, cards }: { viewing: boolean; cards: number }) =>
  viewing || call.kind !== "none" || wordsOf(call).length > 0 || cards > 0;

export const personaOf = (call: Call, speaking: boolean): PersonaState => {
  if (call.kind === "none") {
    return "idle";
  }

  if (call.phase !== "live") {
    return "thinking";
  }

  if (call.kind === "here" && speaking) {
    return "speaking";
  }

  return quiet(call) ? "idle" : "listening";
};

const isHushed = (call: Exclude<Call, { kind: "none" }>) =>
  call.kind === "here" ? call.hushed : hushed(call.record.moments);

const quiet = (call: Exclude<Call, { kind: "none" }>) =>
  isHushed(call) || (call.kind === "here" && call.mic.muted);

export const wakeOf = (call: Call) => {
  if (call.kind === "none") {
    return 0;
  }

  return call.phase === "live" ? 1 : 0.5;
};

export const statusOf = (call: Call) => {
  if (call.kind === "none") {
    return "Ready to start a conversation";
  }

  if (call.phase === "connecting") {
    return "Connecting";
  }

  if (call.phase === "ending") {
    return "Ending conversation";
  }

  if (call.kind === "elsewhere") {
    const { started, where } = SOURCES[call.record.from];

    return `${started}, ${where.toLowerCase()}`;
  }

  if (call.mic.muted) {
    return call.hushed ? "Microphone and hex muted" : "Microphone muted";
  }

  return call.hushed ? "hex muted" : "Conversation active";
};

export type CallButton = "start" | "retry" | "cancel" | "end" | "ending";

export type Muted = "none" | "app" | "hex";

export type MuteButton = { muted: Muted; enabled: boolean } | undefined;

interface Buttons {
  call: CallButton;
  mute: MuteButton;
  add: boolean;
}

export const buttonsOf = (call: Call): Buttons => {
  if (call.kind === "none") {
    return {
      call: (call.last?.error ?? "") === "" ? "start" : "retry",
      mute: undefined,
      add: false,
    };
  }

  if (call.phase === "ending") {
    return { call: "ending", mute: muteOf(call), add: false };
  }

  return {
    call: call.phase === "connecting" ? "cancel" : "end",
    mute: muteOf(call),
    add: call.phase === "live",
  };
};

const mutedOf = (call: Exclude<Call, { kind: "none" }>): Muted => {
  if (call.kind === "here" && (call.mic.muted || call.mic.interrupted)) {
    return "app";
  }

  return isHushed(call) ? "hex" : "none";
};

const muteOf = (call: Exclude<Call, { kind: "none" }>): MuteButton => ({
  muted: mutedOf(call),
  enabled: call.kind === "here" && call.phase === "live",
});

export const voiceLocked = (call: Call) => call.kind === "here";

export type Footer =
  | { kind: "ended"; id?: string | undefined; text: string; bad: boolean }
  | { kind: "elsewhere"; text: string }
  | { kind: "paused"; text: string }
  | { kind: "hushed"; text: string };

const PAUSED: Footer = { kind: "paused", text: "Paused while another app has the audio" };

const HUSHED: Footer = { kind: "hushed", text: "hex muted · say “unmute”" };

export const footerOf = (call: Call, viewing: boolean): Footer | undefined => {
  if (call.kind === "elsewhere") {
    if (isHushed(call)) {
      return HUSHED;
    }

    const { where, started } = SOURCES[call.record.from];

    return { kind: "elsewhere", text: `${where} · ${started}` };
  }

  if (call.kind === "here") {
    if (call.mic.interrupted) {
      return PAUSED;
    }

    return call.hushed ? HUSHED : undefined;
  }

  const { last } = call;

  if (viewing || !last?.ending) {
    return undefined;
  }

  const { line, bad } = ENDINGS[last.ending];

  return {
    kind: "ended",
    id: last.id,
    text: last.ending === "no-connect" ? line : `${line} · ${callLength(last.seconds)}`,
    bad: !!bad,
  };
};

export const errorOf = (call: Call) => (call.kind === "none" ? call.last?.error : undefined);
