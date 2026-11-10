import AppIntents
import Foundation
import os

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

private struct Topic: Decodable {
  let id: String
  let place: String
  let `where`: String
}

private struct Board: Decodable {
  let tasks: [Topic]
}

private struct Turn: Decodable {
  let from: String
  let text: String
}

private struct Sent: Decodable {
  let key: String
}

private struct Chat: Decodable {
  let version: Double
  let turns: [Turn]
  let waiting: [Sent]
}

private struct Step: Decodable {
  let text: String
  let at: Date
}

// An app server older than ?after= on a task's page answers without a version.
private struct Page: Decodable {
  let version: Double?
  let steps: [Step]?
}

private struct HexError: Error, CustomLocalizedStringResourceConvertible {
  let localizedStringResource: LocalizedStringResource
}

private struct Refused: Error, CustomLocalizedStringResourceConvertible {
  let status: Int
  let localizedStringResource: LocalizedStringResource
}

private struct Unreachable: Error, CustomLocalizedStringResourceConvertible {
  let localizedStringResource: LocalizedStringResource = "Can't reach hex. Check that Tailscale is on."
}

private struct Hex {
  // Past this, hex is stuck rather than busy.
  static let patience: TimeInterval = 600
  static let stuck = "hex has been on it for ten minutes and still hasn't answered."
  // The topic's id, kept once found: a topic quiet for a week drops off hex's board.
  static let kept = "siriTopic"

  // Each ask's timings, read off the phone with `log collect`: how long the app had been running when
  // Siri started the ask says whether asking launched it.
  static let log = Logger(subsystem: "com.shahidy.hexvoice", category: "siri")

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

  // The Live Activity iOS shows while this waits takes its title and subtitle from the progress.
  func ask(_ words: String, progress: Progress) async throws -> String {
    guard !words.isEmpty else { throw HexError(localizedStringResource: "Tell me what to ask hex.") }
    progress.totalUnitCount = Int64(Self.patience * 2)
    progress.localizedDescription = "Asking hex"
    progress.localizedAdditionalDescription = "“\(words)”"
    let start = Date()
    let ticking = Task {
      while !Task.isCancelled {
        progress.completedUnitCount = Int64(-start.timeIntervalSinceNow)
        try await Task.sleep(for: .seconds(3))
      }
    }
    defer { ticking.cancel() }

    // Others post in the topic too, so the answer is the reply that starts with this ask's tag.
    let id = UUID().uuidString.prefix(6).lowercased()
    let tag = "#siri-\(id)"
    let key = "app-siri-\(id)"
    let said = "(asked Siri: reply once, starting with \(tag), then one short spoken sentence) \(words)"
    let topic = try await send(said, key: key)
    let sent = Date()
    Self.log.notice("\(tag): app up \(launched(), format: .fixed(precision: 2))s, posted in \(sent.timeIntervalSince(start), format: .fixed(precision: 2))s")

    let following = Task { await follow(topic, since: sent, progress: progress) }
    defer { following.cancel() }

    let end = sent.addingTimeInterval(Self.patience)
    var latest: Chat?
    while true {
      do {
        latest = try await get(chat(topic) + (latest.map { "?after=\(Int64($0.version))" } ?? ""), within: 40)
      } catch is Unreachable {
        try await Task.sleep(for: .seconds(2))
      }
      if let latest {
        if let reply = latest.turns.first(where: { $0.from == "hex" && $0.text.contains(tag) }) {
          Self.log.notice("\(tag): answered in \(-start.timeIntervalSinceNow, format: .fixed(precision: 2))s")
          return String(reply.text.replacingOccurrences(of: tag, with: "").drop { " :-–—\n".contains($0) })
        }
        progress.localizedDescription =
          latest.waiting.contains { $0.key.hasSuffix(key) } ? "Waiting for hex to pick it up" : "hex is working on it"
      }
      guard end.timeIntervalSinceNow > 1 else { return Self.stuck }
    }
  }

  // Seconds since iOS started the app's process.
  private func launched() -> Double {
    var process = kinfo_proc()
    var size = MemoryLayout<kinfo_proc>.stride
    var name = [CTL_KERN, KERN_PROC, KERN_PROC_PID, getpid()]
    guard sysctl(&name, 4, &process, &size, nil, 0) == 0 else { return -1 }
    let started = process.kp_proc.p_starttime
    return Date().timeIntervalSince1970 - Double(started.tv_sec) - Double(started.tv_usec) / 1e6
  }

  // Posting first, before reading anything, starts hex on the words as soon as it can. The key
  // makes a second post of the same words deliver once.
  private func send(_ said: String, key: String) async throws -> String {
    if let kept = UserDefaults.standard.string(forKey: Self.kept) {
      do {
        try await post(said, key: key, to: kept)
        return kept
      } catch let refused as Refused where refused.status == 404 {}
    }
    let board: Board = try await get("/tasks")
    guard let siri = board.tasks.first(where: { $0.place == "Siri" && $0.where == "Telegram" }) else {
      throw HexError(localizedStringResource: "hex has no Siri topic. Ask hex to open one in Telegram.")
    }
    try await post(said, key: key, to: siri.id)
    UserDefaults.standard.set(siri.id, forKey: Self.kept)
    return siri.id
  }

  private func post(_ said: String, key: String, to topic: String) async throws {
    do {
      _ = try await call(chat(topic), body: ["text": said, "key": key])
    } catch let refused as Refused where refused.status == 409 {
      throw HexError(localizedStringResource: "hex's Siri topic isn't taking messages right now. Ask in Telegram.")
    }
  }

  // The subtitle shows what hex is doing for this ask, as its topic's page lists each step.
  private func follow(_ topic: String, since sent: Date, progress: Progress) async {
    var after: Double?
    while !Task.isCancelled {
      guard let read: Page = try? await get(page(topic) + (after.map { "?after=\(Int64($0))" } ?? ""), within: 40),
        let version = read.version
      else { return }
      if let step = read.steps?.first(where: { $0.at >= sent }) {
        progress.localizedAdditionalDescription = step.text
      }
      after = version
    }
  }

  private func page(_ topic: String) -> String {
    "/tasks/\(topic.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? topic)"
  }

  private func chat(_ topic: String) -> String { page(topic) + "/chat" }

  private func get<T: Decodable>(_ path: String, within timeout: TimeInterval = 30) async throws -> T {
    let decoder = JSONDecoder()
    decoder.dateDecodingStrategy = .custom { decoder in
      let text = try decoder.singleValueContainer().decode(String.self)
      return (try? Date(text, strategy: Date.ISO8601FormatStyle(includingFractionalSeconds: true))) ?? .distantPast
    }
    return try decoder.decode(T.self, from: try await call(path, timeout: timeout))
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
    } catch let error as URLError where error.code == .cancelled {
      throw CancellationError()
    } catch {
      throw Unreachable()
    }
    let status = (response as? HTTPURLResponse)?.statusCode ?? 0
    guard (200..<300).contains(status) else {
      // hex explains a refusal in plain words; its bare 404 says nothing.
      let said = String(decoding: data, as: UTF8.self).trimmingCharacters(in: .whitespacesAndNewlines)
      throw Refused(
        status: status,
        localizedStringResource: "\(said.isEmpty || said == "\(status)" ? "hex answered HTTP \(status)." : said)")
    }
    return data
  }
}
