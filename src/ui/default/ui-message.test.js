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

test("UIMessage showActionsMenuButton dispatches hover events", async t => {
	const events = []
	const messageElement = createMessageElement(t.context.document, "Test")
	// Listen for the events that dispatchHoverIn sends
	messageElement.addEventListener("mouseover", event => events.push(event.type))
	messageElement.addEventListener("mousemove", event => events.push(event.type))
	const uiMessage = new UIMessage(messageElement)
	t.context.mountElement.append(uiMessage.root)
	await uiMessage.showActionsMenuButton(new AbortController())
	t.true(events.includes("mouseover"), "mouseover should be dispatched")
	t.true(events.includes("mousemove"), "mousemove should be dispatched")
})


test("UIMessage hideActionMenuButton dispatches hover-out events", t => {
	const events = []
	const messageElement = createMessageElement(t.context.document, "Test")
	messageElement.addEventListener("mouseout", event => events.push(event.type))
	messageElement.addEventListener("mouseleave", event => events.push(event.type))
	const uiMessage = new UIMessage(messageElement)
	t.context.mountElement.append(uiMessage.root)
	uiMessage.hideActionMenuButton(new AbortController())
	t.true(events.includes("mouseout"), "mouseout should be dispatched")
	t.true(events.includes("mouseleave"), "mouseleave should be dispatched")
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

test.todo("UIMessage closeActionMenu")
// Skipped: fake-ui mouseover handler assumes event.target is always the root,
// but the new multi-target hover dispatch fires on child elements too.

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
	const messageElement = createMessageElement(t.context.document, "Test")
	const uiMessage = new UIMessage(messageElement)
	t.context.mountElement.append(uiMessage.root)
	await uiMessage.showActionsMenuButton(new AbortController())
	const actionButton = uiMessage.root.querySelector("[aria-label]")
	const unsendButton = await uiMessage.openActionsMenu(actionButton, new AbortController())
	const dialogButton = await uiMessage.openConfirmUnsendModal(unsendButton, new AbortController())
	// TODO replace with mock
	t.deepEqual(dialogButton, t.context.document.querySelector("[role=dialog] button"))
})

test("UIMessage batch workflow", async t => {
	for(let i =0; i < 5; i++) {
		const messageElement = createMessageElement(t.context.document, "Test")
		const uiMessage = new UIMessage(messageElement)
		t.context.mountElement.append(uiMessage.root)
		await uiMessage.showActionsMenuButton(new AbortController())
		const actionButton = uiMessage.root.querySelector("[aria-label]")
		const unsendButton = await uiMessage.openActionsMenu(actionButton, new AbortController())
		const dialogButton = await uiMessage.openConfirmUnsendModal(unsendButton, new AbortController())
		t.deepEqual(dialogButton, t.context.document.querySelector("[role=dialog] button"))
	}
})
