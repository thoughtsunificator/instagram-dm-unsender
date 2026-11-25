/** @module unsend-feature Unsend all the messages of a conversation */

import { PageNavigation } from "../../page-navigation.js"
import { UnsendWorkflow } from "../../../../unsend-workflow/unsend-workflow.js"
import { OSD } from "./osd.js"
import { t } from "../../../../i18n/i18n.js"

export { UnsendFeature }

const BUG_REPORT_URL = "https://github.com/thoughtsunificator/instagram-dm-unsender/issues/new?template=bug_report.md"

/**
 * Shows the OSD on every conversation and runs an UnsendWorkflow on demand.
 *
 * While the workflow runs, keyboard interaction with the page is cancelled so that it cannot corrupt the run.
 *
 * @param {Window} window
 */
function UnsendFeature(window) {
	this.window = window
	this.navigation = new PageNavigation(window)
	this.thread = null
	this.osd = null
	this.workflow = null
	this.navigation.on("enter", thread => this.onEnterThread(thread))
	this.navigation.on("leave", () => this.onLeaveThread())
	this.navigation.on("error", error => console.error(error))
	this.onKeyEvent = event => this.filterKeyEvent(event)
	// Capture phase: runs before the page's own handlers
	window.document.addEventListener("keydown", this.onKeyEvent, true)
	window.document.addEventListener("keyup", this.onKeyEvent, true)
}

UnsendFeature.prototype.start = function() {
	this.navigation.start()
}

/**
 * @returns {boolean} true while a workflow is running
 */
UnsendFeature.prototype.isRunning = function() {
	return this.workflow !== null
}

UnsendFeature.prototype.onEnterThread = function(thread) {
	this.thread = thread
	this.osd = new OSD(this.window.document, { onToggle: () => this.toggle() })
	this.osd.render()
}

UnsendFeature.prototype.onLeaveThread = function() {
	this.stop()
	if(this.osd) {
		this.osd.remove()
	}
	this.osd = null
	this.thread = null
}

UnsendFeature.prototype.toggle = function() {
	if(this.isRunning()) {
		console.debug("User asked for messages unsending to stop")
		this.stop()
	} else {
		console.debug("User asked for messages unsending to start")
		this.run()
	}
}

UnsendFeature.prototype.run = function() {
	const { osd } = this
	const workflow = new UnsendWorkflow(this.thread)
	this.workflow = workflow
	workflow.on("status", text => osd.setStatus(text))
	workflow.on("start", () => osd.setRunning(true))
	workflow.on("end", () => {
		osd.setRunning(false)
		if(this.workflow === workflow) {
			this.workflow = null
		}
	})
	workflow.run().catch(error => {
		console.error(error)
		osd.setStatus(t("ui.error", { url: BUG_REPORT_URL }))
	})
}

UnsendFeature.prototype.stop = function() {
	if(this.workflow) {
		this.osd?.setStatus(t("ui.stopping"))
		this.workflow.stop()
	}
}

/**
 * @param {KeyboardEvent} event
 */
UnsendFeature.prototype.filterKeyEvent = function(event) {
	if(this.isRunning() && this.osd) {
		console.log("User interaction is disabled while unsending is running; stop the execution first.")
		event.stopImmediatePropagation()
		event.preventDefault()
		event.stopPropagation()
		this.osd.focusOverlay()
	}
}
