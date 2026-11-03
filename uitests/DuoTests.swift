import XCTest

// Taps the installed hex app (scripts/duo tap installs the commit under test) the way he does on
// the Duo. Each step keeps a screenshot named for it, and the run keeps the accessibility tree.
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
        let back = app.buttons["Call"]
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
        let window = app.windows.firstMatch
        window.coordinate(withNormalizedOffset: CGVector(dx: 0.005, dy: 0.5))
            .press(forDuration: 0.05, thenDragTo: window.coordinate(withNormalizedOffset: CGVector(dx: 0.6, dy: 0.5)))
    }

    private func keep(_ step: String) {
        sleep(1)
        let shot = XCTAttachment(screenshot: app.screenshot())
        shot.name = step
        shot.lifetime = .keepAlways
        add(shot)
    }
}
