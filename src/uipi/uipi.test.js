import { test } from "../../test/setup.js"
import DefaultUI from "../ui/default/default-ui.js"
import { createMessagesWrapperElement } from "../../test/fake-ui.js"
import { mock } from "node:test"
import UIPI from "./uipi.js"
import getUI from "../ui/get-ui.js"

test.beforeEach(t => {
	t.context.mountElement.append(createMessagesWrapperElement(t.context.document))
})

test("UIPI", t => {
	const ui = new DefaultUI(t.context.window)
	const uipi = new UIPI(ui)
	t.is(uipi.ui, ui)
})

test("UIPI create", t => {
	const uiClass = getUI()
	mock.method(uiClass, "create")
	const uipi = UIPI.create(t.context.window)
	t.true(uipi instanceof UIPI)
	t.true(uipi.ui instanceof DefaultUI)
	const call = uiClass.create.mock.calls[0]
  	t.deepEqual(call.arguments, [t.context.window])
  	t.is(uiClass.create.mock.callCount(), 1)
})

test("UIPI fetchAndRenderThreadNextMessagePage", t => {
	const uipi = UIPI.create(t.context.window)
	mock.method(uipi.ui, "fetchAndRenderThreadNextMessagePage")
	const abortController = new AbortController()
	uipi.fetchAndRenderThreadNextMessagePage(abortController)
	const call = uipi.ui.fetchAndRenderThreadNextMessagePage.mock.calls[0]
	t.deepEqual(call.arguments, [abortController])
	t.is(uipi.ui.fetchAndRenderThreadNextMessagePage.mock.callCount(), 1)
})

test("UIPI getNextUIPIMessage", t => {
	const uipi = UIPI.create(t.context.window)
	mock.method(uipi.ui, "getNextUIPIMessage")
	const abortController = new AbortController()
	uipi.getNextUIPIMessage(abortController)
	const call = uipi.ui.getNextUIPIMessage.mock.calls[0]
	t.deepEqual(call.arguments, [abortController])
	t.is(uipi.ui.getNextUIPIMessage.mock.callCount(), 1)
})
