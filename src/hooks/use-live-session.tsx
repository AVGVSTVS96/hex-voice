import {
  createContext,
  use,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';
import { LiveSession } from '@/live/session';
import { createTransport } from '@/live/transport';
import { sessionAPI } from '@/live/api';
import { CallInterruptions } from '../../modules/call-interruptions';

const Live = createContext<LiveSession | null>(null);

// The one call the app holds, above its tabs, so a call goes on while you chat or look at Activity.
export function LiveSessionProvider({ children }: { children: ReactNode }) {
  const [session] = useState(() => new LiveSession(createTransport, sessionAPI));
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
  return <Live value={session}>{children}</Live>;
}

export function useLiveSession() {
  const session = use(Live);
  if (!session) throw new Error('useLiveSession needs a LiveSessionProvider above it');
  const snapshot = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  return { ...snapshot, start: session.start, stop: session.stop, toggleMute: session.toggleMute };
}
