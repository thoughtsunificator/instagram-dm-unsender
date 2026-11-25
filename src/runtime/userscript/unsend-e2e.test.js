import { test } from "../../../test/setup.js"
import { createMessagesWrapperElement } from "../../../test/fake-ui.js"
import { main } from "./main.js"

/**
 * Polls condition until it holds (no fixed sleep)
 *
 * @param {function(): boolean} condition
 * @returns {Promise<void>}
 */
function waitFor(condition) {
	return new Promise((resolve, reject) => {
		let attempts = 0
		const check = () => {
			if(condition()) {
				resolve()
			} else if(++attempts > 2000) {
				reject(new Error("waitFor timed out"))
			} else {
				setTimeout(check, 1)
			}
		}
		check()
	})
}

test("the Unsend button unsends every message of the conversation", async t => {
	const { document, window } = t.context
	window.history.pushState({}, "", "/direct/t/1")
	const element = createMessagesWrapperElement({ document, totalPages: 0, itemsPerPage: 2 })
	document.body.append(element)
	const root = element.querySelector("#messageWrapper")
	for(const child of root.children) {
		child.getBoundingClientRect = () => ({ x: 0, y: 105, width: 300, height: 50 })
	}

	main(window)

	const button = document.querySelector("#idmu-menu button")
	t.is(button.textContent, "Unsend all DMs")
	button.click()
	await waitFor(() => document.getElementById("idmu-status").textContent.startsWith("Done."))
	t.is(document.getElementById("idmu-status").textContent, "Done. 2 messages unsent.")
	t.is(root.children.length, 0)
	t.is(button.textContent, "Unsend all DMs")
})
