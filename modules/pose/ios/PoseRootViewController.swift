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
      (controller: Self, _) in controller.setNeedsUpdateOfSupportedInterfaceOrientations()
    }
  }

  override var supportedInterfaceOrientations: UIInterfaceOrientationMask {
    turns ? .all : .portrait
  }

  private var turns: Bool {
    if traitCollection.userInterfaceIdiom == .pad { return true }
    guard #available(iOS 27.1, *) else { return false }
    return traitCollection.verticalBarEdge != .unspecified
  }
}
