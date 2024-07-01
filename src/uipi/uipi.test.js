import { test } from "../../test/setup.js"
import DefaultUI from "../ui/default/default-ui.js"
import { createMessageElement, createMessagesWrapperElement } from "../../test/fake-ui.js"
import UIPIMessage from "./uipi-message.js"
import UIMessage from "../ui/default/ui-message.js"
import UIPI from "./uipi.js"
import { findMessagesWrapper } from "../ui/default/dom-lookup.js"

test("UIPI", t => {
	const ui = new DefaultUI(t.context.window)
	const uipi = new UIPI(ui)
	t.is(uipi.ui, ui)
})

test("UIPI create", t => {
	const messagesWrapperElement = createMessagesWrapperElement(t.context.document)
	t.context.mountElement.append(messagesWrapperElement)
	const uipi = UIPI.create(t.context.window)
	t.true(uipi instanceof UIPI)
	t.true(uipi.ui instanceof DefaultUI)
	t.is(uipi.ui.identifier.uiMessagesWrapper.root, findMessagesWrapper(t.context.window))
})

test("UIPI fetchAndRenderThreadNextMessagePage", async t => {
	t.context.mountElement.append(createMessagesWrapperElement(t.context.document))
	const messagesWrapperElement = findMessagesWrapper(t.context.window)
	const uipi = UIPI.create(t.context.window)
	messagesWrapperElement.innerHTML += `<div role="progressbar"></div>`
	const result = uipi.fetchAndRenderThreadNextMessagePage( new AbortController())
	messagesWrapperElement.querySelector("[role=progressbar]").remove()
	t.is(await result, true)
})

test("UIPI getNextUIPIMessage", async t => {
	const messageElement = createMessageElement(t.context.document, "Test")
	const uiMessage = new UIMessage(messageElement)
	const messagesWrapperElement = createMessagesWrapperElement(t.context.document)
	t.context.mountElement.append(messagesWrapperElement)
	const uipi = UIPI.create(t.context.window)
	uipi.ui.identifier.uiMessagesWrapper.root.appendChild(messageElement)
	const uiMessages = await uipi.getNextUIPIMessage()
	t.deepEqual(uiMessages, [new UIPIMessage(uiMessage)])
})

test("UIPI getNextUIPIMessage multiple", async t => {
	const messagesWrapperElement = createMessagesWrapperElement(t.context.document)
	t.context.mountElement.append(messagesWrapperElement)
	const uipi = UIPI.create(t.context.window)
	uipi.ui.identifier.uiMessagesWrapper.root.appendChild(createMessageElement(t.context.document, "Test"))
	uipi.ui.identifier.uiMessagesWrapper.root.appendChild(createMessageElement(t.context.document, "Ignore_me", false))
	uipi.ui.identifier.uiMessagesWrapper.root.appendChild(createMessageElement(t.context.document, "Test1"))
	uipi.ui.identifier.uiMessagesWrapper.root.appendChild(createMessageElement(t.context.document, "Ignore_me", false))
	uipi.ui.identifier.uiMessagesWrapper.root.appendChild(createMessageElement(t.context.document, "Ignore_me", false))
	uipi.ui.identifier.uiMessagesWrapper.root.appendChild(createMessageElement(t.context.document, "Test2"))
	t.deepEqual((await uipi.getNextUIPIMessage()).map(uipiMessage => uipiMessage.uiMessage.root.textContent), ["Test", "Test1", "Test2"])
	t.deepEqual((await uipi.getNextUIPIMessage()).map(uipiMessage => uipiMessage.uiMessage.root.textContent), ["Test", "Test1", "Test2"])
})
