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
	* @param {UnseTaskndTask} task
	* @returns {Promise}
	*/
	add(task, retry, retryDelay=0) {
		const promise = () => new Promise((resolve, reject) => {
			task.run().then(resolve).catch(() => {
				if(item.retry) {
					setTimeout(() => this.add(item.task, item.retry, item.retryDelay), item.retryDelay)
				} else {
					reject()
				}
			})
		})
		const item = { task, retry, retryDelay, promise }
		this.items.push(item)
		return this.clearQueue()
	}

}
