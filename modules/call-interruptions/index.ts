import type { NativeModule } from 'expo';
import { requireOptionalNativeModule } from 'expo';

export interface Interruption {
  began: boolean;
}

declare class CallInterruptionsModule extends NativeModule<{
  onInterruption: (interruption: Interruption) => void;
}> {}

export const CallInterruptions =
  requireOptionalNativeModule<CallInterruptionsModule>('CallInterruptions');
