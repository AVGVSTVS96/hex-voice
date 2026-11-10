import Foundation
import SwiftUI
import Textual

// hex writes chat: a line break is a break, and Discord's `-# ` lines are small and secondary.
struct Chat: MarkupParser {
  let look: Look
  var breaks = true
  private static let mark = "-# "

  func attributedString(for input: String) throws -> AttributedString {
    var document = try AttributedStringMarkdownParser(baseURL: nil).attributedString(for: chat(input))
    var prefixes: [Range<AttributedString.Index>] = []
    var small = false
    var block: PresentationIntent?
    var lineStart = true
    for run in document.runs {
      let intent = run.presentationIntent
      if intent != block {
        block = intent
        lineStart = true
        small = false
      }
      let text = String(document[run.range].characters)
      if lineStart, text.hasPrefix(Self.mark), !Self.isCode(intent) {
        small = true
        let end = document.characters.index(run.range.lowerBound, offsetBy: Self.mark.count)
        prefixes.append(run.range.lowerBound..<end)
      }
      if small {
        document[run.range].font = .system(size: look.size * 0.8)
        document[run.range].foregroundColor = look.secondary
      }
      lineStart = run.inlinePresentationIntent?.isDisjoint(with: [.lineBreak, .softBreak]) == false
      if lineStart { small = false }
    }
    for prefix in prefixes.reversed() { document.removeSubrange(prefix) }
    return document
  }

  fileprivate static func isCode(_ intent: PresentationIntent?) -> Bool {
    intent?.components.contains { if case .codeBlock = $0.kind { true } else { false } } == true
  }

  private func chat(_ input: String) -> String {
    var fenced = false
    return input.replacingOccurrences(of: "\r\n", with: "\n")
      .split(separator: "\n", omittingEmptySubsequences: false)
      .map { line in
        let line = String(line)
        let trimmed = line.trimmingCharacters(in: .whitespaces)
        if trimmed.hasPrefix("```") || trimmed.hasPrefix("~~~") {
          fenced.toggle()
          return line
        }
        if fenced || trimmed.isEmpty { return line }
        return breaks ? line + "  " : line
      }
      .joined(separator: "\n")
  }
}

// A message as one text, for a few lines of it: each block on its own line as written, list items
// with their number or bullet, so a line limit folds it where the reader expects.
struct Run: MarkupParser {
  let look: Look

  func attributedString(for input: String) throws -> AttributedString {
    let document = try Chat(look: look).attributedString(for: input)
    var words = AttributedString()
    var block: PresentationIntent?
    for run in document.runs {
      let intent = run.presentationIntent
      if intent != block {
        if !words.characters.isEmpty { words += AttributedString("\n") }
        if let mark = Self.mark(intent) {
          var marked = AttributedString(mark)
          marked.foregroundColor = look.secondary
          words += marked
        }
        block = intent
      }
      var piece = AttributedString(document[run.range])
      piece.presentationIntent = nil
      words += piece
    }
    return words
  }

  // An item's number or bullet, indented by how deep its list sits.
  private static func mark(_ intent: PresentationIntent?) -> String? {
    guard let components = intent?.components else { return nil }
    let lists = components.filter {
      switch $0.kind {
      case .orderedList, .unorderedList: true
      default: false
      }
    }
    guard let item = components.first(where: { if case .listItem = $0.kind { true } else { false } }),
      case .listItem(let ordinal) = item.kind, let list = lists.first
    else { return nil }
    let indent = String(repeating: "    ", count: lists.count - 1)
    if case .orderedList = list.kind { return "\(indent)\(ordinal). " }
    return "\(indent)• "
  }
}
