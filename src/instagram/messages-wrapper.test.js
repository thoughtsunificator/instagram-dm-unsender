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
