import { test } from "../../../test/setup.js"
import { createMessagesWrapperElement, createMessageElement } from "../../../test/fake-ui.js"
import { BatchUnsendStrategy } from "./unsend-strategy.js"
import IDMU from "../../idmu/idmu.js"
import { findMessagesWrapper } from "../../ui/default/dom-lookup.js"

test.beforeEach(t => {
	t.context.mountElement.append(createMessagesWrapperElement(t.context.document, 3, 5))
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

test("BatchUnsendStrategy", async t => {
	let unsuccessfulWorkflowsCount = 0
	const onUnsuccessfulWorkflows = () => {
		unsuccessfulWorkflowsCount++
	}
	findMessagesWrapper(t.context.window).append(...[
		createMessageElement(t.context.document, "Test", false),
		createMessageElement(t.context.document, "Testdsadsadsac"),
		createMessageElement(t.context.document, "Test", false),
		createMessageElement(t.context.document, "xzcxzdsadsadsa"),
		createMessageElement(t.context.document, "Test", false),
		createMessageElement(t.context.document, "32132xzcxzdsadsadsa"),
	])
	const strategy = new BatchUnsendStrategy(t.context.idmu, onUnsuccessfulWorkflows)
	await strategy.run(1)
	t.is(unsuccessfulWorkflowsCount, 0)
})



