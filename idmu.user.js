
// ==UserScript==

// @name				instagram-dm-unsender
// @license				MIT
// @copyright				Copyright (c) 2023, Romain Lebesle <oss@thoughtsunificator.me> (https://thoughtsunificator.me)
// @namespace				https://thoughtsunificator.me/
// @author				Romain Lebesle <oss@thoughtsunificator.me> (https://thoughtsunificator.me)
// @homepageURL				https://thoughtsunificator.me/
// @supportURL				https://thoughtsunificator.me/
// @contributionURL				https://thoughtsunificator.me/
// @icon				https://www.instagram.com/favicon.ico
// @version				0.4.26
// @updateURL				https://raw.githubusercontent.com/thoughtsunificator/instagram-dm-unsender/userscript/idmu.user.js
// @downloadURL				https://raw.githubusercontent.com/thoughtsunificator/instagram-dm-unsender/userscript/idmu.user.js
// @description				Simple script to unsend all DMs in a thread on instagram.com
// @run-at				document-end
// @include				/^https://(www\.)?instagram\.com/direct*/

// ==/UserScript==


;(function() {
	window["IDMU_MESSAGE_QUEUE_DELAY"] = 1000
	window["IDMU_DRY_RUN"] = false
	window["IDMU_RETRY"] = true
	window["IDMU_DEBUG"] = false
})();
(function () {
	'use strict';

	class UIComponent {
		constructor(root, identifier={}) {
			this.root = root;
			this.identifier = identifier;
		}
	}

	function waitFor(target, test, removed=false, timeout=500) {
		return new Promise((resolve, reject) => {
			let _observer;
			let timeoutId;
			if(timeout) {
				timeoutId = setTimeout(() => {
					if(_observer) {
						_observer.disconnect();
					}
					reject(`waitFor timed out before finding its target (${timeout}ms)`);
				}, timeout);
			}
			new MutationObserver((mutations, observer) => {
				_observer = observer;
				for(const mutation of mutations) {
					const nodes = removed ? mutation.removedNodes : mutation.addedNodes;
					for(const node of [...nodes]) {
						const testNode = test(node);
						if(testNode) {
							clearTimeout(timeoutId);
							resolve(testNode);
						}
					}
				}
			}).observe(target, { subtree: true, childList:true });
			const treeWalker = target.ownerDocument.createTreeWalker(
				target,
				NodeFilter.SHOW_ELEMENT
			);
			while(treeWalker.nextNode()) {
				const testNode = test(treeWalker.currentNode);
				if(testNode) {
					clearTimeout(timeoutId);
					if(_observer) {
						_observer.disconnect();
					}
					resolve(testNode);
					break
				}
			}
		})

	}

	class UIMessage extends UIComponent {

		/**
		*
		* @param {Node} root
		*/
		constructor(root) {
			super(root);
		}


		async showActionsMenu() {
			console.debug("showActionsMenu");
			this.root?.firstChild.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
			this.root?.firstChild.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
			this.root?.firstChild.dispatchEvent(new MouseEvent("mousenter", { bubbles: true }));
			this.identifier.actionButton = await new Promise((resolve, reject) => {
				setTimeout(() => {
					const button = [...this.root.ownerDocument.querySelectorAll("[aria-describedby] [role] [aria-label=Unsend], [aria-label=More]")].pop();
					if(button) {
						resolve(button);
						return
					}
					reject("Unable to find actionButton");
				});
			});
		}

		async openActionsMenu() {
			console.debug("openActionsMenu", this.identifier.actionButton);
			this.identifier.actionButton.parentNode.click();
			this.identifier.unSendButton = await new Promise((resolve, reject) => {
				setTimeout(() => {
					if(this.root.ownerDocument.querySelector("[style*=translate]")) {
						const button = [...this.root.ownerDocument.querySelectorAll("div[role] [role]")].pop();
						if(button) {
							if(button.textContent.toLocaleLowerCase() === "unsend") {
								resolve(button);
								return
							}
							reject("Unable to find unSendButton");
						}
					}
				});
			});
		}

		async clickUnsend() {
			console.debug("clickUnsend", this.identifier.unSendButton);
			this.identifier.unSendButton.click();
			this.identifier.dialogButton = await waitFor(this.root.ownerDocument.body, () => this.root.ownerDocument.querySelector("[role=dialog] button"));
		}

		async confirmUnsend() {
			console.debug("confirmUnsend", this.identifier.dialogButton);
			this.identifier.dialogButton.click();
			await waitFor(this.root.ownerDocument.body, node => node.nodeType === Node.ELEMENT_NODE && node.contains(this.root) || node === this.root, true);
		}

	}

	class UI extends UIComponent {
		/**
		*
		* @param {Node} root
		* @param {UIMessagesWrapper} uiMessagesWrapper
		*/
		constructor(root, uiMessagesWrapper) {
			super(root);
			this._uiMessagesWrapper = uiMessagesWrapper;
			this._uiMessages = [];
		}
		get uiMessagesWrapper() {
			return this._uiMessagesWrapper
		}

		get uiMessages() {
			return this._uiMessages
		}

		addUIMessage(root) {
			const uiMessage = new UIMessage(root);
			this.uiMessages.push(uiMessage);
			return uiMessage
		}

		removeMessage(uiMessage) {
			this.uiMessages.splice(this.uiMessages.indexOf(uiMessage), 1);
		}

	}

	class Task {
		constructor(id) {
			this.id = id;
		}

		/**
		* @abstract
		* @returns {Promise}
		*/
		run() {
			throw new Error("run method not implemented")
		}
		/**
		* @abstract
		*/
		stop() {
			throw new Error("stop method not implemented")
		}
	}

	class MessageUnsendTask extends Task {
		/**
		 *
		 * @param {data} message
		 */
		constructor(id, message) {
			super(id);
			this.message = message;
			this.runCount = 0;
		}
		run() {
			const unsend = this.message.unsend();
			this.runCount++;
			return unsend
		}
		stop() {
		}
	}

	class FailedWorkflowException extends Error {}

	class Message {

		constructor(ui) {
			this._ui = ui;
			this._task = null;
		}

		get ui() {
			return this._ui
		}

		get task() {
			return this._task
		}

		async unsend() {
			try {
				await this.ui.showActionsMenu();
				await this.ui.openActionsMenu();
				await this.ui.clickUnsend();
				await this.ui.confirmUnsend();
			} catch(ex) {
				console.error(ex);
				throw FailedWorkflowException({ error: "Failed to execute workflow for this message", task: this.task })
			}
		}

		createTask(id) {
			this._task = new MessageUnsendTask(id, this);
			return this.task
		}

	}

	class UIMessagesWrapper extends UIComponent {

		constructor(root) {
			super(root);
		}

		#isLoader(node) {
			if(node.nodeType === Node.ELEMENT_NODE && this.root.contains(node) && this.root.scrollTop !== 0) {
				return node
			}
		}

		async loadEntireThread() {
			console.debug("loadEntireThread");
			this.root.scrollTop = 0;
			try {
				await waitFor(this.root.ownerDocument.body, node => this.#isLoader(node), false, 2000);
				if(this.root.scrollTop !== 0) {
					this.loadEntireThread();
				}
			} catch(ex) {
				console.error(ex);
			}
		}

	}

	class Queue {
		constructor() {
			this.items = [];
		}

		clearQueue() {
			const item = this.items.shift();
			return item.promise()
		}

		/**
		*
		* @param {Task} task
		*/
		add(task) {
			const promise = () => new Promise((resolve, reject) => {
				task.run().then(resolve).catch(() => {
					console.debug("Task failed");
					reject({ error: "Task failed", task });
				});
			});
			const item = { task, promise };
			this.items.push(item);
			return item
		}

		removeTask(task) {
			this.items.splice(this.items.indexOf(task), 1);
			task.stop();
		}

		get length() {
			return this.items.length
		}

		stop() {
			for(const item of this.items.slice()) {
				item.task.stop();
			}
		}

	}

	class Instagram {

		constructor(window) {
			this._window = window;
			this._messages = [];
			this._ui = null;
			this._mutationObserver = null;
			this.unsendQueue = new Queue();
			this.taskId = 1;
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
			console.debug("clearUnsendQueue", this.unsendQueue.items);
			if(this.unsendQueue.items.length >= 1) {
				this.unsendQueue.clearQueue().then(() => {
					console.debug(`Completed task will continue again in ${this.window.IDMU_MESSAGE_QUEUE_DELAY}ms`);
					new Promise(resolve => setTimeout(resolve, this.window.IDMU_MESSAGE_QUEUE_DELAY)).then(() => this.clearUnsendQueue());
				}).catch(({error, task}) => {
					if(task.runCount < 3) {
						console.error(error, `Task ${task.id} will be placed at the end of the queue`);
						this.unsendQueue.add(task);
					} else {
						console.error(error, `Max runCount reached (3) for task ${task.id}; Skipping`);
					}
					console.debug(`Will continue again in ${this.window.IDMU_MESSAGE_QUEUE_DELAY}ms`);
					new Promise(resolve => setTimeout(resolve, this.window.IDMU_MESSAGE_QUEUE_DELAY)).then(() => this.clearUnsendQueue());
				});
			}
		}

		stopUnsendQueue() {
			console.debug("stopUnsendQueue", this.unsendQueue.items);
			this.unsendQueue.stop();
		}

		#addMessage(messageNode) {
			const uiMessage = this.ui.addUIMessage(messageNode);
			const message = new Message(uiMessage);
			this.messages.push(message);
			const task = message.createTask(this.taskId);
			console.debug(`Queuing message (Task ID: ${task.id}`, message);
			this.unsendQueue.add(task);
			console.debug(`${this.unsendQueue.length} item(s) pending in queue`);
			this.taskId++;
			return message
		}

		#removeMessage(message) {
			this.messages.splice(this.messages.indexOf(message), 1);
			this.ui.removeMessage(message.ui);
			this.unsendQueue.removeTask(message.task);
		}

		#onNodeAdded(addedNode) {
			if(addedNode.nodeType === Node.ELEMENT_NODE) {
				if(this.ui === null) {
					const messagesWrapperNode = this.window.document.querySelector("div[role=grid]  > div > div > div > div, section > div > div > div > div > div > div > div > div[style*=height] > div");
					if(messagesWrapperNode !== null) {
						console.log(messagesWrapperNode);
						const uiMessagesWrapper = new UIMessagesWrapper(messagesWrapperNode);
						this._ui = new UI(this.window, uiMessagesWrapper);
					}
				}
				if(this.ui !== null) {
					const messageNodes = [...this.ui.uiMessagesWrapper.root.querySelectorAll("div[role] div[role=button] div[dir=auto], div[role] div[role=button] div > img, div[role] div[role=button] > svg, div[role] div[role=button] div > p > span")];
					// TODO assign message type
					for(const messageNode of messageNodes) {
						if(!this.messages.find(message => messageNode === message.ui.root || message.ui.root.contains(messageNode))) {
							this.#addMessage(messageNode);
						}
					}
				}
			}
		}

		#onNodeRemoved(removedNode) {
			if(removedNode.nodeType === Node.ELEMENT_NODE) {
				if(this.ui !== null) {
					const message = this.messages.find(message => removedNode === message.ui.root || removedNode.contains(message.ui.root));
					if(message) {
						this.#removeMessage(message);
					}
				}
			}
		}

		observe() {
			this._mutationObserver = new MutationObserver((mutations) => {
				for(const mutation of mutations) {
					for(const addedNode of mutation.addedNodes) {
						try {
							this.#onNodeAdded(addedNode);
						} catch(ex) {
							console.error(ex);
						}
					}
					for(const removedNode of mutation.removedNodes) {
						try {
							this.#onNodeRemoved(removedNode);
						} catch(ex) {
							console.error(ex);
						}
					}
				}
			});
			this._mutationObserver.observe(this.window.document.body, { subtree: true, childList: true, attributes: true });
		}

	}

	class IDMU {

		/**
		 *
		 * @param {Window} window
		 */
		constructor(window) {
			this.instagram = new Instagram(window);
		}

		async unsendMessages() {
			console.debug("User asked for messages unsending");
			try {
				this.instagram.stopUnsendQueue();
			} catch(ex) {
				console.error(ex);
			}
			return this.instagram.clearUnsendQueue()
		}

		getMessages() {
			return this.instagram.messages
		}

	}

	const dmUnsender = new IDMU(window);
	dmUnsender.instagram.observe();
	console.log("dmUnsender observing...");

	const button = document.createElement("button");
	button.textContent = "Unsend all DMs";
	button.style.position = "fixed";
	button.style.top = "10px";
	button.style.right = "10px";
	button.style.zIndex = 9999;
	button.style.fontSize = "var(--system-14-font-size)";
	button.style.color = "white";
	button.style.border = "0px";
	button.style.borderRadius = "8px";
	button.style.padding = "8px";
	button.style.fontWeight = "bold";
	button.style.cursor = "pointer";
	button.style.lineHeight = "var(--system-14-line-height)";
	button.style.backgroundColor = "rgb(var(--ig-primary-button))";
	button.addEventListener("click", async () => {
		console.log("dmUnsender button click");
		button.disabled = true;
		try {
			await dmUnsender.instagram.ui.uiMessagesWrapper.loadEntireThread();
		} catch(ex) {
			console.error(ex);
		}
		const messages = dmUnsender.getMessages();
		console.debug(messages);
		try {
			await dmUnsender.unsendMessages(messages);
		} catch(ex) {
			console.error(ex);
		}
		button.disabled = false;
	});
	button.addEventListener("mouseover", async () => {
		button.style.backgroundColor = "rgb(var(--ig-primary-button-hover))";
	});
	button.addEventListener("mouseout", async () => {
		button.style.backgroundColor = "rgb(var(--ig-primary-button))";
	});
	document.body.appendChild(button);

})();
