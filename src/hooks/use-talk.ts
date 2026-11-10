import { useEffect, useRef, useState } from "react";

import { hex } from "@/hex";
import type { Talk, TalkChange } from "@/live/talk";
import { isLiveVoice } from "@/live/voices";
import type { LiveVoice } from "@/live/voices";

export const useTalk = ({
  open,
  voice,
  setVoice,
  voiceLoaded,
}: {
  open: boolean;
  voice: LiveVoice;
  setVoice: (voice: LiveVoice) => void;
  voiceLoaded: boolean;
}) => {
  const [talk, setTalk] = useState<Talk>();
  const [failure, setFailure] = useState<string>();
  const [heard, setHeard] = useState<string | null>();
  const changes = useRef(0);
  const writesInOrder = useRef(Promise.resolve());

  useEffect(() => {
    if (!open) {
      return;
    }

    let active = true;
    const since = changes.current;

    void (async () => {
      try {
        const read = await hex.talk.get();

        if (active && since === changes.current) {
          setTalk(read);
          setFailure(undefined);
          setHeard(read.settings.voice ?? null);
        }
      } catch {
        if (active) {
          setFailure("Can’t reach hex right now.");
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [open]);

  const change = (next: TalkChange) => {
    changes.current += 1;
    const mine = changes.current;
    setTalk((now) => now && { ...now, settings: { ...now.settings, ...next } });
    const before = writesInOrder.current;

    writesInOrder.current = (async () => {
      await before;

      try {
        const saved = await hex.talk.change(next);

        if (mine === changes.current) {
          setTalk(saved);
        }

        setFailure(undefined);
      } catch {
        setFailure("hex didn’t save that. Try again.");
      }
    })();
  };

  useEffect(() => {
    if (heard === undefined || !voiceLoaded) {
      return;
    }

    setHeard(undefined);

    if (heard === null) {
      change({ voice });
    } else if (isLiveVoice(heard) && heard !== voice) {
      setVoice(heard);
    }
  }, [heard, voiceLoaded]);

  return {
    talk,
    failure,
    change,
    setVoice: (next: LiveVoice) => {
      setVoice(next);
      change({ voice: next });
    },
  };
};

export type TalkSettings = ReturnType<typeof useTalk>;
