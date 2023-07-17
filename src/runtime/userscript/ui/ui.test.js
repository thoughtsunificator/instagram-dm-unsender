import { test } from "../../../../test/test.js"
import UI from "./ui.js"
import { createMessagesWrapperElement } from "../../../../test/default-ui.js"

test("userscript ui render", t => {
	UI.render(t.context.window)
	t.is(t.context.window.document.querySelectorAll("button").length, 2)
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

