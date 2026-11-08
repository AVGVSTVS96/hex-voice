import ExpoModulesCore
import ExpoUI
import SwiftUI

final class ColumnProps: UIBaseViewProps {
  // The least the tools keep from the column's top, and how far the call buttons keep above what
  // covers its foot.
  @Field var top: CGFloat = 0
  @Field var clear: CGFloat = 0
}

// iPhone Duo's side column, its tools at the top and its call buttons at the foot, placed by
// SwiftUI in the frame a turn or fold lands. iOS reports what covers the screen (the camera, the
// time and wifi) as occlusion regions: the tools start under those at the top, the call buttons end
// above those at the foot, and both center on the narrow ones, where the system draws its items a
// few points toward the screen from the column's middle.
struct ColumnView: ExpoSwiftUI.View {
  @ObservedObject var props: ColumnProps

  var body: some View {
    GeometryReader { room in
      let children = props.children ?? []
      let place = placed(in: room)
      VStack(spacing: 0) {
        ForEach(Array(children.enumerated()), id: \.element.childIdentity) { index, child in
          let view: any View = child.childView
          if index > 0 { Spacer(minLength: 0) }
          AnyView(view)
        }
      }
      .padding(.top, place.top)
      .padding(.bottom, place.foot)
      .frame(width: room.size.width, height: room.size.height)
      .offset(x: place.shift)
    }
    // The column is the bar's inset, all of it outside the safe area across, so it reads its
    // room across in full and keeps the window's top and foot insets. Its call buttons fade under
    // the keyboard rather than rise above it.
    .ignoresSafeArea(.container, edges: .horizontal)
    .ignoresSafeArea(.keyboard)
  }

  // The tools' and call buttons' distance from the room's top and foot, which sit inside the
  // window's top and foot insets, and how far across to shift them.
  private func placed(in room: GeometryProxy) -> (top: CGFloat, foot: CGFloat, shift: CGFloat) {
    let width = room.size.width
    let height = room.size.height
    let insets = room.safeAreaInsets
    var covers: [CGRect] = []
    if #available(iOS 27.1, *) {
      covers = room.reservedRegions(kind: .occlusion).map(\.frame).filter {
        $0.minX < width && $0.maxX > 0
      }
    }
    let middle = (height + insets.bottom - insets.top) / 2
    let high = covers.filter { $0.midY < middle }
    let low = covers.filter { $0.midY >= middle }
    let top = high.reduce(insets.top) { max($0, $1.maxY + insets.top) }
    let foot = low.reduce(insets.bottom) { max($0, height + insets.bottom - $1.minY + props.clear) }
    let items = covers.filter { $0.width < width }
    let center = items.isEmpty ? width / 2 : items.map(\.midX).reduce(0, +) / CGFloat(items.count)
    return (max(top, props.top) - insets.top, foot - insets.bottom, center - width / 2)
  }
}
