import { test } from "../../test/test.js"
import UI from "./ui.js"
import UIWrapper from "./ui-messages-wrapper.js"
import { createMessageElement, createMessagesWrapperElement } from "../../test/virtual-instagram.js"
import UIPIMessage from "../uipi/uipi-message.js"
import UIMessage from "./ui-message.js"
import findMessagesWrapperStrategy from "./strategy/find-messages-wrapper-strategy.js"

test("UI fetchAndRenderThreadNextMessagePage", async t => {
	t.context.mountElement.append(createMessagesWrapperElement(t.context.document))
	const messagesWrapperElement = findMessagesWrapperStrategy(t.context.window)
	const ui = new UI(t.context.window)
	ui.identifier.uiMessagesWrapper = new UIWrapper(messagesWrapperElement)
	messagesWrapperElement.innerHTML += `<div role="progressbar"></div>`
	const result = ui.fetchAndRenderThreadNextMessagePage()
	messagesWrapperElement.querySelector("[role=progressbar]").remove()
	t.is(await result, true)
})

test("UI createUIPIMessages", async t => {
	const messageElement = createMessageElement(t.context.document, "Test")
	const uiMessage = new UIMessage(messageElement)
	const messagesWrapperElement = createMessagesWrapperElement(t.context.document)
	messagesWrapperElement.appendChild(messageElement)
	const ui = new UI(t.context.window)
	ui.identifier.uiMessagesWrapper = new UIWrapper(messagesWrapperElement)
	t.context.mountElement.append(messagesWrapperElement)
	const uipiMessages = await ui.createUIPIMessages()
	t.deepEqual(uipiMessages, [new UIPIMessage(uiMessage)])
})
