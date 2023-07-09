import { test } from "../../test/test.js"
import UI from "../ui/ui.js"
import { createMessageElement, createMessagesWrapperElement } from "../../test/virtual-instagram.js"
import UIPI from "../uipi/uipi.js"
import findMessagesWrapperStrategy from "../ui/strategy/find-messages-wrapper-strategy.js"
import IDMU from "./idmu.js"

test("IDMU", t => {
	const ui = new UI(t.context.window)
	const uipi = new UIPI(ui)
	t.is(uipi.uiComponent, ui)
})

test("IDMU fetchAndRenderThreadNextMessagePage", async t => {
	t.context.mountElement.append(createMessagesWrapperElement(t.context.document))
	const messagesWrapperElement = findMessagesWrapperStrategy(t.context.window)
	const idmu = new IDMU(t.context.window)
	messagesWrapperElement.innerHTML += `<div role="progressbar"></div>`
	const result = idmu.fetchAndRenderThreadNextMessagePage()
	messagesWrapperElement.querySelector("[role=progressbar]").remove()
	t.is(await result, true)
})

test("IDMU createUIPIMessages", async t => {
	const messagesWrapperElement = createMessagesWrapperElement(t.context.document)
	t.context.mountElement.append(messagesWrapperElement)
	const messageElement = createMessageElement(t.context.document, "cxzc423Testsdfdsfsdfsdfds")
	const idmu = new IDMU(t.context.window)
	findMessagesWrapperStrategy(t.context.window).appendChild(messageElement)
	const uiMessages = await idmu.createUIPIMessages()
	t.is(uiMessages.length, 1)
	t.is(uiMessages[0].uiComponent.root.querySelector("span").textContent, "cxzc423Testsdfdsfsdfsdfds")
})
