import { test } from "../../test/setup.js"
import { UIMessage } from "../ui/default/ui-message.js"
import { createMessageElement } from "../../test/fake-ui.js"
import { MessageUnsend } from "./message-unsend-workflow.js"

test("MessageUnsend", t => {
	const messageElement = createMessageElement({ document: t.context.document, text: "Test" })
	const uiMessage = new UIMessage(messageElement)
	const workflow = new MessageUnsend(uiMessage)
	t.is(workflow.uiComponent, uiMessage)
})

test("MessageUnsend unsend", async t => {
	const messageElement = createMessageElement({ document: t.context.document, text: "Test" })
	const uiMessage = new UIMessage(messageElement)
	t.context.mountElement.append(uiMessage.root)
	const workflow = new MessageUnsend(uiMessage)
	await t.notThrowsAsync(() => workflow.unsend(new AbortController()))
	t.is(t.context.mountElement.contains(uiMessage.root), false)
})

test("MessageUnsend batch unsend", async t => {
	for(let i =0; i < 5; i++) {
		const messageElement = createMessageElement({ document: t.context.document, text: "Test" })
		const uiMessage = new UIMessage(messageElement)
		t.context.mountElement.append(uiMessage.root)
		const workflow = new MessageUnsend(uiMessage)
		await t.notThrowsAsync(() => workflow.unsend(new AbortController()))
		t.is(t.context.mountElement.contains(uiMessage.root), false)
	}
})
