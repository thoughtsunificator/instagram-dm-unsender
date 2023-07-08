import { test } from "../../test/test.js"
import UIMessagesWrapper from "./ui-messages-wrapper.js"
import { createMessagesWrapperElement } from "../../test/virtual-instagram.js"
import findMessagesWrapperStrategy from "./strategy/find-messages-wrapper-strategy.js"

test("UIMessagesWrapper", t => {
	const messagesWrapperElement = createMessagesWrapperElement(t.context.document)
	const uiMessagesWrapper = new UIMessagesWrapper(messagesWrapperElement)
	t.context.document.mount.append(uiMessagesWrapper.root)
	t.deepEqual(uiMessagesWrapper.root, messagesWrapperElement)
})

test("UIMessagesWrapper fetchAndRenderThreadNextMessagePage", async t => {
	t.context.document.mount.append(createMessagesWrapperElement(t.context.document))
	const messagesWrapperElement = findMessagesWrapperStrategy(t.context.window)
	const uiMessagesWrapper = new UIMessagesWrapper(messagesWrapperElement)
	const result = uiMessagesWrapper.fetchAndRenderThreadNextMessagePage()
	messagesWrapperElement.innerHTML += `<div role="progressbar"></div>`
	messagesWrapperElement.scrollTop = 1
	t.is(await result, false)
})
