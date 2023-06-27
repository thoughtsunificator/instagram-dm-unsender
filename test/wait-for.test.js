import test from "ava"
import { JSDOM } from "jsdom"

import waitFor from "../src/dom/wait-for.js";

global.MutationObserver = new JSDOM().window.MutationObserver
global.Node = new JSDOM().window.Node
global.MouseEvent = new JSDOM().window.MouseEvent
global.NodeFilter = new JSDOM().window.NodeFilter

test.beforeEach(t => {
	const virtualDOM = new JSDOM().window
	const { document } = virtualDOM.window
	t.context.document = document
	t.context.window = virtualDOM.window
	t.context.window.IDMU_MESSAGE_QUEUE_DELAY = 0
	t.context.window.IDMU_DRY_RUN = false
	t.context.window.IDMU_RETRY = false
})

test("waitFor", async t => {
	t.context.document.body.innerHTML = "<div><p></p></div>"
	const target = await waitFor(t.context.document.body, (node) => {
		if(node.tagName === "P") {
			return node
		}
	})
	t.is(target.tagName, "P")
})

