
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
		for(const [index, message] of this.instagram.messages.entries()) { // TODO remove slice
			console.log(message)
			if(!this.#isMessageQueued(message)) {
				console.debug("Queuing message", message)
				try {
					await this.unsendQueue.add(new MessageUnsendTask(message), index >= 1 ? this.instagram.window.IDMU_MESSAGE_QUEUE_DELAY : 0, true, 2000)
				} catch(ex) {
					console.error(ex)
				}
			}
		}
	}

	getMessages() {
		return this.instagram.messages
	}

}
