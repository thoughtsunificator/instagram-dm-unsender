export default class Queue {
	constructor() {
		this.items = []
	}

	clearQueue() {
		const item = this.items.shift()
		return item.promise()
	}

	/**
	*
	* @param {Task} task
	*/
	add(task) {
		const promise = () => new Promise((resolve, reject) => {
			task.run().then(resolve).catch(() => {
				console.debug("Task failed")
				reject({ error: "Task failed", task })
			})
		})
		const item = { task, promise }
		this.items.push(item)
		return item
	}

	removeTask(task) {
		this.items.splice(this.items.indexOf(task), 1)
		task.stop()
	}

	get length() {
		return this.items.length
	}

	stop() {
		for(const item of this.items.slice()) {
			item.task.stop()
		}
	}

}
