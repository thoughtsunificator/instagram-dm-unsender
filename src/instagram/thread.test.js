import { test } from "../../test/setup.js"
import { createMessagesWrapperElement } from "../../test/fake-ui.js"
import { findMessagesWrapper, isThreadPath } from "./thread.js"
import { dismissStaleOverlays, dismissOverlays } from "./overlays.js"

test("findMessagesWrapper returns null without a conversation", t => {
	t.is(findMessagesWrapper(t.context.window), null)
})

test("findMessagesWrapper returns the scrollable messages container", t => {
	t.context.mountElement.append(createMessagesWrapperElement({ document: t.context.document, itemsPerPage: 1 }))
	t.is(findMessagesWrapper(t.context.window).id, "messageWrapper")
})

test("isThreadPath matches conversation urls", t => {
	t.context.window.history.pushState({}, "", "/direct/t/123")
	t.true(isThreadPath(t.context.window))
	t.context.window.history.pushState({}, "", "/direct/inbox/")
	t.false(isThreadPath(t.context.window))
})

test("dismissStaleOverlays dismisses a stale dialog via Escape, falling back to a cancel button", t => {
	const dialog = t.context.document.createElement("div")
	dialog.setAttribute("role", "dialog")
	const cancel = t.context.document.createElement("button")
	cancel.textContent = "Cancel"
	let clicked = false
	cancel.addEventListener("click", () => { clicked = true; dialog.remove() })
	const confirm = t.context.document.createElement("button")
	confirm.textContent = "Unsend"
	confirm.addEventListener("click", () => { t.fail("must not click confirm") })
	dialog.append(confirm, cancel)
	t.context.document.body.append(dialog)
	let escapePressed = false
	t.context.document.body.addEventListener("keydown", event => { if(event.key === "Escape") escapePressed = true })
	dismissStaleOverlays(t.context.document)
	t.true(escapePressed)
	t.true(clicked)
	t.is(t.context.document.querySelector("[role=dialog]"), null)
})

test("dismissStaleOverlays presses Escape when a menu is open", t => {
	const menu = t.context.document.createElement("div")
	menu.setAttribute("role", "menu")
	t.context.document.body.append(menu)
	let key
	t.context.document.addEventListener("keydown", event => {
		key = event.key
	})
	dismissStaleOverlays(t.context.document)
	t.is(key, "Escape")
})

test("dismissOverlays stops as soon as no dialog is left", async t => {
	let presses = 0
	t.context.document.addEventListener("keydown", () => presses++)
	await dismissOverlays(t.context.document, () => Promise.resolve())
	t.is(presses, 1)
})
