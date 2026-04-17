import { test } from "../../../test/setup.js"
import { createMessageElement, createMessagesWrapperElement } from "../../../test/fake-ui.js"
import { findMessagesWrapper, loadMoreMessages, getFirstVisibleMessage, getMessagesInnerContainer, isSentByCurrentUser, findScrollableChild } from "./dom-lookup.js"

test("getFirstVisibleMessage", async t => {
	const messageElement = createMessageElement(t.context.document, "Test")
	t.context.mountElement.append(messageElement)
	t.is(await getFirstVisibleMessage(t.context.document.body, new AbortController(), t.context.window), undefined)
})

test("getFirstVisibleMessage visible", async t => {
	const messageElement = createMessageElement(t.context.document, "Test")
	t.context.mountElement.append(messageElement)
	messageElement.getBoundingClientRect = () => ({ y: 105, height: 50 })
	t.is(await getFirstVisibleMessage(t.context.document.body, new AbortController(), t.context.window), messageElement)
})

test("getFirstVisibleMessage ignore if already processed", async t => {
	const messageElement = createMessageElement(t.context.document, "Test", true, true)
	t.context.mountElement.append(messageElement)
	t.is(await getFirstVisibleMessage(t.context.document.body, new AbortController(), t.context.window), undefined)
})

test("getFirstVisibleMessage ignore if sent by someone else", async t => {
	const messageElement = createMessageElement(t.context.document, "Test", false, true)
	t.context.mountElement.append(messageElement)
	messageElement.getBoundingClientRect = () => ({ y: 105, height: 50 })
	t.is(await getFirstVisibleMessage(t.context.document.body, new AbortController(), t.context.window), undefined)
})

test("getFirstVisibleMessage tall message partially visible", async t => {
	// Tall message with top edge above viewport (negative y) but bottom edge still visible
	const messageElement = createMessageElement(t.context.document, "Long text")
	t.context.mountElement.append(messageElement)
	messageElement.getBoundingClientRect = () => ({ y: -200, height: 500 })
	// Bottom edge = -200 + 500 = 300, which is > 0 so it should be found
	t.is(await getFirstVisibleMessage(t.context.document.body, new AbortController(), t.context.window), messageElement)
})

test("getFirstVisibleMessage skips fully offscreen message", async t => {
	// Message completely above viewport: bottom edge is negative
	const messageElement = createMessageElement(t.context.document, "Offscreen")
	t.context.mountElement.append(messageElement)
	messageElement.getBoundingClientRect = () => ({ y: -300, height: 50 })
	// Bottom edge = -300 + 50 = -250, which is < 0 so it should be skipped
	t.is(await getFirstVisibleMessage(t.context.document.body, new AbortController(), t.context.window), undefined)
})

test("findMessagesWrapper", t => {
	const messagesWrapperElement = createMessagesWrapperElement(t.context.document)
	t.context.mountElement.append(messagesWrapperElement)
	t.not(findMessagesWrapper(t.context.window), null)
})

test("findMessagesWrapper returns null without conversation", t => {
	// No aria-label="Conversation..." element present
	t.is(findMessagesWrapper(t.context.window), null)
})

test("isSentByCurrentUser detects flex-end", t => {
	const element = t.context.document.createElement("div")
	element.innerHTML = `<div role="none" style="justify-content: flex-end"><span>Test</span></div>`
	t.context.mountElement.append(element)
	t.true(isSentByCurrentUser(element, t.context.window))
})

test("isSentByCurrentUser rejects non-flex-end", t => {
	const element = t.context.document.createElement("div")
	element.innerHTML = `<div role="none"><span>Test</span></div>`
	t.context.mountElement.append(element)
	t.false(isSentByCurrentUser(element, t.context.window))
})

test("getMessagesInnerContainer finds deepest container with most children", t => {
	const root = t.context.document.createElement("div")
	// Nested structure: root > wrapper > innerContainer (has most children)
	const wrapper = t.context.document.createElement("div")
	const inner = t.context.document.createElement("div")
	for (let i = 0; i < 5; i++) {
		inner.appendChild(t.context.document.createElement("div"))
	}
	wrapper.appendChild(inner)
	root.appendChild(wrapper)
	t.context.mountElement.append(root)
	t.is(getMessagesInnerContainer(root), inner)
})

test("getMessagesInnerContainer returns root when no deeper container", t => {
	const root = t.context.document.createElement("div")
	t.context.mountElement.append(root)
	t.is(getMessagesInnerContainer(root), root)
})

test("findScrollableChild finds scrollable element", t => {
	const parent = t.context.document.createElement("div")
	const child = t.context.document.createElement("div")
	child.style.overflowY = "auto"
	Object.defineProperty(child, "scrollHeight", { value: 1000, configurable: true })
	Object.defineProperty(child, "clientHeight", { value: 500, configurable: true })
	parent.appendChild(child)
	t.context.mountElement.append(parent)
	t.is(findScrollableChild(parent, t.context.window), child)
})

test("findScrollableChild returns null when no scrollable", t => {
	const parent = t.context.document.createElement("div")
	const child = t.context.document.createElement("div")
	parent.appendChild(child)
	t.context.mountElement.append(parent)
	t.is(findScrollableChild(parent, t.context.window), null)
})

test("loadMoreMessages done", async t => {
	t.context.mountElement.append(createMessagesWrapperElement(t.context.document))
	const messagesWrapperElement = findMessagesWrapper(t.context.window)
	messagesWrapperElement.innerHTML += `<div role="progressbar"></div>` // FIXME subject to change
	const result = loadMoreMessages(messagesWrapperElement,  new AbortController())
	messagesWrapperElement.querySelector("[role=progressbar]").remove()
	t.is(await result, true)
})

test("loadMoreMessages not done", async t => {
	t.context.mountElement.append(createMessagesWrapperElement(t.context.document, 2, 3))
	const messagesWrapperElement = findMessagesWrapper(t.context.window)
	// Ensure there is content that extends beyond the viewport
	Object.defineProperty(messagesWrapperElement, "scrollHeight", { value: 2000, writable: true, configurable: true })
	Object.defineProperty(messagesWrapperElement, "clientHeight", { value: 500, writable: true, configurable: true })
	// Start from a non-zero scroll position (not at top)
	messagesWrapperElement._scrollTop = 500
	const result = loadMoreMessages(messagesWrapperElement, new AbortController())
	// Simulate: after scroll to 0, progressbar appears and is removed, but scrollTop stays non-zero
	messagesWrapperElement._scrollTop = 100
	t.is(await result, false)
})

test("loadMoreMessages short chat fits viewport", async t => {
	t.context.mountElement.append(createMessagesWrapperElement(t.context.document))
	const messagesWrapperElement = findMessagesWrapper(t.context.window)
	// Make scrollHeight equal to clientHeight (everything fits)
	Object.defineProperty(messagesWrapperElement, "scrollHeight", { value: 500, writable: true, configurable: true })
	Object.defineProperty(messagesWrapperElement, "clientHeight", { value: 500, writable: true, configurable: true })
	messagesWrapperElement._scrollTop = 0
	const result = await loadMoreMessages(messagesWrapperElement, new AbortController())
	t.is(result, true)
})
