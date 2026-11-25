import { test } from "../../../test/setup.js"
import { PageNavigation } from "./page-navigation.js"

test("PageNavigation emits enter and leave when the thread changes", t => {
	let current = null
	const navigation = new PageNavigation(t.context.window, () => current)
	const events = []
	navigation.on("enter", thread => events.push(["enter", thread.id]))
	navigation.on("leave", thread => events.push(["leave", thread.id]))
	navigation.start()
	current = { id: 1, root: {} }
	navigation.check()
	navigation.check()
	current = null
	navigation.check()
	t.deepEqual(events, [["enter", 1], ["leave", 1]])
})

test("PageNavigation emits leave on stop while a thread is open", t => {
	const thread = { id: 2, root: {} }
	const navigation = new PageNavigation(t.context.window, () => thread)
	const events = []
	navigation.on("leave", () => events.push("leave"))
	navigation.start()
	navigation.stop()
	t.deepEqual(events, ["leave"])
})

test("PageNavigation emits a single error while discovery keeps failing", t => {
	const navigation = new PageNavigation(t.context.window, () => {
		throw new Error("broken selector")
	})
	const errors = []
	navigation.on("error", error => errors.push(error.message))
	navigation.check()
	navigation.check()
	t.deepEqual(errors, ["broken selector"])
})
