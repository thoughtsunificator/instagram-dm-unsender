import { test } from "./test.js"
import UI from "../src/ui/ui.js"
import { createMessageElement, createMessagesWrapperElement } from "./virtual-instagram.js"
import UIPI from "../src/uipi/uipi.js"
import findMessagesWrapperStrategy from "../src/ui/strategy/find-messages-wrapper-strategy.js"
import IDMU from "../src/idmu/idmu.js"

test("IDMU", async t => {
	const ui = new UI(t.context.window)
	const uipi = new UIPI(ui)
	t.is(uipi.uiComponent, ui)
})

test("IDMU fetchAndRenderThreadNextMessagePage", async t => {
	const messagesWrapperElement = createMessagesWrapperElement(t.context.document)
	t.context.document.body.append(messagesWrapperElement)
	const idmu = new IDMU(t.context.window)
	const result = idmu.fetchAndRenderThreadNextMessagePage()
	idmu.uipi.uiComponent.identifier.uiMessagesWrapper.root.scrollTop = 1
	idmu.uipi.uiComponent.identifier.uiMessagesWrapper.root.innerHTML += "<div></div>"
	t.is(await result, false)
})

test("IDMU createUIPIMessages", async t => {
	const messagesWrapperElement = createMessagesWrapperElement(t.context.document)
	t.context.document.body.append(messagesWrapperElement)
	const messageElement = createMessageElement(t.context.document, "cxzc423Testsdfdsfsdfsdfds")
	const idmu = new IDMU(t.context.window)
	findMessagesWrapperStrategy(t.context.window).appendChild(messageElement)
	console.debug(t.context.document.body.outerHTML)
	const uiMessages = await idmu.createUIPIMessages()
	t.is(uiMessages.length, 1)
	t.is(uiMessages[0].uiComponent.root.querySelector("span").textContent, "cxzc423Testsdfdsfsdfsdfds")
})
