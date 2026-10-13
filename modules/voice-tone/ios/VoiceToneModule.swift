import AVFoundation
import ExpoModulesCore

public final class VoiceToneModule: Module {
  private static let tick = 1.0 / 30
  private static let window = 0.048

  private let queue = DispatchQueue(label: "hex.voice-tone", qos: .userInteractive)
  private var timer: DispatchSourceTimer?
  private var routes: NSObjectProtocol?
  private var state = VoiceTone()
  private var samples = [Float](repeating: 0, count: 4096)
  private var rate = Float(48000)
  private var sent = (pitch: Float(0), tone: Float(0))

  public func definition() -> ModuleDefinition {
    Name("VoiceTone")
    Events("onTone")
    Function("start") { self.queue.async(execute: self.begin) }
    Function("stop") { self.queue.async(execute: self.end) }
    OnDestroy { self.queue.sync(execute: self.end) }
  }

  private func begin() {
    guard timer == nil, voice_tap_install() else { return }
    voice_tone_reset(&state)
    sent = (0, 0)
    rate = Float(AVAudioSession.sharedInstance().sampleRate)
    routes = NotificationCenter.default.addObserver(
      forName: AVAudioSession.routeChangeNotification, object: nil, queue: nil
    ) { [weak self] _ in
      let rate = Float(AVAudioSession.sharedInstance().sampleRate)
      self?.queue.async { self?.rate = rate }
    }
    voice_tap_enable(true)
    let timer = DispatchSource.makeTimerSource(queue: queue)
    timer.schedule(deadline: .now(), repeating: Self.tick, leeway: .milliseconds(4))
    timer.setEventHandler { [weak self] in self?.listen() }
    timer.resume()
    self.timer = timer
  }

  private func end() {
    guard let timer else { return }
    timer.cancel()
    self.timer = nil
    voice_tap_enable(false)
    if let routes { NotificationCenter.default.removeObserver(routes) }
    routes = nil
  }

  private func listen() {
    let wanted = min(Int(rate * Float(Self.window)), samples.count)
    let count = Int(voice_tap_read(&samples, Int32(wanted)))
    voice_tone_step(&state, samples, Int32(count), rate, Float(Self.tick))
    guard abs(state.pitch - sent.pitch) > 0.004 || abs(state.tone - sent.tone) > 0.004 else {
      return
    }
    sent = (state.pitch, state.tone)
    sendEvent("onTone", ["pitch": state.pitch, "tone": state.tone])
  }
}
