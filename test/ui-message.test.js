import test from "ava"
import { JSDOM } from "jsdom"

import SAMPLE_FRANCE_PAGE_HTML from "./sample/france/page.js"

import UIMessageStub from "./ui/ui-message.js"
import UIMessage from "../src/instagram/ui/ui-message.js"

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

test("UIMessage showActionsMenu throws", async t => {
	t.context.document.body.innerHTML = SAMPLE_FRANCE_PAGE_HTML
	const node = t.context.document.createElement("div")
	const uiMessage = new UIMessage(node)
	try {
		await uiMessage.showActionsMenu()
	} catch(ex) {
		console.error(ex)
		t.pass()
	}
})

test("UIMessage showActionsMenu", async t => {
	t.context.document.body.innerHTML = SAMPLE_FRANCE_PAGE_HTML
	const node = t.context.document.createElement("div")
	const uiMessage = new UIMessage(node)
	new UIMessageStub(uiMessage).registerDefaultActions()
	await uiMessage.showActionsMenu()
	t.pass()
})
