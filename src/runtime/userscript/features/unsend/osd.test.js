import { test } from "../../../../../test/setup.js"
import { OSD } from "./osd.js"

function createOSD(t, handlers = { onToggle: () => {} }) {
	const osd = new OSD(t.context.document, handlers)
	osd.render()
	return osd
}

test("OSD renders the menu, the button and the status", t => {
	createOSD(t)
	t.not(t.context.document.getElementById("idmu-root"), null)
	t.is(t.context.document.getElementById("idmu-status").textContent, "Ready")
	t.is(t.context.document.querySelector("#idmu-menu button").textContent, "Unsend all DMs")
})

test("OSD button emits a toggle to its handler", t => {
	let toggled = 0
	const osd = createOSD(t, { onToggle: () => toggled++ })
	osd.button.root.click()
	t.is(toggled, 1)
})

test("OSD setRunning shows the overlay and changes the button", t => {
	const osd = createOSD(t)
	osd.setRunning(true)
	t.is(osd.overlayElement.style.display, "")
	t.is(osd.button.root.textContent, "Stop processing")
	osd.setRunning(false)
	t.is(osd.overlayElement.style.display, "none")
	t.is(osd.button.root.textContent, "Unsend all DMs")
})

test("OSD setStatus updates the status line and remove removes the UI", t => {
	const osd = createOSD(t)
	osd.setStatus("Done. 2 messages unsent.")
	t.is(osd.statusElement.textContent, "Done. 2 messages unsent.")
	osd.remove()
	t.is(t.context.document.getElementById("idmu-root"), null)
	t.is(t.context.document.getElementById("idmu-overlay"), null)
})
