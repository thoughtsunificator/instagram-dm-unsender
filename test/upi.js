import test from "ava"
import { JSDOM } from "jsdom"

import UIPI from "../src/uipi/uipi.js"

global.MutationObserver = new JSDOM().window.MutationObserver
global.Node = new JSDOM().window.Node
global.NodeFilter = new JSDOM().window.NodeFilter
global.MouseEvent = new JSDOM().window.MouseEvent
global.getComputedStyle = new JSDOM().window.getComputedStyle

test.beforeEach(t => {
	const virtualDOM = new JSDOM().window
	const { document } = virtualDOM.window
	t.context.document = document
	t.context.window = virtualDOM.window
	t.context.window.IDMU_MESSAGE_QUEUE_DELAY = 0
	t.context.window.IDMU_DRY_RUN = false
	t.context.window.IDMU_RETRY = false
})



test("Test", t => {
	t.pass()
})

// test("Instagram observe", async t => {
	// t.plan(2)
	// await new Promise(resolve => {
		// const instagram = new Instagram(t.context.window)
		// instagram.observe()
		// t.context.document.body.innerHTML += `<div><div>`
		// setTimeout(() => {
			// t.is(instagram.uiComponent, null)
			// t.deepEqual(instagram.messages.length, 0)
			// resolve()
		// })
	// })
// })
//
//
// test("Instagram observe messagesWrapper", async t => {
	// t.plan(1)
	// await new Promise(resolve => {
		// const instagram = new Instagram(t.context.window)
		// instagram.observe()
		// t.context.document.body.innerHTML += `<div role="grid"><div><div><div>div>`
		// setTimeout(() => {
			// t.not(instagram.uiComponent, null)
			// resolve()
		// })
	// })
// })
//
// test("Instagram observe messagesWrappe #2r", async t => {
	// t.plan(1)
	// await new Promise(resolve => {
		// const instagram = new Instagram(t.context.window)
		// instagram.observe()
		// t.context.document.body.innerHTML += `<section><div><div><div><div><div><div><div><div style="height: 100%"><div>`
		// setTimeout(() => {
			// t.not(instagram.uiComponent, null)
			// resolve()
		// })
	// })
// })

