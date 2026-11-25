import { test } from "../../test/setup.js"
import { createMessageElement } from "../../test/fake-ui.js"
import { Message, findActionButton, findUnsendMenuItem, collectHoverTargets } from "./message.js"

function createMessage(t, options = {}) {
	const element = createMessageElement({ document: t.context.document, text: "Test", ...options })
	t.context.mountElement.append(element)
	return { element, message: new Message(element) }
}

test("Message unsend flow removes the message from the DOM", async t => {
	const { element, message } = createMessage(t)
	const controller = new AbortController()
	const actionButton = await message.showActionsMenuButton(undefined, controller)
	const unsendButton = await message.openActionsMenu(actionButton, controller)
	const dialogButton = await message.openConfirmUnsendModal(unsendButton, controller)
	await message.confirmUnsend(dialogButton, controller)
	t.false(message.exists())
	t.false(element.isConnected)
})

test("Message openActionsMenu fails when the unsend entry is missing", async t => {
	const { message } = createMessage(t, { includesUnsend: false })
	const controller = new AbortController()
	const actionButton = await message.showActionsMenuButton(undefined, controller)
	await t.throwsAsync(() => message.openActionsMenu(actionButton, controller))
})

test("Message exists while rendered and is not unsent yet", t => {
	const { element, message } = createMessage(t)
	t.true(message.exists())
	t.false(message.isUnsent())
	message.markUnsent()
	t.true(element.hasAttribute("data-idmu-unsent"))
	t.true(message.isUnsent())
})

test("Message ignore flag can be set and cleared", t => {
	const { element, message } = createMessage(t)
	message.markIgnored()
	t.true(element.hasAttribute("data-idmu-ignore"))
	message.clearIgnored()
	t.false(element.hasAttribute("data-idmu-ignore"))
})

test("findActionButton resolves the labelled svg to its button", t => {
	const { element } = createMessage(t)
	const button = t.context.document.createElement("div")
	button.setAttribute("role", "button")
	button.innerHTML = "<svg aria-label='See more options for message from foo'></svg>"
	element.append(button)
	t.is(findActionButton(element), button)
})

test("findUnsendMenuItem matches the localized unsend labels", t => {
	const menu = t.context.document.createElement("div")
	menu.setAttribute("role", "menu")
	const label = t.context.document.createElement("span")
	label.textContent = "Annulla invio"
	menu.append(label)
	t.context.document.body.append(menu)
	t.is(findUnsendMenuItem(t.context.document), label)
})

test("findUnsendMenuItem matches labels in any language, ignoring accents composition, apostrophes and spacing", t => {
	const { document } = t.context
	const menu = document.createElement("div")
	menu.setAttribute("role", "menu")
	const label = document.createElement("span")
	label.textContent = "送信を取り消す"
	menu.append(label)
	document.body.append(menu)
	t.is(findUnsendMenuItem(document), label)

	menu.innerHTML = ""
	const decomposed = document.createElement("span")
	decomposed.textContent = "zurücknehmen" // "zurücknehmen" with a combining diaeresis
	menu.append(decomposed)
	t.is(findUnsendMenuItem(document), decomposed)

	menu.innerHTML = ""
	const spaced = document.createElement("span")
	spaced.textContent = "  Ongedaan   maken "
	menu.append(spaced)
	t.is(findUnsendMenuItem(document), spaced)
})

test("findUnsendMenuItem does not match an unrelated menu entry", t => {
	const { document } = t.context
	const menu = document.createElement("div")
	menu.setAttribute("role", "menu")
	const label = document.createElement("span")
	label.textContent = "Reply"
	menu.append(label)
	document.body.append(menu)
	t.is(findUnsendMenuItem(document), undefined)
})

test("findActionButton finds the more options button by a localized aria-label, quotes included", t => {
	const { document } = t.context
	const { element } = createMessage(t)
	const button = document.createElement("div")
	button.setAttribute("role", "button")
	button.innerHTML = "<svg aria-label=\"Plus d'options\"></svg>"
	element.append(button)
	t.is(findActionButton(element), button)
})

test("collectHoverTargets walks down to a limited depth", t => {
	const root = t.context.document.createElement("div")
	let parent = root
	for(let depth = 0; depth < 12; depth++) {
		const child = t.context.document.createElement("div")
		parent.append(child)
		parent = child
	}
	const targets = collectHoverTargets(root)
	t.is(targets[0], root)
	t.is(targets.length, 9 + 1)
})
