import Queue from "../idmu/queue.js"
import UPIComponent from "./upi-component.js"
import findMessagesWrapperStrategy from "../ui/strategy/find-messages-wrapper-strategy.js"
import UIMessagesWrapper from "../ui/ui-messages-wrapper.js"
import UI from "../ui/ui.js"

export default class UPI extends UPIComponent {

	#unsendQueue
	#taskId = 1

	constructor(uiComponent) {
		super(uiComponent)
		this.#unsendQueue = new Queue()
		this._upiMessages = []
	}

	static create(window) {
		console.debug("UPI.create")
		const messagesWrapperElement = findMessagesWrapperStrategy(window)
		let upi
		if(messagesWrapperElement !== null) {
			console.debug("Found messagesWrapperElement")
			console.log(messagesWrapperElement)
			const ui = new UI(window)
			ui.identifier.uiMessagesWrapper = new UIMessagesWrapper(messagesWrapperElement)
			upi = new UPI(ui)
		} else {
			throw new Error("Unable to find messagesWrapperElement")
		}
		return upi
	}


	async unsendThreadMessages() {
		console.debug("unsendThreadMessages")
		for(const upiMessage of await this.uiComponent.createUPIMessages()) {
			this.upiMessages.push(upiMessage)
			const task = upiMessage.createTask(this.#taskId)
			console.debug(`Queuing message (Task ID: ${task.id}`, upiMessage)
			this.#unsendQueue.add(task)
			console.debug(`${this.#unsendQueue.length} item(s) pending in queue`)
			this.taskId++
		}
		this.#unsendQueuedMessages()
	}

	async loadThreadMessages() {
		await this.uiComponent.loadMoreMessages()
	}

	get upiMessages() {
		return this._upiMessages.slice()
	}

	#unsendQueuedMessages() {
		console.debug("unsendQueuedMessages", this.#unsendQueue.items)
		if(this.#unsendQueue.items.length >= 1) {
			this.#unsendQueue.clearQueue().then((task) => {
				console.debug(`Completed Task ${task.id} will continue again in ${this.uiComponent.IDMU_MESSAGE_QUEUE_DELAY}ms`)
				new Promise(resolve => setTimeout(resolve, this.uiComponent.IDMU_MESSAGE_QUEUE_DELAY)).then(() => this.#unsendQueuedMessages())
			}).catch(({error, task}) => {
				console.error(error, `Task ${task.id}`)
				this.#unsendQueuedMessages()
			})
		}
	}

}
