import { test } from "../../../test/setup.js"
import { ThreadPage } from "./default-ui.js"
import { createMessageElement, createMessagesWrapperElement } from "../../../test/fake-ui.js"
import { UIMessage } from "./ui-message.js"
import { mock } from "node:test"
import { UIMessagesWrapper } from "./ui-messages-wrapper.js"
import { UI } from "../ui.js"
import { test } from "../../test/setup.js"
import { DefaultUI } from "./thread-page.js"
import { createMessagesWrapperElement } from "../../test/fake-ui.js"
import { mock } from "node:test"
import { ThreadPage } from "./uipi.js"

test.beforeEach(t => {
	t.context.messagesWrapperElement = createMessagesWrapperElement({ document: t.context.document })
	t.context.mountElement.append(t.context.messagesWrapperElement)
})

test("ThreadPage", t => {
	const defaultUI = new ThreadPage(t.context.window)
	t.true(defaultUI instanceof UI)
	t.is(defaultUI.lastScrollTop, null)
})

test("ThreadPage loadMessages", t => {
	const defaultUI = ThreadPage.create(t.context.window)
	const uiMessagesWrapper = defaultUI.identifier.uiMessagesWrapper
	mock.method(uiMessagesWrapper, "loadMessages")
	const abortController = new AbortController()
	defaultUI.loadMessages(abortController)
	const call = uiMessagesWrapper.loadMessages.mock.calls[0]
	t.deepEqual(call.arguments, [abortController])
	t.is(uiMessagesWrapper.loadMessages.mock.callCount(), 1)
})

test("ThreadPage fetchNextMessage", async t => {
	const defaultUI = ThreadPage.create(t.context.window)
	// Add multiple messages so getMessagesInnerContainer correctly identifies
	// the scrollable root as the inner container (most children wins)
	for (let i = 0; i < 3; i++) {
		const filler = createMessageElement({ document: t.context.document, text: `Filler ${i}` })
		filler.getBoundingClientRect = () => ({ y: 0, height: 0 })
		defaultUI.identifier.uiMessagesWrapper.root.appendChild(filler)
	}
	const messageElement = createMessageElement({ document: t.context.document, text: "Test" })
	messageElement.getBoundingClientRect = () => ({ y: 105, height: 50 })
	const uiMessage = new UIMessage(messageElement)
	defaultUI.identifier.uiMessagesWrapper.root.appendChild(messageElement)
	Object.defineProperty(defaultUI.identifier.uiMessagesWrapper.root, "clientHeight", { value: 123 })
	Object.defineProperty(defaultUI.identifier.uiMessagesWrapper.root, "scrollHeight", { value: 200 })
	const abortController = new AbortController()
	const uipiMessage = await defaultUI.fetchNextMessage(abortController)
	t.deepEqual(uipiMessage, new UIPIMessage(uiMessage))
})

test("ThreadPage fetchNextMessage finds message without scrolling", async t => {
	// A message visible at current scroll position should be found by the pre-check
	const defaultUI = ThreadPage.create(t.context.window)
	for (let i = 0; i < 3; i++) {
		const filler = createMessageElement({ document: t.context.document, text: `Filler ${i}` })
		filler.getBoundingClientRect = () => ({ y: 0, height: 0 })
		defaultUI.identifier.uiMessagesWrapper.root.appendChild(filler)
	}
	const messageElement = createMessageElement({ document: t.context.document, text: "Visible" })
	messageElement.getBoundingClientRect = () => ({ y: 200, height: 50 })
	defaultUI.identifier.uiMessagesWrapper.root.appendChild(messageElement)
	Object.defineProperty(defaultUI.identifier.uiMessagesWrapper.root, "clientHeight", { value: 500 })
	Object.defineProperty(defaultUI.identifier.uiMessagesWrapper.root, "scrollHeight", { value: 500 })
	const abortController = new AbortController()
	const uipiMessage = await defaultUI.fetchNextMessage(abortController)
	t.truthy(uipiMessage)
	t.true(uipiMessage instanceof UIPIMessage)
})

test("ThreadPage fetchNextMessage returns false when no messages", async t => {
	const defaultUI = ThreadPage.create(t.context.window)
	// No messages added — should exhaust all passes and return false
	Object.defineProperty(defaultUI.identifier.uiMessagesWrapper.root, "clientHeight", { value: 100 })
	Object.defineProperty(defaultUI.identifier.uiMessagesWrapper.root, "scrollHeight", { value: 200 })
	const abortController = new AbortController()
	const result = await defaultUI.fetchNextMessage(abortController)
	t.is(result, false)
})

test("ThreadPage fetchNextMessage respects abort", async t => {
	const defaultUI = ThreadPage.create(t.context.window)
	Object.defineProperty(defaultUI.identifier.uiMessagesWrapper.root, "clientHeight", { value: 100 })
	Object.defineProperty(defaultUI.identifier.uiMessagesWrapper.root, "scrollHeight", { value: 200 })
	const abortController = new AbortController()
	abortController.abort()
	const result = await defaultUI.fetchNextMessage(abortController)
	t.is(result, false)
})

test("ThreadPage loadMessages", t => {
	const uipi = ThreadPage.create(t.context.window)
	mock.method(uipi.ui, "loadMessages")
	const abortController = new AbortController()
	uipi.loadMessages(abortController)
	const call = uipi.ui.loadMessages.mock.calls[0]
	t.deepEqual(call.arguments, [abortController])
	t.is(uipi.ui.loadMessages.mock.callCount(), 1)
})

test("ThreadPage fetchNextMessage", t => {
	const uipi = ThreadPage.create(t.context.window)
	mock.method(uipi.ui, "fetchNextMessage")
	const abortController = new AbortController()
	uipi.fetchNextMessage(abortController)
	const call = uipi.ui.fetchNextMessage.mock.calls[0]
	t.deepEqual(call.arguments, [abortController])
	t.is(uipi.ui.fetchNextMessage.mock.callCount(), 1)
})
