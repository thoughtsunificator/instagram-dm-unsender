export { WorkflowMetrics }

/**
 * Counters and states of a workflow. Every change is emitted on the owner
 * workflow as a "metrics" event so that the UI can reflect progress.
 *
 * @param {Observable} owner - Anything with an emit(name, payload) method
 */
function WorkflowMetrics(owner) {
	this.owner = owner
	this.counters = {}
	this.state = null
}

/**
 * @param {string} name
 * @param {number} [amount=1]
 * @returns {number} the new value
 */
WorkflowMetrics.prototype.count = function(name, amount = 1) {
	this.counters[name] = (this.counters[name] ?? 0) + amount
	this.owner.emit("metrics", { type: "counter", name, value: this.counters[name] })
	return this.counters[name]
}

/**
 * @param {string|null} name - null clears the state
 */
WorkflowMetrics.prototype.setState = function(name = null) {
	this.state = name
	this.owner.emit("metrics", { type: "state", name, value: name })
}
