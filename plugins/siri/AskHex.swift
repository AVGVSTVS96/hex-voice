import AppIntents
import Foundation

// Siri hands hex the words the way the app's chat does, into his DM with hex, then waits there for
// hex's reply and speaks it.
struct AskHex: AppIntent {
  static let title: LocalizedStringResource = "Ask hex"
  static let description = IntentDescription(
    "Sends a question or request to hex, Bassim's own assistant that runs his projects, servers and tasks, in his DM with it, and returns hex's reply.",
    searchKeywords: ["hex", "assistant", "tasks", "running", "tell hex"])

  @Parameter(
    title: "Request",
    description: "What to ask or tell hex, in the person's own words.",
    requestValueDialog: "What should I ask hex?")
  var request: String

  func perform() async throws -> some IntentResult & ReturnsValue<String> & ProvidesDialog {
    let answer = try await Hex().ask(request.trimmingCharacters(in: .whitespacesAndNewlines))
    return .result(value: answer, dialog: "\(answer)")
  }
}

// Xcode 27.3's Swift is the first with ToolIntent; older Xcodes build the intent without it.
#if compiler(>=6.4.2)
  @available(iOS 27.3, *)
  extension AskHex: ToolIntent {}
#endif

private struct Thread: Decodable {
  let id: String
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
  // How long Siri waits for hex's reply before leaving it to his DM.
  static let patience: TimeInterval = 20
  static let later = "hex has it and will answer in your Telegram DM."

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

  func ask(_ words: String) async throws -> String {
    guard !words.isEmpty else { throw HexError(localizedStringResource: "Tell me what to ask hex.") }
    let board: Board = try await get("/tasks")
    guard let dm = board.tasks.first(where: { $0.where == "DM" }) else {
      throw HexError(localizedStringResource: "hex's DM isn't on its board right now. Ask in Telegram.")
    }
    let chat = "/tasks/\(dm.id.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? dm.id)/chat"
    let before: Chat = try await get(chat)
    guard before.sends else {
      throw HexError(localizedStringResource: "hex's DM isn't open to the app right now. Ask in Telegram.")
    }
    let said = "(asked Siri) \(words)"
    let key = "app-siri-\(UUID().uuidString.prefix(8).lowercased())"
    _ = try await call(chat, body: ["text": said, "key": key])

    // Sent: from here on, anything short of hex's reply leaves it to his DM, so Siri never sends it
    // again. hex's reply is the first thing it says after the poll that first shows his words, since
    // the chat lists turns by when they came in and his only shows once hex has taken it in.
    let end = Date().addingTimeInterval(Self.patience)
    var latest = before
    var heard: Int?
    while end.timeIntervalSinceNow > 1 {
      guard let next: Chat = try? await get("\(chat)?after=\(Int64(latest.version))", within: end.timeIntervalSinceNow)
      else { break }
      latest = next
      let shown = latest.total - latest.turns.count
      if let heard, let reply = latest.turns.dropFirst(max(0, heard - shown)).first(where: { $0.from == "hex" }) {
        return reply.text
      }
      if heard == nil, latest.turns.contains(where: { $0.from == "me" && $0.text == said }) {
        heard = latest.total
      }
    }
    return Self.later
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
      let said = (try? JSONDecoder().decode([String: [String: String]].self, from: data))?["error"]?["message"]
      throw HexError(localizedStringResource: "\(said ?? "hex answered HTTP \(status).")")
    }
    return data
  }
}
