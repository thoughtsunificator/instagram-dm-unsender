import UI from "./ui/ui.js"
import Message from "./message.js"
import UIMessagesWrapper from "./ui/ui-messages-wrapper.js"

export default class Instagram {

	constructor(window) {
		this._window = window
		this._messages = []
		this._ui = null
		this._mutationObserver = null
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

	#addMessage(messageNode) {
		const uiMessage = this.ui.addUIMessage(messageNode)
		const message = new Message(uiMessage)
		this.messages.push(message)
		return message
	}

	#removeMessage(message) {
		this.messages.splice(this.messages.indexOf(message), 1)
		this.ui.removeMessage(message.ui)
	}

	#onNodeAdded(addedNode) {
		if(addedNode.nodeType === Node.ELEMENT_NODE) {
			const messageNodes = this.window.document.querySelectorAll("div[role] div[role=button] div[dir=auto], div[role] div[role=button] div > img, div[role] div[role=button] > svg, div[role] div[role=button] div > p > span")
			if(this.ui === null) {
				if(addedNode.querySelector('div > textarea[dir=auto], div[aria-label="Message"]')) {
					const treeWalker = this.window.document.createTreeWalker(
						addedNode,
						NodeFilter.SHOW_ELEMENT,
					)
					const resultNodes = []
					while(treeWalker.nextNode()) {
						if(getComputedStyle(treeWalker.currentNode).overflowX === "hidden") {
							resultNodes.push(treeWalker.currentNode)
						}
					}
					const messagesWrapperNode = resultNodes[0]
					console.debug(messagesWrapperNode)
					if(messagesWrapperNode !== null) {
						const uiMessagesWrapper = new UIMessagesWrapper(messagesWrapperNode)
						this._ui = new UI(this.window, uiMessagesWrapper)
						setTimeout(() => this.ui.uiMessagesWrapper.loadEntireThread(), 500)
					}
				}
			}
			if(this._ui !== null) {
				// TODO assign message type
				for(const messageNode of messageNodes) {
					if(messageNode.querySelector("div > span > img") == null && !this.messages.find(message => messageNode === message.ui.root || message.ui.root.contains(messageNode))) {
						this.#addMessage(messageNode)
					}
				}
			}
		}
	}

	#onNodeRemoved(removedNode) {
		if(removedNode.nodeType === Node.ELEMENT_NODE) {
			if(this._ui !== null) {
				const message = this.messages.find(message => removedNode === message.ui.root || removedNode.contains(message.ui.root))
				if(message) {
					this.#removeMessage(message)
					// const messagesWrapperNode = removedNode === this.ui.root || removedNode.contains(this.ui.root)
					// if(messagesWrapperNode) {
					// 	this.ui = null
					// 	// TODO clean ongoing jobs
					// }
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
				for(const removedNode of mutation.removedNodes) {
					try {
						this.#onNodeRemoved(removedNode)
					} catch(ex) {
						console.error(ex)
					}
				}
			}
		})
		this._mutationObserver.observe(this.window.document.body, { subtree: true, childList: true, attributes: true })
	}

}
