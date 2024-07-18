import { test } from "../../../test/setup.js"
import UIMessagesWrapper from "./ui-messages-wrapper.js"
import { createMessagesWrapperElement } from "../../../test/fake-ui.js"
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
	// TODO replace with mock
	const result = uiMessagesWrapper.fetchAndRenderThreadNextMessagePage(new AbortController())
	messagesWrapperElement.querySelector("[role=progressbar]").remove()
	t.is(await result, true)
})
