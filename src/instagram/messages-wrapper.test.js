import { test } from "../../../test/setup.js"
import { UIMessagesWrapper } from "./ui-messages-wrapper.js"
import { createMessagesWrapperElement } from "../../../test/fake-ui.js"
import { findMessagesWrapper } from "./dom-lookup.js"

test("UIMessagesWrapper", t => {
	const messagesWrapperElement = createMessagesWrapperElement({ document: t.context.document })
	const uiMessagesWrapper = new UIMessagesWrapper(messagesWrapperElement)
	t.context.mountElement.append(uiMessagesWrapper.root)
	t.deepEqual(uiMessagesWrapper.root, messagesWrapperElement)
})

test("UIMessagesWrapper loadMessages", async t => {
	t.context.mountElement.append(createMessagesWrapperElement({ document: t.context.document }))
	const messagesWrapperElement = findMessagesWrapper(t.context.window)
	const uiMessagesWrapper = new UIMessagesWrapper(messagesWrapperElement)
	messagesWrapperElement.innerHTML += `<div role="progressbar"></div>`
	// TODO replace with mock
	const result = uiMessagesWrapper.loadMessages(new AbortController())
	messagesWrapperElement.querySelector("[role=progressbar]").remove()
	t.is(await result, true)
})

test("UIMessagesWrapper loadMessages done", async t => {
	t.context.mountElement.append(createMessagesWrapperElement({ document: t.context.document }))
	const messagesWrapperElement = findMessagesWrapper(t.context.window)
	const uiMessagesWrapper = new UIMessagesWrapper(messagesWrapperElement)
	messagesWrapperElement.innerHTML += `<div role="progressbar"></div>`
	// TODO replace with mock
	const result = uiMessagesWrapper.loadMessages(new AbortController())
	t.is(await result, true)
})

test("UIMessagesWrapper loadMessages stop when there are not more messages", async t => {
	t.context.mountElement.append(createMessagesWrapperElement({ document: t.context.document, totalPages: 2, itemsPerPage: 3 }))
	const messagesWrapperElement = findMessagesWrapper(t.context.window)
	const uiMessagesWrapper = new UIMessagesWrapper(messagesWrapperElement)
	// Ensure there is content that extends beyond the viewport
	Object.defineProperty(messagesWrapperElement, "scrollHeight", { value: 2000, writable: true, configurable: true })
	Object.defineProperty(messagesWrapperElement, "clientHeight", { value: 500, writable: true, configurable: true })
	// Start from a non-zero scroll position (not at top)
	messagesWrapperElement._scrollTop = 500
	const result = uiMessagesWrapper.loadMessages(new AbortController())
	// Simulate: after scroll to 0, progressbar appears and is removed, but scrollTop stays non-zero
	messagesWrapperElement._scrollTop = 100
	t.is(await result, false) // TODO this should not fail
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
