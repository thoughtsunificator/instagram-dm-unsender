import test from "ava"
import { JSDOM } from "jsdom"
import debug from "debug"

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
	t.context.document = document
	t.context.window = virtualDOM.window
	t.context.window.IDMU_DEBUG = true
})


console.debug = debug("idmu:test")

export { test }
