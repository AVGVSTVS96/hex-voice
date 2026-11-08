import { createContext, use } from "react";

export interface Size {
  width: number;
  height: number;
}

export const Viewport = createContext<Size | null>(null);

export const useViewport = (): Size => {
  const size = use(Viewport);

  if (!size) {
    throw new Error("useViewport() needs the Viewport the call screen's root provides");
  }

  return size;
};
