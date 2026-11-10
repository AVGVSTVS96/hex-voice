import * as Updates from "expo-updates";
import { useEffect, useEffectEvent, useState } from "react";
import { AppState } from "react-native";

import { installLink } from "@/hex";
import type { LinkBuild } from "@/hex";
import { useWatch } from "@/hooks/use-watch";

export const useAppUpdates = (callLive: boolean) => {
  const { isUpdatePending } = Updates.useUpdates();
  const [onLink, setOnLink] = useState<LinkBuild>();

  useWatch(Updates.isEnabled ? "install-link" : null, installLink.watch, setOnLink);

  const apply = useEffectEvent(() => {
    if (isUpdatePending && !callLive) {
      void Updates.reloadAsync();
    }
  });

  useEffect(() => {
    if (!Updates.isEnabled) {
      return;
    }

    let last = AppState.currentState;

    const listener = AppState.addEventListener("change", (state) => {
      const fromBackground = last === "background" && state === "active";
      last = state;

      if (state !== "active") {
        return;
      }

      if (fromBackground) {
        apply();
      }

      void download();
    });

    return () => {
      listener.remove();
    };
  }, []);

  return newNative(onLink);
};

const newNative = (build: LinkBuild | undefined) =>
  build?.runtime === undefined || build.runtime === Updates.runtimeVersion
    ? undefined
    : { version: build.version, runtime: build.runtime, install: build.install ?? "" };

export type NativeBuild = NonNullable<ReturnType<typeof newNative>>;

const download = async () => {
  const update = await Updates.checkForUpdateAsync().catch(() => null);

  if (update?.isAvailable === true) {
    await Updates.fetchUpdateAsync().catch(() => null);
  }
};
