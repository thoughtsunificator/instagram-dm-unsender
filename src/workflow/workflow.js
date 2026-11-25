import { Observable } from "../event/observable.js"
import { WorkflowMetrics } from "./workflow-metrics.js"
import { sleep, backoffDelay } from "./timing.js"

export { Workflow, WorkflowAbortedError, pipe }

/**
 * Thrown when a workflow is aborted (user stop, parent failure, timeout...)
 *
 * @param {any} reason
 * @returns {Error}
 */
function WorkflowAbortedError(reason) {
	const error = new Error(`Workflow aborted: ${reason}`)
	error.name = "WorkflowAbortedError"
	return error
}

/**
 * Base class of every workflow.
 *
 * A workflow is a unit of work that can be aborted, retried with backoff,
 * composed with pipe() and that reports progress through its events:
 *  - "metrics" ({ type, name, value })
 *  - "status"  (string, human readable)
 *
 * Child workflows share the AbortController of their parent so that stopping the parent stops everything.
 *
 * @param {AbortController} [abortController]
 */
function Workflow(abortController = new AbortController()) {
	Observable.call(this)
	this.abortController = abortController
	this.metrics = new WorkflowMetrics(this)
}
Workflow.prototype = Object.create(Observable.prototype)
Workflow.prototype.constructor = Workflow

/**
 * @returns {Promise<any>}
 */
Workflow.prototype.run = function() {
	return Promise.reject(new Error("Not implemented"))
}

/**
 * @param {string} [reason]
 */
Workflow.prototype.abort = function(reason = "aborted") {
	this.abortController.abort(reason)
}

/**
 * @returns {boolean}
 */
Workflow.prototype.isAborted = function() {
	return this.abortController.signal.aborted
}

/**
 * @throws {Error} WorkflowAbortedError when the workflow was aborted
 */
Workflow.prototype.throwIfAborted = function() {
	if(this.isAborted()) {
		throw WorkflowAbortedError(this.abortController.signal.reason)
	}
}

/**
 * @param {string} text
 */
Workflow.prototype.setStatus = function(text) {
	this.emit("status", text)
}

/**
 * Runs task until it succeeds, retrying with exponential backoff.
 * The last error is rethrown when retries are exhausted. Aborting stops immediately.
 *
 * @param {function(): Promise<any>} task
 * @param {object}   [options]
 * @param {number}   [options.retries=3]       - Retries after the first attempt
 * @param {number}   [options.baseMs=3000]
 * @param {number}   [options.maxMs=60000]
 * @param {function(Error, number): void} [options.onFailure] - Called with (error, attempt)
 * @returns {Promise<any>}
 */
Workflow.prototype.withBackoff = async function(task, { retries = 3, baseMs = 3000, maxMs = 60000, onFailure } = {}) {
	for(let attempt = 1; ; attempt++) {
		this.throwIfAborted()
		try {
			return await task()
		} catch(error) {
			if(error?.name === "WorkflowAbortedError" || this.isAborted()) {
				throw error
			}
			if(onFailure) {
				onFailure(error, attempt)
			}
			if(attempt > retries) {
				throw error
			}
			const delay = backoffDelay(attempt, baseMs, maxMs)
			this.setStatus(`Retrying in ${(delay / 1000).toFixed(0)}s (${attempt}/${retries})...`)
			await sleep(delay, this.abortController.signal)
		}
	}
}

/**
 * Sleep that is cut short (and throws) when the workflow is aborted
 *
 * @param {number} ms
 * @returns {Promise<void>}
 */
Workflow.prototype.wait = function(ms) {
	return sleep(ms, this.abortController.signal)
}

/**
 * Runs steps one after the other. Each step receives the previous result and the abort controller.
 *
 * @param {AbortController} abortController
 * @param {Array<function(any, AbortController): any>} steps
 * @param {any} [initial]
 * @returns {Promise<any>}
 */
function pipe(abortController, steps, initial) {
	return steps.reduce(async (previous, step) => {
		const value = await previous
		if(abortController.signal.aborted) {
			throw WorkflowAbortedError(abortController.signal.reason)
		}
		return step(value, abortController)
	}, Promise.resolve(initial))
}
