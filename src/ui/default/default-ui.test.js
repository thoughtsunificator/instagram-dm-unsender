import { test } from "../../../test/setup.js"
import DefaultUI from "./default-ui.js"
import { createMessageElement, createMessagesWrapperElement } from "../../../test/fake-ui.js"
import UIPIMessage from "../../uipi/uipi-message.js"
import UIMessage from "./ui-message.js"
import { mock } from "node:test"
import UIMessagesWrapper from "./ui-messages-wrapper.js"
import UI from "../ui.js"

test.beforeEach(t => {
	t.context.messagesWrapperElement = createMessagesWrapperElement(t.context.document)
	t.context.mountElement.append(t.context.messagesWrapperElement)
})

test("DefaultUI", t => {
	const defaultUI = new DefaultUI(t.context.window)
	t.true(defaultUI instanceof UI)
	t.is(defaultUI.lastScrollTop, null)
})

test("DefaultUI create", t => {
	const defaultUI = DefaultUI.create(t.context.window)
	t.is(defaultUI.lastScrollTop, null)
	t.true(defaultUI instanceof DefaultUI)
	t.true(defaultUI.identifier.uiMessagesWrapper instanceof UIMessagesWrapper)
	// t.is(defaultUI.identifier.uiMessagesWrapper.root, t.context.messagesWrapperElement)
})

test("DefaultUI fetchAndRenderThreadNextMessagePage", t => {
	const defaultUI = DefaultUI.create(t.context.window)
	const uiMessagesWrapper = defaultUI.identifier.uiMessagesWrapper
	mock.method(uiMessagesWrapper, "fetchAndRenderThreadNextMessagePage")
	const abortController = new AbortController()
	defaultUI.fetchAndRenderThreadNextMessagePage(abortController)
	const call = uiMessagesWrapper.fetchAndRenderThreadNextMessagePage.mock.calls[0]
	t.deepEqual(call.arguments, [abortController])
	t.is(uiMessagesWrapper.fetchAndRenderThreadNextMessagePage.mock.callCount(), 1)
})

test("DefaultUI getNextUIPIMessage", async t => {
	const defaultUI = DefaultUI.create(t.context.window)
	const messageElement = createMessageElement(t.context.document, "Test")
	messageElement.getBoundingClientRect = () => ({ y: 105 })
	const uiMessage = new UIMessage(messageElement)
	defaultUI.identifier.uiMessagesWrapper.root.appendChild(messageElement)
	Object.defineProperty(defaultUI.identifier.uiMessagesWrapper.root, "clientHeight", { value: 123 })
	Object.defineProperty(defaultUI.identifier.uiMessagesWrapper.root, "scrollHeight", { value: 200 })
	const abortController = new AbortController()
	const uipiMessage = await defaultUI.getNextUIPIMessage(abortController)
	t.deepEqual(uipiMessage, new UIPIMessage(uiMessage))
})
