import { test } from "./test.js"
import UI from "../src/ui/ui.js"
import { createMessageElement, createMessagesWrapperElement } from "./virtual-instagram.js"
import UIPIMessage from "../src/uipi/uipi-message.js"
import UIMessage from "../src/ui/ui-message.js"
import UIPI from "../src/uipi/uipi.js"
import findMessagesWrapperStrategy from "../src/ui/strategy/find-messages-wrapper-strategy.js"

test("UIPI", async t => {
	const ui = new UI(t.context.window)
	const uipi = new UIPI(ui)
	t.is(uipi.uiComponent, ui)
})

test("UIPI create", async t => {
	const messagesWrapperElement = createMessagesWrapperElement(t.context.document)
	t.context.document.body.append(messagesWrapperElement)
	const uipi = UIPI.create(t.context.window)
	t.true(uipi instanceof UIPI)
	t.true(uipi.uiComponent instanceof UI)
	t.is(uipi.uiComponent.identifier.uiMessagesWrapper.root, findMessagesWrapperStrategy(t.context.window))
})


test("UIPI fetchAndRenderThreadNextMessagePage", async t => {
	const messagesWrapperElement = createMessagesWrapperElement(t.context.document)
	t.context.document.body.append(messagesWrapperElement)
	const uipi = UIPI.create(t.context.window)
	const result = uipi.fetchAndRenderThreadNextMessagePage()
	uipi.uiComponent.identifier.uiMessagesWrapper.root.scrollTop = 1
	uipi.uiComponent.identifier.uiMessagesWrapper.root.innerHTML += "<div></div>"
	t.is(await result, false)
})

test("UIPI disablePointerEvents", async t => {
	const messagesWrapperElement = createMessagesWrapperElement(t.context.document)
	t.context.document.body.append(messagesWrapperElement)
	const uipi = UIPI.create(t.context.window)
	t.is(uipi.uiComponent.identifier.uiMessagesWrapper.root.style.pointerEvents, "")
	uipi.disablePointerEvents()
	t.is(uipi.uiComponent.identifier.uiMessagesWrapper.root.style.pointerEvents, "none")
})

test("UIPI enablePointerEvents", async t => {
	const messagesWrapperElement = createMessagesWrapperElement(t.context.document)
	t.context.document.body.append(messagesWrapperElement)
	const uipi = UIPI.create(t.context.window)
	uipi.uiComponent.identifier.uiMessagesWrapper.root.style.pointerEvents = "none"
	uipi.uiComponent.identifier.uiMessagesWrapper.enablePointerEvents()
	t.is(uipi.uiComponent.identifier.uiMessagesWrapper.root.style.pointerEvents, "")
})

test("UIPI createUIPIMessages", async t => {
	const messageElement = createMessageElement(t.context.document, "Test")
	const uiMessage = new UIMessage(messageElement)
	const messagesWrapperElement = createMessagesWrapperElement(t.context.document)
	t.context.document.body.append(messagesWrapperElement)
	const uipi = UIPI.create(t.context.window)
	uipi.uiComponent.identifier.uiMessagesWrapper.root.appendChild(messageElement)
	const uiMessages = await uipi.createUIPIMessages()
	t.deepEqual(uiMessages, [new UIPIMessage(uiMessage)])
})

test("UIPI createUIPIMessages multiple", async t => {
	const messagesWrapperElement = createMessagesWrapperElement(t.context.document)
	t.context.document.body.append(messagesWrapperElement)
	const uipi = UIPI.create(t.context.window)
	uipi.uiComponent.identifier.uiMessagesWrapper.root.appendChild(createMessageElement(t.context.document, "Test"))
	uipi.uiComponent.identifier.uiMessagesWrapper.root.appendChild(createMessageElement(t.context.document, "Ignore_me", false))
	uipi.uiComponent.identifier.uiMessagesWrapper.root.appendChild(createMessageElement(t.context.document, "Test1"))
	uipi.uiComponent.identifier.uiMessagesWrapper.root.appendChild(createMessageElement(t.context.document, "Ignore_me", false))
	uipi.uiComponent.identifier.uiMessagesWrapper.root.appendChild(createMessageElement(t.context.document, "Ignore_me", false))
	uipi.uiComponent.identifier.uiMessagesWrapper.root.appendChild(createMessageElement(t.context.document, "Test2"))
	t.deepEqual((await uipi.createUIPIMessages()).map(uiMessage => uiMessage.uiComponent.root.textContent), ["Test", "Test1", "Test2"])
	t.deepEqual((await uipi.createUIPIMessages()).map(uiMessage => uiMessage.uiComponent.root.textContent), ["Test", "Test1", "Test2"])
})
