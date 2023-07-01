import { test } from "./test.js"
import UIMessagesWrapper from "../src/ui/ui-messages-wrapper.js"
import { createMessagesWrapperElement } from "./virtual-instagram.js"

test("UIMessagesWrapper", t => {
	const messagesWrapperElement = createMessagesWrapperElement(t.context.document)
	const uiMessagesWrapper = new UIMessagesWrapper(messagesWrapperElement)
	t.context.document.body.append(uiMessagesWrapper.root)
	t.deepEqual(uiMessagesWrapper.root, messagesWrapperElement)
})

test("UIMessagesWrapper disablePointerEvents", t => {
	const messagesWrapperElement = createMessagesWrapperElement(t.context.document)
	const uiMessagesWrapper = new UIMessagesWrapper(messagesWrapperElement)
	t.context.document.body.append(uiMessagesWrapper.root)
	t.is(uiMessagesWrapper.root.style.pointerEvents, "")
	uiMessagesWrapper.disablePointerEvents()
	t.is(uiMessagesWrapper.root.style.pointerEvents, "none")
})

test("UIMessagesWrapper enablePointerEvents", t => {
	const messagesWrapperElement = createMessagesWrapperElement(t.context.document)
	const uiMessagesWrapper = new UIMessagesWrapper(messagesWrapperElement)
	t.context.document.body.append(uiMessagesWrapper.root)
	uiMessagesWrapper.root.style.pointerEvents = "none"
	uiMessagesWrapper.enablePointerEvents()
	t.is(uiMessagesWrapper.root.style.pointerEvents, "")
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
