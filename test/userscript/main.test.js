import { test } from "../test.js"
import { render } from "../../src/runtime/userscript/ui/ui.js"
import { createMessagesWrapperElement } from "../virtual-instagram.js"

test("usercript ui render", async t => {
	render(t.context.window)
	t.is(t.context.window.document.querySelectorAll("button").length, 2)
	t.pass()
})

test("usercript ui unsend button", async t => {
	render(t.context.window)
	let alerted = false
	t.context.window.alert = () => { alerted = true }
	const messagesWrapperElement = createMessagesWrapperElement(t.context.document)
	t.context.document.body.append(messagesWrapperElement)
	const button = t.context.window.document.querySelectorAll("button")[0]
	button.click()
	t.is(button.style.backgroundColor, "rgb(250, 56, 62)")
	t.is(button.textContent, "Stop processing")
	await new Promise(resolve => setTimeout(resolve, 100))
	t.is(alerted, true)
	t.is(button.style.backgroundColor, "")
	t.is(button.textContent, "Unsend all DMs")
	alerted = false
	button.click()
	t.is(alerted, false)
	t.is(button.textContent, "Stop processing")
	t.is(button.style.backgroundColor, "rgb(250, 56, 62)")
	button.click()
	t.is(button.textContent, "Unsend all DMs")
})
