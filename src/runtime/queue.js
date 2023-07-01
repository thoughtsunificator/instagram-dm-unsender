export default class Queue {

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

	get length() {
		return this.items.length
	}

}
