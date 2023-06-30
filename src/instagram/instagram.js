import UI from "./ui/ui.js"
import Message from "./message.js"
import UIMessagesWrapper from "./ui/ui-messages-wrapper.js"
import Queue from "../idmu/queue.js"

export default class Instagram {

	constructor(window) {
		this._window = window
		this._messages = []
		this._ui = null
		this._mutationObserver = null
		this.unsendQueue = new Queue()
		this.taskId = 1
	}

	get messages() {
		return this._messages
	}

	get ui() {
		return this._ui
	}

	get window() {
		return this._window
	}

	clearUnsendQueue() {
		console.debug("clearUnsendQueue", this.unsendQueue.items)
		if(this.unsendQueue.items.length >= 1) {
			this.unsendQueue.clearQueue().then((task) => {
				console.debug(`Completed Task ${task.id} will continue again in ${this.window.IDMU_MESSAGE_QUEUE_DELAY}ms`)
				new Promise(resolve => setTimeout(resolve, this.window.IDMU_MESSAGE_QUEUE_DELAY)).then(() => this.clearUnsendQueue())
			}).catch(({error, task}) => {
				console.error(error, `Task ${task.id}`)
				new Promise(resolve => setTimeout(resolve, this.window.IDMU_MESSAGE_QUEUE_DELAY)).then(() => this.clearUnsendQueue())
			})
		}
	}

	#addMessage(messageNode) {
		const uiMessage = this.ui.addUIMessage(messageNode)
		const message = new Message(uiMessage)
		this.messages.push(message)
		const task = message.createTask(this.taskId)
		console.debug(`Queuing message (Task ID: ${task.id}`, message)
		this.unsendQueue.add(task)
		console.debug(`${this.unsendQueue.length} item(s) pending in queue`)
		this.taskId++
		return message
	}

	async buildUI() {
		const messagesWrapperNode = this.window.document.querySelector("div[role=grid]  > div > div > div > div, section > div > div > div > div > div > div > div > div[style*=height] > div")
		if(messagesWrapperNode !== null) {
			console.log(messagesWrapperNode)
			const uiMessagesWrapper = new UIMessagesWrapper(messagesWrapperNode)
			this._ui = new UI(this.window, uiMessagesWrapper)
		}
		const nodes = [...this.ui.uiMessagesWrapper.root.querySelector("div + div + div > div").childNodes]
		for(const node of nodes) {
			this.#addMessage(node)
		}
	}

}
