import ExpoModulesCore
import ExpoUI

public final class ColumnModule: Module {
  public func definition() -> ModuleDefinition {
    Name("Column")
    ExpoUIView(ColumnView.self)
  }
}
