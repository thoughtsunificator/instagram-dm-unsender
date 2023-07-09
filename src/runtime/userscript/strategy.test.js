import { test } from "../../../test/test.js"
import { createMessagesWrapperElement, createMessageElement } from "../../../test/virtual-instagram.js"
import { UnsendThreadMessagesBatchStrategy } from "./strategy.js"
import IDMU from "../../idmu/idmu.js"

test.beforeEach(t => {
	const pages = []
	for(let i =0; i < 2; i++) {
		pages.push({
			page: i,
			items: [
				createMessageElement(t.context.document, `Test1`, true),
				createMessageElement(t.context.document, `Test2`, true),
				createMessageElement(t.context.document, `Test3`, true),
				createMessageElement(t.context.document, `Ignore_me`, false)
			]
		})
	}
	t.context.mountElement.append(createMessagesWrapperElement(t.context.document, pages))
	t.context.unsends = []
	t.context.document.addEventListener("click", event => {
		if(event.target.id === "confirmUnsend") {
			t.context.unsends.push({ currentPage: event.target.currentPage, messageElement: event.target.parentNode.parentNode.messageElement.textContent })
		}
	})
	t.context.idmu = new IDMU(t.context.window)
})

test("UnsendThreadMessagesBatchStrategy unsuccessfulWorkflowAlert", async t => {
	t.context.window.FAKE_FAIL_UNSEND = true
	await new UnsendThreadMessagesBatchStrategy(t.context.idmu, (unsuccessfulWorkflows) => {
		console.log(unsuccessfulWorkflows)
		t.deepEqual(unsuccessfulWorkflows.map(uiMessage => uiMessage.uiComponent.root.textContent), [
			"Test1",
			"Test2",
			"Test3",
			"Test1",
			"Test2",
			"Test3",
		])
	}).run(2)
})

// test("UnsendThreadMessagesBatchStrategy unsuccessfulWorkflowAlert #2", async t => {
// 	const _unsuccessfulWorkflows = []
// 	await new UnsendThreadMessagesBatchStrategy(t.context.idmu, (unsuccessfulWorkflows) => {
// 		_unsuccessfulWorkflows.push(...unsuccessfulWorkflows)
// 	}).run(1)
// 	t.deepEqual(_unsuccessfulWorkflows.map(uiMessage => uiMessage.uiComponent.root.textContent), [  ])
// })

test("UnsendThreadMessagesBatchStrategy isRunning", t => {
	const strategy = new UnsendThreadMessagesBatchStrategy(t.context.idmu)
	t.is(strategy._running, false)
	t.is(strategy._stopped, false)
	t.is(strategy.isRunning(), false)
	strategy.run(1)
	t.is(strategy._running, true)
	t.is(strategy._stopped, false)
	t.is(strategy.isRunning(), true)
})

test("UnsendThreadMessagesBatchStrategy stop", t => {
	const strategy = new UnsendThreadMessagesBatchStrategy(t.context.idmu)
	t.is(strategy._running, false)
	t.is(strategy._stopped, false)
	t.is(strategy.isRunning(), false)
	strategy.run(1)
	strategy.stop()
	t.is(strategy._running, true)
	t.is(strategy._stopped, true)
	t.is(strategy.isRunning(), false)
})

