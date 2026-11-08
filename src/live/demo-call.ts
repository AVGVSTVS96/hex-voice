import { CallId } from "./calls";
import type { LiveEvent, SessionAPI, TransportFactory } from "./types";

type Line = [
  type: "session.input_transcript.delta" | "session.output_transcript.delta",
  at: number,
  text: string,
];

const LINES: Line[] = [
  ["session.input_transcript.delta", 4, "What's left on the voice app's Duo pass?"],
  [
    "session.output_transcript.delta",
    9,
    "Layout moves the buttons into the top bar, glass makes them native, and Tasks gets its own way back to the call.",
  ],
  ["session.input_transcript.delta", 22, "And the transcript beside Tasks?"],
  ["session.output_transcript.delta", 26, "That's in the layout pass too."],
];

export const demoTransport: TransportFactory = async ({ onEvent }) => {
  const emit = (event: LiveEvent) =>
    setTimeout(() => {
      onEvent(event);
    }, 0);

  return {
    offer: async () => "",
    answer: async () => {
      emit({ type: "session.started" });

      for (const [type, at, delta] of LINES) {
        emit({ type, delta, start_ms: at * 1000, end_ms: (at + 4) * 1000 });
      }
    },
    send: (event) => {
      if (event.type === "session.close") {
        emit({ type: "session.closed" });
      } else {
        emit({ type: `${event.type}d`, client_event_id: event.event_id });
      }

      return true;
    },
    setMuted: () => {},
    stats: async () => ({ inputLevel: 0, outputLevel: 0.2, sentPackets: 0, receivedPackets: 0 }),
    close: () => {},
  };
};

export const demoAPI: SessionAPI = {
  create: async () => ({ sdp: "", sessionId: CallId.parse("demo") }),
  close: async () => {},
};
