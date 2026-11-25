import { test } from "../../test/setup.js"
import { createMessagesWrapperElement, createMessageElement } from "../../test/fake-ui.js"
import { MessagesWrapper, getFirstVisibleMessage, isSentByCurrentUser } from "./messages-wrapper.js"

const IN_VIEW = () => ({ x: 0, y: 105, width: 300, height: 50 })
const ABOVE_VIEW = () => ({ x: 0, y: -300, width: 300, height: 50 })

/**
 * Three messages sent by us, all in view unless overridden
 */
function createWrapper(t, { itemsPerPage = 3 } = {}) {
	const element = createMessagesWrapperElement({ document: t.context.document, totalPages: 0, itemsPerPage })
	t.context.mountElement.append(element)
	const root = element.querySelector("#messageWrapper")
	for(const child of root.children) {
		child.getBoundingClientRect = IN_VIEW
	}
	return root
}

test("getFirstVisibleMessage returns the newest visible message sent by us and flags it", t => {
	const root = createWrapper(t)
	const found = getFirstVisibleMessage(root, new AbortController(), t.context.window)
	t.is(found, root.children[2])
	t.true(found.hasAttribute("data-idmu-ignore"))
})

test("getFirstVisibleMessage skips the newest message when it was already processed", t => {
	const root = createWrapper(t)
	root.children[2].setAttribute("data-idmu-ignore", "")
	t.is(getFirstVisibleMessage(root, new AbortController(), t.context.window), root.children[1])
})

test("getFirstVisibleMessage skips messages received from others", t => {
	const root = createWrapper(t, { itemsPerPage: 0 })
	const received = createMessageElement({ document: t.context.document, text: "hi", includesUnsend: false })
	received.getBoundingClientRect = IN_VIEW
	root.append(received)
	t.is(getFirstVisibleMessage(root, new AbortController(), t.context.window), undefined)
})

test("getFirstVisibleMessage skips messages fully above the viewport", t => {
	const root = createWrapper(t)
	for(const child of root.children) {
		child.getBoundingClientRect = ABOVE_VIEW
	}
	t.is(getFirstVisibleMessage(root, new AbortController(), t.context.window), undefined)
})

test("getFirstVisibleMessage accepts a tall message whose top is above the viewport", t => {
	const root = createWrapper(t)
	root.children[2].getBoundingClientRect = () => ({ x: 0, y: -200, width: 300, height: 500 })
	root.children[1].getBoundingClientRect = ABOVE_VIEW
	root.children[0].getBoundingClientRect = ABOVE_VIEW
	t.is(getFirstVisibleMessage(root, new AbortController(), t.context.window), root.children[2])
})

test("isSentByCurrentUser detects justify-content flex-end", t => {
	const root = createWrapper(t, { itemsPerPage: 1 })
	t.true(isSentByCurrentUser(root.children[0], t.context.window))
	const received = createMessageElement({ document: t.context.document, includesUnsend: false })
	t.false(isSentByCurrentUser(received, t.context.window))
})

test("MessagesWrapper.findNextMessage returns a Message for a message already in view", async t => {
	const root = createWrapper(t)
	const message = await new MessagesWrapper(root).findNextMessage(new AbortController())
	t.is(message.root, root.children[2])
})

test("MessagesWrapper.loadMore reports the last page when nothing loads", async t => {
	const root = createWrapper(t)
	t.true(await new MessagesWrapper(root).loadMore(new AbortController()))
})
