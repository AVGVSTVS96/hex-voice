import type { NativeModule } from "expo";
import { requireOptionalNativeModule } from "expo";

declare class EscapeModule extends NativeModule<{ onEscape: () => void }> {}

export const Escape = requireOptionalNativeModule<EscapeModule>("Escape");
