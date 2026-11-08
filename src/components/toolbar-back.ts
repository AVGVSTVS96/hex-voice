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

// Who has a way back: Tasks' pages, settings' voice page, and a past call while one is live.
export type BackFrom = 'tasks' | 'settings' | 'call';
type Publish = (from: BackFrom, back: Back | undefined) => void;

// On iPhone Duo a page's Back sits in the toolbar, down the side column under the status items or
// at the leading end of the band beside them, where the thumb is, never in the page's own header.
// The call screen gathers each one here and shows the one in front.
const ToolbarBack = createContext<Publish | null>(null);
export const ToolbarBackProvider = ToolbarBack.Provider;

export const useToolbarBacks = () => {
  const [backs, setBacks] = useState<Partial<Record<BackFrom, Back>>>({});
  const publish = useCallback<Publish>((from, back) => {
    setBacks((was) => (was[from] === back ? was : { ...was, [from]: back }));
  }, []);
  return { backs, publish };
};

// Hands `back` to the toolbar where there is one to take it, and says whether it did, so the page
// draws its own Back only where the toolbar doesn't.
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
