import * as z from "zod/mini";

import type { CallEnding, CallId } from "./calls";
import type { Shown } from "./media";
import type { TaskId } from "./tasks";
import type { LiveVoice } from "./voices";

export interface FailedHere {
  failed?: string;
}

export type LiveStatus = "idle" | "connecting" | "connected" | "disconnecting" | "error";

export interface TranscriptEntry {
  id: string;
  role: "user" | "assistant";
  text: string;
  startMs: number;
  endMs?: number;
  media?: Shown;
  sending?: boolean;
  failed?: string | undefined;
}

export interface LiveSnapshot {
  status: LiveStatus;
  error: string | null;
  muted: boolean;
  elapsedSeconds: number;
  transcript: TranscriptEntry[];
  callId: CallId | null;
  ending: CallEnding | null;
  interrupted: boolean;
}

export interface Levels {
  input: number;
  output: number;
}

const LiveEvent = z.discriminatedUnion("type", [
  z.object({ type: z.literal("session.started") }),
  z.object({
    type: z.enum(["session.input_transcript.delta", "session.output_transcript.delta"]),
    delta: z.string(),
    start_ms: z.optional(z.number()),
    end_ms: z.optional(z.number()),
  }),
  z.object({
    type: z.enum(["session.input_audio.muted", "session.input_audio.unmuted"]),
    client_event_id: z.optional(z.string()),
  }),
  z.object({ type: z.literal("session.closed"), reason: z.optional(z.string()) }),
  z.object({
    type: z.enum(["error", "session.error"]),
    error: z.catch(z.optional(z.object({ message: z.optional(z.string()) })), undefined),
  }),
]);

export type LiveEvent = z.infer<typeof LiveEvent>;

export const parseEvent = (text: string): LiveEvent | undefined => {
  try {
    return LiveEvent.safeParse(JSON.parse(text)).data;
  } catch {
    return undefined;
  }
};

export interface LiveCommand {
  type: "session.input_audio.mute" | "session.input_audio.unmute" | "session.close";
  event_id?: string;
}

export interface AudioStats {
  inputLevel: number;
  outputLevel: number;
  sentPackets: number;
  receivedPackets: number;
}

export interface LiveTransport {
  offer: () => Promise<string>;
  answer: (sdp: string) => Promise<void>;
  send: (event: LiveCommand) => boolean;
  setMuted: (muted: boolean) => void;
  stats: () => Promise<AudioStats>;
  close: () => void;
}

export interface TransportCallbacks {
  onEvent: (event: LiveEvent) => void;
  onFailure: (message: string) => void;
}

export type TransportFactory = (callbacks: TransportCallbacks) => Promise<LiveTransport>;

export type CallAbout = { task: TaskId } | "asks";

export interface SessionAPI {
  create: (
    sdp: string,
    voice?: LiveVoice,
    about?: CallAbout,
  ) => Promise<{ sdp: string; sessionId: CallId }>;
  close: (sessionId: CallId) => Promise<void>;
  mark?: (sessionId: CallId, kind: "paused" | "resumed") => Promise<void>;
}
