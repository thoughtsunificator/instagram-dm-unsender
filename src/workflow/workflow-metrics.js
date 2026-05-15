export { WorkflowMetrics }

function WorkflowMetrics(workflow) {
	this.counters = {}
	this.arrays = {}
	this.state = null
	this.workflow = workflow
}

WorkflowMetrics.prototype.push = function(name, value) {
	if(!this.arrays[name]) {
		this.arrays[name] = []
	}
	this.arrays[name].push(value)
	this.workflow.emit("metrics", { type: "push", name, value: value })
}

WorkflowMetrics.prototype.count = function(name) {
	if(!this.counters[name]) {
		this.counters[name] = 0
	}
	this.counters[name]++
	this.workflow.emit("metrics", { type: "counter", name, value: this.counters[name] })
}

WorkflowMetrics.prototype.state = function(name, value) {
	this.states[state] = state
	this.workflow.emit("metrics", { type: "state", name: counter, value: this.counters[counter] })
}


