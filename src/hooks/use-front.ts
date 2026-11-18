import { File, Paths } from "expo-file-system";
import { useEffect } from "react";
// oxlint-disable-next-line no-restricted-imports -- whether the window fills the screen needs both sizes, not the laid-out one
import { AppState, Dimensions } from "react-native";

// WHY: scripts/duo phone pictures his real Duo only while this says hex voice alone fills the screen, untouched for a while.
const file = new File(Paths.document, "HexFront");
let front: number | undefined;
let touched = 0;

const say = () => {
  if (front === undefined) {
    if (file.exists) {
      file.delete();
    }

    return;
  }

  const window = Dimensions.get("window");
  const screen = Dimensions.get("screen");
  const fills = window.width === screen.width && window.height === screen.height;

  void file.write(`${front} ${fills ? "full" : "part"} ${touched}`);
};

const track = (state: string | null | undefined) => {
  front = state === "active" ? Date.now() : undefined;
  say();
};

export const touch = () => {
  const now = Date.now();

  if (now - touched > 2000) {
    touched = now;
    say();
  }
};

export const useFront = () => {
  useEffect(() => {
    track(AppState.currentState);
    const states = AppState.addEventListener("change", track);
    const sizes = Dimensions.addEventListener("change", say);

    return () => {
      states.remove();
      sizes.remove();
    };
  }, []);
};
