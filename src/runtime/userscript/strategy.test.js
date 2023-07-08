import { test } from "../../../test/test.js"
import { createMessagesWrapperElement, createMessageElement } from "../../../test/virtual-instagram.js"
import { UnsendThreadMessagesBatchStrategy } from "./strategy.js"
import IDMU from "../../idmu/idmu.js"
import findMessagesWrapperStrategy from "../../ui/strategy/find-messages-wrapper-strategy.js"

test.beforeEach(t => {
	t.context.pages = []
	const initialScrollTop = 500
	for(let i =0; i < 2; i++) {
		const scrollY = initialScrollTop + i + 1
		const page = {
			page: i,
			batchMessageElements: [],
			items: [],
			scrollY
		}
		for(let ii =0; ii < 2; ii++) {
			const messageElement = createMessageElement(t.context.document, `Test_${i}_${ii}`)
			messageElement.scrollIntoView = function() {}
			page.items.push(messageElement, createMessageElement(t.context.document, `Ignore_me`, false))
		}
		t.context.pages.push(page)
	}
	t.context.window.IDMU_SCROLL_DETECTION_TIMEOUT = 5
	t.context.window.IDMU_MESSAGE_QUEUE_DELAY = 0
	t.context.window.IDMU_NEXT_MESSAGE_PAGE_DELAY = 0
	t.context.window.IDMU_UNSUCESSFUL_WORKFLOW_ALERT_INTERVAL = 0
	t.context.document.mount.append(createMessagesWrapperElement(t.context.document))
	const messagesWrapperElement = findMessagesWrapperStrategy(t.context.window)
	Object.defineProperty(messagesWrapperElement, "scrollTop", {
		get() {
			return messagesWrapperElement._scrollTop
		},
		set(newValue) {
			messagesWrapperElement._scrollTop = newValue
			messagesWrapperElement.dispatchEvent(new t.context.window.Event("scroll"))
		}
	})
	let currentPage = 0
	t.context.unsends = []
	t.context.document.addEventListener("click", event => {
		if(event.target.id === "confirmUnsend") {
			t.context.unsends.push({ currentPage, messageElement: event.target.parentNode.parentNode.messageElement.textContent })
		}
	})
	messagesWrapperElement.scrollTop = initialScrollTop
	messagesWrapperElement.addEventListener("scroll", (event) => {
		if(event.target.scrollTop === 0) {
			const page = t.context.pages.find(page => page.page === currentPage)
			if(page) {
				event.target.scrollTop = initialScrollTop
				page.items.forEach(item => event.target.append(item))
				currentPage++
			}
		}
	})
	t.context.idmu = new IDMU(t.context.window)
})

// test("UnsendThreadMessagesBatchStrategy unsuccessfulWorkflowAlert", async t => {
// 	const _unsuccessfulWorkflows = []
// 	t.context.window.FAKE_FAIL_UNSEND = true
// 	await new UnsendThreadMessagesBatchStrategy(t.context.idmu, (unsuccessfulWorkflows) => {
// 		_unsuccessfulWorkflows.push(...unsuccessfulWorkflows)
// 	}).run(1)
// 	t.deepEqual(_unsuccessfulWorkflows.map(uiMessage => uiMessage.uiComponent.root.textContent), [ "Test_0_0", "Test_0_1", "Test_1_0", "Test_1_1" ])
// })

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

