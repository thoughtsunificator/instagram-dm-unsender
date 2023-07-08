import { test } from "../../test/test.js"
import { clickElementAndWaitFor, waitForElement } from "./async-events.js"

test("waitForElement", async t => {
	const element = t.context.document.createElement("p")
	element.id = "test"
	const promise = waitForElement(t.context.document.body, () => t.context.document.querySelector("#test"))
	t.context.document.body.append(element)
	const target = await promise
	t.is(target.tagName, "P")
})

test("waitForElement #2", async t => {
	const element = t.context.document.createElement("p")
	element.id = "test"
	const promise = waitForElement(t.context.document.body, () => t.context.document.querySelector("#test") !== null)
	t.context.document.body.append(element)
	const target = await promise
	t.is(target, true)
})

test("waitForElement not found", async t => {
	const element = t.context.document.createElement("p")
	const promise = waitForElement(t.context.document.body, () => t.context.document.querySelector("#test") === null)
	t.context.document.body.append(element)
	const target = await promise
	t.is(target, true)
})

test("clickElementAndWaitFor #2", async t => {
	const element = t.context.document.createElement("p")
	element.id = "test"
	element.addEventListener("click", () => {
		t.context.document.body.innerHTML += `<div id="sup432"></div>`
	})
	t.context.document.body.append(element)
	const promise = clickElementAndWaitFor(element, t.context.document.body, () => t.context.document.querySelector("#sup432") !== null)
	const target = await promise
	t.is(target, true)
})

test("clickElementAndWaitFor not found", async t => {
	const element = t.context.document.createElement("p")
	element.id = "test"
	t.context.document.body.append(element)
	const promise = clickElementAndWaitFor(element, t.context.document.body, () => t.context.document.querySelector("#sup432") === null)
	const target = await promise
	t.is(target, true)
})

