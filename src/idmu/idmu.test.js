import { test } from "../../test/setup.js"
import UI from "../ui/ui.js"
import { createMessageElement, createMessagesWrapperElement } from "../../test/fake-ui.js"
import UIPI from "../uipi/uipi.js"
import { findMessagesWrapper } from "../ui/default/dom-lookup.js"
import IDMU from "./idmu.js"

// TODO use mock instead of testing the same methods twice

test("IDMU", t => {
	const ui = new UI(t.context.window)
	const uipi = new UIPI(ui)
	t.is(uipi.ui, ui)
})

test("IDMU fetchAndRenderThreadNextMessagePage", async t => {
	t.context.mountElement.append(createMessagesWrapperElement(t.context.document))
	const messagesWrapperElement = findMessagesWrapper(t.context.window)
	const idmu = new IDMU(t.context.window, () => {})
	idmu.loadUIPI()
	messagesWrapperElement.innerHTML += `<div role="progressbar"></div>`
	const result = idmu.fetchAndRenderThreadNextMessagePage( new AbortController())
	messagesWrapperElement.querySelector("[role=progressbar]").remove()
	t.is(await result, true)
})

test("IDMU getNextUIPIMessage", async t => {
	const messagesWrapperElement = createMessagesWrapperElement(t.context.document)
	t.context.mountElement.append(messagesWrapperElement)
	const messageElement = createMessageElement(t.context.document, "cxzc423Testsdfdsfsdfsdfds")
	const idmu = new IDMU(t.context.window, () => {})
	idmu.loadUIPI()
	findMessagesWrapper(t.context.window).appendChild(messageElement)
	const uipiMessages = await idmu.getNextUIPIMessage()
	t.is(uipiMessages.length, 1)
	t.is(uipiMessages[0].uiMessage.root.querySelector("span").textContent, "cxzc423Testsdfdsfsdfsdfds")
})


test("IDMU onStatusText", t => {
	let text = ""
	const callback = () => {
		text = "text"
	}
	const idmu = new IDMU(t.context.window, callback)
	idmu.loadUIPI()
	idmu.onStatusText("text")
	t.is(text, "text")
})
