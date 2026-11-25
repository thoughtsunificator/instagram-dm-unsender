import { test } from "../../../test/setup.js"
import { createMessageElement } from "../../../test/fake-ui.js"
import { DebugLog, snapshotMessageRow, explainRow } from "./debug.js"

test("DebugLog stores entries and formats text", t => {
	const log = new DebugLog(2)
	log.info("hello", { a: 1 })
	log.warn("world")
	t.is(log.entries.length, 2)
	t.true(log.formatText().includes("INFO hello"))
	log.error("third")
	t.is(log.entries.length, 2)
	t.false(log.formatText().includes("hello"))
	t.true(log.formatText().includes("ERROR third"))
})

test("snapshotMessageRow reports action button and sent state", t => {
	const element = createMessageElement({ document: t.context.document, text: "Hi", includesUnsend: true })
	t.context.mountElement.append(element)
	const snap = snapshotMessageRow(element)
	t.true(snap.sentByCurrentUser)
	t.truthy(snap.actionButton === null || typeof snap.actionButton === "object")
	t.is(snap.isConnected, true)
})


test("explainRow reports why a row is selected", t => {
	const element = createMessageElement({ document: t.context.document, text: "Hi", includesUnsend: true })
	t.context.mountElement.append(element)
	const info = explainRow(element)
	t.true(typeof info.sentByCurrentUser === "boolean")
	t.true(Array.isArray(info.reasons))
})
