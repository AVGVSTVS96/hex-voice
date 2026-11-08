import {
  createContext,
  use,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import type { Context, ReactNode } from 'react';
import { Alert, AppState } from 'react-native';

import { callIdOf, callOf, isHere, withSent } from '@/call/call';
import type { Call } from '@/call/call';
import { hex } from '@/hex';
import { RefusedError } from '@/hex/client';
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

const Sending = createContext<{
  sent: Sent[];
  send: (call: CallId, at: number, picked: Picked[]) => void;
  retry: (entry: string) => void;
} | null>(null);

export const CallProvider = ({ demo, children }: { demo: boolean; children: ReactNode }) => {
  const [value] = useState(() => ({
    session: demo
      ? new LiveSession(demoTransport, demoAPI)
      : new LiveSession(createTransport, hex.session),
    demo,
  }));

  const { session } = value;

  useEffect(() => {
    const onAppStateChange = (state: typeof AppState.currentState) => {
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
  const [sent, setSent] = useState<Sent[]>([]);

  const go = async (call: CallId, batch: Sent[]) => {
    const outcome = await deliver(call, batch, {
      upload: hex.media.upload,
      media: hex.calls.media,
    });

    if (outcome.error instanceof RefusedError && outcome.error.status === 409) {
      endedBeforeSent();
    }

    setSent((now) => settle(now, batch, outcome));
  };

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

    setSent((now) => now.map((one) => again.find((redo) => redo.entry.id === one.entry.id) ?? one));
    void go(again[0].call, again);
  };

  const sending = useMemo(() => ({ sent, send, retry }), [sent, send, retry]);

  return (
    <Session value={value}>
      <Sending value={sending}>{children}</Sending>
    </Session>
  );
};

export const useCall = (held: CallId | null) => {
  const { session, demo } = useProvided(Session);

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

  const { sent } = useProvided(Sending);

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
    start: async (voice: LiveVoice, about?: CallAbout) => {
      await session.start(voice, about);
    },
    end: async () => {
      await (call.kind === 'elsewhere' ? elsewhere.hangUp() : session.stop());
    },
    toggleMute: session.toggleMute,
  };
};

const useProvided = <Value,>(context: Context<Value | null>) => {
  const value = use(context);

  if (value === null) {
    throw new Error('The call hooks work only inside CallProvider.');
  }

  return value;
};

const endedBeforeSent = () => {
  Alert.alert('The call has ended', 'What you picked wasn’t sent.');
};

export const useMicHeld = () => {
  const { session } = useProvided(Session);

  const { status } = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );

  return isHere(status);
};

export const useShare = (call: Call) => {
  const { send } = useProvided(Sending);
  const now = useRef(call);
  useEffect(() => {
    now.current = call;
  });

  return (picked: Picked[]) => {
    const live = now.current;
    const id = callIdOf(live);

    if (live.kind === 'none' || !id) {
      endedBeforeSent();

      return;
    }

    const at =
      live.kind === 'here' ? live.seconds * 1000 : Date.now() - Date.parse(live.record.started);

    send(id, at, picked);
  };
};

export const useRetry = () => useProvided(Sending).retry;

export const useLevels = (hear: (levels: Levels) => void) => {
  const { session } = useProvided(Session);
  const take = useEffectEvent(hear);
  useLayoutEffect(() => {
    const now = () => {
      take(session.getLevels());
    };

    now();

    return session.subscribeLevels(now);
  }, [session]);
};
