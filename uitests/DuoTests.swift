import XCTest

// Plays a tap script (scripts/duo-taps by default, or the file scripts/duo tap is given) on the
// installed hex app, one command a line:
//   launch <url>          starts the app afresh from a link
//   open <url>            opens a link in the running app
//   tap <query>           taps the element whose id is the query, or whose label holds it; with the
//                         keyboard up, in the middle of what shows of it above the keyboard
//   tap-at <x> <y>        taps that point of the window
//   swipe-back <query>    drags from that element across the screen, the way an edge swipe goes
//   swipe-left <query>    swipes left across the row, pager or list holding that element: a row's swipe
//                         actions, a pager's next page
//   scroll [query]        swipes up the list holding that element (or the list on screen), so its
//                         rows run under the bars
//   shoot <name>          holds still while scripts/duo screenshots the screen as <name>
//   snap <name>           has it screenshot right away and goes on, to catch what moves (two snaps a
//                         wait 0.1 apart are shot about 100 ms apart)
//   wait <seconds>        waits
//   pose <pose>           has scripts/duo turn or fold the Duo there, without relaunching the app
//   pose-burst <pose>     the same, with three shots as fast as they come once the hinge lands
//   frame <query>         notes where accessibility puts that element
//   selected <query>      checks the element is selected; unselected checks it isn't
//   type <query> <text>   taps the element and types the text on the software keyboard
//   above-keyboard <query> checks the keyboard is up and the element shows whole above it
//   mark <query>          remembers the element's frame; still <query> checks it hasn't moved or resized
//   swipe-down <query>    drags from the element down to the screen's foot, the way you pull a keyboard away
//   no-keyboard [name]    checks the keyboard has gone, naming the step in its failure
//   tree <name>           keeps the accessibility tree as it is now, as <name>
//   absent <id>           checks no element has that id
//   hex down|up           has the stand-in drop every read from now on, as when hex can't be reached, or answer again
// A line whose element isn't there fails and is skipped, and the script goes on. The
// accessibility tree at the end is kept beside the shots too.
final class DuoTests: XCTestCase {
    let app = XCUIApplication(bundleIdentifier: "com.shahidy.hexvoice")
    var marked: [String: CGRect] = [:]

    override func setUp() {
        continueAfterFailure = true
        app.terminate()
        app.launch()
    }

    override func tearDown() {
        keepTree(nil)
    }

    private func keepTree(_ name: String?) {
        let tree = XCTAttachment(string: app.debugDescription)
        tree.name = name.map { "tree-\($0)" } ?? "tree"
        tree.lifetime = .keepAlways
        add(tree)
    }

    func testScript() throws {
        let script = try XCTUnwrap(ProcessInfo.processInfo.environment["DUO_TAPS"], "no tap script")
        for line in script.split(separator: "\n") {
            let words = line.split(separator: " ", maxSplits: 1).map(String.init)
            guard let command = words.first, !command.hasPrefix("#") else { continue }
            print("duo-line \(line)")
            let argument = words.count > 1 ? words[1] : ""
            switch command {
            case "launch":
                app.terminate()
                XCUIDevice.shared.system.open(try XCTUnwrap(URL(string: argument)))
                XCTAssertTrue(app.wait(for: .runningForeground, timeout: 20), "\(argument) didn't open the app")
            case "open": app.open(try XCTUnwrap(URL(string: argument)))
            case "tap": element(argument).map { tap($0, argument) }
            case "tap-at":
                let point = argument.split(separator: " ").compactMap { Double($0) }
                touch()
                app.windows.firstMatch.coordinate(withNormalizedOffset: .zero)
                    .withOffset(CGVector(dx: point[0], dy: point[1])).tap()
            case "swipe-back":
                element(argument).map { _ in touch() }
                element(argument)?.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
                    .press(forDuration: 0.05, thenDragTo: app.windows.firstMatch.coordinate(withNormalizedOffset: CGVector(dx: 0.6, dy: 0.5)))
            case "swipe-left": element(argument).map { touch(); holder($0, rows: true).swipeLeft() }
            case "scroll":
                let list = argument.isEmpty ? app.collectionViews.firstMatch : element(argument).map { holder($0, rows: false) }
                list.map { touch(); $0.swipeUp() }
            case "shoot", "pose", "pose-burst":
                sleep(1)
                print("duo-\(["shoot": "step", "pose": "pose", "pose-burst": "burst"][command]!) \(argument)")
                sleep(command == "shoot" ? UInt32(ProcessInfo.processInfo.environment["DUO_SHOOT_WAIT"] ?? "") ?? 3 : 9)
            case "snap": print("duo-snap \(argument)")
            case "hex":
                print("duo-hex \(argument)")
                sleep(1)
            case "tree": keepTree(argument)
            case "absent":
                XCTAssertFalse(app.descendants(matching: .any)[argument].exists, "\(argument) is there")
            case "frame": element(argument).map { print("duo-frame \(argument) \($0.frame)") }
            case "wait": usleep(UInt32((Double(argument) ?? 1) * 1_000_000))
            case "selected": element(argument).map { XCTAssertTrue($0.isSelected, "\(argument) isn't selected") }
            case "unselected": element(argument).map { XCTAssertFalse($0.isSelected, "\(argument) is still selected") }
            case "type":
                let parts = argument.split(separator: " ", maxSplits: 1).map(String.init)
                guard let field = element(parts[0]) else { break }
                touch()
                field.tap()
                field.typeText(parts.count > 1 ? parts[1] : "")
            case "above-keyboard":
                let keyboard = app.keyboards.firstMatch
                XCTAssertTrue(keyboard.waitForExistence(timeout: 5), "the keyboard isn't up")
                guard let frame = element(argument)?.frame else { break }
                XCTAssertLessThanOrEqual(frame.maxY, keyboard.frame.minY, "\(argument) ends \(frame.maxY) under the keyboard's top \(keyboard.frame.minY)")
                XCTAssertGreaterThanOrEqual(frame.minY, app.windows.firstMatch.frame.minY, "\(argument) starts above the screen")
            case "swipe-down":
                element(argument).map { _ in touch() }
                element(argument)?.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.3))
                    .press(forDuration: 0.05, thenDragTo: app.windows.firstMatch.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.98)))
            case "no-keyboard":
                let keyboard = app.keyboards.firstMatch
                let gone = NSPredicate(format: "exists == false")
                let wait = XCTNSPredicateExpectation(predicate: gone, object: keyboard)
                if XCTWaiter().wait(for: [wait], timeout: 5) != .completed {
                    let focused = app.descendants(matching: .any).matching(NSPredicate(format: "hasKeyboardFocus == true")).firstMatch
                    XCTFail("\(argument.isEmpty ? "" : "\(argument): ")the keyboard is still up at \(keyboard.frame) in a \(app.windows.firstMatch.frame) window; focused: \(focused.exists ? focused.identifier : "nothing")")
                }
            case "mark": marked[argument] = element(argument)?.frame
            case "still":
                guard let was = marked[argument] else {
                    XCTFail("\(argument) wasn't marked")
                    break
                }
                guard let now = element(argument)?.frame else { break }
                XCTAssertEqual(now.minY, was.minY, accuracy: 1, "\(argument) moved from \(was) to \(now)")
                XCTAssertEqual(now.minX, was.minX, accuracy: 1, "\(argument) moved from \(was) to \(now)")
                XCTAssertEqual(now.width, was.width, accuracy: 1, "\(argument) resized from \(was) to \(now)")
                XCTAssertEqual(now.height, was.height, accuracy: 1, "\(argument) resized from \(was) to \(now)")
            default: XCTFail("unknown tap command: \(line)")
            }
        }
    }

    // Pages that have left stay in the tree off screen, and rows scrolled under a bar can't be
    // touched, so the first match that can be wins, then the first on screen. Which are on screen
    // comes from one snapshot of the tree, since a live list can change between reading a match's
    // place and touching it.
    private func element(_ query: String) -> XCUIElement? {
        let matches = app.descendants(matching: .any).matching(predicate(for: query))
        guard matches.firstMatch.waitForExistence(timeout: 10) else {
            XCTFail("nothing matches \(query), so its line was skipped")
            return nil
        }
        guard let tree = try? app.snapshot() else { return matches.firstMatch }
        let screen = app.windows.firstMatch.frame
        let onScreen = matching(query, in: tree).enumerated()
            .filter { screen.contains(CGPoint(x: $0.element.frame.midX, y: $0.element.frame.midY)) }
            .map { matches.element(boundBy: $0.offset) }
        return onScreen.prefix(4).first { $0.exists && $0.isHittable } ?? onScreen.first ?? matches.firstMatch
    }

    // The elements under a snapshot (itself excluded) that match the query, in the order a query finds them.
    private func matching(_ query: String, in tree: XCUIElementSnapshot) -> [XCUIElementSnapshot] {
        tree.children.flatMap { child in
            (child.identifier == query || child.label.contains(query) ? [child] : []) + matching(query, in: child)
        }
    }

    // With the keyboard up, XCUITest's own tap can land on the keyboard even for a view drawn wholly
    // above it (a thread's messages, on its side), so it taps the middle of what shows of the view
    // above the keyboard instead. Anything else, like a row scrolled off screen, XCUITest scrolls to.
    private func tap(_ element: XCUIElement, _ query: String) {
        let keyboard = app.keyboards.firstMatch
        let window = app.windows.firstMatch
        var shows = element.frame.intersection(window.frame)
        if keyboard.exists { shows.size.height = max(0, min(shows.height, keyboard.frame.minY - shows.minY)) }
        guard keyboard.exists, !shows.isEmpty else {
            touch()
            element.tap()
            return
        }
        print("duo-frame tapped \(query) at (\(shows.midX), \(shows.midY)) of \(element.frame), keyboard at \(keyboard.frame.minY)")
        touch()
        window.coordinate(withNormalizedOffset: .zero).withOffset(CGVector(dx: shows.midX, dy: shows.midY)).tap()
    }

    // Marks the moment a finger lands, so a filmed run knows where each move starts.
    private func touch() {
        print("duo-touch")
    }

    // The smallest list or scroll view under the element, or with rows the smallest row too.
    private func holder(_ inside: XCUIElement, rows: Bool) -> XCUIElement {
        let point = CGPoint(x: inside.frame.midX, y: inside.frame.midY)
        let around = (app.collectionViews.allElementsBoundByIndex + app.scrollViews.allElementsBoundByIndex
            + (rows ? app.cells.allElementsBoundByIndex : []))
            .filter { $0.frame.contains(point) }
        return around.min { $0.frame.width * $0.frame.height < $1.frame.width * $1.frame.height } ?? inside
    }

    private func predicate(for query: String) -> NSPredicate {
        NSPredicate(format: "identifier == %@ OR label CONTAINS %@", query, query)
    }
}
