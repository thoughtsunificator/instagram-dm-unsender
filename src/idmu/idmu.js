import UIPI from "../uipi/uipi.js"
import Queue from "../idmu/queue.js"

export default class IDMU {

	/**
	 *
	 * @param {Window} window
	 */
	constructor(window) {
		this.window = window
		this.uipi = null
	}

	async unsendThreadMessages() {
		console.debug("User asked for messages unsending")
		await this.#getUIPI().createUIPIMessages()
		const queue = new Queue()
		console.log(this.#getUIPI().uipiMessages)
		for(const uipiMessage of this.#getUIPI().uipiMessages) {
			queue.add(uipiMessage.createTask(queue.length + 1))
		}
		for(const item of queue.items.slice()) {
			try {
				await item.promise()
			} catch(result) {
				console.error(result)
			}
			console.debug("Queue.next")
			console.debug(`Completed Task ${item.task.id} will continue again in ${this.window.IDMU_MESSAGE_QUEUE_DELAY}ms`)
			await new Promise(resolve => setTimeout(resolve, this.window.IDMU_MESSAGE_QUEUE_DELAY))
		}
	}

	async fetchAndRenderThreadNextMessagePage() {
		await this.#getUIPI().fetchAndRenderThreadNextMessagePage()
	}

	getUIPIMessages() {
		return this.#getUIPI().uipiMessages
	}

	/**
	 *
	 * @returns {UIPI}
	 */
	#getUIPI() {
		if(this.uipi === null) {
			this.uipi = UIPI.create(this.window)
		}
		return this.uipi
	}

}
