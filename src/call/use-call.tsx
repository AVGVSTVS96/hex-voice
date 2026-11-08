import {
  createContext,
  use,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import type { ReactNode } from 'react';
import { Alert, AppState } from 'react-native';

import { callIdOf, callOf, isHere, withSent } from '@/call/call';
import type { Call } from '@/call/call';
import { hex } from '@/hex';
import { Refused } from '@/hex/client';
import { useCallElsewhere } from '@/hooks/use-call-elsewhere';
import type { CallId } from '@/live/calls';
import { newKey } from '@/live/chat';
import type { Picked } from '@/live/media';
import { batchOf, deliver, retrying, settle } from '@/live/shares';
import type { Sent } from '@/live/shares';
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
export const CallProvider = ({ demo, children }: { demo: boolean; children: ReactNode }) => {
  const [session] = useState(() =>
    demo ? new LiveSession(demoTransport, demoAPI) : new LiveSession(createTransport, hex.session),
  );
  useEffect(() => {
    const onAppStateChange = (state: typeof AppState.currentState) => {
      // Native iOS audio continues while the screen is locked or another app is
      // open. Only visual updates pause; the microphone keeps its chosen state.
      session.setAppActive(state === 'active');
      if (state === 'background' && process.env.EXPO_OS !== 'ios') {
        void session.stop();
      }
    };
    onAppStateChange(AppState.currentState);
    const listener = AppState.addEventListener('change', onAppStateChange);
    const interruptions = CallInterruptions?.addListener('onInterruption', ({ began }) => {
      session.interrupt(began);
    });
    return () => {
      listener.remove();
      interruptions?.remove();
      void session.stop();
    };
  }, [session]);
  const [value] = useState({ session, demo });
  const [sent, setSent] = useState<Sent[]>([]);
  const [go] = useState(() => async (call: CallId, batch: Sent[]) => {
    const outcome = await deliver(call, batch, {
      upload: hex.media.upload,
      media: hex.calls.media,
    });
    if (outcome.error instanceof Refused && outcome.error.status === 409) {
      ended();
    }
    setSent((now) => settle(now, batch, outcome));
  });
  // What was sent to an earlier call goes as the next call's first one does.
  const send = (call: CallId, at: number, picked: Picked[]) => {
    const batch = batchOf(call, at, picked, newKey());
    setSent((now) => [...now.filter((one) => one.call === call), ...batch]);
    void go(call, batch);
  };
  const retry = (entry: string) => {
    const again = retrying(sent, entry);
    if (!again.length) {
      return;
    }
    setSent((now) => now.map((one) => again.find(({ entry }) => entry.id === one.entry.id) ?? one));
    void go(again[0]!.call, again);
  };
  return (
    <Session value={value}>
      <Sending value={{ sent, send, retry }}>{children}</Sending>
    </Session>
  );
};

// The one call the screen shows: this phone's own, or the one hex holds elsewhere (`held`, from
// /activity), followed word by word until it ends.
export const useCall = (held: CallId | null) => {
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
    if (demo) {
      void session.start();
    }
  }, [session, demo]);
  return {
    call,
    start: async (voice: LiveVoice, about?: CallAbout) => session.start(voice, about),
    end: async () => (call.kind === 'elsewhere' ? elsewhere.hangUp() : session.stop()),
    toggleMute: session.toggleMute,
  };
};

// The call ended before what you picked could go to it.
const ended = () => {
  Alert.alert('The call has ended', 'What you picked wasn’t sent.');
};

// Whether a call on this phone holds the microphone, so nothing else here records sound.
export const useMicHeld = () => {
  const { session } = use(Session)!;
  const { status } = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  return isHere(status);
};

// What you send a call shows in its words at once, going, then sent or why it didn't. It goes to
// the call on screen when you send it, which may have ended while you picked.
export const useShare = (call: Call) => {
  const { send } = use(Sending)!;
  const now = useRef(call);
  useEffect(() => {
    now.current = call;
  });
  return (picked: Picked[]) => {
    const live = now.current;
    const id = callIdOf(live);
    if (live.kind === 'none' || !id) {
      ended();
      return;
    }
    const at =
      live.kind === 'here' ? live.seconds * 1000 : Date.now() - Date.parse(live.record.started);
    send(id, at, picked);
  };
};

// Sends again what you sent a call that didn't get there.
export const useRetry = () => use(Sending)!.retry;

// The call's audio levels, from where they are as the screen first draws, then as they change,
// outside React's renders.
export const useLevels = (hear: (levels: Levels) => void) => {
  const { session } = use(Session)!;
  const take = useEffectEvent(hear);
  useLayoutEffect(() => {
    const now = () => {
      take(session.getLevels());
    };
    now();
    return session.subscribeLevels(now);
  }, [session]);
};
