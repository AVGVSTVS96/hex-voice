import ExpoModulesCore
import ExpoUI
import ImageIO
import QuickLook
import SwiftUI
import UniformTypeIdentifiers

final class ShotsProps: UIBaseViewProps {
  // Each option's screenshot, its shape (width over height) and the option's label, which names it
  // full screen, in the options' order.
  @Field var uris: [String] = []
  @Field var shapes: [Double] = []
  @Field var labels: [String] = []
  // What reading a screenshot from hex takes, its token.
  @Field var headers: [String: String] = [:]
  // The most a screenshot stands, the gap between two, their corners and the expand mark's size.
  @Field var height: CGFloat = 200
  @Field var gap: CGFloat = 8
  @Field var radius: CGFloat = 12
  @Field var size: CGFloat = 13
  @Field var secondary: Color = .secondary
  @Field var surface: Color = .gray
  @Field var edge: Color = .gray
}

// An ask's screenshots side by side across the card, each at its own shape, so each holds its room
// before it arrives, and its option's answer can sit under it. A tap shows them full screen in Quick Look, titled by
// option, where a swipe goes to the next and a pinch looks closer.
struct ShotsView: ExpoSwiftUI.View {
  @ObservedObject var props: ShotsProps
  @StateObject private var shots = Loaded()
  @State private var shown: URL?
  @Environment(\.displayScale) private var scale

  var body: some View {
    HStack(alignment: .top, spacing: props.gap) {
      ForEach(Array(props.uris.enumerated()), id: \.offset) { index, uri in
        tile(
          uri,
          shape: props.shapes.indices.contains(index) ? props.shapes[index] : 1,
          label: props.labels.indices.contains(index) ? props.labels[index] : "")
      }
    }
    .task(id: props.uris) {
      await shots.load(props.uris, labels: props.labels, headers: props.headers, pixels: props.height * scale * 2)
    }
    .quickLookPreview($shown, in: props.uris.compactMap { shots.files[$0] })
  }

  private func tile(_ uri: String, shape: Double, label: String) -> some View {
    let corner = RoundedRectangle(cornerRadius: props.radius, style: .continuous)
    return props.surface
      .overlay {
        if let image = shots.thumbs[uri] {
          Image(uiImage: image).resizable()
        } else if shots.failed.contains(uri) {
          Image(systemName: "photo").foregroundStyle(props.secondary)
        } else {
          ProgressView()
        }
      }
      .overlay(alignment: .topTrailing) {
        Image(systemName: "arrow.up.left.and.arrow.down.right")
          .font(.system(size: props.size * 0.75, weight: .semibold))
          .foregroundStyle(.primary)
          .padding(props.gap * 0.75)
          .background(.ultraThinMaterial, in: Circle())
          .padding(props.gap * 0.75)
      }
      .clipShape(corner)
      .overlay(corner.strokeBorder(props.edge, lineWidth: 1 / scale))
      .aspectRatio(shape, contentMode: .fit)
      .frame(maxWidth: .infinity, maxHeight: props.height)
      .contentShape(corner)
      .onTapGesture { shown = shots.files[uri] }
      .accessibilityElement()
      .accessibilityLabel("Screenshot of \(label), opens full screen")
      .accessibilityAddTraits(.isButton)
  }
}

// The screenshots one card shows, read from hex into a folder of its own, each named for its option
// so Quick Look titles it so, and gone with the card.
@MainActor
private final class Loaded: ObservableObject {
  @Published var thumbs: [String: UIImage] = [:]
  @Published var files: [String: URL] = [:]
  @Published var failed: Set<String> = []
  private let dir = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)

  deinit { try? FileManager.default.removeItem(at: dir) }

  func load(_ uris: [String], labels: [String], headers: [String: String], pixels: CGFloat) async {
    await withTaskGroup(of: Void.self) { group in
      for (index, uri) in uris.enumerated() where files[uri] == nil {
        let label = labels.indices.contains(index) ? labels[index] : "\(index + 1)"
        group.addTask { await self.fetch(uri, as: label, headers: headers, pixels: pixels) }
      }
    }
  }

  private func fetch(_ uri: String, as label: String, headers: [String: String], pixels: CGFloat) async {
    guard let url = URL(string: uri) else {
      failed.insert(uri)
      return
    }
    var request = URLRequest(url: url)
    for (name, value) in headers { request.setValue(value, forHTTPHeaderField: name) }
    do {
      let (download, response) = try await URLSession.shared.download(for: request)
      guard (response as? HTTPURLResponse)?.statusCode == 200 else {
        failed.insert(uri)
        return
      }
      let kind = UTType(mimeType: response.mimeType ?? "")?.preferredFilenameExtension ?? "png"
      let name = label.replacingOccurrences(of: "/", with: "-")
      let folder = dir.appendingPathComponent(UUID().uuidString)
      try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
      let file = folder.appendingPathComponent(name).appendingPathExtension(kind)
      try FileManager.default.moveItem(at: download, to: file)
      guard let thumb = await Task.detached(operation: { Self.thumb(file, pixels: pixels) }).value else {
        failed.insert(uri)
        return
      }
      files[uri] = file
      thumbs[uri] = thumb
    } catch is CancellationError {
    } catch let error as URLError where error.code == .cancelled {
    } catch {
      failed.insert(uri)
    }
  }

  // As big as its tile draws it, so a screenshot many times the screen's size never sits in memory whole.
  private nonisolated static func thumb(_ file: URL, pixels: CGFloat) -> UIImage? {
    guard let source = CGImageSourceCreateWithURL(file as CFURL, nil) else { return nil }
    let options: [CFString: Any] = [
      kCGImageSourceCreateThumbnailFromImageAlways: true,
      kCGImageSourceCreateThumbnailWithTransform: true,
      kCGImageSourceThumbnailMaxPixelSize: pixels,
    ]
    return CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary).map(UIImage.init)
  }
}
