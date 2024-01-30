import { test } from "../../../../test/setup.js"
import UI from "./ui.js"
import { createMessagesWrapperElement } from "../../../../test/fake-ui.js"
import IDMU from "../../../idmu/idmu.js"
import { DefaultStrategy } from "../../../ui/default/unsend-strategy.js"

test("userscript ui", t => {
	const ui = UI.render(t.context.window)
	t.is(ui._document, t.context.document)
	t.is(ui._root, t.context.document.querySelector("#idmu-root"))
	t.is(ui._overlayElement, t.context.document.querySelector("#idmu-overlay"))
	t.is(ui._menuElement, t.context.document.querySelector("#idmu-menu"))
	t.is(ui._statusElement, t.context.document.querySelector("#idmu-status"))
	t.is(ui._unsendThreadMessagesButton, t.context.window.document.querySelectorAll("button")[0])
	t.true(ui._idmu instanceof IDMU)
	t.true(ui._strategy instanceof DefaultStrategy)
	t.pass()
})

test("userscript ui render", t => {
	UI.render(t.context.window)
	t.is(t.context.window.document.querySelectorAll("button").length, 1)
	t.pass()
})

test("userscript ui unsend button", t => {
	UI.render(t.context.window)
	let alerted = false
	t.context.window.alert = () => { alerted = true }
	const messagesWrapperElement = createMessagesWrapperElement(t.context.document)
	const overlayElement = t.context.document.querySelector("#idmu-overlay")
	t.context.mountElement.append(messagesWrapperElement)
	const button = t.context.window.document.querySelectorAll("button")[0]
	t.is(button.style.backgroundColor, "")
	t.is(button.textContent, "Unsend all DMs")
	t.is(overlayElement.style.display, "none")
	button.click()
	t.is(button.style.backgroundColor, "rgb(250, 56, 62)")
	t.is(button.textContent, "Stop processing")
	t.is(overlayElement.style.display, "")
	alerted = false
	button.click()
	t.is(alerted, false)
	t.is(overlayElement.style.display, "none")
	t.is(button.style.backgroundColor, "")
	t.is(button.textContent, "Unsend all DMs")
	t.is(overlayElement.style.display, "none")
})


test("userscript status", t => {
	const ui = UI.render(t.context.window)
	t.is(t.context.document.querySelector("#idmu-status").textContent, "Ready")
	ui.onStatusText("test")
	t.is(t.context.document.querySelector("#idmu-status").textContent, "test")
})

