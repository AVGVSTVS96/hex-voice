import type { LiveEvent, SessionAPI, TransportFactory } from './types';

// A call with no microphone or server behind it, for looking at the call screens
// (hexvoice:///?demo=call): it connects at once and says a few lines.
const LINES: [type: string, at: number, text: string][] = [
  ['session.input_transcript.delta', 4, "What's left on the voice app's Duo pass?"],
  [
    'session.output_transcript.delta',
    9,
    'Layout moves the buttons into the top bar, glass makes them native, and Tasks gets its own way back to the call.',
  ],
  ['session.input_transcript.delta', 22, 'And the transcript beside Tasks?'],
  ['session.output_transcript.delta', 26, "That's in the layout pass too."],
];

export const demoTransport: TransportFactory = async ({ onEvent }) => {
  const emit = (event: LiveEvent) => setTimeout(() => onEvent(event), 0);
  return {
    offer: async () => '',
    answer: async () => {
      emit({ type: 'session.started' });
      for (const [type, at, delta] of LINES)
        emit({ type, delta, start_ms: at * 1000, end_ms: (at + 4) * 1000 });
    },
    send: (event) => {
      if (event.type === 'session.input_audio.mute' || event.type === 'session.input_audio.unmute')
        emit({ type: `${event.type}d`, client_event_id: event.event_id });
      if (event.type === 'session.close') emit({ type: 'session.closed' });
      return true;
    },
    setMuted: () => {},
    stats: async () => ({ inputLevel: 0, outputLevel: 0.2, sentPackets: 0, receivedPackets: 0 }),
    close: () => {},
  };
};

export const demoAPI: SessionAPI = {
  create: async () => ({ sdp: '', sessionId: 'demo' }),
  close: async () => {},
};
