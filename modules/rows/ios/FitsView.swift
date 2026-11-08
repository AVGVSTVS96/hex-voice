import ExpoModulesCore
import ExpoUI
import SwiftUI

final class FitsProps: UIBaseViewProps {}

// The first child whose own width fits the width it's given, else the last; a lone child shows
// only where it fits. SwiftUI picks in the layout pass that gives the width, so a turn or a fold
// lands with each row already one line or stacked.
struct FitsView: ExpoSwiftUI.View {
  @ObservedObject var props: FitsProps

  var body: some View {
    let children = (props.children ?? []).map { child -> AnyView in
      let view: any View = child.childView
      return AnyView(view)
    }
    ViewThatFits(in: .horizontal) {
      ForEach(children.indices, id: \.self) { children[$0] }
      if children.count == 1 { Color.clear.frame(width: 0, height: 0) }
    }
  }
}

final class EvenRowProps: UIBaseViewProps {
  @Field var spacing: CGFloat = 0
}

// Children side by side, each as wide as the others, filling the width it's given. Its own width
// is the widest child's times their number, so it fits only where each child does in its share.
struct EvenRowView: ExpoSwiftUI.View {
  @ObservedObject var props: EvenRowProps

  var body: some View {
    let children = props.children ?? []
    EvenRow(spacing: props.spacing) {
      ForEach(Array(children.enumerated()), id: \.element.childIdentity) { _, child in
        let view: any View = child.childView
        AnyView(view)
      }
    }
  }
}

private struct EvenRow: Layout {
  let spacing: CGFloat

  func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
    let gaps = spacing * CGFloat(max(0, subviews.count - 1))
    let widest = subviews.map { $0.sizeThatFits(.unspecified).width }.max() ?? 0
    let ideal = widest * CGFloat(subviews.count) + gaps
    let width = proposal.width.flatMap { $0.isFinite ? $0 : nil } ?? ideal
    let each = cell(width, subviews)
    let height = subviews.map { $0.sizeThatFits(.init(width: each, height: nil)).height }.max()
    return CGSize(width: width, height: height ?? 0)
  }

  func placeSubviews(
    in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()
  ) {
    let each = cell(bounds.width, subviews)
    for (i, subview) in subviews.enumerated() {
      subview.place(
        at: CGPoint(x: bounds.minX + CGFloat(i) * (each + spacing), y: bounds.midY),
        anchor: .leading,
        proposal: .init(width: each, height: bounds.height)
      )
    }
  }

  private func cell(_ width: CGFloat, _ subviews: Subviews) -> CGFloat {
    guard !subviews.isEmpty else { return 0 }
    return (width - spacing * CGFloat(subviews.count - 1)) / CGFloat(subviews.count)
  }
}
