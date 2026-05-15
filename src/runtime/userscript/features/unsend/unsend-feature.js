import { ThreadsPageNavigation } from "./threads-page-navigation.js"
import { Observable } from "../../../../event/observable.js"

export { UnsendFeature }

/**
 * @param {Window} window
 */
function UnsendFeature(window) {
	const feature = new Observable()
	const workflow = new UnsendWorkflow()
	const navigation = new ThreadsPageNavigation()
	renderUI(workflow)
	filterInteractions(navigation, workflow)
}

function renderUI() {
	const osd = ThreadPageWorkflowOSD()
}

function onThreadPageEnter() {
	window.document.body.appendChild(threadPageWorkflowOSD.root)
}

function onThreadPageLeave() {
	workflow.stop()
	threadPageWorkflowOSD.remove()
}

/**
 * When workflow is running, filter user interactions to avoid corrupting it
 * This is done by cancelling keydown
 */
function filterInteractions(navigation, workflow) {
	workflow.on("run", () => toggleListener(true))
	workflow.on("stop", () => toggleListener(false))
	navigation.on("enter", () => toggleListener(true))
	navigation.on("leave", () => toggleListener(false))
	let listener = null
	function toggleListener(enable) {
		if(enable) {
			listener = window.addEventListener("keydown", () => {
				// Replace with a non-blocking alert
				console.log("User interaction is disabled as the unsending is still running; Please stop the execution first.")
				event.stopImmediatePropagation()
				event.preventDefault()
				event.stopPropagation()
				feature.emit("userInteractionPrevented")
				return false
			})
		} else if(listener) {
			window.removeEventListener(listener)
		}
	}
}
