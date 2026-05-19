import { WorkflowMetrics } from "./workflow-metrics.js"

export { Workflow }

function Workflow() {
	// Calling Workflow directly amount to the same as calling
	// its constructor methid
	if(!this) {
		return new Workflow(arguments)
	}
	this._abortController = new AbortController()
	this._parentWorkflow = null
	this._childWorkflows = []
	this.metrics = new WorkflowMetrics()
}

/**
 * @param {Workflow[]} ...workflows
 */
Workflow.prototype.pipe = async function(...workflows) {
	// TODO create pipable workflow
	let previousResult
	for(const workflow of workflows) {
		const result = await method(previousResult)
		previousResult = result
	}
}

Workflow.prototype.run = async function() {
	throw new Error("Not implemented")
}

Workflow.prototype.appendChild = async function(workflow) {
	if(workflow._parentWorkflow) {
		throw new Error(`This workflow is already part on another workflow (${workflow._parentWorkflow.constructor.name})`)
	}
	this._childWorkflows.push(workflow)
	workflow._parentWorkflow = this
	await workflow.run()
}


Workflow.prototype.randomWait = async function() {
}

Workflow.prototype.withBackoff = async function() {
	// retry with backoff
}

Workflow.prototype.abort = async function(reason) {
	this._abortController.abort(reason)
}
