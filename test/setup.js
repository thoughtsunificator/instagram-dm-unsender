/** setups/teardowns */

import test from "ava"
import { JSDOM } from "jsdom"
import { createMountElement } from "./fake-ui.js"

global.NodeFilter = new JSDOM().window.NodeFilter
global.MouseEvent = new JSDOM().window.MouseEvent
global.getComputedStyle = new JSDOM().window.getComputedStyle
global.MutationObserver = new JSDOM().window.MutationObserver
global.Node = new JSDOM().window.Node
// PointerEvent and KeyboardEvent are not in jsdom; stub them as MouseEvent subclasses
if (typeof globalThis.PointerEvent === "undefined") {
	globalThis.PointerEvent = class PointerEvent extends new JSDOM().window.MouseEvent {
		constructor(type, params = {}) {
			super(type, params)
			this.pointerId = params.pointerId ?? 0
			this.pointerType = params.pointerType ?? ""
		}
	}
}
if (typeof globalThis.KeyboardEvent === "undefined") {
	globalThis.KeyboardEvent = new JSDOM().window.KeyboardEvent ?? class KeyboardEvent extends new JSDOM().window.Event {
		constructor(type, params = {}) {
			super(type, params)
			this.key = params.key ?? ""
		}
	}
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

export { test }
