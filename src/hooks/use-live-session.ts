import { useEffect, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { LiveSession } from '@/live/session';
import { createTransport } from '@/live/transport';
import { hex } from '@/hex';
import { demoAPI, demoTransport } from '@/live/demo-call';
import { CallInterruptions } from '../../modules/call-interruptions';

// A demo session plays a pretend call (src/live/demo-call.ts) and starts at once.
export function useLiveSession(demo = false) {
  const [session] = useState(() =>
    demo ? new LiveSession(demoTransport, demoAPI) : new LiveSession(createTransport, hex.session),
  );
  const snapshot = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
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
  return { ...snapshot, start: session.start, stop: session.stop, toggleMute: session.toggleMute };
}
