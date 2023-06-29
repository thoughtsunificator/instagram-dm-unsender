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
				this.#removeMessage(task.message)
				new Promise(resolve => setTimeout(resolve, this.window.IDMU_MESSAGE_QUEUE_DELAY)).then(() => this.clearUnsendQueue())
			}).catch(({error, task}) => {
				if(task.runCount < 3) {
					console.error(error, `Task ${task.id} will be placed at the end of the queue`)
					this.unsendQueue.add(task)
				} else {
					console.error(error, `Max runCount reached (3) for task ${task.id}; Skipping`)
				}
				console.debug(`Will continue again in ${this.window.IDMU_MESSAGE_QUEUE_DELAY}ms`)
				new Promise(resolve => setTimeout(resolve, this.window.IDMU_MESSAGE_QUEUE_DELAY)).then(() => this.clearUnsendQueue())
			})
		}
	}

	stopUnsendQueue() {
		console.debug("stopUnsendQueue", this.unsendQueue.items)
		this.unsendQueue.stop()
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

	#removeMessage(message) {
		this.messages.splice(this.messages.indexOf(message), 1)
		this.ui.removeMessage(message.ui)
		this.unsendQueue.removeTask(message.task)
	}

	#onNodeAdded(addedNode) {
		if(addedNode.nodeType === Node.ELEMENT_NODE) {
			if(this.ui === null) {
				const messagesWrapperNode = this.window.document.querySelector("div[role=grid]  > div > div > div > div, section > div > div > div > div > div > div > div > div[style*=height] > div")
				if(messagesWrapperNode !== null) {
					console.log(messagesWrapperNode)
					const uiMessagesWrapper = new UIMessagesWrapper(messagesWrapperNode)
					this._ui = new UI(this.window, uiMessagesWrapper)
				}
			}
			if(this.ui !== null) {
				const messageNodes = [...this.ui.uiMessagesWrapper.root.querySelectorAll("div[role] div[role=button] div[dir=auto], div[role] div[role=button] div > img, div[role] div[role=button] > svg, div[role] div[role=button] div > p > span")]
				// TODO assign message type
				for(const messageNode of messageNodes) {
					if(window.innerWidth - messageNode.getBoundingClientRect().x < 200 && messageNode.querySelector("div > span > img") == null && !this.messages.find(message => messageNode === message.ui.root || message.ui.root.contains(messageNode))) {
						this.#addMessage(messageNode)
					}
				}
			}
		}
	}
	observe() {
		this._mutationObserver = new MutationObserver((mutations) => {
			for(const mutation of mutations) {
				for(const addedNode of mutation.addedNodes) {
					try {
						this.#onNodeAdded(addedNode)
					} catch(ex) {
						console.error(ex)
					}
				}
			}
		})
		this._mutationObserver.observe(this.window.document.body, { subtree: true, childList: true, attributes: true })
	}

}
