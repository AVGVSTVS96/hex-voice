import ExpoModulesCore
import ExpoUI
import SwiftUI
import UIKit

struct ProseRun: Record {
  @Field var text: String = ""
  @Field var strong: Bool = false
}

enum ProseStyle: String, Enumerable {
  case body, subheadline, footnote

  var uiKit: UIFont.TextStyle {
    switch self {
    case .body: .body
    case .subheadline: .subheadline
    case .footnote: .footnote
    }
  }
}

final class ProseProps: UIBaseViewProps {
  @Field var runs: [ProseRun] = []
  @Field var style: ProseStyle = .body
  @Field var size: CGFloat = 17
  @Field var medium: Bool = false
  @Field var color: UIColor = .label
  @Field var lineSpacing: CGFloat = 0
  @Field var lines: Int = 0
}

// Text that wraps each line as full as it fits. SwiftUI's Text pushes a word down so the last line
// never holds one word alone, and has no public way to stop it; UIKit's lineBreakStrategy does:
// https://developer.apple.com/documentation/uikit/nsparagraphstyle/linebreakstrategy-swift.struct
struct ProseView: ExpoSwiftUI.View {
  @ObservedObject var props: ProseProps

  var body: some View {
    let font = font(strong: false)
    ProseLabel(text: attributed, lines: props.lines)
      .alignmentGuide(.firstTextBaseline) { _ in font.ascender }
      .alignmentGuide(.lastTextBaseline) { $0.height + font.descender }
  }

  private func font(strong: Bool) -> UIFont {
    UIFontMetrics(forTextStyle: props.style.uiKit)
      .scaledFont(for: .systemFont(ofSize: props.size, weight: props.medium || strong ? .medium : .regular))
  }

  private var attributed: NSAttributedString {
    let paragraph = NSMutableParagraphStyle()
    paragraph.lineSpacing = props.lineSpacing
    paragraph.lineBreakStrategy = []
    let text = NSMutableAttributedString()
    for run in props.runs {
      text.append(
        NSAttributedString(
          string: run.text,
          attributes: [
            .font: font(strong: run.strong),
            .foregroundColor: props.color,
            .paragraphStyle: paragraph,
          ]))
    }
    return text
  }
}

private struct ProseLabel: UIViewRepresentable {
  let text: NSAttributedString
  let lines: Int

  func makeUIView(context: Context) -> UILabel {
    let label = UILabel()
    label.adjustsFontForContentSizeCategory = true
    label.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
    label.setContentHuggingPriority(.defaultLow, for: .horizontal)
    return label
  }

  func updateUIView(_ label: UILabel, context: Context) {
    label.attributedText = text
    label.numberOfLines = lines
    label.lineBreakMode = .byTruncatingTail
    label.lineBreakStrategy = []
  }

  func sizeThatFits(_ proposal: ProposedViewSize, uiView label: UILabel, context: Context) -> CGSize? {
    let width = proposal.width.flatMap { $0.isFinite ? $0 : nil } ?? label.intrinsicContentSize.width
    let height = label.sizeThatFits(CGSize(width: width, height: .greatestFiniteMagnitude)).height
    return CGSize(width: width, height: ceil(height))
  }
}
