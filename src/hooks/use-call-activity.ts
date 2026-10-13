import { addUserInteractionListener, type LiveActivity } from 'expo-widgets';
import { useEffect, useEffectEvent, useRef } from 'react';

import CallActivity, { type CallActivityProps } from '@/live/call-activity';
import type { LiveStatus } from '@/live/types';

type Call = {
  status: LiveStatus;
  muted: boolean;
  orb: string;
  toggleMute: () => void;
  stop: () => Promise<void>;
};

export function useCallActivity({ status, muted, orb, toggleMute, stop }: Call) {
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
    if (!live) {
      since.current = 0;
      void activity.current?.end('immediate');
      activity.current = null;
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
  }, [live, status, muted, orb]);
}
