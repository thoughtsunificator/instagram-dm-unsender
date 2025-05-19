import { test } from "../../../test/setup.js"
import { createMessageElement, createMessagesWrapperElement } from "../../../test/fake-ui.js"
import { findMessagesWrapper, loadMoreMessages, getFirstVisibleMessage } from "./dom-lookup.js"

test("getFirstVisibleMessage", async t => {
	const messageElement = createMessageElement(t.context.document, "Test")
	t.context.mountElement.append(messageElement)
	t.is(await getFirstVisibleMessage(t.context.document.body, new AbortController()), undefined)
})

test("getFirstVisibleMessage visible", async t => {
	const messageElement = createMessageElement(t.context.document, "Test")
	t.context.mountElement.append(messageElement)
	messageElement.getBoundingClientRect = () => ({ y: 105 })
	t.is(await getFirstVisibleMessage(t.context.document.body, new AbortController()), messageElement)
})

test("getFirstVisibleMessage ignore if already processed", async t => {
	const messageElement = createMessageElement(t.context.document, "Test", true, true)
	t.context.mountElement.append(messageElement)
	t.is(await getFirstVisibleMessage(t.context.document.body, new AbortController()), undefined)
})

test("getFirstVisibleMessage ignore if sent by someone else", async t => {
	const messageElement = createMessageElement(t.context.document, "Test", false, true)
	t.context.mountElement.append(messageElement)
	messageElement.getBoundingClientRect = () => ({ y: 105 })
	t.is(await getFirstVisibleMessage(t.context.document.body, new AbortController()), undefined)
})

test("findMessagesWrapper", t => {
	const messagesWrapperElement = createMessagesWrapperElement(t.context.document)
	t.context.mountElement.append(messagesWrapperElement)
	t.not(findMessagesWrapper(t.context.window), null)
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
	t.context.mountElement.append(createMessagesWrapperElement(t.context.document))
	const messagesWrapperElement = findMessagesWrapper(t.context.window)
	messagesWrapperElement.innerHTML += `<div role="progressbar"></div>`  // FIXME subject to change
	const result = loadMoreMessages(messagesWrapperElement, new AbortController())
	messagesWrapperElement.scrollTop = 1
	messagesWrapperElement.querySelector("[role=progressbar]").remove()  // FIXME subject to change
	t.is(await result, false)
})
