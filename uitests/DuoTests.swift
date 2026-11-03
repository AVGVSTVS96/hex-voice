import XCTest

// Plays a tap script (scripts/duo-taps by default, or the file scripts/duo tap is given) on the
// installed hex app, one command a line:
//   open <url>            opens a link in the app
//   tap <query>           taps the element whose id is the query, or whose label holds it
//   swipe-back <query>    drags from that element across the screen, the way an edge swipe goes
//   shoot <name>          holds still while scripts/duo screenshots the screen as <name>
//   pose <pose>           has scripts/duo turn or fold the Duo there, without relaunching the app
//   selected <query>      checks the element is selected; unselected checks it isn't
// The accessibility tree at the end is kept beside the shots.
final class DuoTests: XCTestCase {
    let app = XCUIApplication(bundleIdentifier: "com.shahidy.hexvoice")

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
            case "open": app.open(try XCTUnwrap(URL(string: argument)))
            case "tap": element(argument).tap()
            case "swipe-back":
                element(argument).coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
                    .press(forDuration: 0.05, thenDragTo: app.windows.firstMatch.coordinate(withNormalizedOffset: CGVector(dx: 0.6, dy: 0.5)))
            case "shoot", "pose":
                sleep(1)
                print("duo-\(command == "shoot" ? "step" : "pose") \(argument)")
                sleep(command == "shoot" ? 3 : 5)
            case "selected": XCTAssertTrue(element(argument).isSelected, "\(argument) isn't selected")
            case "unselected": XCTAssertFalse(element(argument).isSelected, "\(argument) is still selected")
            default: XCTFail("unknown tap command: \(line)")
            }
        }
    }

    private func element(_ query: String) -> XCUIElement {
        let match = app.descendants(matching: .any)
            .matching(NSPredicate(format: "identifier == %@ OR label CONTAINS %@", query, query)).firstMatch
        XCTAssertTrue(match.waitForExistence(timeout: 10), "nothing matches \(query)")
        return match
    }
}
