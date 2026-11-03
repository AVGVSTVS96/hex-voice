import ExpoModulesCore
import UIKit

// The window's root view controller is in every responder chain, and UIKit asks it for key
// commands even when nothing is first responder, so Esc reaches it whatever has focus.
public final class EscapeModule: Module {
  private static let command = UIKeyCommand(
    input: UIKeyCommand.inputEscape, modifierFlags: [],
    action: #selector(UIViewController.hexVoiceEscape))
  private static weak var listening: EscapeModule?

  public func definition() -> ModuleDefinition {
    Name("Escape")
    Events("onEscape")
    OnStartObserving { self.listen(true) }
    OnStopObserving { self.listen(false) }
  }

  fileprivate static func escape() {
    listening?.sendEvent("onEscape")
  }

  private func listen(_ on: Bool) {
    DispatchQueue.main.async {
      Self.listening = on ? self : nil
      let root = UIApplication.shared.connectedScenes.lazy
        .compactMap { ($0 as? UIWindowScene)?.keyWindow?.rootViewController }.first
      if on {
        root?.addKeyCommand(Self.command)
      } else {
        root?.removeKeyCommand(Self.command)
      }
    }
  }
}

extension UIViewController {
  @objc fileprivate func hexVoiceEscape() {
    EscapeModule.escape()
  }
}
