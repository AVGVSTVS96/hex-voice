import SwiftUI
import Textual

// How the app draws markdown, from its own colors, sizes and corners rather than Textual's:
// headings as semibold body words, list marks and quotes in the secondary tone, code on the
// surface with the inner corner, links in the accent.
struct Look {
  var size: CGFloat
  var leading: CGFloat
  var gap: CGFloat
  var radius: CGFloat
  var color: Color
  var secondary: Color
  var edge: Color
  var surface: Color
  var accent: Color
  var progress: Color
  var ask: Color
  var danger: Color
}

extension Look: StructuredText.Style {
  var inlineStyle: InlineStyle {
    InlineStyle()
      .code(.monospaced, .fontScale(0.94))
      .strong(.fontWeight(.semibold))
      .link(.foregroundColor(accent))
  }

  var headingStyle: Heading { Heading(look: self) }
  var paragraphStyle: Paragraph { Paragraph(look: self) }
  var blockQuoteStyle: Quote { Quote(look: self) }
  var codeBlockStyle: Code { Code(look: self) }
  var listItemStyle: Item { Item(look: self) }
  var unorderedListMarker: Bullet { Bullet(look: self) }
  var orderedListMarker: Number { Number(look: self) }
  var tableStyle: StructuredText.DefaultTableStyle { .default }
  var tableCellStyle: StructuredText.DefaultTableCellStyle { .default }
  var thematicBreakStyle: StructuredText.DividerThematicBreakStyle { .divider }

  // Blocks sit a gap apart, and a list's items closer than that.
  fileprivate func spacing(_ level: Int) -> StructuredText.BlockSpacing {
    .init(top: level == 0 ? gap : gap * 2 / 3)
  }

  struct Heading: StructuredText.HeadingStyle {
    let look: Look
    func makeBody(configuration: Configuration) -> some View {
      configuration.label
        .fontWeight(.semibold)
        .lineSpacing(look.leading)
        .textual.blockSpacing(look.spacing(configuration.indentationLevel))
    }
  }

  struct Paragraph: StructuredText.ParagraphStyle {
    let look: Look
    func makeBody(configuration: Configuration) -> some View {
      configuration.label
        .lineSpacing(look.leading)
        .textual.blockSpacing(look.spacing(configuration.indentationLevel))
    }
  }

  struct Quote: StructuredText.BlockQuoteStyle {
    let look: Look
    func makeBody(configuration: Configuration) -> some View {
      configuration.label
        .foregroundStyle(look.secondary)
        .padding(.leading, 15)
        .frame(maxWidth: .infinity, alignment: .leading)
        .overlay(alignment: .leading) {
          Rectangle().fill(look.edge).frame(width: 3)
        }
    }
  }

  struct Code: StructuredText.CodeBlockStyle {
    let look: Look
    func makeBody(configuration: Configuration) -> some View {
      Overflow {
        configuration.label
          .lineSpacing(3)
          .textual.fontScale(0.8)
          .monospaced()
          .fixedSize(horizontal: false, vertical: true)
          .padding(.horizontal, 14)
          .padding(.vertical, 12)
      }
      .background(look.surface)
      .clipShape(RoundedRectangle(cornerRadius: look.radius, style: .continuous))
      .textual.blockSpacing(look.spacing(configuration.indentationLevel))
    }
  }

  struct Item: StructuredText.ListItemStyle {
    let look: Look
    func makeBody(configuration: Configuration) -> some View {
      HStack(alignment: .firstTextBaseline, spacing: 8) {
        configuration.marker.foregroundStyle(look.secondary)
        configuration.block
      }
    }
  }

  struct Bullet: StructuredText.UnorderedListMarker {
    let look: Look
    func makeBody(configuration: Configuration) -> some View {
      Text("•").frame(minWidth: 14, alignment: .leading)
    }
  }

  struct Number: StructuredText.OrderedListMarker {
    let look: Look
    func makeBody(configuration: Configuration) -> some View {
      Text("\(configuration.ordinal).").monospacedDigit().frame(minWidth: 14, alignment: .leading)
    }
  }
}

extension StructuredText.HighlighterTheme {
  init(_ look: Look) {
    let tones: [(Color, [TokenType])] = [
      (
        look.progress,
        [.keyword, .builtin, .boolean, .literal, .atrule, .important, .directive, .preprocessor]
      ),
      (look.accent, [.string, .char, .regex, .attributeValue, .url, .inserted]),
      (look.ask, [.number, .constant, .className, .attribute, .tag, .selector]),
      (look.secondary, [.comment, .blockComment, .docComment, .prolog, .punctuation, .operator]),
      (look.danger, [.deleted]),
    ]
    self.init(
      foregroundColor: DynamicColor(look.color),
      backgroundColor: DynamicColor(look.surface),
      tokenProperties: Dictionary(
        uniqueKeysWithValues: tones.flatMap { tone, types in
          types.map { ($0, AnyTextProperty(.foregroundColor(tone))) }
        })
    )
  }
}
