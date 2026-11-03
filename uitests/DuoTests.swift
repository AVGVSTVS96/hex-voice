import XCTest

// Plays a tap script (scripts/duo-taps by default, or the file scripts/duo tap is given) on the
// installed hex app, one command a line:
//   launch <url>          starts the app afresh from a link
//   open <url>            opens a link in the running app
//   tap <query>           taps the element whose id is the query, or whose label holds it
//   tap-at <x> <y>        taps that point of the window
//   swipe-back <query>    drags from that element across the screen, the way an edge swipe goes
//   scroll <query>        swipes up on that element, so its rows run under the bars
//   shoot <name>          holds still while scripts/duo screenshots the screen as <name>
//   snap <name>           has it screenshot right away and goes on, to catch what moves
//   wait <seconds>        waits
//   pose <pose>           has scripts/duo turn or fold the Duo there, without relaunching the app
//   frame <query>         notes where accessibility puts that element
//   selected <query>      checks the element is selected; unselected checks it isn't
//   type <query> <text>   taps the element and types the text on the software keyboard
//   above-keyboard <query> checks the keyboard is up and the element shows whole above it
//   mark <query>          remembers the element's frame; still <query> checks it hasn't moved or resized
//   swipe-down <query>    drags from the element down to the screen's foot, the way you pull a keyboard away
//   no-keyboard           checks the keyboard has gone
// The accessibility tree at the end is kept beside the shots.
final class DuoTests: XCTestCase {
    let app = XCUIApplication(bundleIdentifier: "com.shahidy.hexvoice")
    var marked: [String: CGRect] = [:]

    override func setUp() {
        continueAfterFailure = true
        app.terminate()
        app.launch()
    }

    override func tearDown() {
        let tree = XCTAttachment(string: app.debugDescription)
        tree.name = "tree"
        tree.lifetime = .keepAlways
        add(tree)
    }

    func testScript() throws {
        let script = try XCTUnwrap(ProcessInfo.processInfo.environment["DUO_TAPS"], "no tap script")
        for line in script.split(separator: "\n") {
            let words = line.split(separator: " ", maxSplits: 1).map(String.init)
            guard let command = words.first, !command.hasPrefix("#") else { continue }
            let argument = words.count > 1 ? words[1] : ""
            switch command {
            case "launch":
                app.terminate()
                XCUIDevice.shared.system.open(try XCTUnwrap(URL(string: argument)))
                XCTAssertTrue(app.wait(for: .runningForeground, timeout: 20), "\(argument) didn't open the app")
            case "open": app.open(try XCTUnwrap(URL(string: argument)))
            case "tap": element(argument).tap()
            case "tap-at":
                let point = argument.split(separator: " ").compactMap { Double($0) }
                app.windows.firstMatch.coordinate(withNormalizedOffset: .zero)
                    .withOffset(CGVector(dx: point[0], dy: point[1])).tap()
            case "swipe-back":
                element(argument).coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
                    .press(forDuration: 0.05, thenDragTo: app.windows.firstMatch.coordinate(withNormalizedOffset: CGVector(dx: 0.6, dy: 0.5)))
            case "scroll": element(argument).swipeUp()
            case "shoot", "pose":
                sleep(1)
                print("duo-\(command == "shoot" ? "step" : "pose") \(argument)")
                sleep(command == "shoot" ? 3 : 5)
            case "snap": print("duo-step \(argument)")
            case "frame": print("duo-frame \(argument) \(element(argument).frame)")
            case "wait": usleep(UInt32((Double(argument) ?? 1) * 1_000_000))
            case "selected": XCTAssertTrue(element(argument).isSelected, "\(argument) isn't selected")
            case "unselected": XCTAssertFalse(element(argument).isSelected, "\(argument) is still selected")
            case "type":
                let parts = argument.split(separator: " ", maxSplits: 1).map(String.init)
                let field = element(parts[0])
                field.tap()
                field.typeText(parts.count > 1 ? parts[1] : "")
            case "above-keyboard":
                let keyboard = app.keyboards.firstMatch
                XCTAssertTrue(keyboard.waitForExistence(timeout: 5), "the keyboard isn't up")
                let frame = element(argument).frame
                XCTAssertLessThanOrEqual(frame.maxY, keyboard.frame.minY, "\(argument) ends \(frame.maxY) under the keyboard's top \(keyboard.frame.minY)")
                XCTAssertGreaterThanOrEqual(frame.minY, app.windows.firstMatch.frame.minY, "\(argument) starts above the screen")
            case "swipe-down":
                element(argument).coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.3))
                    .press(forDuration: 0.05, thenDragTo: app.windows.firstMatch.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.98)))
            case "no-keyboard":
                let gone = NSPredicate(format: "exists == false")
                let wait = XCTNSPredicateExpectation(predicate: gone, object: app.keyboards.firstMatch)
                XCTAssertEqual(XCTWaiter().wait(for: [wait], timeout: 5), .completed, "the keyboard is still up")
            case "mark": marked[argument] = element(argument).frame
            case "still":
                let was = try XCTUnwrap(marked[argument], "\(argument) wasn't marked")
                let now = element(argument).frame
                XCTAssertEqual(now.minY, was.minY, accuracy: 1, "\(argument) moved from \(was) to \(now)")
                XCTAssertEqual(now.minX, was.minX, accuracy: 1, "\(argument) moved from \(was) to \(now)")
                XCTAssertEqual(now.width, was.width, accuracy: 1, "\(argument) resized from \(was) to \(now)")
                XCTAssertEqual(now.height, was.height, accuracy: 1, "\(argument) resized from \(was) to \(now)")
            default: XCTFail("unknown tap command: \(line)")
            }
        }
    }

    // Pages that have left stay in the tree off screen, so the first match on screen wins.
    private func element(_ query: String) -> XCUIElement {
        let matches = app.descendants(matching: .any)
            .matching(NSPredicate(format: "identifier == %@ OR label CONTAINS %@", query, query))
        XCTAssertTrue(matches.firstMatch.waitForExistence(timeout: 10), "nothing matches \(query)")
        let screen = app.windows.firstMatch.frame
        return matches.allElementsBoundByIndex.first { screen.contains(CGPoint(x: $0.frame.midX, y: $0.frame.midY)) }
            ?? matches.firstMatch
    }
}
