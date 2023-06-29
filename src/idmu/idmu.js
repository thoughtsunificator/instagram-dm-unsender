
import Queue from "./queue.js"
import Instagram from "../instagram/instagram.js"
import { MessageUnsendTask } from "./task.js"

export default class IDMU {

	constructor(window) {
		this.instagram = new Instagram(window)
		this.unsendQueue = new Queue()
	}

	/**
	 *
	 * @param {Message} message
	 */
	#isMessageQueued(message) {
		return this.unsendQueue.items.find(item => item.message === message)
	}

	async unsendMessages() {// TODO doesn't work for new messages
		for(const message of this.instagram.messages.slice()) {
			try {
				if(!this.#isMessageQueued(message)) {
					console.debug("Queuing message", message)
					await this.unsendQueue.add(new MessageUnsendTask(message), true, 2000)
				}
			} catch(ex) {
				this.instagram.messages.push(this.instagram.messages.shift())
				console.error(ex)
			}
			await new Promise(resolve => {
				setTimeout(resolve, this.instagram.window.IDMU_MESSAGE_QUEUE_DELAY)
			})
		}

	}

	getMessages() {
		return this.instagram.messages
	}

}
