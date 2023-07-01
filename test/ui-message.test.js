import { test } from "./test.js"
import UIMessage from "../src/ui/ui-message.js"
import { createMessageElement, createMessageActionsMenuElement } from "./virtual-instagram.js"

test("UIMessage", t => {
	const messageElement = createMessageElement(t.context.document, "Test")
	const uiMessage = new UIMessage(messageElement)
	t.context.document.body.append(uiMessage.root)
	t.deepEqual(uiMessage.root, messageElement)
})

test("UIMessage showActionsMenuButton mouse events are sent", async t => {
	const events = []
	const messageElement = createMessageElement(t.context.document, "Test")
	messageElement.addEventListener("mousemove", event => events.push(event.type))
	messageElement.addEventListener("mouseover", event => events.push(event.type))
	messageElement.addEventListener("mousenter", event => events.push(event.type))
	const uiMessage = new UIMessage(messageElement)
	t.context.document.body.append(uiMessage.root)
	let scrolledIntoView = false
	uiMessage.root.scrollIntoView = () => {
		scrolledIntoView = true
	}
	await uiMessage.showActionsMenuButton()
	t.deepEqual(events, ["mousemove", "mouseover", "mousenter"])
	t.true(scrolledIntoView)
})


test("UIMessage hideActionMenuButton mouse events are sent", t => {
	const events = []
	const messageElement = createMessageElement(t.context.document, "Test")
	messageElement.addEventListener("mousemove", event => events.push(event.type))
	messageElement.addEventListener("mouseout", event => events.push(event.type))
	messageElement.addEventListener("mouseleave", event => events.push(event.type))
	const uiMessage = new UIMessage(messageElement)
	t.context.document.body.append(uiMessage.root)
	uiMessage.hideActionMenuButton()
	t.deepEqual(events, ["mousemove", "mouseout", "mouseleave"])
})

test("UIMessage openActionsMenu", async t => {
	const events = []
	const messageElement = createMessageElement(t.context.document, "Test")
	const uiMessage = new UIMessage(messageElement)
	t.context.document.body.append(uiMessage.root)
	uiMessage.root.scrollIntoView = () => {}
	await uiMessage.showActionsMenuButton()
	const actionButton = uiMessage.root.querySelector("[aria-label]")
	actionButton.addEventListener("click", event => events.push(event.type))
	await uiMessage.openActionsMenu(actionButton)
	t.deepEqual(events, ["click"])
})

test("UIMessage closeActionMenu", async t => {
	const events = []
	const messageElement = createMessageElement(t.context.document, "Test")
	messageElement.addEventListener("click", event => events.push(event.type))
	const uiMessage = new UIMessage(messageElement)
	t.context.document.body.append(uiMessage.root)
	uiMessage.root.scrollIntoView = () => {}
	await uiMessage.showActionsMenuButton()
	t.is(t.context.document.querySelector("[role=dialog]"), null)
	await uiMessage.openActionsMenu(uiMessage.root.querySelector("[aria-label]"))
	t.not(t.context.document.querySelector("[role=dialog]"), null)
	await uiMessage.closeActionsMenu()
	t.is(t.context.document.querySelector("[role=dialog]"), null)
	t.deepEqual(events, ["click", "click"])
})

test("UIMessage openConfirmUnsendModal", async t => {
	const messageActionsMenuElement = createMessageActionsMenuElement(t.context.document)
	const messageElement = createMessageElement(t.context.document, "Test")
	const uiMessage = new UIMessage(messageElement)
	t.context.document.body.append(uiMessage.root)
	t.context.document.body.append(messageActionsMenuElement)
	const dialogButton = await uiMessage.openConfirmUnsendModal()
	t.deepEqual(dialogButton, t.context.document.querySelector("[role=dialog] button"))
})

test("UIMessage workflow", async t => {
	const events = []
	const messageElement = createMessageElement(t.context.document, "Test")
	const uiMessage = new UIMessage(messageElement)
	t.context.document.body.append(uiMessage.root)
	messageElement.addEventListener("mousemove", event => events.push(event.type))
	messageElement.addEventListener("mouseover", event => events.push(event.type))
	messageElement.addEventListener("mousenter", event => events.push(event.type))
	let scrolledIntoView = false
	uiMessage.root.scrollIntoView = () => {
		scrolledIntoView = true
	}
	await uiMessage.showActionsMenuButton()
	const actionButton = uiMessage.root.querySelector("[aria-label]")
	actionButton.addEventListener("click", event => events.push(event.type))
	await uiMessage.openActionsMenu(actionButton)
	const dialogButton = await uiMessage.openConfirmUnsendModal()
	t.deepEqual(events, ["mousemove", "mouseover", "mousenter", "click"])
	t.true(scrolledIntoView)
	t.deepEqual(dialogButton, t.context.document.querySelector("[role=dialog] button"))
})

test("UIMessage batch workflow", async t => {
	for(let i =0; i < 5; i++) {
		const events = []
		const messageElement = createMessageElement(t.context.document, "Test")
		const uiMessage = new UIMessage(messageElement)
		t.context.document.body.append(uiMessage.root)
		messageElement.addEventListener("mousemove", event => events.push(event.type))
		messageElement.addEventListener("mouseover", event => events.push(event.type))
		messageElement.addEventListener("mousenter", event => events.push(event.type))
		let scrolledIntoView = false
		uiMessage.root.scrollIntoView = () => {
			scrolledIntoView = true
		}
		await uiMessage.showActionsMenuButton()
		const actionButton = uiMessage.root.querySelector("[aria-label]")
		actionButton.addEventListener("click", event => events.push(event.type))
		await uiMessage.openActionsMenu(actionButton)
		const dialogButton = await uiMessage.openConfirmUnsendModal()
		t.deepEqual(events, ["mousemove", "mouseover", "mousenter", "click"])
		t.true(scrolledIntoView)
		t.deepEqual(dialogButton, t.context.document.querySelector("[role=dialog] button"))
	}
})
