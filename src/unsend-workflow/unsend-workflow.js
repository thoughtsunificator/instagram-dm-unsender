import { Workflow } from "../workflow/workflow.js"
import { backoffDelay, randomDelay } from "../workflow/timing.js"
import { MessageUnsend, MessageValidateUnsend } from "./message-unsend-workflow.js"
import { LoadMessages } from "./load-messages.js"

export { UnsendWorkflow, DEFAULT_OPTIONS }

const DEFAULT_OPTIONS = {
	/** Stop after this many unsends in a row failed */
	maxConsecutiveFailures: 5,
	/** Randomized pause between two successful unsends, to look less like a bot */
	minDelayMs: 1000,
	maxDelayMs: 2000,
	/** Backoff after a failed unsend */
	failureBackoffMs: 3000,
	/** Backoff after Instagram kept the message (likely rate limit) */
	rateLimitBackoffMs: 5000,
	backoffMaxMs: 60000,
	/** When nothing at all was found, rescan this many times (the page may not be hydrated yet) */
	rescanAttempts: 3,
	rescanDelayMs: 2000,
}

/**
 * Loads every page of a thread, then unsends the messages sent by the current user, from the newest to the oldest.
 *
 * Events:
 *  - "start" ()
 *  - "end"   (result)
 *  - "status" (string) and "metrics" (see Workflow)
 *
 * @param {Thread}          thread
 * @param {object}          [options] - Overrides of DEFAULT_OPTIONS
 * @param {AbortController} [abortController]
 */
function UnsendWorkflow(thread, options = {}, abortController) {
	Workflow.call(this, abortController)
	this.thread = thread
	this.options = { ...DEFAULT_OPTIONS, ...options }
	this.lastUnsendAt = null
}
UnsendWorkflow.prototype = Object.create(Workflow.prototype)
UnsendWorkflow.prototype.constructor = UnsendWorkflow

/**
 * @returns {Promise<{ outcome: string, unsent: number, failures: number }>}
 */
UnsendWorkflow.prototype.run = async function() {
	this.emit("start")
	const result = { outcome: "done", unsent: 0, failures: 0 }
	try {
		this.clearIgnoreMarkers()
		this.thread.dismissStaleOverlays()
		await new LoadMessages(this.thread.messagesWrapper, this.abortController).run()
		for(let attempt = 0; attempt <= this.options.rescanAttempts; attempt++) {
			if(attempt > 0) {
				this.setStatus(`No messages detected, retrying (${attempt}/${this.options.rescanAttempts})...`)
				await this.wait(this.options.rescanDelayMs)
				this.clearIgnoreMarkers()
				await new LoadMessages(this.thread.messagesWrapper, this.abortController).run()
			}
			await this.unsendAll()
			if(this.metrics.counters.unsent > 0) {
				break
			}
		}
	} catch(error) {
		if(!this.isAborted()) {
			console.error(error)
			result.outcome = "error"
		} else {
			result.outcome = "aborted"
		}
	}
	result.unsent = this.metrics.counters.unsent ?? 0
	result.failures = this.metrics.counters.failures ?? 0
	this.setStatus(summary(result))
	this.emit("end", result)
	return result
}

/**
 * Stops the run. The message being unsent is left as it is.
 */
UnsendWorkflow.prototype.stop = function() {
	this.abort("Stopped by user")
}

/**
 * Removes the ignore markers left by a previous run so that messages can be picked again
 */
UnsendWorkflow.prototype.clearIgnoreMarkers = function() {
	this.thread.root.ownerDocument.querySelectorAll("[data-idmu-ignore]").forEach(element => element.removeAttribute("data-idmu-ignore"))
}

/**
 * Unsends messages one after the other until none is left, the run is stopped or too many failures happened in a row
 *
 * @returns {Promise<void>}
 */
UnsendWorkflow.prototype.unsendAll = async function() {
	const { messagesWrapper } = this.thread
	let consecutiveFailures = 0
	while(!this.isAborted()) {
		if(consecutiveFailures >= this.options.maxConsecutiveFailures) {
			this.setStatus(`Stopped: ${consecutiveFailures} consecutive failures.`)
			return
		}
		const message = await messagesWrapper.findNextMessage(this.abortController)
		if(!message) {
			return
		}
		await this.pace()
		this.setStatus(`Unsending message... (${this.metrics.counters.unsent ?? 0} unsent so far)`)
		try {
			await new MessageUnsend(message, this.abortController).run()
			await new MessageValidateUnsend(message, this.abortController).run()
			this.lastUnsendAt = Date.now()
			consecutiveFailures = 0
			messagesWrapper.lastScrollTop = null
			this.metrics.count("unsent")
		} catch(error) {
			if(this.isAborted()) {
				message.clearIgnored()
				return
			}
			consecutiveFailures++
			this.metrics.count("failures")
			message.clearIgnored()
			const base = error.name === "LateFailureWorkflowError" ? this.options.rateLimitBackoffMs : this.options.failureBackoffMs
			const delay = backoffDelay(consecutiveFailures, base, this.options.backoffMaxMs)
			console.debug(`UnsendWorkflow: ${error.name} (${consecutiveFailures} in a row), backing off ${delay}ms`, error)
			this.setStatus(`Failed (${consecutiveFailures}/${this.options.maxConsecutiveFailures}), retrying in ${(delay / 1000).toFixed(0)}s...`)
			await this.wait(delay)
		}
	}
}

/**
 * Waits so that consecutive unsends are at least minDelayMs..maxDelayMs apart
 *
 * @returns {Promise<void>}
 */
UnsendWorkflow.prototype.pace = async function() {
	if(this.lastUnsendAt === null) {
		return
	}
	const delay = randomDelay(this.options.minDelayMs, this.options.maxDelayMs) - (Date.now() - this.lastUnsendAt)
	if(delay > 0) {
		await this.wait(delay)
	}
}

/**
 * @param {{ outcome: string, unsent: number, failures: number }} result
 * @returns {string}
 */
function summary({ outcome, unsent }) {
	const count = `${unsent} message(s) unsent.`
	if(outcome === "aborted") {
		return `Aborted. ${count}`
	}
	if(outcome === "error") {
		return `Errored. ${count}`
	}
	return `Done. ${count}`
}
