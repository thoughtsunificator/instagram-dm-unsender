import { test } from "../../test/test.js"
import UI from "../ui/ui.js"
import { createMessageElement, createMessagesWrapperElement } from "../../test/virtual-instagram.js"
import UIPIMessage from "./uipi-message.js"
import UIMessage from "../ui/ui-message.js"
import UIPI from "./uipi.js"
import findMessagesWrapperStrategy from "../ui/strategy/find-messages-wrapper-strategy.js"

test("UIPI", t => {
	const ui = new UI(t.context.window)
	const uipi = new UIPI(ui)
	t.is(uipi.uiComponent, ui)
})

test("UIPI create", t => {
	const messagesWrapperElement = createMessagesWrapperElement(t.context.document)
	t.context.mountElement.append(messagesWrapperElement)
	const uipi = UIPI.create(t.context.window)
	t.true(uipi instanceof UIPI)
	t.true(uipi.uiComponent instanceof UI)
	t.is(uipi.uiComponent.identifier.uiMessagesWrapper.root, findMessagesWrapperStrategy(t.context.window))
})

test("UIPI fetchAndRenderThreadNextMessagePage", async t => {
	t.context.mountElement.append(createMessagesWrapperElement(t.context.document))
	const messagesWrapperElement = findMessagesWrapperStrategy(t.context.window)
	const uipi = UIPI.create(t.context.window)
	messagesWrapperElement.innerHTML += `<div role="progressbar"></div>`
	const result = uipi.fetchAndRenderThreadNextMessagePage()
	messagesWrapperElement.querySelector("[role=progressbar]").remove()
	t.is(await result, true)
})

test("UIPI createUIPIMessages", async t => {
	const messageElement = createMessageElement(t.context.document, "Test")
	const uiMessage = new UIMessage(messageElement)
	const messagesWrapperElement = createMessagesWrapperElement(t.context.document)
	t.context.mountElement.append(messagesWrapperElement)
	const uipi = UIPI.create(t.context.window)
	uipi.uiComponent.identifier.uiMessagesWrapper.root.appendChild(messageElement)
	const uiMessages = await uipi.createUIPIMessages()
	t.deepEqual(uiMessages, [new UIPIMessage(uiMessage)])
})

test("UIPI createUIPIMessages multiple", async t => {
	const messagesWrapperElement = createMessagesWrapperElement(t.context.document)
	t.context.mountElement.append(messagesWrapperElement)
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
