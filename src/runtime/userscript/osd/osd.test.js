import { test } from "../../../../test/setup.js"
import OSD from "./osd.js"
import { createMessagesWrapperElement } from "../../../../test/fake-ui.js"
import IDMU from "../../../idmu/idmu.js"
import { DefaultStrategy } from "../../../ui/default/unsend-strategy.js"
import { mock } from "node:test"

test("userscript osd", t => {
	const ui = OSD.render(t.context.window)
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

test("userscript osd render", t => {
	OSD.render(t.context.window)
	t.is(t.context.window.document.querySelectorAll("button").length, 1)
	t.pass()
})

test("userscript osd unsend button", t => {
	const ui = OSD.render(t.context.window)
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
	mock.method(ui._strategy, "isRunning", () => true)
	ui._strategy._abortController = new t.context.window.AbortController()
	button.click()
	t.is(button.textContent, "Unsend all DMs")
	t.is(overlayElement.style.display, "none")
	t.is(button.style.backgroundColor, "")
	t.is(overlayElement.style.display, "none")
})


test("userscript status", t => {
	const ui = OSD.render(t.context.window)
	t.is(t.context.document.querySelector("#idmu-status").textContent, "Ready")
	ui.onStatusText("test")
	t.is(t.context.document.querySelector("#idmu-status").textContent, "test")
})

