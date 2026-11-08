import {
  createContext,
  use,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';

import { callIdOf, callOf, isHere, withSent, type Call, type Sent } from '@/call/call';
import { hex } from '@/hex';
import { useCallElsewhere } from '@/hooks/use-call-elsewhere';
import type { CallId } from '@/live/calls';
import type { MediaId, Picked } from '@/live/media';
import { demoAPI, demoTransport } from '@/live/demo-call';
import { LiveSession } from '@/live/session';
import { createTransport } from '@/live/transport';
import type { CallAbout, Levels } from '@/live/types';
import type { LiveVoice } from '@/live/voices';
import { CallInterruptions } from '../../modules/call-interruptions';

const Session = createContext<{ session: LiveSession; demo: boolean } | null>(null);
// What you sent the call from here, and how to send it more.
const Sending = createContext<{
  sent: Sent[];
  send: (call: CallId, at: number, picked: Picked[]) => void;
  retry: (entry: string) => void;
} | null>(null);

// The call's audio lives above every screen, so moving between them never ends it. A demo session
// plays a pretend call (src/live/demo-call.ts), starting as the call screen opens.
export function CallProvider({ demo, children }: { demo: boolean; children: ReactNode }) {
  const [session] = useState(() =>
    demo ? new LiveSession(demoTransport, demoAPI) : new LiveSession(createTransport, hex.session),
  );
  useEffect(() => {
    const onAppStateChange = (state: typeof AppState.currentState) => {
      // Native iOS audio continues while the screen is locked or another app is
      // open. Only visual updates pause; the microphone keeps its chosen state.
      session.setAppActive(state === 'active');
      if (state === 'background' && process.env.EXPO_OS !== 'ios') void session.stop();
    };
    onAppStateChange(AppState.currentState);
    const listener = AppState.addEventListener('change', onAppStateChange);
    const interruptions = CallInterruptions?.addListener('onInterruption', ({ began }) =>
      session.interrupt(began),
    );
    return () => {
      listener.remove();
      interruptions?.remove();
      void session.stop();
    };
  }, [session]);
  const [value] = useState({ session, demo });
  const [sent, setSent] = useState<Sent[]>([]);
  // What's sent together goes to hex in one request, so it hears of them once.
  const [go] = useState(() => (call: CallId, group: Sent[]) => {
    const settle = (change: (one: Sent, i: number) => Partial<Sent['entry']> & { id?: MediaId }) =>
      setSent((now) =>
        now.map((one) => {
          const i = group.findIndex(({ entry }) => entry.id === one.entry.id);
          if (i < 0) return one;
          const { id, ...entry } = change(one, i);
          return { ...one, id: id ?? one.id, entry: { ...one.entry, sending: false, ...entry } };
        }),
      );
    hex.calls
      .share(
        call,
        group.map(({ picked }) => picked),
      )
      .then(
        // A clip's file is one no image view draws, so once hex has it, it shows hex's still.
        (shared) =>
          settle((one, i) => ({
            id: shared[i]!.id,
            ...(one.picked.kind === 'video' && { media: shared[i] }),
          })),
        (error: unknown) =>
          settle(() => ({ failed: error instanceof Error ? error.message : String(error) })),
      );
  });
  // What was sent to an earlier call goes as the next call's first one does.
  const send = (call: CallId, at: number, picked: Picked[]) => {
    const group = picked.map((media, i) => ({
      call,
      picked: media,
      entry: {
        id: `sent ${call} ${at} ${i} ${media.uri}`,
        role: 'user' as const,
        text: '',
        startMs: at,
        media,
        sending: true,
      },
    }));
    setSent((now) => [...now.filter((each) => each.call === call), ...group]);
    go(call, group);
  };
  const retry = (id: string) => {
    const one = sent.find(({ entry }) => entry.id === id);
    if (!one) return;
    const again = { ...one, entry: { ...one.entry, sending: true, failed: undefined } };
    setSent((now) => now.map((each) => (each.entry.id === id ? again : each)));
    go(one.call, [again]);
  };
  return (
    <Session value={value}>
      <Sending value={{ sent, send, retry }}>{children}</Sending>
    </Session>
  );
}

// The one call the screen shows: this phone's own, or the one hex holds elsewhere (`held`, from
// /activity), followed word by word until it ends.
export function useCall(held: CallId | null) {
  const { session, demo } = use(Session)!;
  const snapshot = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  const here = isHere(snapshot.status);
  const elsewhere = useCallElsewhere(
    held && !here && held !== snapshot.callId ? held : undefined,
    here,
  );
  const { sent } = use(Sending)!;
  const call = withSent(
    callOf(snapshot, { record: elsewhere.call, leaving: elsewhere.leaving }),
    sent,
  );
  useEffect(() => {
    if (demo) void session.start();
  }, [session, demo]);
  return {
    call,
    start: (voice: LiveVoice, about?: CallAbout) => session.start(voice, about),
    end: () => (call.kind === 'elsewhere' ? elsewhere.hangUp() : session.stop()),
    toggleMute: session.toggleMute,
  };
}

// Whether a call on this phone holds the microphone, so nothing else here records sound.
export function useMicHeld() {
  const { session } = use(Session)!;
  const { status } = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  return isHere(status);
}

// What you send a call shows in its words at once, going, then sent or why it didn't.
export function useShare(call: Call) {
  const { send } = use(Sending)!;
  const id = callIdOf(call);
  return (picked: Picked[]) => {
    if (call.kind === 'none' || !id) return;
    const at =
      call.kind === 'here' ? call.seconds * 1000 : Date.now() - Date.parse(call.record.started);
    send(id, at, picked);
  };
}

// Sends again what you sent a call that didn't get there.
export function useRetry() {
  return use(Sending)!.retry;
}

// The call's audio levels, from where they are as the screen first draws, then as they change,
// outside React's renders.
export function useLevels(hear: (levels: Levels) => void) {
  const { session } = use(Session)!;
  const take = useEffectEvent(hear);
  useLayoutEffect(() => {
    const now = () => take(session.getLevels());
    now();
    return session.subscribeLevels(now);
  }, [session]);
}
