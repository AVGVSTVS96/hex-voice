import ExpoModulesCore
import UIKit

public final class PoseModule: Module {
  public func definition() -> ModuleDefinition {
    Name("Pose")
    View(PoseView.self) {
      Events("onPoseChange")
    }
  }
}

// Reports, in its own coordinates, whether the width is regular, which side the system puts its
// bars on (iPhone Duo's side column), where the fold lies and what the cameras and system bars
// cover, each time one changes. It reads them only while laying out, where they're current: UIKit
// tracks the traits and reserved regions read there and lays the view out again when they change.
// The fold is its whole frame at every angle, so folding the Duo sends nothing.
final class PoseView: ExpoView {
  let onPoseChange = EventDispatcher()
  private var reported: NSDictionary?

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    isUserInteractionEnabled = false
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    let pose = NSDictionary(dictionary: current())
    guard pose != reported else { return }
    reported = pose
    onPoseChange(pose as! [String: Any])
  }

  private func current() -> [String: Any] {
    var pose: [String: Any] = ["regular": traitCollection.horizontalSizeClass == .regular]
    guard #available(iOS 27.1, *) else { return pose }
    let rtl = traitCollection.layoutDirection == .rightToLeft
    switch traitCollection.verticalBarEdge {
    case .leading: pose["bar"] = rtl ? "right" : "left"
    case .trailing: pose["bar"] = rtl ? "left" : "right"
    default: break
    }
    if let fold = reservedRegions(kind: .division, options: .includeInactive).first {
      pose["fold"] = rect(fold.frame)
    }
    pose["occlusions"] = reservedRegions(kind: .occlusion).map { rect($0.frame) }
    return pose
  }

  private func rect(_ frame: CGRect) -> [String: Any] {
    ["x": frame.minX, "y": frame.minY, "width": frame.width, "height": frame.height]
  }
}
