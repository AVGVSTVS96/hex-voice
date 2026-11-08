import ExpoModulesCore
import ExpoUI
import SwiftUI

struct Span: Record {
  @Field var from: Double = 0
  @Field var to: Double = 0
}

final class LaneProps: UIBaseViewProps {
  // Where hex worked, each a stretch from and to a share of the lane's width, and where runs failed.
  @Field var spans: [Span] = []
  @Field var failures: [Double] = []
  @Field var line: Color = .gray
  @Field var work: Color = .blue
  @Field var failure: Color = .red
}

// A project's last week across the width the lane is given: a thin line, a bar where hex worked and
// a dot where a run failed, each at its share of that width, so the lane redraws with the row in the
// pass that resizes it.
struct LaneView: ExpoSwiftUI.View {
  @ObservedObject var props: LaneProps

  private let height: CGFloat = 9
  private let bar: CGFloat = 4
  // The shortest run is still a bar, never a dot.
  private let shortest: CGFloat = 6
  private let dot: CGFloat = 5

  var body: some View {
    GeometryReader { lane in
      let width = lane.size.width
      ZStack(alignment: .leading) {
        Rectangle().fill(props.line).frame(width: width, height: 1)
        ForEach(props.spans.indices, id: \.self) { i in
          let span = props.spans[i]
          let length = max(shortest, (span.to - span.from) * width)
          Capsule().fill(props.work).frame(width: length, height: bar)
            .offset(x: min(span.from * width, width - length))
        }
        ForEach(props.failures.indices, id: \.self) { i in
          Circle().fill(props.failure).frame(width: dot, height: dot)
            .offset(x: min(props.failures[i] * width, width - dot / 2) - dot / 2)
        }
      }
      .frame(width: width, height: height)
    }
    .frame(height: height)
    .accessibilityHidden(true)
  }
}
