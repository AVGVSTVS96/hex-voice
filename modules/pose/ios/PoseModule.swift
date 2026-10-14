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
// bars on (iPhone Duo's side column), where the fold divides the screen and what the cameras and
// system bars cover, each time one changes.
final class PoseView: ExpoView {
  let onPoseChange = EventDispatcher()
  private var reported: NSDictionary?

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    isUserInteractionEnabled = false
    guard #available(iOS 17, *) else { return }
    var traits: [UITrait] = [UITraitHorizontalSizeClass.self]
    if #available(iOS 27.1, *) {
      traits += UITraitCollection.systemTraitsAffectingVerticalBarEdge
      addInteraction(UIHingeInteraction { [weak self] _, _ in self?.report() })
    }
    registerForTraitChanges(traits) { (view: PoseView, _) in view.report() }
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    report()
  }

  private func report() {
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
      pose["fold"] = rect(fold.frame).merging(["active": fold.isActive]) { $1 }
    }
    pose["occlusions"] = reservedRegions(kind: .occlusion).map { rect($0.frame) }
    return pose
  }

  private func rect(_ frame: CGRect) -> [String: Any] {
    ["x": frame.minX, "y": frame.minY, "width": frame.width, "height": frame.height]
  }
}
