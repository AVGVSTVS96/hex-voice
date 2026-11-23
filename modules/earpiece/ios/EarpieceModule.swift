import AVFoundation
import ExpoModulesCore
import UIKit
import WebRTC

public final class EarpieceModule: Module {
  private var proximity: NSObjectProtocol?
  private var held = false

  public func definition() -> ModuleDefinition {
    Name("Earpiece")
    Function("start") { DispatchQueue.main.async(execute: self.begin) }
    Function("stop") { DispatchQueue.main.async(execute: self.end) }
    OnDestroy { DispatchQueue.main.async(execute: self.end) }
  }

  private func begin() {
    guard proximity == nil else { return }
    UIDevice.current.isProximityMonitoringEnabled = true
    proximity = NotificationCenter.default.addObserver(
      forName: UIDevice.proximityStateDidChangeNotification, object: nil, queue: .main
    ) { [weak self] _ in
      self?.follow(near: UIDevice.current.proximityState)
    }
  }

  private func end() {
    guard let proximity else { return }
    NotificationCenter.default.removeObserver(proximity)
    self.proximity = nil
    UIDevice.current.isProximityMonitoringEnabled = false
    if held { hold(false) }
  }

  private func follow(near: Bool) {
    if near, !held, onLoudspeaker() { hold(true) }
    if !near, held { hold(false) }
  }

  private func onLoudspeaker() -> Bool {
    AVAudioSession.sharedInstance().currentRoute.outputs.contains { $0.portType == .builtInSpeaker }
  }

  private func hold(_ toEar: Bool) {
    let audio = RTCAudioSessionConfiguration.webRTC()
    if toEar {
      audio.mode = AVAudioSession.Mode.voiceChat.rawValue
      audio.categoryOptions.remove(.defaultToSpeaker)
    } else {
      audio.mode = AVAudioSession.Mode.videoChat.rawValue
      audio.categoryOptions.insert(.defaultToSpeaker)
    }
    let session = RTCAudioSession.sharedInstance()
    session.lockForConfiguration()
    defer { session.unlockForConfiguration() }
    guard (try? session.setConfiguration(audio)) != nil else { return }
    RTCAudioSessionConfiguration.setWebRTC(audio)
    held = toEar
  }
}
