import ExpoModulesCore
import ExpoUI

public final class MarkdownModule: Module {
  public func definition() -> ModuleDefinition {
    Name("Markdown")
    ExpoUIView(MarkdownView.self)
  }
}
