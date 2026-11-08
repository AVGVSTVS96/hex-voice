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
    .ignoresSafeArea()
  }

  private func placed(in room: GeometryProxy) -> (top: CGFloat, foot: CGFloat, shift: CGFloat) {
    let width = room.size.width
    let height = room.size.height
    var covers: [CGRect] = []
    if #available(iOS 27.1, *) {
      covers = room.reservedRegions(kind: .occlusion).map(\.frame).filter {
        $0.minX < width && $0.maxX > 0
      }
    }
    let high = covers.filter { $0.midY < height / 2 }
    let low = covers.filter { $0.midY >= height / 2 }
    let top = high.reduce(room.safeAreaInsets.top) { max($0, $1.maxY) }
    let foot = low.reduce(room.safeAreaInsets.bottom) { max($0, height - $1.minY + props.clear) }
    let items = covers.filter { $0.width < width }
    let center = items.isEmpty ? width / 2 : items.map(\.midX).reduce(0, +) / CGFloat(items.count)
    return (max(top, props.top), foot, center - width / 2)
  }
}
