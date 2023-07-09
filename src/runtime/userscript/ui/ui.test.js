import { test } from "../../../../test/test.js"
import { render } from "./ui.js"
import { createMessagesWrapperElement } from "../../../../test/virtual-instagram.js"

test("userscript ui unsend button", t => {
	render(t.context.window)
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

