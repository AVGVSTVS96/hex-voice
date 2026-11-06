import * as z from 'zod/mini';

import type { CallEnding, CallId } from './calls';
import type { Picked, Shown } from './media';
import type { TaskId } from './tasks';
import type { LiveVoice } from './voices';

export type LiveStatus = 'idle' | 'connecting' | 'connected' | 'disconnecting' | 'error';
// A photo or clip you sent shows as your turn: going while hex takes it in, which for a clip
// takes a few seconds, then sent, or why it didn't go.
export type TranscriptEntry = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  startMs: number;
  endMs?: number;
  media?: Shown;
  sending?: boolean;
  failed?: string;
};
export type LiveSnapshot = {
  status: LiveStatus;
  error: string | null;
  muted: boolean;
  elapsedSeconds: number;
  transcript: TranscriptEntry[];
  callId: CallId | null;
  ending: CallEnding | null;
  interrupted: boolean;
};

// How loud the microphone and hex's voice are, 0 to 1, several times a second during a call.
export type Levels = { input: number; output: number };

// The events this app acts on, of all the voice service sends over the data channel.
const LiveEvent = z.discriminatedUnion('type', [
  z.object({ type: z.literal('session.started') }),
  z.object({
    type: z.enum(['session.input_transcript.delta', 'session.output_transcript.delta']),
    delta: z.string(),
    start_ms: z.optional(z.number()),
    end_ms: z.optional(z.number()),
  }),
  z.object({
    type: z.enum(['session.input_audio.muted', 'session.input_audio.unmuted']),
    client_event_id: z.optional(z.string()),
  }),
  z.object({ type: z.literal('session.closed'), reason: z.optional(z.string()) }),
  z.object({
    type: z.enum(['error', 'session.error']),
    error: z.catch(z.optional(z.object({ message: z.optional(z.string()) })), undefined),
  }),
]);
export type LiveEvent = z.infer<typeof LiveEvent>;

const Message = z.object({ data: z.string() });

// A data channel message as one of the events above, or nothing when it's none of them.
export function parseEvent(message: unknown) {
  const text = Message.safeParse(message).data?.data;
  try {
    return text === undefined ? undefined : LiveEvent.safeParse(JSON.parse(text)).data;
  } catch {
    return undefined;
  }
}

export type LiveCommand = {
  type: 'session.input_audio.mute' | 'session.input_audio.unmute' | 'session.close';
  event_id?: string;
};
export type AudioStats = {
  inputLevel: number;
  outputLevel: number;
  sentPackets: number;
  receivedPackets: number;
};
export interface LiveTransport {
  offer(): Promise<string>;
  answer(sdp: string): Promise<void>;
  send(event: LiveCommand): boolean;
  setMuted(muted: boolean): void;
  stats(): Promise<AudioStats>;
  close(): void;
}
export type TransportCallbacks = {
  onEvent: (event: LiveEvent) => void;
  onFailure: (message: string) => void;
};
export type TransportFactory = (callbacks: TransportCallbacks) => Promise<LiveTransport>;
// What a call is about when it starts: a task, or going through your asks.
export type CallAbout = { task: TaskId } | 'asks';
export type SessionAPI = {
  create: (
    sdp: string,
    voice?: LiveVoice,
    about?: CallAbout,
  ) => Promise<{ sdp: string; sessionId: CallId }>;
  close: (sessionId: CallId) => Promise<void>;
  mark?: (sessionId: CallId, kind: 'paused' | 'resumed') => Promise<void>;
  share?: (sessionId: CallId, media: Picked) => Promise<void>;
};
