import { test } from "./test.js"
import UIMessagesWrapper from "../src/ui/ui-messages-wrapper.js"
import { createMessagesWrapperElement } from "./virtual-instagram.js"

test("UIMessagesWrapper", t => {
	const messagesWrapperElement = createMessagesWrapperElement(t.context.document)
	const uiMessagesWrapper = new UIMessagesWrapper(messagesWrapperElement)
	t.context.document.body.append(uiMessagesWrapper.root)
	t.deepEqual(uiMessagesWrapper.root, messagesWrapperElement)
})

test("UIMessagesWrapper fetchAndRenderThreadNextMessagePage", async t => {
	const messagesWrapperElement = createMessagesWrapperElement(t.context.document)
	const uiMessagesWrapper = new UIMessagesWrapper(messagesWrapperElement)
	t.context.document.body.append(uiMessagesWrapper.root)
	const result = uiMessagesWrapper.fetchAndRenderThreadNextMessagePage()
	messagesWrapperElement.scrollTop = 1
	messagesWrapperElement.innerHTML += "<div></div>"
	t.is(await result, false)
})
