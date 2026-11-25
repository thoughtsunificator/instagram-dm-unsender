import { test } from "../../test/setup.js"
import { createMessageElement } from "../../test/fake-ui.js"
import { Message } from "../instagram/message.js"
import { MessageUnsend, MessageValidateUnsend } from "./message-unsend-workflow.js"

function createMessage(t, options = {}) {
	const element = createMessageElement({ document: t.context.document, text: "Test", ...options })
	t.context.mountElement.append(element)
	return new Message(element)
}

test("MessageUnsend and MessageValidateUnsend unsend a message", async t => {
	const message = createMessage(t)
	await t.notThrowsAsync(() => new MessageUnsend(message).run())
	await t.notThrowsAsync(() => new MessageValidateUnsend(message).run())
	t.true(message.isUnsent())
})

test("MessageUnsend fails and ignores the message when a step fails", async t => {
	const message = createMessage(t, { includesUnsend: false })
	const error = await t.throwsAsync(() => new MessageUnsend(message).run())
	t.is(error.name, "FailedWorkflowError")
	t.true(message.root.hasAttribute("data-idmu-ignore"))
})

test("MessageValidateUnsend reports a late failure when the message is still rendered", async t => {
	const message = createMessage(t)
	const error = await t.throwsAsync(() => new MessageValidateUnsend(message).run())
	t.is(error.name, "LateFailureWorkflowError")
	t.false(message.isUnsent())
})
