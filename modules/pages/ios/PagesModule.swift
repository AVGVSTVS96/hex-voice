import ExpoModulesCore
import ExpoUI

public final class PagesModule: Module {
  public func definition() -> ModuleDefinition {
    Name("Pages")
    ExpoUIView(PagesView.self)
  }
}
