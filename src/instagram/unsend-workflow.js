import { Workflow } from "../workflow/workflow.js"

export { UnsendWorkflow }

/**
 * Ensure all messages are loaded then unsend them
 */
function UnsendWorkflow() {
	Workflow.prototype.constructor.call(this)
}
UnsendWorkflow.prototype = Object.create(Workflow.prototype)
UnsendWorkflow.prototype.constructor = UnsendWorkflow

UnsendWorkflow.prototype.run = async function() {
	console.debug("UnsendWorkflow.run()")
	this.append(new LoadMessages())
	this.metrics.state("unsending")
	this.append(new UnsendMessages())
}

function LoadMessages(page) {
	Workflow.prototype.constructor.call(this)
	this.page = page
}
LoadMessages.prototype = Object.create(Workflow)
LoadMessages.prototype.constructor = LoadMessages

LoadMessages.prototype.run = async function() {
	// TODO rename to EnsureAllMessageAreLoaded
	await this.withBackoff(new LoadMessagesWorkflow())
}

function UnsendMessages(page) {
	Workflow.prototype.constructor.call(this)
	this.page = page
}
UnsendMessages.prototype = Object.create(Workflow)
UnsendMessages.prototype.constructor = UnsendMessages

UnsendMessages.prototype.run = async function() {
	// TODO rename to EnsureAllMessageAreLoaded
	this.append(this.page.dismissStaleOverlays)
	try {
		await this.withBackoff(new MessageUnsend(message))
		await this.withBackoff(new MessageValidateUnsend(message))
		this.metrics.count("unsent", message)
		this.metrics.state()
		//this.metrics.push("unsent", message)
	} catch(error) {
		console.error(error)
		this.metrics.count("failures", message)
	}
}

function LoadMessages() {
	Workflow.prototype.constructor.call(this)
}
LoadMessages.prototype = Object.create(Workflow)
LoadMessages.prototype.constructor = LoadMessages

/**
 * Scroll until all messages are loaded
 *
 * Note: Even though messages were loaded they will still be removed from the DOM
 * when they are no longer within the viewport.
 *
 * This means that scrolling is done twice, once to load all messages and
 * a second time to have them back in the viewport.
 *
 */
LoadMessages.prototype.run = function() {
	this.withBackoff(page.loadMessages)
}
