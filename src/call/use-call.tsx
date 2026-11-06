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
import type { Picked } from '@/live/media';
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
  send: (call: CallId, at: number, media: Picked) => void;
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
  const [send] = useState(() => (call: CallId, at: number, media: Picked) => {
    const entry = {
      id: `sent ${call} ${at} ${media.uri}`,
      role: 'user' as const,
      text: '',
      startMs: at,
      media,
      sending: true,
    };
    const settle = (change: Partial<Sent>, entryChange: Partial<Sent['entry']>) =>
      setSent((now) =>
        now.map((one) =>
          one.entry.id === entry.id
            ? { ...one, ...change, entry: { ...one.entry, sending: false, ...entryChange } }
            : one,
        ),
      );
    setSent((now) => [...now, { call, entry }]);
    // A clip's file is one no image view draws, so once hex has it, it shows hex's still.
    hex.calls.share(call, media).then(
      (shared) => settle({ id: shared.id }, media.kind === 'video' ? { media: shared } : {}),
      (error: unknown) =>
        settle({}, { failed: error instanceof Error ? error.message : String(error) }),
    );
  });
  return (
    <Session value={value}>
      <Sending value={{ sent, send }}>{children}</Sending>
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
  return (media: Picked) => {
    if (call.kind === 'none' || !id) return;
    const at =
      call.kind === 'here' ? call.seconds * 1000 : Date.now() - Date.parse(call.record.started);
    send(id, at, media);
  };
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
