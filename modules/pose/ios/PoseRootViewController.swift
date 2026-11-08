import ExpoModulesCore
import UIKit

// Gives the app's window its root view controller, which iOS asks which ways the screen may turn.
public final class PoseReactDelegateHandler: ExpoReactDelegateHandler {
  public override func createRootViewController() -> UIViewController? {
    PoseRootViewController()
  }
}

// A plain iPhone stays upright; iPad and iPhone Duo turn however they're held. The Duo is the
// iPhone with a vertical bar edge: iOS gives its cover screen one in every orientation, and no other
// iPhone one. That edge arrives a moment after iOS first asks, as the app starts, by which time an
// app opened on its side would already have been turned upright, to spin back once it came. Until
// iOS reports the edge, the device's screen answers: the Duo's are near square, shut (466 by 678) and
// open, where every other iPhone's is 16 by 9 or taller. It's the screen's size, not the window's,
// so Split View or Stage Manager can't change the answer.
final class PoseRootViewController: ExpoRootViewController {
  override func viewDidLoad() {
    super.viewDidLoad()
    guard #available(iOS 27.1, *) else { return }
    registerForTraitChanges(UITraitCollection.systemTraitsAffectingVerticalBarEdge) {
      (controller: Self, _) in
      controller.reported = true
      controller.setNeedsUpdateOfSupportedInterfaceOrientations()
    }
  }

  override var supportedInterfaceOrientations: UIInterfaceOrientationMask {
    turns ? .all : .portrait
  }

  // Once seen, a bar edge stays seen: iOS leaves the edge unspecified in orientations without a
  // vertical bar, so an answer read fresh each time could undo the turn it allowed.
  private var barSeen = false
  private var reported = false

  private var turns: Bool {
    if UIDevice.current.userInterfaceIdiom == .pad { return true }
    guard #available(iOS 27.1, *) else { return false }
    if traitCollection.verticalBarEdge != .unspecified { barSeen = true }
    return barSeen || (!reported && squareScreen)
  }

  private var squareScreen: Bool {
    let size = (viewIfLoaded?.window?.windowScene?.screen ?? UIScreen.main).bounds.size
    return max(size.width, size.height) / min(size.width, size.height) < 1.6
  }
}
