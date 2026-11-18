import ExpoModulesCore
import ExpoUI
import SwiftUI

struct Columns: Record {
  // From this width the first level stays in a column of its own, `share` of the width between
  // `least` and `most`, beside the rest one at a time.
  @Field var from: Double = .infinity
  @Field var share: Double = 0.42
  @Field var least: Double = 360
  @Field var most: Double = 440
}

final class PagesProps: UIBaseViewProps {
  // Each child's level, in the children's order.
  @Field var pages: [String] = []
  // The levels showing one page at a time, two side by side and in columns, the deepest last.
  @Field var one: [String] = []
  @Field var two: [String] = []
  @Field var columns: [String] = []
  // Two side by side where each side of the middle, moved `meet` along, has room for `page`.
  @Field var page: CGFloat = .infinity
  @Field var meet: CGFloat = 0
  @Field var column: Columns = Columns()
  // How far a page behind the front one waits, as a share of the width it shares.
  @Field var behind: CGFloat = 1
  @Field var edge: Color = .clear
  // The shape it laid the pages out in, sent each time that changes: JS lays the pages' content
  // out by this answer, never by its own reading of a width.
  var onShape = EventDispatcher()
}

enum Shape: String {
  case one, columns, panes
}

// Tasks' pages, laid out from the width SwiftUI gives them, so a resize lands with them in the
// frame it happens. One at a time, the deepest level fills the width and the ones before it wait
// behind. Two side by side, the deepest takes the second page and the one before it the first;
// deeper ones wait off the leading edge, shallower ones off the trailing edge. In columns the first
// level keeps a column of its own and the rest go one at a time beside it. Pages that leave fade,
// under whatever animation the change came with, each as one layer: a glass button fading on its
// own fades where it stands instead of leaving with its page.
struct PagesView: ExpoSwiftUI.View {
  @ObservedObject var props: PagesProps

  var body: some View {
    GeometryReader { room in
      let children = props.children ?? []
      let width = room.size.width
      let shape = shape(width)
      let list = shape == .columns ? listWidth(width) : 0
      ZStack(alignment: .topLeading) {
        if shape == .columns {
          Rectangle().fill(props.edge).frame(width: 1).offset(x: list)
        }
        ForEach(Array(children.enumerated()), id: \.element.childIdentity) { index, child in
          let level = props.pages.indices.contains(index) ? props.pages[index] : ""
          let spot = place(level, in: width, shape: shape)
          let view: any View = child.childView
          AnyView(view)
            .frame(width: spot.width, alignment: .top)
            .clipped()
            .mask(alignment: .topLeading) {
              Rectangle().frame(width: spot.room.width).offset(x: spot.room.x - spot.x)
            }
            .compositingGroup()
            .opacity(spot.shown ? 1 : 0)
            .offset(x: spot.x)
            .accessibilityHidden(!spot.shown)
        }
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
      .onChange(of: shape, initial: true) { _, shape in props.onShape(["shape": shape.rawValue]) }
    }
  }

  private func shape(_ width: CGFloat) -> Shape {
    if width >= props.column.from { return .columns }
    let seam = width / 2 + props.meet
    return min(seam, width - seam) >= props.page ? .panes : .one
  }

  private func listWidth(_ width: CGFloat) -> CGFloat {
    (min(props.column.most, max(props.column.least, width * props.column.share))).rounded()
  }

  private struct Spot {
    var x: CGFloat
    var width: CGFloat
    var shown: Bool
    var room: (x: CGFloat, width: CGFloat)
  }

  private func place(_ level: String, in width: CGFloat, shape: Shape) -> Spot {
    switch shape {
    case .one:
      return alone(level, levels: props.one, from: 0, width: width)
    case .panes:
      return paired(level, in: width)
    case .columns:
      let list = listWidth(width)
      if level == props.columns.first {
        return Spot(x: 0, width: list, shown: true, room: (0, list))
      }
      return alone(level, levels: Array(props.columns.dropFirst()), from: list + 1, width: width - list - 1)
    }
  }

  private func alone(_ level: String, levels: [String], from: CGFloat, width: CGFloat) -> Spot {
    let room = (x: from, width: width)
    let at = levels.firstIndex(of: level)
    if at == levels.count - 1 { return Spot(x: from, width: width, shown: true, room: room) }
    let x = at == nil ? from + width : from - width * props.behind
    return Spot(x: x, width: width, shown: false, room: room)
  }

  private func paired(_ level: String, in width: CGFloat) -> Spot {
    let seam = width / 2 + props.meet
    let levels = props.two
    let at = levels.firstIndex(of: level)
    let front = levels.count - 1
    let room = (x: CGFloat(0), width: width)
    if at == front { return Spot(x: seam, width: width - seam, shown: true, room: room) }
    if at == front - 1 { return Spot(x: 0, width: seam, shown: true, room: room) }
    return at == nil
      ? Spot(x: width, width: width - seam, shown: false, room: room)
      : Spot(x: -seam, width: seam, shown: false, room: room)
  }
}
