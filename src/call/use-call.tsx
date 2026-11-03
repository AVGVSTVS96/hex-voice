import {
  createContext,
  use,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';

import { hex } from '@/hex';
import { demoAPI, demoTransport } from '@/live/demo-call';
import { LiveSession } from '@/live/session';
import { createTransport } from '@/live/transport';
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

export function useSession() {
  const session = use(Session)!;
  const snapshot = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  return { ...snapshot, start: session.start, stop: session.stop, toggleMute: session.toggleMute };
}
