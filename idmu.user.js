
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
// @version				0.4.31
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

	function waitFor(target, test, removed=false, timeout=2000) {
		return new Promise((resolve, reject) => {
			let _observer;
			let timeoutId;
			if(timeout !== -1) {
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


		showActionsMenuButton() {
			console.debug("showActionsMenuButton");
			this.root.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
			this.root.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
			this.root.dispatchEvent(new MouseEvent("mousenter", { bubbles: true }));
		}

		hideActionMenuButton() {
			console.debug("hideActionMenuButton");
			this.root.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
			this.root.dispatchEvent(new MouseEvent("mouseout", { bubbles: true }));
			this.root.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true }));
		}


		async openActionsMenu() {
			console.debug("openActionsMenu");
			// console.log(this.root.ownerDocument.querySelector("[aria-describedby] [role] [aria-label=Unsend], [aria-label=More]"))
			this.identifier.actionButton = await new Promise((resolve, reject) => {
				setTimeout(() => {
					const button = this.root.querySelector("[aria-label=More]");
					if(button) {
						resolve(button);
						return
					}
					reject("Unable to find actionButton");
				});
			});
			console.debug(this.identifier.actionButton);
			this.identifier.actionButton.click();
		}

		closeActionsMenu() {
			console.debug("hideActionMenuButton");
			if(this.identifier.actionButton) {
				this.identifier.actionButton.click();
			}
		}

		async clickUnsend() {
			console.debug("clickUnsend");
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
			console.debug(this.identifier.unSendButton);
			this.identifier.unSendButton.click();
			this.identifier.dialogButton = await waitFor(this.root.ownerDocument.body, () => this.root.ownerDocument.querySelector("[role=dialog] button"));
		}

		async confirmUnsend() {
			console.debug("confirmUnsend", this.identifier.dialogButton);
			this.identifier.dialogButton.click();
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
				await this.ui.showActionsMenuButton();
				await this.ui.openActionsMenu();
				await this.ui.clickUnsend();
				await this.ui.confirmUnsend();
				return true
			} catch(ex) {
				console.error(ex);
				this.ui.hideActionMenuButton();
				this.ui.closeActionMenuButton();
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
				await waitFor(this.root.ownerDocument.body, node => this.#isLoader(node), false, 10000);
				if(this.root.scrollTop !== 0) {
					await new Promise(resolve => setTimeout(resolve, 1000));
					await this.loadEntireThread();
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
				task.run().then(() => resolve(task)).catch(() => {
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
				this.unsendQueue.clearQueue().then((task) => {
					console.debug(`Completed Task ${task.id} will continue again in ${this.window.IDMU_MESSAGE_QUEUE_DELAY}ms`);
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

		async buildUI() {
			const messagesWrapperNode = this.window.document.querySelector("div[role=grid]  > div > div > div > div, section > div > div > div > div > div > div > div > div[style*=height] > div");
			if(messagesWrapperNode !== null) {
				console.log(messagesWrapperNode);
				const uiMessagesWrapper = new UIMessagesWrapper(messagesWrapperNode);
				this._ui = new UI(this.window, uiMessagesWrapper);
			}
			const nodes = [...this.ui.uiMessagesWrapper.root.querySelector("div + div + div > div").childNodes];
			for(const node of nodes) {
				node.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
				node.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
				node.dispatchEvent(new MouseEvent("mousenter", { bubbles: true }));
				await new Promise(resolve => setTimeout(() => {
					const more = node.querySelector("div > [aria-label=More]");
					if(more && (window.innerWidth - more.getBoundingClientRect().right) < 400) {
						this.#addMessage(node);
					}
					resolve();
				}));
			}
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
			return this.instagram.clearUnsendQueue()
		}

		getMessages() {
			return this.instagram.messages
		}

	}

	const dmUnsender = new IDMU(window);

	const unsendDMButton = document.createElement("button");
	unsendDMButton.textContent = "Unsend all DMs";
	unsendDMButton.style.top = "20px";
	unsendDMButton.style.right = "430px";
	applyDefaultStyle(unsendDMButton);
	unsendDMButton.addEventListener("click", async () => {
		try {
			await dmUnsender.instagram.buildUI();
		} catch(ex) {
			console.error(ex);
		}
		console.log("dmUnsender button click");
		unsendDMButton.disabled = true;
		const messages = dmUnsender.getMessages();
		console.debug(messages);
		try {
			await dmUnsender.unsendMessages(messages);
		} catch(ex) {
			console.error(ex);
		}
		unsendDMButton.disabled = false;
	});
	document.body.appendChild(unsendDMButton);

	const loadDMsButton = document.createElement("button");
	loadDMsButton.textContent = "Load all DMs";
	loadDMsButton.style.top = "20px";
	loadDMsButton.style.right = "550px";
	applyDefaultStyle(loadDMsButton, "secondary");
	loadDMsButton.addEventListener("click", async () => {
		try {
			await dmUnsender.instagram.buildUI();
		} catch(ex) {
			console.error(ex);
		}
		unsendDMButton.disabled = true;
		try {
			await dmUnsender.instagram.ui.uiMessagesWrapper.loadEntireThread();
			const messages = dmUnsender.getMessages();
			console.debug(messages);
		} catch(ex) {
			console.error(ex);
		}
		unsendDMButton.disabled = false;
	});
	document.body.appendChild(loadDMsButton);


	function applyDefaultStyle(node, styleName="primary") {
		node.style.position = "fixed";
		node.style.zIndex = 9999;
		node.style.fontSize = "var(--system-14-font-size)";
		node.style.color = "white";
		node.style.border = "0px";
		node.style.borderRadius = "8px";
		node.style.padding = "8px";
		node.style.fontWeight = "bold";
		node.style.cursor = "pointer";
		node.style.lineHeight = "var(--system-14-line-height)";
		node.style.backgroundColor = `rgb(var(--ig-${styleName}-button))`;
		node.addEventListener("mouseover", async () => {
			node.style.backgroundColor = `rgb(var(--ig-${styleName}-button-hover))`;
		});
		node.addEventListener("mouseout", async () => {
			node.style.backgroundColor = `rgb(var(--ig-${styleName}-button))`;
		});
	}

})();
