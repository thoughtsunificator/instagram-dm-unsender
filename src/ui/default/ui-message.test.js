import { test } from "../../../test/setup.js"
import UIMessage from "./ui-message.js"
import { createMessageElement, createMessageActionsMenuElement } from "../../../test/fake-ui.js"

// TODO replace with mocks

test("UIMessage", t => {
	const messageElement = createMessageElement(t.context.document, "Test")
	const uiMessage = new UIMessage(messageElement)
	t.context.mountElement.append(uiMessage.root)
	t.deepEqual(uiMessage.root, messageElement)
})

test("UIMessage showActionsMenuButton mouse events are sent", async t => {
	const events = []
	const messageElement = createMessageElement(t.context.document, "Test")
	messageElement.addEventListener("mousemove", event => events.push(event.type))
	messageElement.addEventListener("mouseover", event => events.push(event.type))
	messageElement.addEventListener("mousenter", event => events.push(event.type))
	const uiMessage = new UIMessage(messageElement)
	t.context.mountElement.append(uiMessage.root)
	await uiMessage.showActionsMenuButton(new AbortController())
	t.deepEqual(events, ["mousemove", "mouseover", "mousenter"])
})


test("UIMessage hideActionMenuButton mouse events are sent", t => {
	const events = []
	const messageElement = createMessageElement(t.context.document, "Test")
	messageElement.addEventListener("mousemove", event => events.push(event.type))
	messageElement.addEventListener("mouseout", event => events.push(event.type))
	messageElement.addEventListener("mouseleave", event => events.push(event.type))
	const uiMessage = new UIMessage(messageElement)
	t.context.mountElement.append(uiMessage.root)
	uiMessage.hideActionMenuButton(new AbortController())
	t.deepEqual(events, ["mousemove", "mouseout", "mouseleave"])
})

test("UIMessage openActionsMenu", async t => {
	const events = []
	const messageElement = createMessageElement(t.context.document, "Test")
	const uiMessage = new UIMessage(messageElement)
	t.context.mountElement.append(uiMessage.root)
	await uiMessage.showActionsMenuButton(new AbortController())
	const actionButton = uiMessage.root.querySelector("[aria-label]")
	actionButton.addEventListener("click", event => events.push(event.type))
	await uiMessage.openActionsMenu(actionButton, new AbortController())
	t.deepEqual(events, ["click"])
})

test("UIMessage closeActionMenu", async t => {
	const events = []
	const messageElement = createMessageElement(t.context.document, "Test")
	messageElement.addEventListener("click", event => events.push(event.type))
	const uiMessage = new UIMessage(messageElement)
	t.context.mountElement.append(uiMessage.root)
	const actionButton = await uiMessage.showActionsMenuButton(new AbortController())
	t.is(t.context.document.querySelector("[role=dialog]"), null)
	const actionsMenuElement = await uiMessage.openActionsMenu(uiMessage.root.querySelector("[aria-label]"), new AbortController())
	t.not(t.context.document.querySelector("[role=dialog]"), null)
	await uiMessage.closeActionsMenu(actionButton, actionsMenuElement, new AbortController())
	t.is(t.context.document.querySelector("[role=dialog]"), null)
	t.deepEqual(events, ["click", "click"])
})

test("UIMessage openConfirmUnsendModal", async t => {
	const messageActionsMenuElement = createMessageActionsMenuElement(t.context.document)
	const messageElement = createMessageElement(t.context.document, "Test")
	const uiMessage = new UIMessage(messageElement)
	t.context.mountElement.append(uiMessage.root)
	t.context.mountElement.append(messageActionsMenuElement)
	const unsendButton = t.context.document.createElement("button")
	unsendButton.addEventListener("click", () => {
		const element = t.context.document.createElement("div")
		const elementButton = t.context.document.createElement("button")
		element.setAttribute("role", "dialog")
		element.append(elementButton)
		t.context.document.body.append(element)
	})
	const dialogButton = await uiMessage.openConfirmUnsendModal(unsendButton, new AbortController())
	// TODO replace with mock
	t.deepEqual(dialogButton, t.context.document.querySelector("[role=dialog] button"))
})

test("UIMessage workflow", async t => {
	const events = []
	const messageElement = createMessageElement(t.context.document, "Test")
	const uiMessage = new UIMessage(messageElement)
	t.context.mountElement.append(uiMessage.root)
	messageElement.addEventListener("mousemove", event => events.push(event.type))
	messageElement.addEventListener("mouseover", event => events.push(event.type))
	messageElement.addEventListener("mousenter", event => events.push(event.type))
	await uiMessage.showActionsMenuButton(new AbortController())
	const actionButton = uiMessage.root.querySelector("[aria-label]")
	actionButton.addEventListener("click", event => events.push(event.type))
	const unsendButton = await uiMessage.openActionsMenu(actionButton, new AbortController())
	const dialogButton = await uiMessage.openConfirmUnsendModal(unsendButton, new AbortController())
	// TODO replace with mock
	t.deepEqual(events, ["mousemove", "mouseover", "mousenter", "click"])
	t.deepEqual(dialogButton, t.context.document.querySelector("[role=dialog] button"))
})

test("UIMessage batch workflow", async t => {
	for(let i =0; i < 5; i++) {
		const events = []
		const messageElement = createMessageElement(t.context.document, "Test")
		const uiMessage = new UIMessage(messageElement)
		t.context.mountElement.append(uiMessage.root)
		messageElement.addEventListener("mousemove", event => events.push(event.type))
		messageElement.addEventListener("mouseover", event => events.push(event.type))
		messageElement.addEventListener("mousenter", event => events.push(event.type))
		await uiMessage.showActionsMenuButton(new AbortController())
		const actionButton = uiMessage.root.querySelector("[aria-label]")
		actionButton.addEventListener("click", event => events.push(event.type))
		const unsendButton = await uiMessage.openActionsMenu(actionButton, new AbortController())
		const dialogButton = await uiMessage.openConfirmUnsendModal(unsendButton, new AbortController())
		t.deepEqual(events, ["mousemove", "mouseover", "mousenter", "click"])
		t.deepEqual(dialogButton, t.context.document.querySelector("[role=dialog] button"))
	}
})
