export default class Queue {

	items

	constructor() {
		this.items = []
	}

	/**
	*
	* @param {Task} task
	*/
	add(task) {
		const promise = () => new Promise((resolve, reject) => {
			task.run().then(() => resolve(task)).catch(() => {
				console.debug("Task failed")
				reject({ error: "Task failed", task })
			})
		})
		const item = { task, promise }
		this.items.push(item)
		return item
	}

	hasItems() {
		return this.items.length >= 1
	}

	removeTask(task) {
		this.items.splice(this.items.indexOf(task), 1)
		task.stop()
	}

	get length() {
		return this.items.length
	}

}
