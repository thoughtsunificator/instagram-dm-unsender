
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
// @version				0.4.39
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

	const BUTTON_STYLE = {
		"PRIMARY": "primary",
		"SECONDARY": "secondary",
	};


	function applyButtonStyle(node, styleName=BUTTON_STYLE.PRIMARY) {
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

	function createMenuButtonElement(text, styleName) {

		const buttonElement = document.createElement("button");
		buttonElement.textContent = text;
		applyButtonStyle(buttonElement, styleName);
		return buttonElement
	}

	function createMenuElement() {
		const menuElement = document.createElement("div");
		menuElement.style.top = "20px";
		menuElement.style.right = "430px";
		menuElement.style.position = "fixed";
		menuElement.style.display = "flex";
		menuElement.style.gap = "10px";
		return menuElement
	}

	function createUIElement() {
		const uiElement = document.createElement("div");
		const menuElement = createMenuElement();

		const unsendThreadMessagesButton = createMenuButtonElement("Unsend all DMs");
		const loadThreadMessagesButton = createMenuButtonElement("Load DMs", "secondary");


		menuElement.appendChild(unsendThreadMessagesButton);
		menuElement.appendChild(loadThreadMessagesButton);

		uiElement.appendChild(menuElement);
		return { uiElement, menuElement, unsendThreadMessagesButton, loadThreadMessagesButton }
	}

	class UIPIComponent {
		constructor(uiComponent) {
			this._uiComponent = uiComponent;
		}
		get uiComponent() {
			return this._uiComponent
		}
	}

	function findMessagesWrapperStrategy(window) {
		return window.document.querySelector("div[role=grid]  > div > div > div > div, section > div > div > div > div > div > div > div > div[style*=height] > div")
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

	async function loadMoreMessageStrategy(uiComponent) {
		uiComponent.root.scrollTop = 0;
		try {
			await waitFor(uiComponent.root.ownerDocument.body, node => {
				if(node.nodeType === Node.ELEMENT_NODE && uiComponent.root.contains(node) && uiComponent.root.scrollTop !== 0) {
					return node
				}
			}, false, 10000);
			if(uiComponent.root.scrollTop !== 0) {
				await new Promise(resolve => setTimeout(resolve, 2000));
			}
		} catch(ex) {
			console.error(ex);
		}
	}

	class UIMessagesWrapper extends UIComponent {

		async fetchAndRenderThreadNextMessagePage() {
			console.debug("loadMoreMessages");
			await loadMoreMessageStrategy(this);
		}

	}

	function findMessagesStrategy(uiMessagesWrapper) {
		return [...uiMessagesWrapper.root.querySelector("div + div + div > div").childNodes]
	}

	class FailedWorkflowException extends Error {}

	class UIPIMessage extends UIPIComponent {

		constructor(uiComponent) {
			super(uiComponent);
		}

		async unsend() {
			try {
				await this.uiComponent.showActionsMenuButton();
				await this.uiComponent.openActionsMenu();
				await this.uiComponent.clickUnsend();
				await this.uiComponent.confirmUnsend();
				return true
			} catch(ex) {
				console.error(ex);
				this.uiComponent.hideActionMenuButton();
				this.uiComponent.closeActionMenuButton();
				throw FailedWorkflowException({ error: "Failed to execute workflow for this message" })
			}
		}

	}

	class UIMessage extends UIComponent {

		showActionsMenuButton() {
			console.debug("showActionsMenuButton");
			this.root.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
			this.root.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
			this.root.dispatchEvent(new MouseEvent("mousenter", { bubbles: true }));
			this.root.addEventListener("mousemove", e => e.preventDefault());
			this.root.addEventListener("mouseover", e => e.preventDefault());
			this.root.addEventListener("mousenter", e => e.preventDefault());
		}

		hideActionMenuButton() {
			console.debug("hideActionMenuButton");
			this.root.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
			this.root.dispatchEvent(new MouseEvent("mouseout", { bubbles: true }));
			this.root.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true }));
		}


		async openActionsMenu() {
			console.debug("openActionsMenu");
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
			this.root.click();
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

		async fetchAndRenderThreadNextMessagePage() {
			await this.identifier.uiMessagesWrapper.fetchAndRenderThreadNextMessagePage();
		}

		createUIPIMessages() {
			const uipiMessages = [];
			const messageElements = findMessagesStrategy(this.identifier.uiMessagesWrapper);
			console.debug("findMessagesStrategy", messageElements);
			for(const messageElement of messageElements) {
				const uiMessage = new UIMessage(messageElement);
				uipiMessages.push(new UIPIMessage(uiMessage));
			}
			return uipiMessages
		}

	}

	class UIPI extends UIPIComponent {


		constructor(uiComponent) {
			super(uiComponent);
			this._uipiMessages = [];
		}

		static create(window) {
			console.debug("UIPI.create");
			const messagesWrapperElement = findMessagesWrapperStrategy(window);
			let uipi;
			if(messagesWrapperElement !== null) {
				console.debug("Found messagesWrapperElement");
				console.log(messagesWrapperElement);
				const ui = new UI(window);
				ui.identifier.uiMessagesWrapper = new UIMessagesWrapper(messagesWrapperElement);
				uipi = new UIPI(ui);
			} else {
				throw new Error("Unable to find messagesWrapperElement")
			}
			return uipi
		}

		async fetchAndRenderThreadNextMessagePage() {
			console.debug("fetchAndRenderThreadNextMessagePage");
			await this.uiComponent.fetchAndRenderThreadNextMessagePage();
		}

		async createUIPIMessages() {
			console.debug("createUIPIMessages");
			for(const uipiMessage of this.uiComponent.createUIPIMessages()) {
				this.uipiMessages.push(uipiMessage);
				this.taskId++;
			}
		}

		get uipiMessages() {
			return this._uipiMessages
		}

	}

	class Queue {

		items

		constructor() {
			this.items = [];
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

		hasItems() {
			return this.items.length >= 1
		}

		removeTask(task) {
			this.items.splice(this.items.indexOf(task), 1);
			task.stop();
		}

		get length() {
			return this.items.length
		}

	}

	class IDMU {

		/**
		 *
		 * @param {Window} window
		 */
		constructor(window) {
			this.window = window;
			this.uipi = null;
		}

		async createUIPIMessages() {
			console.debug("User asked for messages unsending");
			await this.#getUIPI().createUIPIMessages();
			return this.#getUIPI().uipiMessages
		}

		async fetchAndRenderThreadNextMessagePage() {
			await this.#getUIPI().fetchAndRenderThreadNextMessagePage();
		}

		/**
		 *
		 * @returns {UIPI}
		 */
		#getUIPI() {
			if(this.uipi === null) {
				this.uipi = UIPI.create(this.window);
			}
			return this.uipi
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


	class UIPIMessageUnsendTask extends Task {
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

	// This script automates the process of unsending DM's on instagram.com
	// This script is meant to be run on the page that lists the message threads
	// The workflow works as follow:
	// - Create a list of all messages by querying on the [role=listbox] selector
	//  - For each message another workflow begins:
	//      - Over the message node so that the three dots button appears
	//      - Click the three dots button to open the message actions
	//      - Click the "Unsend" action button, a modal will open with a dialog that asks user to confirm the intent
	//      - Click the "Unsend" button inside the modal
	// There is no concurrency, message are unsent one after another by using a queue.


	const { uiElement, unsendThreadMessagesButton, loadThreadMessagesButton } = createUIElement();

	const idmu = new IDMU(window);

	async function batchLoadStrategy(batchSize=1) {
		console.debug("batchLoadStrategy", batchSize);
		for(let i =0; i < batchSize;i++) {
			await unsendThreadMessages();
			await idmu.fetchAndRenderThreadNextMessagePage();
		}
		alert("IDMU: Finished");
	}

	async function unsendThreadMessages() {
		try {
			const queue = new Queue();
			for(const uipiMessage of await idmu.createUIPIMessages()) {
				queue.add(new UIPIMessageUnsendTask(queue.length + 1, uipiMessage));
			}
			for(const item of queue.items.slice()) {
				try {
					await item.promise();
					console.debug(`Completed Task ${item.task.id} will continue again in ${window.IDMU_MESSAGE_QUEUE_DELAY}ms`);
					await new Promise(resolve => setTimeout(resolve, window.IDMU_MESSAGE_QUEUE_DELAY));
				} catch(result) {
					console.error(result);
				}
			}
		} catch(ex) {
			console.error(ex);
		}
	}


	unsendThreadMessagesButton.addEventListener("click", async () => {
		console.log("unsendThreadMessagesButton click");
		batchLoadStrategy(localStorage.getItem("IDMU_BATCH_SIZE") || 1);
	});

	loadThreadMessagesButton.addEventListener("click", async () => {
		console.log("loadThreadMessagesButton click");
		try {
			const batchSize = parseInt(window.prompt("How many pages should we load ? ", localStorage.getItem("IDMU_BATCH_SIZE") || 5 ));
			if(parseInt(batchSize)) {
				localStorage.setItem("IDMU_BATCH_SIZE", parseInt(batchSize));
			}
			console.debug(`Setting IDMU_BATCH_SIZE to ${batchSize}`);
		} catch(ex) {
			console.error(ex);
		}
	});


	document.body.appendChild(uiElement);

})();
