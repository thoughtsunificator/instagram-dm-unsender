import { Workflow } from "../workflow/workflow.js"

export { MessageUnsend, MessageValidateUnsend }

function LateFailureWorkflowException() {}
LateFailureWorkflowException.prototype = Object.create(Error.prototype)

function FailedWorkflowException() {}
FailedWorkflowException.prototype = Object.create(Error.prototype)

function MessageUnsend(message) {
	Workflow.prototype.constructor.call(this)
	this.message = message
}
MessageUnsend.prototype = Object.create(Workflow.prototype)
MessageUnsend.prototype.constructor = MessageUnsend

/**
 * Attempt to unsend a message and returns true when it succeedds
 * Should the workflow fails, a FailedWorkflowException will be thrown
 */
MessageUnsend.prototype.run = async function() {
	console.debug("MessageUnsend unsend")
	try {
		await this.pipe(
			this.message.showActionsMenuButton,
			this.message.openActionsMenu,
			this.message.openConfirmUnsendModal,
			this.message.confirmUnsend
		)
		// No exception raised at this point which mean that the workflow passed
		this.message.setFlag("sent")
	} catch(error) {
		console.error(error)
		throw new FailedWorkflowException("Failed to execute workflow for this message", error)
	} finally {
		this.message.setFlag("ignore")
	}
}


function MessageValidateUnsend(message) {
	Workflow.prototype.constructor.call(this)
	this.message = message
}
MessageValidateUnsend.prototype = Object.create(Workflow.prototype)
MessageValidateUnsend.prototype.constructor = MessageValidateUnsend

/**
 * Verify the message actually disappeared from DOM (server accepted the mutation)
 */
MessageValidateUnsend.prototype.run = function() {
	if (this.message.exists()) {
		throw new LateFailureWorkflowException("Message remains in the DOM after unsend, possible rate limit.")
	}
}

