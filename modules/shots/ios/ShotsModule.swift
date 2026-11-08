import ExpoModulesCore
import ExpoUI

public final class ShotsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("Shots")
    ExpoUIView(ShotsView.self)
  }
}
