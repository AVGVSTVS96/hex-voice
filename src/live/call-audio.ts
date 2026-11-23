import { DeviceEventEmitter } from "react-native";
import InCallManager from "react-native-incall-manager";
import * as z from "zod/mini";

import { Earpiece } from "../../modules/earpiece";

const Proximity = z.object({ isNear: z.boolean() });

const Route = z.object({ selectedAudioDevice: z.string() });

const startAndroid = () => {
  let route = "";
  let held = false;

  const routes = DeviceEventEmitter.addListener("onAudioDeviceChanged", (data) => {
    route = Route.safeParse(data).data?.selectedAudioDevice ?? route;
  });

  const proximity = DeviceEventEmitter.addListener("Proximity", (data) => {
    const near = Proximity.safeParse(data).data?.isNear;

    if (near === true && !held && route === "SPEAKER_PHONE") {
      held = true;
      InCallManager.setForceSpeakerphoneOn(false);
      InCallManager.turnScreenOff();
    }

    if (near === false && held) {
      held = false;
      InCallManager.turnScreenOn();
      InCallManager.setForceSpeakerphoneOn(null);
    }
  });

  InCallManager.start({ media: "video", auto: true });

  return () => {
    routes.remove();
    proximity.remove();
    InCallManager.stop();
  };
};

const startIos = () => {
  Earpiece?.start();

  return () => {
    Earpiece?.stop();
  };
};

export const startCallAudio = process.env.EXPO_OS === "android" ? startAndroid : startIos;
