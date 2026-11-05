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
        if line.trimmingCharacters(in: .whitespaces).hasPrefix("```") {
          fenced.toggle()
          return line
        }
        if fenced || line.trimmingCharacters(in: .whitespaces).isEmpty { return line }
        return breaks ? line + "  " : line
      }
      .joined(separator: "\n")
  }
}

// A message as one run of words: its blocks joined, list items by a dot, its code left out.
// Bold, code and links keep their marks.
struct Run: MarkupParser {
  let look: Look

  func attributedString(for input: String) throws -> AttributedString {
    let document = try Chat(look: look, breaks: false).attributedString(for: input)
    var words = AttributedString()
    var block: PresentationIntent?
    for run in document.runs {
      let intent = run.presentationIntent
      if Chat.isCode(intent) { continue }
      if intent != block {
        if !words.characters.isEmpty {
          let item = intent?.components.contains { if case .listItem = $0.kind { true } else { false } }
          words += AttributedString(item == true ? " · " : " ")
        }
        block = intent
      }
      var piece = AttributedString(document[run.range])
      piece.presentationIntent = nil
      words += piece
    }
    return words
  }
}
