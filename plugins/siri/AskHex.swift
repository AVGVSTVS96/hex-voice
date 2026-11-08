import AppIntents
import Foundation

// Siri hands hex the words the way the app's chat does, into hex's Siri topic, then waits for
// hex's reply, however long its work takes, and speaks it.
struct AskHex: AppIntent, ProgressReportingIntent {
  static let title: LocalizedStringResource = "Ask hex"
  static let description = IntentDescription(
    "Sends a question or request to hex, Bassim's own assistant that runs his projects, servers and tasks, and returns hex's reply.",
    searchKeywords: ["hex", "assistant", "tasks", "running", "tell hex"])

  @Parameter(
    title: "Request",
    description: "What to ask or tell hex, word for word as the person said it.",
    requestValueDialog: "What should I ask hex?")
  var request: String

  func perform() async throws -> some IntentResult & ReturnsValue<String> & ProvidesDialog {
    let words = request.trimmingCharacters(in: .whitespacesAndNewlines)
    let progress = progress
    let ask = { try await Hex().ask(words, progress: progress) }
    let answer: String
    if #available(iOS 27, *) {
      answer = try await performBackgroundTask(operation: ask)
    } else {
      answer = try await ask()
    }
    return .result(value: answer, dialog: "\(answer)")
  }
}

// iOS ends an intent after 30 seconds unless it runs as a long-running task that reports progress.
@available(iOS 27, *)
extension AskHex: LongRunningIntent {}

// Xcode 27.3's Swift is the first with ToolIntent; older Xcodes build the intent without it.
#if compiler(>=6.4.2)
  @available(iOS 27.3, *)
  extension AskHex: ToolIntent {}
#endif

private struct Thread: Decodable {
  let id: String
  let name: String
  let `where`: String
}

private struct Board: Decodable {
  let tasks: [Thread]
}

private struct Turn: Decodable {
  let from: String
  let text: String
}

private struct Chat: Decodable {
  let version: Double
  let sends: Bool
  let total: Int
  let turns: [Turn]
}

private struct HexError: Error, CustomLocalizedStringResourceConvertible {
  let localizedStringResource: LocalizedStringResource
}

private struct Hex {
  // Past this, hex is stuck rather than busy.
  static let patience: TimeInterval = 600
  static let stuck = "hex has been on it for ten minutes and still hasn't answered."
  // The topic's id, kept once found: a topic quiet for a week drops off hex's board.
  static let kept = "siriTopic"

  let origin: String
  let token: String

  init() throws {
    let info = Bundle.main.infoDictionary ?? [:]
    guard let url = info["HexURL"] as? String, URL(string: url)?.host != nil else {
      throw HexError(localizedStringResource: "This hex app was built without hex's address.")
    }
    origin = url.replacingOccurrences(of: "/+$", with: "", options: .regularExpression)
    token = info["HexToken"] as? String ?? ""
  }

  func ask(_ words: String, progress: Progress) async throws -> String {
    guard !words.isEmpty else { throw HexError(localizedStringResource: "Tell me what to ask hex.") }
    progress.totalUnitCount = Int64(Self.patience)
    progress.localizedDescription = "Asking hex"
    let start = Date()
    let ticking = Task {
      while !Task.isCancelled {
        progress.completedUnitCount = Int64(-start.timeIntervalSinceNow)
        try await Task.sleep(for: .seconds(3))
      }
    }
    defer { ticking.cancel() }

    let (chat, before) = try await topic()
    // Each message carries how to answer it, so whichever session holds the topic knows.
    let said = "(asked Siri: reply once, in one short spoken sentence) \(words)"
    let key = "app-siri-\(UUID().uuidString.prefix(8).lowercased())"
    _ = try await call(chat, body: ["text": said, "key": key])

    // Sent: from here on Siri only waits, so it never sends the words twice. The chat shows the
    // words once hex has taken them in, and hex answers the topic's questions in turn, one reply
    // each, so this one's answer is the reply that follows it once every earlier one is answered.
    let end = Date().addingTimeInterval(Self.patience)
    var latest = before
    var mine: (at: Int, after: Int)?
    while true {
      let shown = latest.total - latest.turns.count
      if mine == nil,
        let asked = latest.turns.indices.last(where: {
          shown + $0 >= before.total && latest.turns[$0].from == "me" && latest.turns[$0].text == said
        })
      {
        let answered = latest.turns[..<asked].lastIndex(where: { $0.from == "hex" }) ?? -1
        mine = (shown + asked, latest.turns[(answered + 1)..<asked].filter { $0.from == "me" }.count)
        progress.localizedDescription = "hex is working on it"
      }
      if let mine {
        let replies = latest.turns.indices.filter { shown + $0 > mine.at && latest.turns[$0].from == "hex" }
        if replies.count > mine.after { return latest.turns[replies[mine.after]].text }
      }
      guard end.timeIntervalSinceNow > 1 else { return Self.stuck }
      // A dropped connection on the way waits and asks again; only the patience ends the wait.
      if let next: Chat = try? await get("\(chat)?after=\(Int64(latest.version))", within: 40) {
        latest = next
      } else {
        try await Task.sleep(for: .seconds(2))
      }
    }
  }

  // The Siri topic's chat path, and its chat as it stands before asking.
  private func topic() async throws -> (String, Chat) {
    let path = { (id: String) in "/tasks/\(id.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? id)/chat" }
    if let id = UserDefaults.standard.string(forKey: Self.kept), let chat: Chat = try? await get(path(id)), chat.sends {
      return (path(id), chat)
    }
    let board: Board = try await get("/tasks")
    guard let siri = board.tasks.first(where: { $0.name == "Siri" && $0.where == "Telegram" }) else {
      throw HexError(localizedStringResource: "hex has no Siri topic. Ask hex to open one in Telegram.")
    }
    let chat: Chat = try await get(path(siri.id))
    guard chat.sends else {
      throw HexError(localizedStringResource: "hex's Siri topic isn't taking messages right now. Ask in Telegram.")
    }
    UserDefaults.standard.set(siri.id, forKey: Self.kept)
    return (path(siri.id), chat)
  }

  private func get<T: Decodable>(_ path: String, within timeout: TimeInterval = 30) async throws -> T {
    try JSONDecoder().decode(T.self, from: try await call(path, timeout: timeout))
  }

  private func call(_ path: String, body: [String: String]? = nil, timeout: TimeInterval = 30)
    async throws -> Data
  {
    var request = URLRequest(url: URL(string: origin + path)!, timeoutInterval: timeout)
    if !token.isEmpty { request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
    if let body {
      request.httpMethod = "POST"
      request.setValue("application/json", forHTTPHeaderField: "Content-Type")
      request.httpBody = try JSONEncoder().encode(body)
    }
    let data: Data
    let response: URLResponse
    do {
      (data, response) = try await URLSession.shared.data(for: request)
    } catch {
      throw HexError(localizedStringResource: "Can't reach hex. Check that Tailscale is on.")
    }
    let status = (response as? HTTPURLResponse)?.statusCode ?? 0
    guard (200..<300).contains(status) else {
      // hex explains a refusal in plain words; its bare 404 says nothing.
      let said = String(decoding: data, as: UTF8.self).trimmingCharacters(in: .whitespacesAndNewlines)
      throw HexError(localizedStringResource: "\(said.isEmpty || said == "\(status)" ? "hex answered HTTP \(status)." : said)")
    }
    return data
  }
}
