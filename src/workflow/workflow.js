import { WorkflowMetrics } from "./workflow-metrics.js"

export { Workflow }

function Workflow() {
	if(!this) {
		return new Workflow()
	}
	this._abortController = new AbortController()
	this._parentWorkflow = null
	this._childWorkflows = []
	this.metrics = new WorkflowMetrics()
}

/**
 * @param {Workflow[]} ...workflows
 */
Workflow.prototype.combine = async function(...workflows) {
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

Workflow.prototype.append = async function(workflow) {
	if(workflow._parentWorkflow) {
		throw new Error(`This workflow is already part on another workflow (${workflow._parentWorkflow.constructor.name})`)
	}
	this.childWorkflows.push(workflow)
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
