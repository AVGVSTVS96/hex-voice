import ExpoModulesCore
import UIKit

// Gives the app's window its root view controller, which iOS asks which ways the screen may turn.
public final class PoseReactDelegateHandler: ExpoReactDelegateHandler {
  public override func createRootViewController() -> UIViewController? {
    PoseRootViewController()
  }
}

// A plain iPhone stays upright; iPad and iPhone Duo turn however they're held. The Duo is the
// iPhone whose screens are near square, shut (466 by 678) and open, where every other iPhone's is
// 16 by 9 or taller. That's known from iOS's first question, as the app starts: the bar edge that
// also marks the Duo arrives a moment later, by which time an app opened on its side would already
// have been turned upright, to spin back once it came.
final class PoseRootViewController: ExpoRootViewController {
  override var supportedInterfaceOrientations: UIInterfaceOrientationMask {
    turns ? .all : .portrait
  }

  private var turns: Bool {
    if UIDevice.current.userInterfaceIdiom == .pad { return true }
    let size = (viewIfLoaded?.window?.windowScene?.screen ?? UIScreen.main).bounds.size
    return max(size.width, size.height) / min(size.width, size.height) < 1.6
  }
}
