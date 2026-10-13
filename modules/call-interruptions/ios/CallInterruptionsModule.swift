import AVFoundation
import ExpoModulesCore

public final class CallInterruptionsModule: Module {
  private var observer: NSObjectProtocol?

  public func definition() -> ModuleDefinition {
    Name("CallInterruptions")
    Events("onInterruption")
    OnStartObserving { self.observe() }
    OnStopObserving { self.forget() }
    OnDestroy { self.forget() }
  }

  private func observe() {
    guard observer == nil else { return }
    observer = NotificationCenter.default.addObserver(
      forName: AVAudioSession.interruptionNotification, object: nil, queue: nil
    ) { [weak self] note in
      guard
        let info = note.userInfo,
        let raw = info[AVAudioSessionInterruptionTypeKey] as? UInt,
        let type = AVAudioSession.InterruptionType(rawValue: raw)
      else { return }
      if type == .began,
        let reason = info[AVAudioSessionInterruptionReasonKey] as? UInt,
        AVAudioSession.InterruptionReason(rawValue: reason) == .appWasSuspended
      {
        return
      }
      self?.sendEvent("onInterruption", ["began": type == .began])
    }
  }

  private func forget() {
    if let observer { NotificationCenter.default.removeObserver(observer) }
    observer = nil
  }
}
