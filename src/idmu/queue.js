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
	add(task, delay=0, retry, retryDelay=0) {
		const promise = () => new Promise((resolve, reject) => {
			setTimeout(() => {
				task.run().then(resolve).catch(() => {
					if(item.retry) {
						setTimeout(() => this.add(item.task, item.delay, item.retry, item.retryDelay), item.retryDelay)
					} else {
						reject()
					}
				})
			}, task.delay)
		})
		const item = { task, delay, retry, retryDelay, promise }
		this.items.push(item)
		return this.clearQueue()
	}

}
