import { test } from "../../../test/setup.js"
import { createMessagesWrapperElement } from "../../../test/fake-ui.js"
import { DefaultStrategy } from "./unsend-strategy.js"
import IDMU from "../../idmu/idmu.js"

test.beforeEach(t => {
	t.context.mountElement.append(createMessagesWrapperElement(t.context.document, 3, 5))
	t.context.idmu = new IDMU(t.context.window, () => {})
	t.context.idmu.loadUIPI()
})

test("DefaultStrategy isRunning", t => {
	const strategy = new DefaultStrategy(t.context.idmu)
	t.is(strategy._running, false)
	t.is(strategy.isRunning(), false)
	strategy.run(1)
	t.is(strategy._running, true)
	t.is(strategy.isRunning(), true)
})

test("DefaultStrategy stop", t => {
	const strategy = new DefaultStrategy(t.context.idmu)
	t.is(strategy._running, false)
	t.is(strategy.isRunning(), false)
	strategy.run(1)
	strategy.stop()
	t.is(strategy._running, true)
	t.is(strategy.isRunning(), false)
})

test("DefaultStrategy", async t => {
	const strategy = new DefaultStrategy(t.context.idmu)
	await strategy.run(1)
	t.pass()
})

test("DefaultStrategy reset", t => {
	const strategy = new DefaultStrategy(t.context.idmu)
	// Simulate some state
	strategy._allPagesLoaded = true
	strategy._unsentCount = 5
	strategy._lastUnsendDate = new Date()
	strategy._pagesLoadedCount = 3
	strategy._consecutiveFailures = 2
	strategy.reset()
	t.is(strategy._allPagesLoaded, false)
	t.is(strategy._unsentCount, 0)
	t.is(strategy._lastUnsendDate, null)
	t.is(strategy._pagesLoadedCount, 0)
	t.is(strategy._consecutiveFailures, 0)
})

test("DefaultStrategy clears stale ignore markers on run", async t => {
	// Add elements with data-idmu-ignore — they should be cleared when run() starts
	const el1 = t.context.document.createElement("div")
	el1.setAttribute("data-idmu-ignore", "")
	t.context.document.body.appendChild(el1)
	const el2 = t.context.document.createElement("div")
	el2.setAttribute("data-idmu-ignore", "")
	t.context.document.body.appendChild(el2)
	t.is(t.context.document.querySelectorAll("[data-idmu-ignore]").length, 2)

	const strategy = new DefaultStrategy(t.context.idmu)
	await strategy.run()
	t.is(el1.hasAttribute("data-idmu-ignore"), false)
	t.is(el2.hasAttribute("data-idmu-ignore"), false)
})

test("DefaultStrategy constructor initializes all fields", t => {
	const strategy = new DefaultStrategy(t.context.idmu)
	t.is(strategy._allPagesLoaded, false)
	t.is(strategy._unsentCount, 0)
	t.is(strategy._pagesLoadedCount, 0)
	t.is(strategy._running, false)
	t.is(strategy._abortController, null)
	t.is(strategy._lastUnsendDate, null)
	t.is(strategy._consecutiveFailures, 0)
	t.is(strategy.idmu, t.context.idmu)
})
