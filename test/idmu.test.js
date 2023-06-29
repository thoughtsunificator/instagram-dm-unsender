import test from "ava"
import { JSDOM } from "jsdom"

import SAMPLE_FRANCE_PAGE_HTML from "./sample/france/page.js"
import SAMPLE_USA_PAGE_HTML from "./sample/usa/page.js"

import IDMU from "../src/idmu/idmu.js"



global.NodeFilter = new JSDOM().window.NodeFilter
global.MouseEvent = new JSDOM().window.MouseEvent
global.getComputedStyle = new JSDOM().window.getComputedStyle
global.MutationObserver = new JSDOM().window.MutationObserver
global.Node = new JSDOM().window.Node
global.MouseEvent = new JSDOM().window.MouseEvent

test.beforeEach(t => {
	const virtualDOM = new JSDOM().window
	const { document } = virtualDOM.window
	t.context.document = document
	t.context.window = virtualDOM.window
	t.context.window.IDMU_INCLUDE_MEDIA = true
	t.context.window.IDMU_MESSAGE_QUEUE_DELAY = 0
	t.context.window.IDMU_DRY_RUN = false
	t.context.window.IDMU_RETRY = false
})


test("SAMPLE_FRANCE_PAGE_HTML", async t => {
	t.context.window.IDMU_INCLUDE_MEDIA = true
	t.plan(1)
	const idmu = new IDMU(t.context.window)
	await new Promise((resolve) => {
		setTimeout(() => {
			t.is(idmu.instagram.messages.length, 11)
			resolve()
		})
		idmu.instagram.observe(() => null, () => null)
		t.context.document.body.innerHTML = SAMPLE_FRANCE_PAGE_HTML
	})

})

test("SAMPLE_USA_PAGE_HTML", async t => {
	t.context.window.IDMU_INCLUDE_MEDIA = true
	t.plan(1)
	await new Promise((resolve) => {
		const idmu = new IDMU(t.context.window)
		setTimeout(() => {
			t.is(idmu.instagram.messages.length, 20)
			resolve()
		})
		idmu.instagram.observe(() => null, () => null)
		t.context.document.body.innerHTML = SAMPLE_USA_PAGE_HTML
	})
})
