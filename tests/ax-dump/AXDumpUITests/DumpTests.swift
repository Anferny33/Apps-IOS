import XCTest

final class DumpTests: XCTestCase {
    func testDump() throws {
        let env = ProcessInfo.processInfo.environment
        let safari = XCUIApplication(bundleIdentifier: "com.apple.mobilesafari")
        safari.activate()
        XCTAssertTrue(safari.wait(for: .runningForeground, timeout: 30))
        let settle = Double(env["AX_WAIT"] ?? "3") ?? 3
        Thread.sleep(forTimeInterval: settle)
        let taps = (env["AX_TAPS"] ?? "").split(separator: "|").map(String.init).filter { !$0.isEmpty }
        var log: [String] = []
        for label in taps {
            var done = false
            for attempt in 0..<12 {
                let q = safari.descendants(matching: .any).matching(NSPredicate(format: "label == %@", label))
                let all = q.allElementsBoundByIndex
                if let el = all.first(where: { $0.isHittable }) {
                    el.tap()
                    log.append("tapped '\(label)' after \(attempt) scrolls (\(all.count) matches)")
                    done = true
                    break
                }
                let from = safari.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.72))
                let to = safari.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.32))
                from.press(forDuration: 0.05, thenDragTo: to)
                Thread.sleep(forTimeInterval: 0.6)
            }
            if !done { log.append("NOT FOUND '\(label)'") }
            Thread.sleep(forTimeInterval: 1.5)
        }
        let text = log.joined(separator: "\n") + "\n" + safari.debugDescription
        let out = env["AX_OUT"] ?? "/tmp/axdump.txt"
        try text.write(toFile: out, atomically: true, encoding: .utf8)
        let a = XCTAttachment(string: text)
        a.lifetime = .keepAlways
        add(a)
    }
}
