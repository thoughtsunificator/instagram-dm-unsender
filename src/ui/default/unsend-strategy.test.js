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



