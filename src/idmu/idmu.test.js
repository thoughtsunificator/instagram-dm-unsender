import { test } from "../../test/setup.js"
import UI from "../ui/ui.js"
import { createMessagesWrapperElement } from "../../test/fake-ui.js"
import UIPI from "../uipi/uipi.js"
import IDMU from "./idmu.js"
import { mock } from "node:test"

test.beforeEach(t => {
	t.context.mountElement.append(createMessagesWrapperElement(t.context.document))
})

// TODO use mock instead of testing the same methods twice

test("IDMU", t => {
	const ui = new UI(t.context.window)
	const uipi = new UIPI(ui)
	t.is(uipi.ui, ui)
})

test("IDMU loadUIPI", t => {
	const idmu = new IDMU(t.context.window, () => {})
	mock.method(UIPI, "create")
	idmu.loadUIPI()
	const call = UIPI.create.mock.calls[0]
	t.deepEqual(call.arguments, [idmu.window])
	t.is(UIPI.create.mock.callCount(), 1)
})

test("IDMU fetchAndRenderThreadNextMessagePage", t => {
	const idmu = new IDMU(t.context.window, () => {})
	idmu.loadUIPI()
	mock.method(idmu.uipi, "fetchAndRenderThreadNextMessagePage")
	const abortController = new AbortController()
	idmu.uipi.fetchAndRenderThreadNextMessagePage(abortController)
	const call = idmu.uipi.fetchAndRenderThreadNextMessagePage.mock.calls[0]
	t.deepEqual(call.arguments, [abortController])
	t.is(idmu.uipi.fetchAndRenderThreadNextMessagePage.mock.callCount(), 1)
})

test("IDMU getNextUIPIMessage", t => {
	const idmu = new IDMU(t.context.window, () => {})
	idmu.loadUIPI()
	mock.method(idmu.uipi, "getNextUIPIMessage")
	const abortController = new AbortController()
	idmu.uipi.getNextUIPIMessage(abortController)
	const call = idmu.uipi.getNextUIPIMessage.mock.calls[0]
	t.deepEqual(call.arguments, [abortController])
	t.is(idmu.uipi.getNextUIPIMessage.mock.callCount(), 1)
})


test("IDMU onStatusText", t => {
	let text = ""
	const callback = () => {
		text = "text"
	}
	const idmu = new IDMU(t.context.window, callback)
	// TODO replace with mock
	idmu.loadUIPI()
	idmu.onStatusText("text")
	t.is(text, "text")
})
