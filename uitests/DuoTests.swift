import XCTest

// Taps the installed hex app (scripts/duo tap installs the commit under test) the way he does on
// the Duo. scripts/duo screenshots each step, and the run keeps the accessibility tree.
final class DuoTests: XCTestCase {
    let app = XCUIApplication(bundleIdentifier: "com.shahidy.hexvoice")

    override func setUp() {
        continueAfterFailure = true
        app.terminate()
        app.launch()
    }

    override func tearDown() {
        keepTree("tree")
    }

    func testTasksOpensAndEveryWayBackCloses() {
        let tasks = app.buttons["tasks-button"]
        XCTAssertTrue(tasks.waitForExistence(timeout: 20), "no Tasks button")
        keep("call")

        tasks.tap()
        keep("tasks-open")
        XCTAssertTrue(tasks.isSelected, "Tasks isn't lit after opening it")
        tasks.tap()
        keep("closed-by-tasks")
        XCTAssertFalse(tasks.isSelected, "Tasks stayed open after tapping Tasks")

        tasks.tap()
        let back = app.buttons["task-back"]
        XCTAssertTrue(back.waitForExistence(timeout: 5), "no ‹ Call back on Tasks' list")
        back.tap()
        keep("closed-by-back")
        XCTAssertFalse(tasks.isSelected, "Tasks stayed open after ‹ Call")

        tasks.tap()
        swipeInFromLeadingEdge()
        keep("closed-by-edge-swipe")
        XCTAssertFalse(tasks.isSelected, "Tasks stayed open after the edge swipe")
    }

    private func swipeInFromLeadingEdge() {
        let edge = app.otherElements["tasks-edge"]
        XCTAssertTrue(edge.waitForExistence(timeout: 5), "no edge to swipe back from")
        edge.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
            .press(forDuration: 0.05, thenDragTo: app.windows.firstMatch.coordinate(withNormalizedOffset: CGVector(dx: 0.6, dy: 0.5)))
    }

    private func keepTree(_ name: String) {
        let tree = XCTAttachment(string: app.debugDescription)
        tree.name = name
        tree.lifetime = .keepAlways
        add(tree)
    }

    // XCUITest can't capture the Duo's open screen, so scripts/duo shoots the display when it
    // reads the step, while the test holds still.
    private func keep(_ step: String) {
        sleep(1)
        print("duo-step \(step)")
        sleep(3)
    }
}
