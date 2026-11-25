import { test } from "../../test/setup.js"
import { createMessagesWrapperElement, createMessageElement } from "../../test/fake-ui.js"
import { Thread } from "../instagram/thread.js"
import { MessagesWrapper } from "../instagram/messages-wrapper.js"
import { UnsendWorkflow } from "./unsend-workflow.js"
import { LoadMessages } from "./load-messages.js"

const FAST = { minDelayMs: 0, maxDelayMs: 0, rescanAttempts: 0, failureBackoffMs: 0, rateLimitBackoffMs: 0, rescanDelayMs: 0 }

function visible(element) {
	element.getBoundingClientRect = () => ({ x: 0, y: 105, width: 300, height: 50 })
	return element
}

/**
 * @param {object}  t
 * @param {boolean} [sent=true] - false creates messages without the unsend entry, so every unsend fails
 * @param {number}  [count=2]
 */
function createThread(t, { sent = true, count = 2 } = {}) {
	const element = createMessagesWrapperElement({ document: t.context.document, totalPages: 0, itemsPerPage: 0 })
	t.context.mountElement.append(element)
	const root = element.querySelector("#messageWrapper")
	for(let index = 0; index < count; index++) {
		root.append(visible(createMessageElement({ document: t.context.document, text: `Item ${index}`, includesUnsend: sent })))
	}
	return { thread: new Thread(new MessagesWrapper(root)), root }
}

test("UnsendWorkflow unsends every message of the conversation", async t => {
	const { thread, root } = createThread(t)
	const result = await new UnsendWorkflow(thread, FAST).run()
	t.deepEqual(result, { outcome: "done", unsent: 2, failures: 0 })
	t.is(root.children.length, 0)
})

test("UnsendWorkflow clears stale ignore markers when it starts", async t => {
	const { thread, root } = createThread(t)
	for(const child of root.children) {
		child.setAttribute("data-idmu-ignore", "")
	}
	await new UnsendWorkflow(thread, FAST).run()
	t.is(root.children.length, 0)
})

test("UnsendWorkflow stops after too many consecutive failures", async t => {
	const { thread, root } = createThread(t, { count: 0 })
	for(let index = 0; index < 3; index++) {
		// Sent by us, but the row never shows its action button: every unsend fails
		const row = t.context.document.createElement("div")
		row.innerHTML = "<div role=\"none\" style=\"justify-content: flex-end\"><span>Failing</span></div>"
		root.append(visible(row))
	}
	const workflow = new UnsendWorkflow(thread, { ...FAST, maxConsecutiveFailures: 2 })
	const statuses = []
	workflow.on("status", text => statuses.push(text))
	const result = await workflow.run()
	t.is(result.unsent, 0)
	t.is(result.failures, 2)
	t.true(statuses.some(text => text.startsWith("Stopped: 2 consecutive failures")))
})

test("UnsendWorkflow stop aborts the run", async t => {
	const { thread } = createThread(t)
	const workflow = new UnsendWorkflow(thread, FAST)
	workflow.stop()
	const result = await workflow.run()
	t.is(result.outcome, "aborted")
	t.is(result.unsent, 0)
})

test("LoadMessages returns the number of pages loaded", async t => {
	const { thread } = createThread(t)
	t.is(await new LoadMessages(thread.messagesWrapper).run(), 0)
})
