import { Workflow } from "../workflow/workflow.js"
import { MessageUnsend, MessageValidateUnsend } from "./message-unsend-workflow.js"
import { LoadNextMessages } from "./load-messages.js"

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
	this.appendChild(new PageCleanup(page))
	this.appendChild(new LoadMessages())
	this.appendChild(new UnsendMessages())
}

function LoadMessages(page) {
	Workflow.prototype.constructor.call(this)
	this.page = page
}
LoadMessages.prototype = Object.create(Workflow)
LoadMessages.prototype.constructor = LoadMessages

LoadMessages.prototype.run = async function() {
	this.metrics.state("pageLoading")
	await this.withBackoff(new LoadNextMessages())
	this.metrics.count("pageLoaded")
	this.metrics.state()
}

function UnsendMessages(page) {
	Workflow.prototype.constructor.call(this)
	this.page = page
}
UnsendMessages.prototype = Object.create(Workflow)
UnsendMessages.prototype.constructor = UnsendMessages

UnsendMessages.prototype.run = async function() {
	try {
		this.metrics.state("unsending")
		await this.withBackoff(new MessageUnsend(message))
		this.metrics.state("validatingUnsend")
		await this.withBackoff(new MessageValidateUnsend(message))
		this.metrics.count("unsent", message)
		this.metrics.state()
		//this.metrics.push("unsent", message)
	} catch(error) {
		console.error(error)
		this.metrics.count("failures", message)
	}
}

function PageCleanup(page) {
	Workflow.prototype.constructor.call(this)
	this.page = page
}
PageCleanup.prototype = Object.create(Workflow)
PageCleanup.prototype.constructor = PageCleanup

PageCleanup.prototype.run = function() {
	this.page.dismissStaleOverlays()
}
