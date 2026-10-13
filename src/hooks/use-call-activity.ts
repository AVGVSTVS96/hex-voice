import { addUserInteractionListener, after, type LiveActivity } from 'expo-widgets';
import { useEffect, useEffectEvent, useRef } from 'react';

import CallActivity, { type CallActivityProps } from '@/live/call-activity';
import { ENDINGS, clock, type CallEnding } from '@/live/calls';
import type { LiveStatus } from '@/live/types';

type Call = {
  status: LiveStatus;
  muted: boolean;
  ending: CallEnding | null;
  elapsedSeconds: number;
  orb: string;
  toggleMute: () => void;
  stop: () => Promise<void>;
};

// An ended call stays on the lock screen with how it ended, long enough to glance at.
const LINGER = 2 * 60_000;

export function useCallActivity({
  status,
  muted,
  ending,
  elapsedSeconds,
  orb,
  toggleMute,
  stop,
}: Call) {
  const activity = useRef<LiveActivity<CallActivityProps>>(null);
  const since = useRef(0);
  const live = status === 'connecting' || status === 'connected';

  const onControl = useEffectEvent((target: string) => {
    if (target === 'mute') toggleMute();
    if (target === 'end') void stop();
  });

  useEffect(() => {
    // An activity can outlive the app process that started it, and its call ended with it.
    for (const stale of CallActivity.getInstances()) void stale.end('immediate');
    const controls = addUserInteractionListener(({ target }) => onControl(target));
    return () => {
      controls.remove();
      void activity.current?.end('immediate');
      activity.current = null;
    };
  }, []);

  useEffect(() => {
    if (status === 'disconnecting') return;
    if (!live) {
      const current = activity.current;
      activity.current = null;
      if (current) {
        const outcome = ending && ENDINGS[ending];
        const line = !outcome
          ? 'Call ended'
          : since.current && ending !== 'no-connect'
            ? `${outcome.line} · ${clock(elapsedSeconds * 1000)}`
            : outcome.line;
        void current
          .end(after(new Date(Date.now() + LINGER)), {
            orb,
            since: since.current,
            state: 'ended',
            outcome: line,
            bad: outcome?.bad,
          })
          .catch(() => {});
      }
      since.current = 0;
      return;
    }
    if (status === 'connected' && !since.current) since.current = Date.now();
    const props: CallActivityProps = {
      orb,
      since: since.current,
      state: status === 'connecting' ? 'connecting' : muted ? 'muted' : 'live',
    };
    if (activity.current) {
      void activity.current.update(props).catch(() => {});
      return;
    }
    try {
      activity.current = CallActivity.start(props);
    } catch (error) {
      console.warn('[hex] The call could not show a Live Activity.', error);
    }
  }, [live, status, muted, orb, ending]);
}
