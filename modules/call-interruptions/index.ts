import { NativeModule, requireOptionalNativeModule } from 'expo';

export type Interruption = { began: boolean };

declare class CallInterruptionsModule extends NativeModule<{
  onInterruption: (interruption: Interruption) => void;
}> {}

export const CallInterruptions =
  requireOptionalNativeModule<CallInterruptionsModule>('CallInterruptions');
