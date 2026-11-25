import { test } from "../../test/setup.js"
import { waitForElementWithTimeout, clickElementAndWaitForWithTimeout } from "./async-events.js"

test("waitForElementWithTimeout rejects when the element never appears", async t => {
	await t.throwsAsync(() => waitForElementWithTimeout(t.context.document.body, () => t.context.document.querySelector("#missing"), 50, new AbortController()), { message: /Timeout after 50ms|aborted/ })
})

test("waitForElementWithTimeout resolves when the element appears", async t => {
	const promise = waitForElementWithTimeout(t.context.document.body, () => t.context.document.querySelector("#present"), 1000, new AbortController())
	const element = t.context.document.createElement("p")
	element.id = "present"
	t.context.document.body.append(element)
	t.is(await promise, element)
})

test("clickElementAndWaitForWithTimeout clicks then resolves with the new element", async t => {
	const button = t.context.document.createElement("button")
	button.addEventListener("click", () => {
		const dialog = t.context.document.createElement("div")
		dialog.id = "dialog"
		t.context.document.body.append(dialog)
	})
	t.context.document.body.append(button)
	const element = await clickElementAndWaitForWithTimeout(button, t.context.document.body, () => t.context.document.querySelector("#dialog"), 1000, new AbortController())
	t.is(element.id, "dialog")
})

test("waitForElementWithTimeout rejects when the parent is aborted", async t => {
	const controller = new AbortController()
	const promise = waitForElementWithTimeout(t.context.document.body, () => null, 60000, controller)
	controller.abort("user")
	await t.throwsAsync(() => promise, { message: /aborted: user/ })
})
