import { createContext, use } from 'react';

export type Size = { width: number; height: number };

// The screen's one size: what its root view is laid out at, provided by the call screen's root.
// React Native's window size can disagree with it for a moment, as while iPhone Duo unfolds.
export const Viewport = createContext<Size | null>(null);

export function useViewport(): Size {
  const size = use(Viewport);
  if (!size) throw new Error("useViewport() needs the Viewport the call screen's root provides");
  return size;
}
