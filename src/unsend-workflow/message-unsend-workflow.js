import { Workflow, pipe } from "../workflow/workflow.js"
import { sleep } from "../workflow/timing.js"
import { dismissOverlays } from "../instagram/overlays.js"

export { MessageUnsend, MessageValidateUnsend, FailedWorkflowError, LateFailureWorkflowError }

/** Time given to Instagram to remove the message from the DOM after confirmation */
const VALIDATION_DELAY_MS = 800

/**
 * @param {string} message
 * @param {Error}  [cause]
 * @returns {Error}
 */
function FailedWorkflowError(message, cause) {
	const error = new Error(message, { cause })
	error.name = "FailedWorkflowError"
	return error
}

/**
 * The unsend flow ran without error but the message is still rendered afterwards (likely a rate limit)
 *
 * @param {string} message
 * @returns {Error}
 */
function LateFailureWorkflowError(message) {
	const error = new Error(message)
	error.name = "LateFailureWorkflowError"
	return error
}

/**
 * Runs the four UI steps that unsend a message: actions button, actions menu, confirmation dialog, confirm.
 *
 * Throws FailedWorkflowError when any step fails. The overlays left open are then dismissed and
 * the message is ignored for the rest of the scan.
 *
 * @param {Message}         message
 * @param {AbortController} [abortController]
 */
function MessageUnsend(message, abortController) {
	Workflow.call(this, abortController)
	this.message = message
}
MessageUnsend.prototype = Object.create(Workflow.prototype)
MessageUnsend.prototype.constructor = MessageUnsend

/**
 * @returns {Promise<void>}
 */
MessageUnsend.prototype.run = async function() {
	const { message } = this
	const document = message.root.ownerDocument
	try {
		await pipe(this.abortController, [
			(_, ac) => message.showActionsMenuButton(_, ac),
			(actionButton, ac) => message.openActionsMenu(actionButton, ac),
			(unsendButton, ac) => message.openConfirmUnsendModal(unsendButton, ac),
			(dialogButton, ac) => message.confirmUnsend(dialogButton, ac),
		])
	} catch(error) {
		if(this.isAborted()) {
			message.clearIgnored()
			throw error
		}
		console.error(error)
		message.markIgnored()
		await dismissOverlays(document, (ms) => sleep(ms))
		throw FailedWorkflowError("Failed to execute the unsend flow for this message", error)
	}
}

/**
 * Verifies that Instagram actually removed the message: a message that is still rendered
 * after the confirmation means the server did not accept the unsend.
 *
 * @param {Message}         message
 * @param {AbortController} [abortController]
 */
function MessageValidateUnsend(message, abortController) {
	Workflow.call(this, abortController)
	this.message = message
}
MessageValidateUnsend.prototype = Object.create(Workflow.prototype)
MessageValidateUnsend.prototype.constructor = MessageValidateUnsend

/**
 * @returns {Promise<void>}
 * @throws {LateFailureWorkflowError} when the message remains in the DOM
 */
MessageValidateUnsend.prototype.run = async function() {
	await this.wait(VALIDATION_DELAY_MS)
	if(this.message.exists()) {
		throw LateFailureWorkflowError("Message remains in the DOM after unsend, possible rate limit.")
	}
	this.message.markUnsent()
}
