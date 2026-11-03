import {
  createContext,
  use,
  useEffect,
  useEffectEvent,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';

import { callOf, isHere } from '@/call/call';
import { hex } from '@/hex';
import { useCallElsewhere } from '@/hooks/use-call-elsewhere';
import type { CallId } from '@/live/calls';
import { demoAPI, demoTransport } from '@/live/demo-call';
import { LiveSession } from '@/live/session';
import { createTransport } from '@/live/transport';
import type { CallAbout, Levels } from '@/live/types';
import type { LiveVoice } from '@/live/voices';
import { CallInterruptions } from '../../modules/call-interruptions';

const Session = createContext<LiveSession | null>(null);

// The call's audio lives above every screen, so moving between them never ends it. A demo session
// plays a pretend call (src/live/demo-call.ts) and starts at once.
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
    if (demo) void session.start();
    const listener = AppState.addEventListener('change', onAppStateChange);
    const interruptions = CallInterruptions?.addListener('onInterruption', ({ began }) =>
      session.interrupt(began),
    );
    return () => {
      listener.remove();
      interruptions?.remove();
      void session.stop();
    };
  }, [session, demo]);
  return <Session value={session}>{children}</Session>;
}

// The one call the screen shows: this phone's own, or the one hex holds elsewhere (`held`, from
// /activity), followed word by word until it ends.
export function useCall(held: CallId | null) {
  const session = use(Session)!;
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
  const call = callOf(snapshot, { record: elsewhere.call, leaving: elsewhere.leaving });
  return {
    call,
    start: (voice: LiveVoice, about?: CallAbout) => session.start(voice, about),
    end: () => (call.kind === 'elsewhere' ? elsewhere.hangUp() : session.stop()),
    toggleMute: session.toggleMute,
  };
}

// The call's audio levels as they change, outside React's renders.
export function useLevels(hear: (levels: Levels) => void) {
  const session = use(Session)!;
  const take = useEffectEvent(hear);
  useEffect(() => session.subscribeLevels(() => take(session.getLevels())), [session]);
}
