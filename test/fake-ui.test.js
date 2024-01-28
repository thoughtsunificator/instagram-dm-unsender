import { test } from "./setup.js"
import { createDummyMessageElement, createMessageActionsMenuElement } from "./fake-ui.js"

test("createDummyMessageElement click", t => {
	const dummyMessageElement = createDummyMessageElement(t.context.document)
	t.context.mountElement.append(dummyMessageElement)
	t.is(t.context.document.querySelector("[role=row]"), dummyMessageElement)
})

test("createMessageActionsMenuElement", t => {
	const messageActionsMenuElement = createMessageActionsMenuElement(t.context.document)
	t.context.mountElement.append(messageActionsMenuElement)
	t.not(messageActionsMenuElement.querySelector("#unsend"), null)
	t.is(messageActionsMenuElement.querySelector("button"), null)
	messageActionsMenuElement.querySelector("#unsend").click()
	t.is(messageActionsMenuElement.querySelector("#unsend"), null)
	t.not(messageActionsMenuElement.querySelector("button"), null)
})

test("createMessageActionsMenuElement click", t => {
	const messageActionsMenuElement = createMessageActionsMenuElement(t.context.document)
	t.context.mountElement.append(messageActionsMenuElement)
	t.not(messageActionsMenuElement.querySelector("#unsend"), null)
	t.is(messageActionsMenuElement.querySelector("button"), null)
	messageActionsMenuElement.querySelector("#unsend").click()
	t.is(messageActionsMenuElement.querySelector("#unsend"), null)
	t.not(messageActionsMenuElement.querySelector("#cancelUnsend"), null)
	t.not(messageActionsMenuElement.querySelector("#confirmUnsend"), null)
})
