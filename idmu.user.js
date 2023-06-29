
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
// @version				0.4.7
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
		* @param {UnseTaskndTask} task
		* @returns {Promise}
		*/
		add(task, delay=0, retry, retryDelay=0) {
			const promise = () => new Promise((resolve, reject) => {
				setTimeout(() => {
					task.run().then(resolve).catch(() => {
						if(item.retry) {
							setTimeout(() => this.add(item.task, item.delay, item.retry, item.retryDelay), item.retryDelay);
						} else {
							reject();
						}
					});
				}, task.delay);
			});
			const item = { task, delay, retry, retryDelay, promise };
			this.items.push(item);
			return this.clearQueue()
		}

	}

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
					for(const addedNode of [...nodes]) {
						const testNode = test(addedNode);
						if(testNode) {
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
				if(test(treeWalker.currentNode)) {
					clearTimeout(timeoutId);
					if(_observer) {
						_observer.disconnect();
					}
					resolve(treeWalker.currentNode);
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

		#isActionMenuButton(node) {
			if(node.nodeType === Node.ELEMENT_NODE) {
				const svgNode = node.querySelector("[aria-describedby] [role] [aria-label=Unsend], [aria-label=More]");
				if(svgNode) {
					return svgNode.parentNode
				}
			}
		}

		#isUnsendButton(node) {
			if(node.nodeType === Node.ELEMENT_NODE && node.querySelector("[style*=translate]")) {
				const button = [...node.ownerDocument.querySelectorAll("div[role] [role]")].pop(); // TODO SELECTOR_ACTIONS_MENU_UNSEND_SELECTOR
				if(button) {
					if(button.textContent.toLocaleLowerCase() === "unsend") {
						return button
					}
				}
			}
		}

		#isDialogButton(node) {
			if(node.nodeType === Node.ELEMENT_NODE) {
				return node.querySelector("[role=dialog] button")
			}
		}

		async showActionsMenu() {
			console.debug("showActionsMenu");
			this.root.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
			const actionButton = await waitFor(this.root.ownerDocument.body, (node) => this.#isActionMenuButton(node));
			this.identifier.actionButton = actionButton;
		}

		async openActionsMenu() {
			console.debug("openActionsMenu", this.identifier.actionButton);
			this.identifier.actionButton.click();
			const unSendButton = await waitFor(this.root.ownerDocument.body, (node) => this.#isUnsendButton(node)); // TODO i18n
			this.identifier.unSendButton = unSendButton;
		}

		async clickUnsend() {
			console.debug("clickUnsend", this.identifier.unSendButton);
			this.identifier.unSendButton.click();
			this.identifier.dialogButton = await waitFor(this.root.ownerDocument.body, (node) => this.#isDialogButton(node));
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

	class Message {

		constructor(ui) {
			this.ui = ui;
			this.task = null;
		}

		async unsend() {
			try {
				await this.ui.showActionsMenu();
				await this.ui.openActionsMenu();
				await this.ui.clickUnsend();
				await this.ui.confirmUnsend();
			} catch(ex) {
				console.error(ex);
			}
		}
	}

	class UIMessagesWrapper extends UIComponent {

		constructor(root) {
			super(root);
		}

		#isLoader(node) {
			if(node.nodeType === Node.ELEMENT_NODE) {
				return node.querySelector("svg[aria-label*=Loading]")
			}
		}

		async loadEntireThread() {
			console.debug("loadEntireThread");
			this.root.scrollTop = 0;
			try {
				await waitFor(this.root.ownerDocument.body, node => this.#isLoader(node), true);
				if(this.root.scrollTop !== 0) {
					this.loadEntireThread();
				}
			} catch(ex) {
				console.error(ex);
			}
		}

	}

	class Instagram {

		constructor(window) {
			this._window = window;
			this._messages = [];
			this._ui = null;
			this._mutationObserver = null;
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
			const uiMessage = this.ui.addUIMessage(messageNode);
			const message = new Message(uiMessage);
			this.messages.push(message);
			return message
		}

		#removeMessage(message) {
			this.messages.splice(this.messages.indexOf(message), 1);
			this.ui.removeMessage(message.ui);
		}

		#onNodeAdded(addedNode) {
			if(addedNode.nodeType === Node.ELEMENT_NODE) {
				const messageNodes = this.window.document.querySelectorAll("div[role] div[role=button] div[dir=auto], div[role] div[role=button] div > img, div[role] div[role=button] > svg, div[role] div[role=button] div > p > span");
				if(this.ui === null) {
					const hintNode = addedNode.querySelector('div > textarea[dir=auto], div[aria-label="Message"]');
					if(hintNode) {
						let messagesWrapperNode = hintNode.parentNode.parentNode.parentNode.parentNode.parentNode?.parentNode.firstElementChild.firstElementChild.firstElementChild;
						if(messagesWrapperNode.getAttribute("arial-label") != null) {
							messagesWrapperNode = messagesWrapperNode.firstElementChild.firstElementChild.firstElementChild.firstElementChild;
						}
						if(messagesWrapperNode !== null) {
							const uiMessagesWrapper = new UIMessagesWrapper(messagesWrapperNode);
							this._ui = new UI(this.window, uiMessagesWrapper);
						}
					}
				}
				if(this._ui !== null) {
					// TODO assign message type
					for(const messageNode of messageNodes) {
						if(messageNode.querySelector("div > span > img") == null && !this.messages.find(message => messageNode === message.ui.root || message.ui.root.contains(messageNode))) {
							this.#addMessage(messageNode);
							setTimeout(() => this.ui.uiMessagesWrapper.loadEntireThread(), 500);

						}
					}
				}
			}
		}

		#onNodeRemoved(removedNode) {
			if(removedNode.nodeType === Node.ELEMENT_NODE) {
				if(this._ui !== null) {
					const message = this.messages.find(message => removedNode === message.ui.root || removedNode.contains(message.ui.root));
					if(message) {
						this.#removeMessage(message);
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

	class Task {
		/**
		* @abstract
		* @returns {Promise}
		*/
		run() {
			throw new Error("run method not implemented")
		}
	}

	class MessageUnsendTask extends Task {
		/**
		 *
		 * @param {data} message
		 */
		constructor(message) {
			super();
			this.message = message;
		}
		run() {
			this.message.task = this;
			return this.message.unsend()
		}
	}

	class IDMU {

		constructor(window) {
			this.instagram = new Instagram(window);
			this.unsendQueue = new Queue();
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
				console.debug("Queuing message", message);
				try {
					await this.unsendQueue.add(new MessageUnsendTask(message), this.instagram.window.IDMU_MESSAGE_QUEUE_DELAY, true, 2000);
				} catch(ex) {
					console.error(ex);
				}
			}
			if(this.instagram.messages.length >= 1) {
				this.#unSendMessage(this.instagram.messages[0]);
			}
		}

		async unsendMessages() {// TODO doesn't work for new messages
			this.#unSendMessage(this.instagram.messages[0]);
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
		const messages = dmUnsender.getMessages();
		console.debug(messages);
		await dmUnsender.unsendMessages(messages);
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
