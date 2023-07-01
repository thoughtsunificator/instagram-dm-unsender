import { test } from "./test.js"
import UI from "../src/ui/ui.js"
import UIWrapper from "../src/ui/ui-messages-wrapper.js"
import { createMessageElement, createMessagesWrapperElement } from "./virtual-instagram.js"
import UIPIMessage from "../src/uipi/uipi-message.js"
import UIMessage from "../src/ui/ui-message.js"

test("UI fetchAndRenderThreadNextMessagePage", async t => {
	const messagesWrapperElement = createMessagesWrapperElement(t.context.document)
	const ui = new UI(t.context.window)
	ui.identifier.uiMessagesWrapper = new UIWrapper(messagesWrapperElement)
	t.context.document.body.append(messagesWrapperElement)
	const result = ui.fetchAndRenderThreadNextMessagePage()
	messagesWrapperElement.scrollTop = 1
	messagesWrapperElement.innerHTML += "<div></div>"
	t.is(await result, false)
})

test("UI createUIPIMessages", async t => {
	const messageElement = createMessageElement(t.context.document, "Test")
	const uiMessage = new UIMessage(messageElement)
	const messagesWrapperElement = createMessagesWrapperElement(t.context.document)
	messagesWrapperElement.appendChild(messageElement)
	const ui = new UI(t.context.window)
	ui.identifier.uiMessagesWrapper = new UIWrapper(messagesWrapperElement)
	t.context.document.body.append(messagesWrapperElement)
	const uipiMessages = await ui.createUIPIMessages()
	t.deepEqual(uipiMessages, [new UIPIMessage(uiMessage)])
})
