import type { PersonaState } from '@/components/persona/animation';
import {
  ENDINGS,
  SOURCES,
  callLength,
  endedSeconds,
  liveEntries,
  type CallEnding,
  type CallId,
  type CallRecord,
  type CallSource,
} from '@/live/calls';
import type { MediaId, Shown } from '@/live/media';
import type { LiveSnapshot, LiveStatus, TranscriptEntry } from '@/live/types';

export type Mic = { muted: boolean; interrupted: boolean };

// What a call leaves on screen once it ends, whether it was here or hex held it elsewhere.
export type Ended = {
  id?: CallId;
  from: CallSource;
  ending?: CallEnding;
  seconds: number;
  error?: string;
  words: TranscriptEntry[];
};

// The one call the screen shows. hex holds one call at a time, so a call on this phone and one
// hex holds elsewhere (a phone call, the web page) never both show; the one here wins.
export type Call =
  | { kind: 'none'; last?: Ended }
  | {
      kind: 'here';
      phase: 'connecting' | 'live' | 'ending';
      id?: CallId;
      mic: Mic;
      seconds: number;
      words: TranscriptEntry[];
    }
  | { kind: 'elsewhere'; phase: 'live' | 'ending'; record: CallRecord; words: TranscriptEntry[] };

export type Elsewhere = { record?: CallRecord; leaving: boolean };

const HERE: Partial<Record<LiveStatus, 'connecting' | 'live' | 'ending'>> = {
  connecting: 'connecting',
  connected: 'live',
  disconnecting: 'ending',
};

export function isHere(status: LiveStatus) {
  return status in HERE;
}

export function callOf(session: LiveSnapshot, { record, leaving }: Elsewhere): Call {
  const phase = HERE[session.status];
  if (phase)
    return {
      kind: 'here',
      phase,
      id: session.callId ?? undefined,
      mic: { muted: session.muted, interrupted: session.interrupted },
      seconds: session.elapsedSeconds,
      words: session.transcript,
    };
  if (record && !record.ended)
    return {
      kind: 'elsewhere',
      phase: leaving ? 'ending' : 'live',
      record,
      words: liveEntries(record),
    };
  if (record)
    return {
      kind: 'none',
      last: {
        id: record.id,
        from: record.from,
        ending: record.end,
        seconds: endedSeconds(record),
        words: liveEntries(record),
      },
    };
  if (!session.callId && !session.error) return { kind: 'none' };
  return {
    kind: 'none',
    last: {
      id: session.callId ?? undefined,
      from: 'app',
      ending: session.ending ?? undefined,
      seconds: session.elapsedSeconds,
      error: session.error ?? undefined,
      words: session.transcript,
    },
  };
}

// A photo or clip you sent a call from here, as its words show it until hex's record has it: going,
// or why it didn't.
export type Sent = { call: CallId; id?: MediaId; entry: TranscriptEntry & { media: Shown } };

// The call with what you sent it among its words. One hex holds elsewhere shows each from its own
// record once that has it, so a sent one shows only until then.
export function withSent(call: Call, sent: Sent[]): Call {
  if (call.kind === 'none') return call;
  const id = callIdOf(call);
  const kept = new Set(
    call.kind === 'elsewhere' ? (call.record.moments ?? []).map((m) => m.media) : [],
  );
  const ours = sent
    .filter((one) => one.call === id && !(one.id && kept.has(one.id)))
    .map((one) => one.entry);
  if (!ours.length) return call;
  return { ...call, words: [...call.words, ...ours].sort((a, b) => a.startMs - b.startMs) };
}

// The call going on now, here or elsewhere; hex names this phone's once it answers.
export function callIdOf(call: Call) {
  if (call.kind === 'none') return undefined;
  return call.kind === 'here' ? call.id : call.record.id;
}

export function wordsOf(call: Call) {
  return call.kind === 'none' ? (call.last?.words ?? []) : call.words;
}

// Where the words have a page of their own, it opens once there's a call or anything to read,
// and before that the orb rests alone.
export function showsWords(call: Call, { viewing, cards }: { viewing: boolean; cards: number }) {
  return viewing || call.kind !== 'none' || wordsOf(call).length > 0 || cards > 0;
}

// `speaking` is hex's voice on this phone's call, from the audio levels.
export function personaOf(call: Call, speaking: boolean): PersonaState {
  if (call.kind === 'none') return 'idle';
  if (call.phase !== 'live') return 'thinking';
  if (call.kind === 'elsewhere') return 'listening';
  return speaking ? 'speaking' : call.mic.muted ? 'idle' : 'listening';
}

// How awake the orb rests: asleep and breathing with no call, half while one connects or ends.
export function wakeOf(call: Call) {
  if (call.kind === 'none') return 0;
  return call.phase === 'live' ? 1 : 0.5;
}

export function statusOf(call: Call) {
  if (call.kind === 'none') return 'Ready to start a conversation';
  if (call.phase === 'connecting') return 'Connecting';
  if (call.phase === 'ending') return 'Ending conversation';
  if (call.kind === 'elsewhere') {
    const { started, where } = SOURCES[call.record.from];
    return `${started}, ${where.toLowerCase()}`;
  }
  return call.mic.muted ? 'Microphone muted' : 'Conversation active';
}

export type CallButton = 'start' | 'retry' | 'cancel' | 'end' | 'ending';
// With no call there's nothing to mute. A call held elsewhere mutes there, not here.
export type MuteButton = { muted: boolean; enabled: boolean } | undefined;

// A photo or clip goes to a call once it's live.
export function buttonsOf(call: Call): { call: CallButton; mute: MuteButton; add: boolean } {
  if (call.kind === 'none')
    return { call: call.last?.error ? 'retry' : 'start', mute: undefined, add: false };
  if (call.phase === 'ending') return { call: 'ending', mute: muteOf(call), add: false };
  return {
    call: call.phase === 'connecting' ? 'cancel' : 'end',
    mute: muteOf(call),
    add: call.phase === 'live',
  };
}

function muteOf(call: Exclude<Call, { kind: 'none' }>): MuteButton {
  if (call.kind === 'elsewhere') return { muted: false, enabled: false };
  return {
    muted: call.mic.muted || call.mic.interrupted,
    enabled: call.phase === 'live',
  };
}

// The voice is fixed when a call here starts.
export function voiceLocked(call: Call) {
  return call.kind === 'here';
}

// What the footer says about the call: how the last one ended, with hex's wrap-up under it once
// hex has written one, where a call held elsewhere is, or that iOS paused the microphone. A past
// call on screen hides how the last one ended.
export type Footer =
  | { kind: 'ended'; id?: string; text: string; bad: boolean }
  | { kind: 'elsewhere'; text: string }
  | { kind: 'paused'; text: string };

export function footerOf(call: Call, viewing: boolean): Footer | undefined {
  if (call.kind === 'elsewhere') {
    const { where, started } = SOURCES[call.record.from];
    return { kind: 'elsewhere', text: `${where} · ${started}` };
  }
  if (call.kind === 'here')
    return call.mic.interrupted
      ? { kind: 'paused', text: 'Paused while another app has the audio' }
      : undefined;
  const last = call.last;
  if (viewing || !last?.ending) return undefined;
  const { line, bad } = ENDINGS[last.ending];
  return {
    kind: 'ended',
    id: last.id,
    text: last.ending === 'no-connect' ? line : `${line} · ${callLength(last.seconds)}`,
    bad: !!bad,
  };
}

export function errorOf(call: Call) {
  return call.kind === 'none' ? call.last?.error : undefined;
}
