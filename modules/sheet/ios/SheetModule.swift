import ExpoModulesCore
import ExpoUI
import SwiftUI
import UIKit

public final class SheetModule: Module {
  public func definition() -> ModuleDefinition {
    Name("Sheet")
    OnCreate {
      ViewModifierRegistry.register("spanWindow") { _, _, _ in SpanWindow() }
    }
    OnDestroy {
      ViewModifierRegistry.unregister("spanWindow")
    }
  }
}

// A sheet as wide as its window, as on a phone. In a regular-width window SwiftUI presents a sheet
// as a form sheet, which iOS draws edge-attached at a fixed width, a card in the middle of the open
// Duo: it asks for all the room there is, and its sheet takes that width once edge-attached.
struct SpanWindow: ViewModifier {
  func body(content: Content) -> some View {
    content.presentationSizing(AllTheRoom()).background(WidthFollowsSize())
  }
}

private struct AllTheRoom: PresentationSizing {
  func proposedSize(for root: PresentationSizingRoot, context: PresentationSizingContext) -> ProposedViewSize {
    .infinity
  }
}

private struct WidthFollowsSize: UIViewRepresentable {
  func makeUIView(context: Context) -> Probe { Probe() }
  func updateUIView(_ view: Probe, context: Context) {}

  final class Probe: UIView {
    override func didMoveToWindow() {
      super.didMoveToWindow()
      var responder = next
      while let current = responder {
        if let controller = current as? UIViewController, controller.presentingViewController != nil,
          let sheet = controller.sheetPresentationController
        {
          sheet.animateChanges { sheet.widthFollowsPreferredContentSizeWhenEdgeAttached = true }
          return
        }
        responder = current.next
      }
    }
  }
}
