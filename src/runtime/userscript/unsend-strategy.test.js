import { test } from "../../../test/test.js"
import { createMessagesWrapperElement } from "../../../test/default-ui.js"
import { BatchUnsendStrategy } from "./unsend-strategy.js"
import IDMU from "../../idmu/idmu.js"

test.beforeEach(t => {
	t.context.mountElement.append(createMessagesWrapperElement(t.context.document))
	t.context.idmu = new IDMU(t.context.window)
})

test("BatchUnsendStrategy isRunning", t => {
	const strategy = new BatchUnsendStrategy(t.context.idmu)
	t.is(strategy._running, false)
	t.is(strategy._stopped, false)
	t.is(strategy.isRunning(), false)
	strategy.run(1)
	t.is(strategy._running, true)
	t.is(strategy._stopped, false)
	t.is(strategy.isRunning(), true)
})

test("BatchUnsendStrategy stop", t => {
	const strategy = new BatchUnsendStrategy(t.context.idmu)
	t.is(strategy._running, false)
	t.is(strategy._stopped, false)
	t.is(strategy.isRunning(), false)
	strategy.run(1)
	strategy.stop()
	t.is(strategy._running, true)
	t.is(strategy._stopped, true)
	t.is(strategy.isRunning(), false)
})

