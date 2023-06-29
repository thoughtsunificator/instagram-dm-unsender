
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

	async #unSendMessage(message) {
		if(!this.#isMessageQueued(message)) {
			console.debug("Queuing message", message)
			try {
				await this.unsendQueue.add(new MessageUnsendTask(message), this.instagram.window.IDMU_MESSAGE_QUEUE_DELAY, true, 2000)
			} catch(ex) {
				console.error(ex)
			}
		}
		if(this.instagram.messages.length >= 1) {
			this.#unSendMessage(this.instagram.messages[0])
		}
	}

	async unsendMessages() {// TODO doesn't work for new messages
		this.#unSendMessage(this.instagram.messages[0])
	}

	getMessages() {
		return this.instagram.messages
	}

}
