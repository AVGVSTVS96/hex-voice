import type { NativeModule } from "expo";
import { requireOptionalNativeModule } from "expo";

declare class EarpieceModule extends NativeModule {
  start(): void;
  stop(): void;
}

export const Earpiece = requireOptionalNativeModule<EarpieceModule>("Earpiece");
