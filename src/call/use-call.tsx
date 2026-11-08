import {
  createContext,
  use,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { Alert, AppState } from 'react-native';

import { callIdOf, callOf, isHere, withSent, type Call, type Sent } from '@/call/call';
import { hex } from '@/hex';
import { Refused } from '@/hex/client';
import { useCallElsewhere } from '@/hooks/use-call-elsewhere';
import type { CallId } from '@/live/calls';
import { newKey } from '@/live/chat';
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
  // Each photo or clip goes up on its own, then the batch goes to the call in one request. What
  // went up stays up, so trying again sends only what didn't.
  const [go] = useState(() => async (call: CallId, batch: Sent[]) => {
    const uploads = await Promise.allSettled(
      batch.map(({ id, picked }) =>
        id ? Promise.resolve({ id, kind: picked.kind }) : hex.media.upload(picked),
      ),
    );
    const shared = uploads.map((one) => (one.status === 'fulfilled' ? one.value : undefined));
    const lost = uploads.find((one) => one.status === 'rejected');
    let failed = lost && reason(lost.reason);
    if (!failed)
      await hex.calls
        .media(
          call,
          shared.map((one) => one!.id),
        )
        .catch((error: unknown) => {
          failed = reason(error);
          if (error instanceof Refused && error.status === 409) ended();
        });
    setSent((now) =>
      now.map((one) => {
        const i = batch.findIndex(({ entry }) => entry.id === one.entry.id);
        const kept = shared[i];
        if (i < 0) return one;
        // A clip's file is one no image view draws, so once hex has it, it shows hex's still.
        const still = kept && one.picked.kind === 'video' ? { media: kept } : {};
        return {
          ...one,
          id: kept?.id ?? one.id,
          entry: { ...one.entry, ...still, sending: false, failed },
        };
      }),
    );
  });
  // What was sent to an earlier call goes as the next call's first one does.
  const send = (call: CallId, at: number, picked: Picked[]) => {
    const batch = `${call} ${at} ${newKey()}`;
    const sending = picked.map((media, i) => ({
      call,
      batch,
      picked: media,
      entry: {
        id: `sent ${batch} ${i}`,
        role: 'user' as const,
        text: '',
        startMs: at,
        media,
        sending: true,
      },
    }));
    setSent((now) => [...now.filter((each) => each.call === call), ...sending]);
    void go(call, sending);
  };
  const retry = (id: string) => {
    const batch = sent.find(({ entry }) => entry.id === id)?.batch;
    const again = sent
      .filter((one) => one.batch === batch && one.entry.failed)
      .map((one) => ({ ...one, entry: { ...one.entry, sending: true, failed: undefined } }));
    if (!again.length) return;
    setSent((now) => now.map((one) => again.find(({ entry }) => entry.id === one.entry.id) ?? one));
    void go(again[0]!.call, again);
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

const reason = (error: unknown) => (error instanceof Error ? error.message : String(error));

// The call ended before what you picked could go to it.
function ended() {
  Alert.alert('The call has ended', 'What you picked wasn’t sent.');
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

// What you send a call shows in its words at once, going, then sent or why it didn't. It goes to
// the call on screen when you send it, which may have ended while you picked.
export function useShare(call: Call) {
  const { send } = use(Sending)!;
  const now = useRef(call);
  useEffect(() => {
    now.current = call;
  });
  return (picked: Picked[]) => {
    const live = now.current;
    const id = callIdOf(live);
    if (live.kind === 'none' || !id) return ended();
    const at =
      live.kind === 'here' ? live.seconds * 1000 : Date.now() - Date.parse(live.record.started);
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
