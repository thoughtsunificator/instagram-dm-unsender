import { test } from "../../../test/test.js"
import UIMessagesWrapper from "./ui-messages-wrapper.js"
import { createMessagesWrapperElement } from "../../../test/virtual-instagram.js"
import { findMessagesWrapper } from "./dom-lookup.js"

test("UIMessagesWrapper", t => {
	const messagesWrapperElement = createMessagesWrapperElement(t.context.document)
	const uiMessagesWrapper = new UIMessagesWrapper(messagesWrapperElement)
	t.context.mountElement.append(uiMessagesWrapper.root)
	t.deepEqual(uiMessagesWrapper.root, messagesWrapperElement)
})

test("UIMessagesWrapper fetchAndRenderThreadNextMessagePage", async t => {
	t.context.mountElement.append(createMessagesWrapperElement(t.context.document))
	const messagesWrapperElement = findMessagesWrapper(t.context.window)
	const uiMessagesWrapper = new UIMessagesWrapper(messagesWrapperElement)
	messagesWrapperElement.innerHTML += `<div role="progressbar"></div>`
	const result = uiMessagesWrapper.fetchAndRenderThreadNextMessagePage()
	messagesWrapperElement.querySelector("[role=progressbar]").remove()
	t.is(await result, true)
})
