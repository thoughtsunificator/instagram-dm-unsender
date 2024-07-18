/** setups/teardowns */

import test from "ava"
import { JSDOM } from "jsdom"
import debug from "debug"
import { createMountElement } from "./fake-ui.js"

global.NodeFilter = new JSDOM().window.NodeFilter
global.MouseEvent = new JSDOM().window.MouseEvent
global.getComputedStyle = new JSDOM().window.getComputedStyle
global.MutationObserver = new JSDOM().window.MutationObserver
global.Node = new JSDOM().window.Node
global.MouseEvent = new JSDOM().window.MouseEvent
const oldSetTimeout = setTimeout
global.setTimeout = (callback) => {
	return oldSetTimeout(callback, 0)
}
const oldSetInterval = setInterval
global.setInterval = (callback) => {
	return oldSetInterval(callback, 0)
}

test.beforeEach(t => {
	const jsdom = new JSDOM("<!doctype html><html><body></body></html>", {
		url: "http://localhost/",
	})
	jsdom.window.Element.prototype.checkVisibility = () => true
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
