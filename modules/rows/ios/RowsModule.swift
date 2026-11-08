import ExpoModulesCore
import ExpoUI

public final class RowsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("Rows")
    ExpoUIView(FitsView.self)
    ExpoUIView(EvenRowView.self)
    ExpoUIView(LaneView.self)
  }
}
