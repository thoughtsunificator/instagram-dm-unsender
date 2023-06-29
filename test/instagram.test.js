import test from "ava"
import { JSDOM } from "jsdom"

import Instagram from "../src/instagram/instagram.js"

global.MutationObserver = new JSDOM().window.MutationObserver
global.Node = new JSDOM().window.Node
global.MouseEvent = new JSDOM().window.MouseEvent

test.beforeEach(t => {
	const virtualDOM = new JSDOM().window
	const { document } = virtualDOM.window
	t.context.document = document
	t.context.window = virtualDOM.window
	t.context.window.IDMU_MESSAGE_QUEUE_DELAY = 0
	t.context.window.IDMU_DRY_RUN = false
	t.context.window.IDMU_RETRY = false
})

test("Instagram observe", async t => {
	t.plan(2)
	await new Promise(resolve => {
		const instagram = new Instagram(t.context.window)
		instagram.observe()
		t.context.document.body.innerHTML += `<div><div>`
		setTimeout(() => {
			t.is(instagram.ui, null)
			t.deepEqual(instagram.messages.length, 0)
			resolve()
		})
	})
})

test("Instagram observe messagesWrapper", async t => {
	t.plan(1)
	await new Promise(resolve => {
		const instagram = new Instagram(t.context.window)
		instagram.observe()
		t.context.document.body.innerHTML += `<div><div><div><div><div><textarea dir="auto"></div></div></div></div></div>`
		setTimeout(() => {
			t.not(instagram.ui, null)
			resolve()
		})
	})
})

test("Instagram observe messagesWrapper #2", async t => {
	t.plan(1)
	await new Promise(resolve => {
		const instagram = new Instagram(t.context.window)
		instagram.observe()
		t.context.document.body.innerHTML += `<div><div><div><div><textarea dir="auto"></div></div></div></div>`
		setTimeout(() => {
			t.is(instagram.ui, null)
			resolve()
		})
	})
})

test("Instagram observe messagesWrapper #3", async t => {
	t.plan(1)
	await new Promise(resolve => {
		const instagram = new Instagram(t.context.window)
		instagram.observe()
		t.context.document.body.innerHTML += `<div><div><div><div><textarea dir="auto"></div></div></div></div>`
		setTimeout(() => {
			t.is(instagram.ui, null)
			resolve()
		})
	})
})