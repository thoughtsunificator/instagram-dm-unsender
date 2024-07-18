import { test } from "../../test/setup.js"
import UIMessage from "../ui/default/ui-message.js"
import { createMessageElement } from "../../test/fake-ui.js"
import UIPIMessage from "./uipi-message.js"

test("UIPIMessage", t => {
	const messageElement = createMessageElement(t.context.document, "Test")
	const uiMessage = new UIMessage(messageElement)
	const uipiMessage = new UIPIMessage(uiMessage)
	t.is(uipiMessage.uiMessage, uiMessage)
})

test("UIMessage unsend", async t => {
	const messageElement = createMessageElement(t.context.document, "Test")
	const uiMessage = new UIMessage(messageElement)
	t.context.mountElement.append(uiMessage.root)
	const uipiMessage = new UIPIMessage(uiMessage)
	await t.notThrowsAsync(() => uipiMessage.unsend(new AbortController()))
	t.is(t.context.mountElement.contains(uiMessage.root), false)
})

test("UIMessage batch unsend", async t => {
	for(let i =0; i < 5; i++) {
		const messageElement = createMessageElement(t.context.document, "Test")
		const uiMessage = new UIMessage(messageElement)
		t.context.mountElement.append(uiMessage.root)
		const uipiMessage = new UIPIMessage(uiMessage)
		await t.notThrowsAsync(() => uipiMessage.unsend(new AbortController()))
		t.is(t.context.mountElement.contains(uiMessage.root), false)
	}
})
