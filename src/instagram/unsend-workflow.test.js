import { test } from "../../../test/setup.js"
import { createMessagesWrapperElement } from "../../../test/fake-ui.js"
import { UnsendWorkflow } from "./unsend-workflow.js"

test.beforeEach(t => {
	t.context.mountElement.append(createMessagesWrapperElement({ document: t.context.document, totalPages: 3, itemsPerPage: 5 }))
})

test("UnsendWorkflow run", async t => {
	const strategy = new UnsendWorkflow(() => {})
	await strategy.run(1)
	t.pass()
})

test("UnsendWorkflow clears stale ignore markers on run", async t => {
	// Add elements with data-idmu-ignore — they should be cleared when run() starts
	const el1 = t.context.document.createElement("div")
	el1.setAttribute("data-idmu-ignore", "")
	t.context.document.body.appendChild(el1)
	const el2 = t.context.document.createElement("div")
	el2.setAttribute("data-idmu-ignore", "")
	t.context.document.body.appendChild(el2)
	t.is(t.context.document.querySelectorAll("[data-idmu-ignore]").length, 2)
	const strategy = new UnsendWorkflow(() => {})
	await strategy.run()
	t.is(el1.hasAttribute("data-idmu-ignore"), false)
	t.is(el2.hasAttribute("data-idmu-ignore"), false)
})

test("getFirstVisibleMessage", async t => {
	const messageElement = createMessageElement({ document: t.context.document, text: "Test" })
	t.context.mountElement.append(messageElement)
	t.is(await getFirstVisibleMessage(t.context.document.body, new AbortController(), t.context.window), undefined)
})

test("getFirstVisibleMessage visible", async t => {
	const messageElement = createMessageElement({ document: t.context.document, text: "Test" })
	t.context.mountElement.append(messageElement)
	messageElement.getBoundingClientRect = () => ({ y: 105, height: 50 })
	t.is(await getFirstVisibleMessage(t.context.document.body, new AbortController(), t.context.window), messageElement)
})

test("getFirstVisibleMessage ignore if already processed", async t => {
	const messageElement = createMessageElement({ document: t.context.document, text: "Test", includesUnsend: true, ignored: true })
	t.context.mountElement.append(messageElement)
	t.is(await getFirstVisibleMessage(t.context.document.body, new AbortController(), t.context.window), undefined)
})

test("getFirstVisibleMessage ignore if sent by someone else", async t => {
	const messageElement = createMessageElement({ document: t.context.document, text: "Test", includesUnsend: false, ignored: true })
	t.context.mountElement.append(messageElement)
	messageElement.getBoundingClientRect = () => ({ y: 105, height: 50 })
	t.is(await getFirstVisibleMessage(t.context.document.body, new AbortController(), t.context.window), undefined)
})

test("getFirstVisibleMessage tall message partially visible", async t => {
	// Tall message with top edge above viewport (negative y) but bottom edge still visible
	const messageElement = createMessageElement({ document: t.context.document, text: "Long text" })
	t.context.mountElement.append(messageElement)
	messageElement.getBoundingClientRect = () => ({ y: -200, height: 500 })
	// Bottom edge = -200 + 500 = 300, which is > 0 so it should be found
	t.is(await getFirstVisibleMessage(t.context.document.body, new AbortController(), t.context.window), messageElement)
})

test("getFirstVisibleMessage skips fully offscreen message", async t => {
	// Message completely above viewport: bottom edge is negative
	const messageElement = createMessageElement({ document: t.context.document, text: "Offscreen" })
	t.context.mountElement.append(messageElement)
	messageElement.getBoundingClientRect = () => ({ y: -300, height: 50 })
	// Bottom edge = -300 + 50 = -250, which is < 0 so it should be skipped
	t.is(await getFirstVisibleMessage(t.context.document.body, new AbortController(), t.context.window), undefined)
})

test("findMessagesWrapper", t => {
	t.is(findMessagesWrapper(t.context.window), null)
	const messagesWrapperElement = createMessagesWrapperElement({ document: t.context.document })
	t.context.mountElement.append(messagesWrapperElement)
	t.not(findMessagesWrapper(t.context.window), null)
})

