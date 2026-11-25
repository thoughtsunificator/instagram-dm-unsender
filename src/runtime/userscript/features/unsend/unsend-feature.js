/** @module unsend-feature Unsend all the messages of a conversation */

import { PageNavigation } from "../../page-navigation.js"
import { UnsendWorkflow } from "../../../../unsend-workflow/unsend-workflow.js"
import { OSD } from "./osd.js"
import { t } from "../../../../i18n/i18n.js"
import { DebugLog, installDebugGlobal, snapshotThread } from "../../debug.js"
import { createOnboardingModal, shouldShowOnboarding } from "./onboarding-modal.js"

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
	this.debugLog = new DebugLog()
	this.navigation.on("enter", thread => this.onEnterThread(thread))
	this.navigation.on("leave", () => this.onLeaveThread())
	this.navigation.on("error", error => {
		this.debugLog.error("Navigation error", { message: error?.message, stack: error?.stack })
		console.error(error)
	})
	this.onKeyEvent = event => this.filterKeyEvent(event)
	// Capture phase: runs before the page's own handlers
	window.document.addEventListener("keydown", this.onKeyEvent, true)
	window.document.addEventListener("keyup", this.onKeyEvent, true)
	installDebugGlobal(window, {
		log: this.debugLog,
		getThread: () => this.thread,
	})
	window.__idmuFeature = this
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
	if(this.osd) {
		this.debugLog.warn("Duplicate OSD detected; removing previous instance")
		this.osd.remove()
		this.osd = null
	}
	this.thread = thread
	this.debugLog.info("Entered thread", { url: this.window.location.href })
	this.osd = new OSD(this.window.document, {
		onToggle: () => this.toggle(),
		debugLog: this.debugLog,
		getDebugReport: () => this.buildDebugReport(),
		onSnapshot: () => snapshotThread(this.thread),
	})
	this.osd.render()
	this.installTestApi()
	if(shouldShowOnboarding(this.window)) {
		const modal = createOnboardingModal(this.window.document)
		this.window.document.body.append(modal.root)
	}
}

UnsendFeature.prototype.onLeaveThread = function() {
	this.debugLog.info("Leaving thread")
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
		this.debugLog.info("User requested stop")
		this.stop()
	} else {
		console.debug("User asked for messages unsending to start")
		this.debugLog.info("User requested start")
		this.run()
	}
}

UnsendFeature.prototype.run = function() {
	const { osd } = this
	const workflow = new UnsendWorkflow(this.thread)
	this.workflow = workflow
	workflow.on("status", text => {
		osd.setStatus(text)
		this.debugLog.debug("Workflow status", { text })
	})
	workflow.on("metrics", metric => {
		if(metric.type === "counter" && (metric.name === "unsent" || metric.name === "failures")) {
			osd.setProgress({ unsent: workflow.metrics.counters.unsent ?? 0, failures: workflow.metrics.counters.failures ?? 0 })
		}
		this.debugLog.debug("Workflow metric", metric)
	})
	osd.setProgress({ unsent: 0, failures: 0 })
	workflow.on("start", () => {
		osd.setRunning(true)
		this.debugLog.info("Workflow started")
	})
	workflow.on("end", result => {
		osd.setRunning(false)
		this.debugLog.info("Workflow ended", result)
		if(this.workflow === workflow) {
			this.workflow = null
		}
	})
	workflow.run().catch(error => {
		console.error(error)
		this.debugLog.error("Workflow crashed", { message: error?.message, stack: error?.stack, name: error?.name })
		osd.setStatus(t("ui.error", { url: BUG_REPORT_URL }))
	})
}

UnsendFeature.prototype.stop = function() {
	if(this.workflow) {
		this.osd?.setStatus(t("ui.stopping"))
		this.workflow.stop()
	}
}

UnsendFeature.prototype.installTestApi = function() {
	const self = this
	this.window.__idmuTest = {
		start: () => { if(!self.isRunning()) self.run() },
		stop: () => self.stop(),
		toggle: () => self.toggle(),
		isRunning: () => self.isRunning(),
		getState: () => ({
			running: self.isRunning(),
			status: self.osd?.statusElement?.textContent || null,
			progress: self.osd?.progressElement?.textContent || null,
			unsent: self.workflow?.metrics?.counters?.unsent ?? 0,
			failures: self.workflow?.metrics?.counters?.failures ?? 0,
		}),
		waitForEnd: (timeoutMs = 30000) => new Promise((resolve, reject) => {
			const start = Date.now()
			const tick = () => {
				const ended = (self.debugLog?.getEntries?.() || []).filter(e => e.message === "Workflow ended").at(-1)
				if(ended) return resolve(ended.data || ended)
				if(Date.now() - start > timeoutMs) return reject(new Error("waitForEnd timeout"))
				setTimeout(tick, 100)
			}
			tick()
		}),
		getDebugReport: () => self.buildDebugReport(),
		snapshot: () => snapshotThread(self.thread),
	}
}

UnsendFeature.prototype.buildDebugReport = function() {
	const snapshot = snapshotThread(this.thread)
	const lines = [
		"# instagram-dm-unsender debug report",
		`url: ${this.window.location.href}`,
		`userAgent: ${this.window.navigator.userAgent}`,
		`running: ${this.isRunning()}`,
		"",
		"## Snapshot",
		JSON.stringify(snapshot, null, 2),
		"",
		"## Log",
		this.debugLog.formatText(),
	]
	return lines.join("\n")
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
