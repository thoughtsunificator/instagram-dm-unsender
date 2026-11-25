import { test } from "../../../../../test/setup.js"
import { UnsendFeature } from "./unsend-feature.js"
import { OSD } from "./osd.js"

test("UnsendFeature cancels keyboard events while a workflow runs", t => {
	const feature = new UnsendFeature(t.context.window)
	feature.osd = new OSD(t.context.document, { onToggle: () => {} })
	feature.osd.render()
	feature.workflow = { stop() {} }
	const event = new t.context.window.KeyboardEvent("keydown", { cancelable: true, bubbles: true })
	t.context.document.body.dispatchEvent(event)
	t.true(event.defaultPrevented)
})

test("UnsendFeature lets keyboard events through when idle", t => {
	const feature = new UnsendFeature(t.context.window)
	feature.osd = new OSD(t.context.document, { onToggle: () => {} })
	feature.osd.render()
	const event = new t.context.window.KeyboardEvent("keydown", { cancelable: true, bubbles: true })
	t.context.document.body.dispatchEvent(event)
	t.false(event.defaultPrevented)
})
