import { test } from "../../../../test/setup.js"
import { createMessagesWrapperElement } from "../../../../test/fake-ui.js"
import { discoverThread } from "./thread.js"

test("discoverThread returns null outside of a conversation", t => {
	t.is(discoverThread(t.context.window), null)
})

test("discoverThread throws on a conversation without messages container", t => {
	t.context.window.history.pushState({}, "", "/direct/t/1")
	t.throws(() => discoverThread(t.context.window), { message: /Unable to find messages wrapper/ })
})

test("discoverThread returns the thread of a conversation", t => {
	t.context.window.history.pushState({}, "", "/direct/t/1")
	t.context.mountElement.append(createMessagesWrapperElement({ document: t.context.document, itemsPerPage: 1 }))
	const thread = discoverThread(t.context.window)
	t.is(thread.root.id, "messageWrapper")
})
