import { addUserInteractionListener, after } from 'expo-widgets';
import type { LiveActivity } from 'expo-widgets';
import { useEffect, useEffectEvent, useRef } from 'react';

import type { Call } from '@/call/call';
import CallActivity from '@/live/call-activity';
import type { CallActivityProps } from '@/live/call-activity';
import { ENDINGS, clock } from '@/live/calls';

// An ended call stays on the lock screen with how it ended, long enough to glance at.
const LINGER = 2 * 60_000;

// A call on this phone shows on the Lock Screen and in the Dynamic Island while it connects and
// lasts, with mute and End.
export const useCallActivity = (
  call: Call,
  orb: string,
  { toggleMute, end }: { toggleMute: () => void; end: () => Promise<void> },
) => {
  const activity = useRef<LiveActivity<CallActivityProps>>(null);
  const since = useRef(0);

  const state =
    call.kind === 'here'
      ? call.phase === 'live'
        ? call.mic.muted
          ? 'muted'
          : 'live'
        : call.phase
      : undefined;

  const last = call.kind === 'none' ? call.last : undefined;

  const onControl = useEffectEvent((target: string) => {
    if (target === 'mute') {
      toggleMute();
    }

    if (target === 'end') {
      void end();
    }
  });

  useEffect(() => {
    // An activity can outlive the app process that started it, and its call ended with it.
    for (const stale of CallActivity.getInstances()) {
      void stale.end('immediate');
    }

    const controls = addUserInteractionListener(({ target }) => {
      onControl(target);
    });

    return () => {
      controls.remove();
      void activity.current?.end('immediate');
      activity.current = null;
    };
  }, []);

  useEffect(() => {
    if (state === 'ending') {
      return;
    }

    if (!state) {
      const current = activity.current;
      activity.current = null;

      if (current) {
        const ending = last?.ending;
        const outcome = ending && ENDINGS[ending];

        const line = outcome
          ? since.current && ending !== 'no-connect'
            ? `${outcome.line} · ${clock((last?.seconds ?? 0) * 1000)}`
            : outcome.line
          : 'Call ended';

        void current
          .end(after(new Date(Date.now() + LINGER)), {
            orb,
            since: since.current,
            state: 'ended',
            outcome: line,
            bad: outcome?.bad,
          })
          .catch(() => null);
      }

      since.current = 0;

      return;
    }

    if (state !== 'connecting' && !since.current) {
      since.current = Date.now();
    }

    const props: CallActivityProps = { orb, since: since.current, state };

    if (activity.current) {
      void activity.current.update(props).catch(() => null);

      return;
    }

    try {
      activity.current = CallActivity.start(props);
    } catch (error) {
      console.warn('[hex] The call could not show a Live Activity.', error);
    }
  }, [state, orb, last?.ending]);
};
