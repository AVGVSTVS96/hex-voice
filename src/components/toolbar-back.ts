import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import type { Back } from '@/components/tasks/bar';

export type BackFrom = 'tasks' | 'settings' | 'call';

type Publish = (from: BackFrom, back: Back | undefined) => void;

const ToolbarBack = createContext<Publish | null>(null);
export const ToolbarBackProvider = ToolbarBack.Provider;

export const useToolbarBacks = () => {
  const [backs, setBacks] = useState<Partial<Record<BackFrom, Back>>>({});

  const publish = useCallback<Publish>((from, back) => {
    setBacks((was) => (was[from] === back ? was : { ...was, [from]: back }));
  }, []);

  return { backs, publish };
};

export const useToolbarBack = (from: BackFrom, back: Back | undefined, when = true): boolean => {
  const publish = useContext(ToolbarBack);
  const takes = !!publish && when;
  const press = useRef(back?.onPress);
  useLayoutEffect(() => {
    press.current = back?.onPress;
  });
  const to = back?.to;
  useEffect(() => {
    if (!publish || !takes) {
      return;
    }

    publish(from, to === undefined ? undefined : { to, onPress: () => press.current?.() });

    return () => {
      publish(from, undefined);
    };
  }, [publish, takes, from, to]);

  return takes;
};
