import { addUserInteractionListener, after } from "expo-widgets";
import type { LiveActivity } from "expo-widgets";
import { useEffect, useEffectEvent, useRef } from "react";

import type { Call } from "@/call/call";
import CallActivity from "@/live/call-activity";
import type { CallActivityProps } from "@/live/call-activity";
import { ENDINGS, clock } from "@/live/calls";

const LINGER = 2 * 60_000;

const shownState = (call: Call) => {
  if (call.kind !== "here") {
    return null;
  }

  if (call.phase !== "live") {
    return call.phase;
  }

  return call.mic.muted ? "muted" : "live";
};

export const useCallActivity = (
  call: Call,
  orb: string,
  { toggleMute, end }: { toggleMute: () => void; end: () => Promise<void> },
) => {
  const activity = useRef<LiveActivity<CallActivityProps>>(null);
  const since = useRef(0);

  const state = shownState(call);

  const last = call.kind === "none" ? call.last : undefined;

  const onControl = useEffectEvent((target: string) => {
    if (target === "mute") {
      toggleMute();
    }

    if (target === "end") {
      void end();
    }
  });

  useEffect(() => {
    for (const fromEarlierLaunch of CallActivity.getInstances()) {
      void fromEarlierLaunch.end("immediate");
    }

    const controls = addUserInteractionListener(({ target }) => {
      onControl(target);
    });

    return () => {
      controls.remove();
      void activity.current?.end("immediate");
      activity.current = null;
    };
  }, []);

  useEffect(() => {
    if (state === "ending") {
      return;
    }

    if (!state) {
      const { current } = activity;
      activity.current = null;

      if (current) {
        const ending = last?.ending;
        const outcome = ending && ENDINGS[ending];

        const timed = since.current !== 0 && ending !== "no-connect";

        const line =
          (outcome && timed
            ? `${outcome.line} · ${clock((last?.seconds ?? 0) * 1000)}`
            : outcome?.line) ?? "Call ended";

        void current
          .end(after(new Date(Date.now() + LINGER)), {
            orb,
            since: since.current,
            state: "ended",
            outcome: line,
            bad: outcome?.bad,
          })
          .catch(() => null);
      }

      since.current = 0;

      return;
    }

    if (state !== "connecting" && !since.current) {
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
      console.warn("[hex] The call could not show a Live Activity.", error);
    }
  }, [state, orb, last?.ending]);
};
