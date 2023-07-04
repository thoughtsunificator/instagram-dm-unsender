
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
// @version				0.4.43
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
		return window.document.querySelector("div[role=grid] > div > div > div > div")
	}

	class UIComponent {
		constructor(root, identifier={}) {
			this.root = root;
			this.identifier = identifier;
		}
	}

	async function loadMoreMessageStrategy(root) {
		root.scrollTop = 0;
		return new Promise((resolve) => {
			new MutationObserver((mutations, observer) => {
				if(root.scrollTop !== 0) {
					observer.disconnect();
					resolve(false);
				}
			}).observe(root.ownerDocument.body, { subtree: true, childList:true });
		})
	}

	class UIMessagesWrapper extends UIComponent {

		disablePointerEvents() {
			this.root.style.pointerEvents = "none";
		}

		enablePointerEvents() {
			this.root.style.pointerEvents = "";
		}

		async fetchAndRenderThreadNextMessagePage() {
			console.debug("test");
			return loadMoreMessageStrategy(this.root)
		}

	}

	async function findMessagesStrategy(root) {
		return [...root.querySelector("div + div + div > div:not([data-idmu-processed])").children]
	}

	class FailedWorkflowException extends Error {}

	class UIPIMessage extends UIPIComponent {

		constructor(uiComponent) {
			super(uiComponent);
		}

		async unsend() {
			this.uiComponent.root.setAttribute("data-idmu-processed", "");
			try {
				const actionButton = await this.uiComponent.showActionsMenuButton();
				this.uiComponent.openActionsMenu(actionButton);
				const dialogButton = await this.uiComponent.openConfirmUnsendModal();
				await this.uiComponent.confirmUnsend(dialogButton);
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

		async showActionsMenuButton() {
			console.debug("Workflow step 1 : showActionsMenuButton");
			this.root.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
			this.root.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
			this.root.dispatchEvent(new MouseEvent("mousenter", { bubbles: true }));
			return new Promise((resolve, reject) => {
				setTimeout(() => {
					const button = this.root.querySelector("[aria-label]");
					if(button) {
						resolve(button);
					} else {
						reject(new Error("Unable to find actionButton"));
					}
				});
			})
		}

		hideActionMenuButton() {
			this.root.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
			this.root.dispatchEvent(new MouseEvent("mouseout", { bubbles: true }));
			this.root.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true }));
		}


		openActionsMenu(actionButton) {
			console.debug("Workflow step 2 : openActionsMenu", actionButton);
			actionButton.click();
		}

		closeActionsMenu() {
			this.root.click();
		}

		async openConfirmUnsendModal() {
			console.debug("Workflow step 3 : openConfirmUnsendModal");
			const unSendButton = await new Promise((resolve, reject) => {
				setTimeout(() => {
					const button = [...this.root.ownerDocument.querySelectorAll("[role=dialog] [role=menu] [role=menuitem]")].filter(node => node.textContent.toLocaleLowerCase() === "unsend").pop();
					if(button) {
						resolve(button);
					} else {
						reject(new Error("Unable to find unSendButton"));
					}
				});
			});
			unSendButton.click();
			return await Promise.race([
				new Promise((resolve, reject) => setTimeout(() => reject(new Error("Unable to find dialogButton")), 2000)),
				new Promise((resolve) => {
					const getDialogButton = () => this.root.ownerDocument.querySelector("[role=dialog] button");
					let dialogButton = getDialogButton();
					if(dialogButton) {
						resolve(dialogButton);
					} else {
						new MutationObserver((mutations, observer) => {
							console.log(this.root.ownerDocument.body.outerHTML);
							dialogButton = getDialogButton();
							if(dialogButton) {
								observer.disconnect();
								resolve(dialogButton);
							}
						}).observe(this.root.ownerDocument.body, { subtree: true, childList:true });
					}
				})
			])
		}

		async confirmUnsend(dialogButton) {
			console.debug("Workflow final step : confirmUnsend", dialogButton);
			dialogButton.click();
		}

	}

	class UI extends UIComponent {

		async fetchAndRenderThreadNextMessagePage() {
			return await this.identifier.uiMessagesWrapper.fetchAndRenderThreadNextMessagePage()
		}

		async createUIPIMessages() {
			const uipiMessages = [];
			const messageElements = await findMessagesStrategy(this.identifier.uiMessagesWrapper.root);
			console.debug("findMessagesStrategy", messageElements);
			for(const messageElement of messageElements) {
				const uiMessage = new UIMessage(messageElement);
				uipiMessages.push(new UIPIMessage(uiMessage));
			}
			return uipiMessages
		}

		disablePointerEvents() {
			this.identifier.uiMessagesWrapper.disablePointerEvents();
		}

		enablePointerEvents() {
			this.identifier.uiMessagesWrapper.enablePointerEvents();
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
			return this.uiComponent.fetchAndRenderThreadNextMessagePage()
		}

		disablePointerEvents() {
			this.uiComponent.identifier.uiMessagesWrapper.disablePointerEvents();
		}

		enablePointerEvents() {
			this.uiComponent.identifier.uiMessagesWrapper.enablePointerEvents();
		}

		async createUIPIMessages() {
			console.debug("createUIPIMessages");
			for(const uipiMessage of await this.uiComponent.createUIPIMessages()) {
				this.uipiMessages.push(uipiMessage);
			}
		}

		get uipiMessages() {
			return this._uipiMessages
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
			return this.#getUIPI().fetchAndRenderThreadNextMessagePage()
		}

		disablePointerEvents() {
			this.#getUIPI().disablePointerEvents();
		}

		enablePointerEvents() {
			this.#getUIPI().enablePointerEvents();
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

	class Queue {

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
					reject(new Error("Task failed"));
				});
			});
			const item = { task, promise };
			this.items.push(item);
			return item
		}

		get length() {
			return this.items.length
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
	}

	class UIPIMessageUnsendTask extends Task {
		/**
		 *
		 * @param {data} message
		 */
		constructor(id, message) {
			super(id);
			this.message = message;
		}
		run() {
			const unsend = this.message.unsend();
			return unsend
		}
	}

	class UnsendThreadMessagesBatchStrategy {
		#batchSize
		#idmu
		constructor(idmu, batchSize) {
			this.#idmu = idmu;
			this.#batchSize = batchSize;
		}
		async run() {
			console.debug("UnsendThreadMessagesBatchStrategy.run()", this.#batchSize);
			let done = false;
			for(let i =0; i < this.#batchSize;i++) {
				done = await Promise.race([
					new Promise(resolve => setTimeout(() => resolve(true), 10000)),
					this.#idmu.fetchAndRenderThreadNextMessagePage()
				]);
				if(done) {
					break
				} else {
					await new Promise(resolve => setTimeout(resolve, 1000));
				}
			}
			try {
				const queue = new Queue();
				for(const uipiMessage of await this.#idmu.createUIPIMessages()) {
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
			if(done) {
				console.debug("UnsendThreadMessagesBatchStrategy done", done);
			} else {
				await this.run();
			}
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

	unsendThreadMessagesButton.addEventListener("click", async () => {
		console.log("unsendThreadMessagesButton click");
		idmu.disablePointerEvents();
		await new UnsendThreadMessagesBatchStrategy(localStorage.getItem("IDMU_BATCH_SIZE") || 1).run();
		idmu.enablePointerEvents();
		alert("IDMU: Finished");
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
