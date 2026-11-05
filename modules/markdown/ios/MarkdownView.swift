import ExpoModulesCore
import ExpoUI
import SwiftUI
import Textual

final class MarkdownProps: UIBaseViewProps {
  @Field var markdown: String = ""
  // One run of words, for a preview or a line: blocks flow together and code is left out.
  @Field var inline: Bool = false
  @Field var lines: Int?
  @Field var selectable: Bool = false
  @Field var size: CGFloat = 17
  @Field var leading: CGFloat = 5
  @Field var gap: CGFloat = 12
  @Field var radius: CGFloat = 12
  @Field var color: Color = .primary
  @Field var secondary: Color = .secondary
  @Field var edge: Color = .gray
  @Field var surface: Color = .gray
  @Field var accent: Color = .accentColor
  var onLink = EventDispatcher()

  var look: Look {
    Look(
      size: size, leading: leading, gap: gap, radius: radius,
      color: color, secondary: secondary, edge: edge, surface: surface, accent: accent)
  }
}

struct MarkdownView: ExpoSwiftUI.View {
  @ObservedObject var props: MarkdownProps

  var body: some View {
    words
      .font(.system(size: props.size))
      .foregroundStyle(props.color)
      .frame(maxWidth: .infinity, alignment: .leading)
      .textual.structuredTextStyle(props.look)
      .textual.highlighterTheme(.init(props.look))
      .environment(
        \.openURL,
        OpenURLAction { url in
          props.onLink(["url": url.absoluteString])
          return .handled
        })
  }

  @ViewBuilder private var words: some View {
    if props.inline {
      InlineText(props.markdown, parser: Run(look: props.look))
        .lineSpacing(props.leading)
        .lineLimit(props.lines)
        .selecting(props.selectable)
    } else {
      StructuredText(props.markdown, parser: Chat(look: props.look)).selecting(props.selectable)
    }
  }
}

extension View {
  @ViewBuilder fileprivate func selecting(_ selectable: Bool) -> some View {
    if selectable { textual.textSelection(.enabled) } else { self }
  }
}
