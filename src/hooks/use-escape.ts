import { useEffect, useEffectEvent } from 'react';

import { Escape } from '../../modules/escape';

export const useEscape = (onEscape?: () => void) => {
  const escape = useEffectEvent(() => onEscape?.());
  const listening = !!onEscape;

  useEffect(() => {
    if (!listening || !Escape) {
      return;
    }
    const subscription = Escape.addListener('onEscape', () => escape());
    return () => subscription.remove();
  }, [listening]);
};
