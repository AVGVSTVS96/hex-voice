import ExpoModulesCore
import UIKit

// Gives the app's window its root view controller, which iOS asks which ways the screen may turn.
public final class PoseReactDelegateHandler: ExpoReactDelegateHandler {
  public override func createRootViewController() -> UIViewController? {
    PoseRootViewController()
  }
}

// A plain iPhone stays upright; iPad and iPhone Duo turn however they're held. iOS asks as it
// settles a screen, so the answer is in before the screen draws. The Duo is the iPhone with a
// vertical bar edge: iOS gives its cover screen one in every orientation, and no other iPhone one.
// Its open screen turns whatever this says.
final class PoseRootViewController: ExpoRootViewController {
  override func viewDidLoad() {
    super.viewDidLoad()
    guard #available(iOS 27.1, *) else { return }
    registerForTraitChanges(UITraitCollection.systemTraitsAffectingVerticalBarEdge) {
      (controller: Self, _) in
      controller.probe("traits")
      controller.setNeedsUpdateOfSupportedInterfaceOrientations()
    }
    probe("loaded")
  }

  override var supportedInterfaceOrientations: UIInterfaceOrientationMask {
    probe("asked")
    return turns ? .all : .portrait
  }

  // PROBE, not to land: what the controller can tell about the screen as it starts.
  private func probe(_ when: String) {
    guard #available(iOS 27.1, *) else { return }
    let scene = viewIfLoaded?.window?.windowScene
    let screen = scene?.screen ?? UIScreen.main
    NSLog(
      "pose-probe %@ t=%.3f own=%ld scene=%ld screen=%ld bounds=%@ native=%@ device=%ld iface=%ld",
      when, ProcessInfo.processInfo.systemUptime,
      traitCollection.verticalBarEdge.rawValue,
      scene?.traitCollection.verticalBarEdge.rawValue ?? -1,
      screen.traitCollection.verticalBarEdge.rawValue,
      NSCoder.string(for: screen.bounds), NSCoder.string(for: screen.nativeBounds),
      UIDevice.current.orientation.rawValue, scene?.effectiveGeometry.interfaceOrientation.rawValue ?? -1)
  }

  // Once seen, a bar edge stays seen: iOS leaves the edge unspecified in orientations without a
  // vertical bar, so an answer read fresh each time could undo the turn it allowed.
  private var barSeen = false

  private var turns: Bool {
    if UIDevice.current.userInterfaceIdiom == .pad { return true }
    guard #available(iOS 27.1, *) else { return false }
    if traitCollection.verticalBarEdge != .unspecified { barSeen = true }
    return barSeen
  }
}
