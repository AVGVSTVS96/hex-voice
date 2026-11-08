import ExpoModulesCore
import ExpoUI
import SwiftUI

final class PagesProps: UIBaseViewProps {
  // Each child's level, in the children's order.
  @Field var pages: [String] = []
  // The levels showing one page at a time, and two side by side, the deepest last.
  @Field var one: [String] = []
  @Field var two: [String] = []
  // Two side by side where each side of the middle, moved `meet` along, has room for `page`.
  @Field var page: CGFloat = .infinity
  @Field var meet: CGFloat = 0
}

// Tasks' pages, laid out from the width SwiftUI gives them, so a resize lands with them in the
// frame it happens. One at a time, the deepest level fills the width and the ones before it wait a
// whole page behind, since clear pages would show through each other. Two side by side, the deepest
// takes the second page and the one before it the first; deeper ones wait off the leading edge,
// shallower ones off the trailing edge. Pages that leave fade, under whatever animation the change
// came with, each as one layer: a glass button fading on its own fades where it stands instead of
// leaving with its page.
struct PagesView: ExpoSwiftUI.View {
  @ObservedObject var props: PagesProps

  var body: some View {
    GeometryReader { room in
      let children = props.children ?? []
      ZStack(alignment: .topLeading) {
        ForEach(Array(children.enumerated()), id: \.element.childIdentity) { index, child in
          let level = props.pages.indices.contains(index) ? props.pages[index] : ""
          let spot = place(level, in: room.size.width)
          let view: any View = child.childView
          AnyView(view)
            .frame(width: spot.width, alignment: .top)
            .clipped()
            .compositingGroup()
            .opacity(spot.shown ? 1 : 0)
            .offset(x: spot.x)
            .accessibilityHidden(!spot.shown)
        }
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
  }

  private func place(_ level: String, in width: CGFloat) -> (x: CGFloat, width: CGFloat, shown: Bool) {
    let seam = width / 2 + props.meet
    let paired = min(seam, width - seam) >= props.page
    let levels = paired ? props.two : props.one
    let at = levels.firstIndex(of: level)
    let front = levels.count - 1
    if !paired {
      if at == front { return (0, width, true) }
      return (at == nil ? width : -width, width, false)
    }
    if at == front { return (seam, width - seam, true) }
    if at == front - 1 { return (0, seam, true) }
    return at == nil ? (width, width - seam, false) : (-seam, seam, false)
  }
}
