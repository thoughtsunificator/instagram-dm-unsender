import test from "ava"
import { JSDOM } from "jsdom"
import debug from "debug"
import { createMountElement } from "./default-ui.js"

global.NodeFilter = new JSDOM().window.NodeFilter
global.MouseEvent = new JSDOM().window.MouseEvent
global.getComputedStyle = new JSDOM().window.getComputedStyle
global.MutationObserver = new JSDOM().window.MutationObserver
global.Node = new JSDOM().window.Node
global.MouseEvent = new JSDOM().window.MouseEvent

test.beforeEach(t => {
	const jsdom = new JSDOM("<!doctype html><html><body></body></html>", {
		url: "http://localhost/",
	})
	const virtualDOM = jsdom.window
	const { document } = virtualDOM.window
	const mountElement = createMountElement(document)
	document.body.appendChild(mountElement)
	t.context.mountElement = mountElement
	t.context.document = document
	t.context.window = virtualDOM.window
})


console.debug = debug("idmu:test")

export { test }
