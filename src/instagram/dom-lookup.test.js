import { test } from "../../../test/setup.js"
import { createMessageElement, createMessagesWrapperElement } from "../../../test/fake-ui.js"
import { findMessagesWrapper, getFirstVisibleMessage } from "./dom-lookup.js"

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

