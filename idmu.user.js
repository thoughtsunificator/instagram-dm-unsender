
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
})();
(function () {
	'use strict';

	const BUTTON_STYLE = {
		"PRIMARY": "primary",
		"SECONDARY": "secondary",
	};

	/**
	 *
	 * @param {HTMLButtonElement} buttonElement
	 * @param {string}            styleName
	 */
	function applyButtonStyle(buttonElement, styleName=BUTTON_STYLE.PRIMARY) {
		buttonElement.style.zIndex = 9999;
		buttonElement.style.fontSize = "var(--system-14-font-size)";
		buttonElement.style.color = "white";
		buttonElement.style.border = "0px";
		buttonElement.style.borderRadius = "8px";
		buttonElement.style.padding = "8px";
		buttonElement.style.fontWeight = "bold";
		buttonElement.style.cursor = "pointer";
		buttonElement.style.lineHeight = "var(--system-14-line-height)";
		buttonElement.style.backgroundColor = `rgb(var(--ig-${styleName}-button))`;
	}

	/**
	 *
	 * @param {Document} document
	 * @param {string}   text
	 * @param {string}   styleName
	 * @returns {HTMLButtonElement}
	 */
	function createMenuButtonElement(document, text, styleName) {
		const buttonElement = document.createElement("button");
		buttonElement.textContent = text;
		applyButtonStyle(buttonElement, styleName);
		buttonElement.addEventListener("mouseover", async () => {
			buttonElement.style.filter = `brightness(1.15)`;
		});
		buttonElement.addEventListener("mouseout", async () => {
			buttonElement.style.filter = ``;
		});
		return buttonElement
	}

	/**
	 * @param {Document} document
	 * @returns {HTMLButtonElement}
	 */
	function createMenuElement(document) {
		const menuElement = document.createElement("div");
		menuElement.style.top = "20px";
		menuElement.style.right = "430px";
		menuElement.style.position = "fixed";
		menuElement.style.display = "flex";
		menuElement.style.gap = "10px";
		return menuElement
	}

	class UIPIComponent {
		/**
		 *
		 * @param {UIComponent} uiComponent
		 */
		constructor(uiComponent) {
			this._uiComponent = uiComponent;
		}

		/**
		 * @readonly
		 * @type {UIComponent}
		 */
		get uiComponent() {
			return this._uiComponent
		}
	}

	/**
	 *
	 * @param {Window} window
	 * @returns {Element}
	 */
	function findMessagesWrapperStrategy(window) {
		return window.document.querySelector("div[role=grid] > div > div > div > div")
	}

	class UIComponent {
		/**
		 *
		 * @param {Element} root
		 * @param {object} identifier
		 */
		constructor(root, identifier={}) {
			this.root = root;
			this.identifier = identifier;
		}
	}

	/**
	 *
	 * @param {Element} root
	 * @returns {Promise<boolean>}
	 */
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

		/**
		 *
		 * @returns {Promise>}
		 */
		async fetchAndRenderThreadNextMessagePage() {
			return loadMoreMessageStrategy(this.root)
		}

	}

	/**
	 *
	 * @param {Element} root
	 * @returns {Element[]}
	 */
	async function findMessagesStrategy(root) {
		const elements = [...root.querySelectorAll("div[role=row]:not([data-idmu-processed])")];
		const messageElements = [];
		for(const element of elements.slice()) {
			element.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
			element.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
			element.dispatchEvent(new MouseEvent("mousenter", { bubbles: true }));
			const foundUnsendButton = await new Promise((resolve) => {
				setTimeout(() => {
					const moreButton = element.querySelector("[aria-label=More]");
					if(moreButton) {
						moreButton.click();
						setTimeout(async () => {
							const dialogElements = [...element.ownerDocument.body.querySelectorAll("[role=dialog]")];
							const actionMenuElement = dialogElements.filter(dialogElement => [...dialogElement.querySelectorAll("[role=menu] [role=menuitem]")].find(node => node.textContent.toLocaleLowerCase() === "unsend")).shift();
							if(actionMenuElement) {
								const unsendButtonFound = !![...actionMenuElement.querySelectorAll("[role=menu] [role=menuitem]")].find(node => node.textContent.toLocaleLowerCase() === "unsend");
								moreButton.click();
								await new Promise((resolve_) => setTimeout(resolve_));
								resolve(unsendButtonFound);
							} else {
								resolve(false);
							}
						});
					} else {
						resolve(false);
					}
				});
			});
			if(foundUnsendButton === true) {
				messageElements.push(element);
			} else {
				element.setAttribute("data-idmu-processed", "");
			}
		}
		console.debug(messageElements);
		return messageElements
	}

	class FailedWorkflowException extends Error {}

	class UIPIMessage extends UIPIComponent {

		/**
		 *
		 * @param {UIMessage} uiComponent
		 */
		constructor(uiComponent) {
			super(uiComponent);
		}


		/**
		 *
		 * @returns {Promise<boolean>}
		 */
		async unsend() {
			this.uiComponent.root.setAttribute("data-idmu-processed", "");
			try {
				const actionButton = await this.uiComponent.showActionsMenuButton();
				this.uiComponent.openActionsMenu(actionButton);
				const dialogButton = await this.uiComponent.openConfirmUnsendModal();
				this.uiComponent.confirmUnsend(dialogButton);
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

		/**
		 *
		 * @returns {Promise<[HTMLButtonElement]>}
		 */
		async showActionsMenuButton() {
			console.debug("Workflow step 1 : showActionsMenuButton");
			this.root.scrollIntoView();
			this.root.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
			this.root.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
			this.root.dispatchEvent(new MouseEvent("mousenter", { bubbles: true }));
			return new Promise((resolve, reject) => {
				setTimeout(() => {
					const button = this.root.querySelector("[aria-label=More]");
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


		/**
		 *
		 * @param {HTMLButtonElement} actionButton
		 */
		openActionsMenu(actionButton) {
			console.debug("Workflow step 2 : openActionsMenu", actionButton);
			actionButton.click();
		}

		closeActionsMenu() {
			this.root.click();
		}

		/**
		 *
		 * @returns {Promise<HTMLButtonElement>|Promise<Error>}
		 */
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

		confirmUnsend(dialogButton) {
			console.debug("Workflow final step : confirmUnsend", dialogButton);
			dialogButton.click();
		}

	}

	class UI extends UIComponent {

		/**
		 *
		 * @returns {Promise>}
		 */
		async fetchAndRenderThreadNextMessagePage() {
			return await this.identifier.uiMessagesWrapper.fetchAndRenderThreadNextMessagePage()
		}

		/**
		 *
		 * @returns {Promise<UIPIMessage[]>}
		 */
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

		#observer

		/**
		 *
		 * @param {UI} uiComponent
		 */
		constructor(uiComponent) {
			super(uiComponent);
			this.#observer = null;
		}

		/**
		 *
		 * @param {Window} window
		 * @returns {UIPI}
		 */
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

		/**
		 *
		 * @returns {Promise}
		 */
		async fetchAndRenderThreadNextMessagePage() {
			return this.uiComponent.fetchAndRenderThreadNextMessagePage()
		}

		disablePointerEvents() {
			this.uiComponent.identifier.uiMessagesWrapper.disablePointerEvents();
		}

		enablePointerEvents() {
			this.uiComponent.identifier.uiMessagesWrapper.enablePointerEvents();
		}

		/**
		 *
		 * @returns {Promise<UIPIMessage[]>}
		 */
		async createUIPIMessages() {
			console.debug("createUIPIMessages");
			return this.uiComponent.createUIPIMessages()
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

		/**
		 *
		 * @returns {Promise<UIPIMessage[]>}
		 */
		async createUIPIMessages() {
			return this.#getUIPI().createUIPIMessages()
		}


		/**
		 *
		 * @returns {Promise}
		 */
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

	class QueueItem {
		/**
		 *
		 * @param {Task}    task
		 * @param {Promise} promise
		 */
		constructor(task, promise) {
			this._task = task;
			this._promise = promise;
		}

		/**
		 * @readonly
		 * @type {Task}
		 */
		get task() {
			return this._task
		}

		/**
		 * @readonly
		 * @type {Promise}
		 */
		get promise() {
			return this._promise
		}

	}

	class Queue {

		constructor() {
			this._items = [];
		}

		/**
		*
		* @param {Task} task
		* @returns {QueueItem}
		*/
		add(task) {
			const promise = () => new Promise((resolve, reject) => {
				task.run().then(() => resolve(task)).catch(() => {
					console.debug("Task failed");
					reject(new Error("Task failed"));
				});
			});
			const item = new QueueItem(task, promise);
			this.items.push(item);
			return item
		}

		get items() {
			return this._items
		}

		get length() {
			return this.items.length
		}

	}

	class Task {
		/**
		 *
		 * @param {number} id
		 */
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
		 * @param {number} id
		 * @param {message} UIPIMessage
		 */
		constructor(id, message) {
			super(id);
			this.message = message;
		}
		/**
		 *
		 * @returns {Promise}
		 */
		run() {
			return this.message.unsend()
		}
	}

	class UnsendThreadMessagesBatchStrategy {
		#idmu
		/**
		 *
		 * @param {IDMU} idmu
		 */
		constructor(idmu) {
			this._started = false;
			this._stopped = false;
			this.#idmu = idmu;
		}
		stop() {
			this._stopped = true;
			this.#idmu.enablePointerEvents();
		}
		/**
		 *
		 * @param {number} batchSize
		 * @returns {Promise}
		 */
		async run(batchSize) {
			this.#idmu.disablePointerEvents();
			console.debug("UnsendThreadMessagesBatchStrategy.run()", batchSize);
			let done = false;
			this._started = true;
			this._stopped = false;
			for(let i = 0; i < batchSize;i++) {
				if(this._stopped) {
					break
				}
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
					if(this._stopped) {
						break
					}
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
				this.#idmu.enablePointerEvents();
				console.debug("UnsendThreadMessagesBatchStrategy done", done);
			} else if(!this._stopped) {
				return this.run(batchSize)
			}
		}
	}

	/**
	 *
	 * @param {window} window
	 * @returns {HTMLDivElement}    object.uiElement
	 * @returns {HTMLButtonElement} object.unsendThreadMessagesButton
	 * @returns {HTMLButtonElement} object.loadThreadMessagesButton
	 */
	function render(window) {
		const idmu = new IDMU(window);
		const strategy = new UnsendThreadMessagesBatchStrategy(idmu);
		const { uiElement, unsendThreadMessagesButton, loadThreadMessagesButton } = createUIElement(window.document);
		unsendThreadMessagesButton.dataTextContent = unsendThreadMessagesButton.textContent;
		unsendThreadMessagesButton.dataBackgroundColor = unsendThreadMessagesButton.style.backgroundColor;
		unsendThreadMessagesButton.addEventListener("click", async () => {
			if(strategy._started && !strategy._stopped) {
				console.debug("User asked to stop messages unsending");
				strategy.stop();
				unsendThreadMessagesButton.textContent = unsendThreadMessagesButton.dataTextContent;
				unsendThreadMessagesButton.style.backgroundColor = unsendThreadMessagesButton.dataBackgroundColor;
			} else {
				console.debug("User asked to start messages unsending");
				unsendThreadMessagesButton.textContent = "Stop processing";
				unsendThreadMessagesButton.style.backgroundColor = "#FA383E";
				const batchSize = localStorage.getItem("IDMU_BATCH_SIZE") || 1;
				await strategy.run(batchSize);
				unsendThreadMessagesButton.textContent = unsendThreadMessagesButton.dataTextContent;
				unsendThreadMessagesButton.style.backgroundColor = unsendThreadMessagesButton.dataBackgroundColor;
				alert("IDMU: Finished");
			}
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
		window.document.body.appendChild(uiElement);
		return { uiElement, unsendThreadMessagesButton, loadThreadMessagesButton }
	}

	/**
	 *
	 * @param   {Document}          document
	 * @param   {string}            text
	 * @param   {string}            text
	 * @param   {string}            styleName
	 * @returns {object}
	 * @returns {HTMLDivElement}    object.uiElement
	 * @returns {HTMLDivElement}    object.menuElement
	 * @returns {HTMLButtonElement} object.unsendThreadMessagesButton
	 * @returns {HTMLButtonElement} object.loadThreadMessagesButton
	 */
	function createUIElement(document) {
		const uiElement = document.createElement("div");
		const menuElement = createMenuElement(document);

		const unsendThreadMessagesButton = createMenuButtonElement(document, "Unsend all DMs");
		const loadThreadMessagesButton = createMenuButtonElement(document, "Load DMs", "secondary");


		menuElement.appendChild(unsendThreadMessagesButton);
		menuElement.appendChild(loadThreadMessagesButton);

		uiElement.appendChild(menuElement);
		return { uiElement, menuElement, unsendThreadMessagesButton, loadThreadMessagesButton }
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


	render(window);

})();
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaWRtdS51c2VyLmpzIiwic291cmNlcyI6WyIuLi9zcmMvcnVudGltZS91c2Vyc2NyaXB0L3VpL3N0eWxlL2luc3RhZ3JhbS5qcyIsIi4uL3NyYy9ydW50aW1lL3VzZXJzY3JpcHQvdWkvbWVudS1idXR0b24uanMiLCIuLi9zcmMvcnVudGltZS91c2Vyc2NyaXB0L3VpL21lbnUuanMiLCIuLi9zcmMvdWlwaS91aXBpLWNvbXBvbmVudC5qcyIsIi4uL3NyYy91aS9zdHJhdGVneS9maW5kLW1lc3NhZ2VzLXdyYXBwZXItc3RyYXRlZ3kuanMiLCIuLi9zcmMvdWkvdWktY29tcG9uZW50LmpzIiwiLi4vc3JjL3VpL3N0cmF0ZWd5L2xvYWQtbW9yZS1tZXNzYWdlcy1zdHJhdGVneS5qcyIsIi4uL3NyYy91aS91aS1tZXNzYWdlcy13cmFwcGVyLmpzIiwiLi4vc3JjL3VpL3N0cmF0ZWd5L2ZpbmQtbWVzc2FnZXMtc3RyYXRlZ3kuanMiLCIuLi9zcmMvdWlwaS91aXBpLW1lc3NhZ2UuanMiLCIuLi9zcmMvdWkvdWktbWVzc2FnZS5qcyIsIi4uL3NyYy91aS91aS5qcyIsIi4uL3NyYy91aXBpL3VpcGkuanMiLCIuLi9zcmMvaWRtdS9pZG11LmpzIiwiLi4vc3JjL3J1bnRpbWUvcXVldWUuanMiLCIuLi9zcmMvcnVudGltZS90YXNrLmpzIiwiLi4vc3JjL3J1bnRpbWUvdXNlcnNjcmlwdC9zdHJhdGVneS5qcyIsIi4uL3NyYy9ydW50aW1lL3VzZXJzY3JpcHQvdWkvdWkuanMiLCIuLi9zcmMvcnVudGltZS91c2Vyc2NyaXB0L21haW4uanMiXSwic291cmNlc0NvbnRlbnQiOlsiY29uc3QgQlVUVE9OX1NUWUxFID0ge1xuXHRcIlBSSU1BUllcIjogXCJwcmltYXJ5XCIsXG5cdFwiU0VDT05EQVJZXCI6IFwic2Vjb25kYXJ5XCIsXG59XG5cbi8qKlxuICpcbiAqIEBwYXJhbSB7SFRNTEJ1dHRvbkVsZW1lbnR9IGJ1dHRvbkVsZW1lbnRcbiAqIEBwYXJhbSB7c3RyaW5nfSAgICAgICAgICAgIHN0eWxlTmFtZVxuICovXG5leHBvcnQgZnVuY3Rpb24gYXBwbHlCdXR0b25TdHlsZShidXR0b25FbGVtZW50LCBzdHlsZU5hbWU9QlVUVE9OX1NUWUxFLlBSSU1BUlkpIHtcblx0YnV0dG9uRWxlbWVudC5zdHlsZS56SW5kZXggPSA5OTk5XG5cdGJ1dHRvbkVsZW1lbnQuc3R5bGUuZm9udFNpemUgPSBcInZhcigtLXN5c3RlbS0xNC1mb250LXNpemUpXCJcblx0YnV0dG9uRWxlbWVudC5zdHlsZS5jb2xvciA9IFwid2hpdGVcIlxuXHRidXR0b25FbGVtZW50LnN0eWxlLmJvcmRlciA9IFwiMHB4XCJcblx0YnV0dG9uRWxlbWVudC5zdHlsZS5ib3JkZXJSYWRpdXMgPSBcIjhweFwiXG5cdGJ1dHRvbkVsZW1lbnQuc3R5bGUucGFkZGluZyA9IFwiOHB4XCJcblx0YnV0dG9uRWxlbWVudC5zdHlsZS5mb250V2VpZ2h0ID0gXCJib2xkXCJcblx0YnV0dG9uRWxlbWVudC5zdHlsZS5jdXJzb3IgPSBcInBvaW50ZXJcIlxuXHRidXR0b25FbGVtZW50LnN0eWxlLmxpbmVIZWlnaHQgPSBcInZhcigtLXN5c3RlbS0xNC1saW5lLWhlaWdodClcIlxuXHRidXR0b25FbGVtZW50LnN0eWxlLmJhY2tncm91bmRDb2xvciA9IGByZ2IodmFyKC0taWctJHtzdHlsZU5hbWV9LWJ1dHRvbikpYFxufVxuIiwiaW1wb3J0IHsgYXBwbHlCdXR0b25TdHlsZSB9IGZyb20gXCIuL3N0eWxlL2luc3RhZ3JhbS5qc1wiXG5cbi8qKlxuICpcbiAqIEBwYXJhbSB7RG9jdW1lbnR9IGRvY3VtZW50XG4gKiBAcGFyYW0ge3N0cmluZ30gICB0ZXh0XG4gKiBAcGFyYW0ge3N0cmluZ30gICBzdHlsZU5hbWVcbiAqIEByZXR1cm5zIHtIVE1MQnV0dG9uRWxlbWVudH1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZU1lbnVCdXR0b25FbGVtZW50KGRvY3VtZW50LCB0ZXh0LCBzdHlsZU5hbWUpIHtcblx0Y29uc3QgYnV0dG9uRWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJidXR0b25cIilcblx0YnV0dG9uRWxlbWVudC50ZXh0Q29udGVudCA9IHRleHRcblx0YXBwbHlCdXR0b25TdHlsZShidXR0b25FbGVtZW50LCBzdHlsZU5hbWUpXG5cdGJ1dHRvbkVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNlb3ZlclwiLCBhc3luYyAoKSA9PiB7XG5cdFx0YnV0dG9uRWxlbWVudC5zdHlsZS5maWx0ZXIgPSBgYnJpZ2h0bmVzcygxLjE1KWBcblx0fSlcblx0YnV0dG9uRWxlbWVudC5hZGRFdmVudExpc3RlbmVyKFwibW91c2VvdXRcIiwgYXN5bmMgKCkgPT4ge1xuXHRcdGJ1dHRvbkVsZW1lbnQuc3R5bGUuZmlsdGVyID0gYGBcblx0fSlcblx0cmV0dXJuIGJ1dHRvbkVsZW1lbnRcbn1cbiIsIi8qKlxuICogQHBhcmFtIHtEb2N1bWVudH0gZG9jdW1lbnRcbiAqIEByZXR1cm5zIHtIVE1MQnV0dG9uRWxlbWVudH1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZU1lbnVFbGVtZW50KGRvY3VtZW50KSB7XG5cdGNvbnN0IG1lbnVFbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKVxuXHRtZW51RWxlbWVudC5zdHlsZS50b3AgPSBcIjIwcHhcIlxuXHRtZW51RWxlbWVudC5zdHlsZS5yaWdodCA9IFwiNDMwcHhcIlxuXHRtZW51RWxlbWVudC5zdHlsZS5wb3NpdGlvbiA9IFwiZml4ZWRcIlxuXHRtZW51RWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gXCJmbGV4XCJcblx0bWVudUVsZW1lbnQuc3R5bGUuZ2FwID0gXCIxMHB4XCJcblx0cmV0dXJuIG1lbnVFbGVtZW50XG59XG4iLCJleHBvcnQgZGVmYXVsdCBjbGFzcyBVSVBJQ29tcG9uZW50IHtcblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7VUlDb21wb25lbnR9IHVpQ29tcG9uZW50XG5cdCAqL1xuXHRjb25zdHJ1Y3Rvcih1aUNvbXBvbmVudCkge1xuXHRcdHRoaXMuX3VpQ29tcG9uZW50ID0gdWlDb21wb25lbnRcblx0fVxuXG5cdC8qKlxuXHQgKiBAcmVhZG9ubHlcblx0ICogQHR5cGUge1VJQ29tcG9uZW50fVxuXHQgKi9cblx0Z2V0IHVpQ29tcG9uZW50KCkge1xuXHRcdHJldHVybiB0aGlzLl91aUNvbXBvbmVudFxuXHR9XG59XG4iLCIvKipcbiAqXG4gKiBAcGFyYW0ge1dpbmRvd30gd2luZG93XG4gKiBAcmV0dXJucyB7RWxlbWVudH1cbiAqL1xuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gZmluZE1lc3NhZ2VzV3JhcHBlclN0cmF0ZWd5KHdpbmRvdykge1xuXHRyZXR1cm4gd2luZG93LmRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCJkaXZbcm9sZT1ncmlkXSA+IGRpdiA+IGRpdiA+IGRpdiA+IGRpdlwiKVxufVxuIiwiZXhwb3J0IGRlZmF1bHQgY2xhc3MgVUlDb21wb25lbnQge1xuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHtFbGVtZW50fSByb290XG5cdCAqIEBwYXJhbSB7b2JqZWN0fSBpZGVudGlmaWVyXG5cdCAqL1xuXHRjb25zdHJ1Y3Rvcihyb290LCBpZGVudGlmaWVyPXt9KSB7XG5cdFx0dGhpcy5yb290ID0gcm9vdFxuXHRcdHRoaXMuaWRlbnRpZmllciA9IGlkZW50aWZpZXJcblx0fVxufVxuIiwiLyoqXG4gKlxuICogQHBhcmFtIHtFbGVtZW50fSByb290XG4gKiBAcmV0dXJucyB7UHJvbWlzZTxib29sZWFuPn1cbiAqL1xuZXhwb3J0IGRlZmF1bHQgYXN5bmMgZnVuY3Rpb24gbG9hZE1vcmVNZXNzYWdlU3RyYXRlZ3kocm9vdCkge1xuXHRyb290LnNjcm9sbFRvcCA9IDBcblx0cmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG5cdFx0bmV3IE11dGF0aW9uT2JzZXJ2ZXIoKG11dGF0aW9ucywgb2JzZXJ2ZXIpID0+IHtcblx0XHRcdGlmKHJvb3Quc2Nyb2xsVG9wICE9PSAwKSB7XG5cdFx0XHRcdG9ic2VydmVyLmRpc2Nvbm5lY3QoKVxuXHRcdFx0XHRyZXNvbHZlKGZhbHNlKVxuXHRcdFx0fVxuXHRcdH0pLm9ic2VydmUocm9vdC5vd25lckRvY3VtZW50LmJvZHksIHsgc3VidHJlZTogdHJ1ZSwgY2hpbGRMaXN0OnRydWUgfSlcblx0fSlcbn1cbiIsImltcG9ydCBVSUNvbXBvbmVudCBmcm9tIFwiLi91aS1jb21wb25lbnQuanNcIlxuaW1wb3J0IGxvYWRNb3JlTWVzc2FnZVN0cmF0ZWd5IGZyb20gXCIuL3N0cmF0ZWd5L2xvYWQtbW9yZS1tZXNzYWdlcy1zdHJhdGVneS5qc1wiXG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFVJTWVzc2FnZXNXcmFwcGVyIGV4dGVuZHMgVUlDb21wb25lbnQge1xuXG5cdGRpc2FibGVQb2ludGVyRXZlbnRzKCkge1xuXHRcdHRoaXMucm9vdC5zdHlsZS5wb2ludGVyRXZlbnRzID0gXCJub25lXCJcblx0fVxuXG5cdGVuYWJsZVBvaW50ZXJFdmVudHMoKSB7XG5cdFx0dGhpcy5yb290LnN0eWxlLnBvaW50ZXJFdmVudHMgPSBcIlwiXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHJldHVybnMge1Byb21pc2U+fVxuXHQgKi9cblx0YXN5bmMgZmV0Y2hBbmRSZW5kZXJUaHJlYWROZXh0TWVzc2FnZVBhZ2UoKSB7XG5cdFx0cmV0dXJuIGxvYWRNb3JlTWVzc2FnZVN0cmF0ZWd5KHRoaXMucm9vdClcblx0fVxuXG59XG4iLCIvKipcbiAqXG4gKiBAcGFyYW0ge0VsZW1lbnR9IHJvb3RcbiAqIEByZXR1cm5zIHtFbGVtZW50W119XG4gKi9cbmV4cG9ydCBkZWZhdWx0IGFzeW5jIGZ1bmN0aW9uIGZpbmRNZXNzYWdlc1N0cmF0ZWd5KHJvb3QpIHtcblx0Y29uc3QgZWxlbWVudHMgPSBbLi4ucm9vdC5xdWVyeVNlbGVjdG9yQWxsKFwiZGl2W3JvbGU9cm93XTpub3QoW2RhdGEtaWRtdS1wcm9jZXNzZWRdKVwiKV1cblx0Y29uc3QgbWVzc2FnZUVsZW1lbnRzID0gW11cblx0Zm9yKGNvbnN0IGVsZW1lbnQgb2YgZWxlbWVudHMuc2xpY2UoKSkge1xuXHRcdGVsZW1lbnQuZGlzcGF0Y2hFdmVudChuZXcgTW91c2VFdmVudChcIm1vdXNlbW92ZVwiLCB7IGJ1YmJsZXM6IHRydWUgfSkpXG5cdFx0ZWxlbWVudC5kaXNwYXRjaEV2ZW50KG5ldyBNb3VzZUV2ZW50KFwibW91c2VvdmVyXCIsIHsgYnViYmxlczogdHJ1ZSB9KSlcblx0XHRlbGVtZW50LmRpc3BhdGNoRXZlbnQobmV3IE1vdXNlRXZlbnQoXCJtb3VzZW50ZXJcIiwgeyBidWJibGVzOiB0cnVlIH0pKVxuXHRcdGNvbnN0IGZvdW5kVW5zZW5kQnV0dG9uID0gYXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcblx0XHRcdHNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0XHRjb25zdCBtb3JlQnV0dG9uID0gZWxlbWVudC5xdWVyeVNlbGVjdG9yKFwiW2FyaWEtbGFiZWw9TW9yZV1cIilcblx0XHRcdFx0aWYobW9yZUJ1dHRvbikge1xuXHRcdFx0XHRcdG1vcmVCdXR0b24uY2xpY2soKVxuXHRcdFx0XHRcdHNldFRpbWVvdXQoYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdFx0Y29uc3QgZGlhbG9nRWxlbWVudHMgPSBbLi4uZWxlbWVudC5vd25lckRvY3VtZW50LmJvZHkucXVlcnlTZWxlY3RvckFsbChcIltyb2xlPWRpYWxvZ11cIildXG5cdFx0XHRcdFx0XHRjb25zdCBhY3Rpb25NZW51RWxlbWVudCA9IGRpYWxvZ0VsZW1lbnRzLmZpbHRlcihkaWFsb2dFbGVtZW50ID0+IFsuLi5kaWFsb2dFbGVtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoXCJbcm9sZT1tZW51XSBbcm9sZT1tZW51aXRlbV1cIildLmZpbmQobm9kZSA9PiBub2RlLnRleHRDb250ZW50LnRvTG9jYWxlTG93ZXJDYXNlKCkgPT09IFwidW5zZW5kXCIpKS5zaGlmdCgpXG5cdFx0XHRcdFx0XHRpZihhY3Rpb25NZW51RWxlbWVudCkge1xuXHRcdFx0XHRcdFx0XHRjb25zdCB1bnNlbmRCdXR0b25Gb3VuZCA9ICEhWy4uLmFjdGlvbk1lbnVFbGVtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoXCJbcm9sZT1tZW51XSBbcm9sZT1tZW51aXRlbV1cIildLmZpbmQobm9kZSA9PiBub2RlLnRleHRDb250ZW50LnRvTG9jYWxlTG93ZXJDYXNlKCkgPT09IFwidW5zZW5kXCIpXG5cdFx0XHRcdFx0XHRcdG1vcmVCdXR0b24uY2xpY2soKVxuXHRcdFx0XHRcdFx0XHRhd2FpdCBuZXcgUHJvbWlzZSgocmVzb2x2ZV8pID0+IHNldFRpbWVvdXQocmVzb2x2ZV8pKVxuXHRcdFx0XHRcdFx0XHRyZXNvbHZlKHVuc2VuZEJ1dHRvbkZvdW5kKVxuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0cmVzb2x2ZShmYWxzZSlcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9KVxuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHJlc29sdmUoZmFsc2UpXG5cdFx0XHRcdH1cblx0XHRcdH0pXG5cdFx0fSlcblx0XHRpZihmb3VuZFVuc2VuZEJ1dHRvbiA9PT0gdHJ1ZSkge1xuXHRcdFx0bWVzc2FnZUVsZW1lbnRzLnB1c2goZWxlbWVudClcblx0XHR9IGVsc2Uge1xuXHRcdFx0ZWxlbWVudC5zZXRBdHRyaWJ1dGUoXCJkYXRhLWlkbXUtcHJvY2Vzc2VkXCIsIFwiXCIpXG5cdFx0fVxuXHR9XG5cdGNvbnNvbGUuZGVidWcobWVzc2FnZUVsZW1lbnRzKVxuXHRyZXR1cm4gbWVzc2FnZUVsZW1lbnRzXG59XG4iLCJpbXBvcnQgVUlQSUNvbXBvbmVudCBmcm9tIFwiLi91aXBpLWNvbXBvbmVudC5qc1wiXG5cblxuY2xhc3MgRmFpbGVkV29ya2Zsb3dFeGNlcHRpb24gZXh0ZW5kcyBFcnJvciB7fVxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBVSVBJTWVzc2FnZSBleHRlbmRzIFVJUElDb21wb25lbnQge1xuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge1VJTWVzc2FnZX0gdWlDb21wb25lbnRcblx0ICovXG5cdGNvbnN0cnVjdG9yKHVpQ29tcG9uZW50KSB7XG5cdFx0c3VwZXIodWlDb21wb25lbnQpXG5cdH1cblxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZTxib29sZWFuPn1cblx0ICovXG5cdGFzeW5jIHVuc2VuZCgpIHtcblx0XHR0aGlzLnVpQ29tcG9uZW50LnJvb3Quc2V0QXR0cmlidXRlKFwiZGF0YS1pZG11LXByb2Nlc3NlZFwiLCBcIlwiKVxuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBhY3Rpb25CdXR0b24gPSBhd2FpdCB0aGlzLnVpQ29tcG9uZW50LnNob3dBY3Rpb25zTWVudUJ1dHRvbigpXG5cdFx0XHR0aGlzLnVpQ29tcG9uZW50Lm9wZW5BY3Rpb25zTWVudShhY3Rpb25CdXR0b24pXG5cdFx0XHRjb25zdCBkaWFsb2dCdXR0b24gPSBhd2FpdCB0aGlzLnVpQ29tcG9uZW50Lm9wZW5Db25maXJtVW5zZW5kTW9kYWwoKVxuXHRcdFx0dGhpcy51aUNvbXBvbmVudC5jb25maXJtVW5zZW5kKGRpYWxvZ0J1dHRvbilcblx0XHRcdHJldHVybiB0cnVlXG5cdFx0fSBjYXRjaChleCkge1xuXHRcdFx0Y29uc29sZS5lcnJvcihleClcblx0XHRcdHRoaXMudWlDb21wb25lbnQuaGlkZUFjdGlvbk1lbnVCdXR0b24oKVxuXHRcdFx0dGhpcy51aUNvbXBvbmVudC5jbG9zZUFjdGlvbk1lbnVCdXR0b24oKVxuXHRcdFx0dGhyb3cgRmFpbGVkV29ya2Zsb3dFeGNlcHRpb24oeyBlcnJvcjogXCJGYWlsZWQgdG8gZXhlY3V0ZSB3b3JrZmxvdyBmb3IgdGhpcyBtZXNzYWdlXCIgfSlcblx0XHR9XG5cdH1cblxufVxuIiwiaW1wb3J0IFVJQ29tcG9uZW50IGZyb20gXCIuL3VpLWNvbXBvbmVudC5qc1wiXG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFVJTWVzc2FnZSBleHRlbmRzIFVJQ29tcG9uZW50IHtcblxuXHQvKipcblx0ICpcblx0ICogQHJldHVybnMge1Byb21pc2U8W0hUTUxCdXR0b25FbGVtZW50XT59XG5cdCAqL1xuXHRhc3luYyBzaG93QWN0aW9uc01lbnVCdXR0b24oKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIldvcmtmbG93IHN0ZXAgMSA6IHNob3dBY3Rpb25zTWVudUJ1dHRvblwiKVxuXHRcdHRoaXMucm9vdC5zY3JvbGxJbnRvVmlldygpXG5cdFx0dGhpcy5yb290LmRpc3BhdGNoRXZlbnQobmV3IE1vdXNlRXZlbnQoXCJtb3VzZW1vdmVcIiwgeyBidWJibGVzOiB0cnVlIH0pKVxuXHRcdHRoaXMucm9vdC5kaXNwYXRjaEV2ZW50KG5ldyBNb3VzZUV2ZW50KFwibW91c2VvdmVyXCIsIHsgYnViYmxlczogdHJ1ZSB9KSlcblx0XHR0aGlzLnJvb3QuZGlzcGF0Y2hFdmVudChuZXcgTW91c2VFdmVudChcIm1vdXNlbnRlclwiLCB7IGJ1YmJsZXM6IHRydWUgfSkpXG5cdFx0cmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcblx0XHRcdHNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0XHRjb25zdCBidXR0b24gPSB0aGlzLnJvb3QucXVlcnlTZWxlY3RvcihcIlthcmlhLWxhYmVsPU1vcmVdXCIpXG5cdFx0XHRcdGlmKGJ1dHRvbikge1xuXHRcdFx0XHRcdHJlc29sdmUoYnV0dG9uKVxuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHJlamVjdChuZXcgRXJyb3IoXCJVbmFibGUgdG8gZmluZCBhY3Rpb25CdXR0b25cIikpXG5cdFx0XHRcdH1cblx0XHRcdH0pXG5cdFx0fSlcblx0fVxuXG5cdGhpZGVBY3Rpb25NZW51QnV0dG9uKCkge1xuXHRcdHRoaXMucm9vdC5kaXNwYXRjaEV2ZW50KG5ldyBNb3VzZUV2ZW50KFwibW91c2Vtb3ZlXCIsIHsgYnViYmxlczogdHJ1ZSB9KSlcblx0XHR0aGlzLnJvb3QuZGlzcGF0Y2hFdmVudChuZXcgTW91c2VFdmVudChcIm1vdXNlb3V0XCIsIHsgYnViYmxlczogdHJ1ZSB9KSlcblx0XHR0aGlzLnJvb3QuZGlzcGF0Y2hFdmVudChuZXcgTW91c2VFdmVudChcIm1vdXNlbGVhdmVcIiwgeyBidWJibGVzOiB0cnVlIH0pKVxuXHR9XG5cblxuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHtIVE1MQnV0dG9uRWxlbWVudH0gYWN0aW9uQnV0dG9uXG5cdCAqL1xuXHRvcGVuQWN0aW9uc01lbnUoYWN0aW9uQnV0dG9uKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIldvcmtmbG93IHN0ZXAgMiA6IG9wZW5BY3Rpb25zTWVudVwiLCBhY3Rpb25CdXR0b24pXG5cdFx0YWN0aW9uQnV0dG9uLmNsaWNrKClcblx0fVxuXG5cdGNsb3NlQWN0aW9uc01lbnUoKSB7XG5cdFx0dGhpcy5yb290LmNsaWNrKClcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZTxIVE1MQnV0dG9uRWxlbWVudD58UHJvbWlzZTxFcnJvcj59XG5cdCAqL1xuXHRhc3luYyBvcGVuQ29uZmlybVVuc2VuZE1vZGFsKCkge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJXb3JrZmxvdyBzdGVwIDMgOiBvcGVuQ29uZmlybVVuc2VuZE1vZGFsXCIpXG5cdFx0Y29uc3QgdW5TZW5kQnV0dG9uID0gYXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuXHRcdFx0c2V0VGltZW91dCgoKSA9PiB7XG5cdFx0XHRcdGNvbnN0IGJ1dHRvbiA9IFsuLi50aGlzLnJvb3Qub3duZXJEb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKFwiW3JvbGU9ZGlhbG9nXSBbcm9sZT1tZW51XSBbcm9sZT1tZW51aXRlbV1cIildLmZpbHRlcihub2RlID0+IG5vZGUudGV4dENvbnRlbnQudG9Mb2NhbGVMb3dlckNhc2UoKSA9PT0gXCJ1bnNlbmRcIikucG9wKClcblx0XHRcdFx0aWYoYnV0dG9uKSB7XG5cdFx0XHRcdFx0cmVzb2x2ZShidXR0b24pXG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0cmVqZWN0KG5ldyBFcnJvcihcIlVuYWJsZSB0byBmaW5kIHVuU2VuZEJ1dHRvblwiKSlcblx0XHRcdFx0fVxuXHRcdFx0fSlcblx0XHR9KVxuXHRcdHVuU2VuZEJ1dHRvbi5jbGljaygpXG5cdFx0cmV0dXJuIGF3YWl0IFByb21pc2UucmFjZShbXG5cdFx0XHRuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiBzZXRUaW1lb3V0KCgpID0+IHJlamVjdChuZXcgRXJyb3IoXCJVbmFibGUgdG8gZmluZCBkaWFsb2dCdXR0b25cIikpLCAyMDAwKSksXG5cdFx0XHRuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuXHRcdFx0XHRjb25zdCBnZXREaWFsb2dCdXR0b24gPSAoKSA9PiB0aGlzLnJvb3Qub3duZXJEb2N1bWVudC5xdWVyeVNlbGVjdG9yKFwiW3JvbGU9ZGlhbG9nXSBidXR0b25cIilcblx0XHRcdFx0bGV0IGRpYWxvZ0J1dHRvbiA9IGdldERpYWxvZ0J1dHRvbigpXG5cdFx0XHRcdGlmKGRpYWxvZ0J1dHRvbikge1xuXHRcdFx0XHRcdHJlc29sdmUoZGlhbG9nQnV0dG9uKVxuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdG5ldyBNdXRhdGlvbk9ic2VydmVyKChtdXRhdGlvbnMsIG9ic2VydmVyKSA9PiB7XG5cdFx0XHRcdFx0XHRkaWFsb2dCdXR0b24gPSBnZXREaWFsb2dCdXR0b24oKVxuXHRcdFx0XHRcdFx0aWYoZGlhbG9nQnV0dG9uKSB7XG5cdFx0XHRcdFx0XHRcdG9ic2VydmVyLmRpc2Nvbm5lY3QoKVxuXHRcdFx0XHRcdFx0XHRyZXNvbHZlKGRpYWxvZ0J1dHRvbilcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9KS5vYnNlcnZlKHRoaXMucm9vdC5vd25lckRvY3VtZW50LmJvZHksIHsgc3VidHJlZTogdHJ1ZSwgY2hpbGRMaXN0OnRydWUgfSlcblx0XHRcdFx0fVxuXHRcdFx0fSlcblx0XHRdKVxuXHR9XG5cblx0Y29uZmlybVVuc2VuZChkaWFsb2dCdXR0b24pIHtcblx0XHRjb25zb2xlLmRlYnVnKFwiV29ya2Zsb3cgZmluYWwgc3RlcCA6IGNvbmZpcm1VbnNlbmRcIiwgZGlhbG9nQnV0dG9uKVxuXHRcdGRpYWxvZ0J1dHRvbi5jbGljaygpXG5cdH1cblxufVxuIiwiaW1wb3J0IFVJQ29tcG9uZW50IGZyb20gXCIuL3VpLWNvbXBvbmVudC5qc1wiXG5pbXBvcnQgZmluZE1lc3NhZ2VzU3RyYXRlZ3kgZnJvbSBcIi4uL3VpL3N0cmF0ZWd5L2ZpbmQtbWVzc2FnZXMtc3RyYXRlZ3kuanNcIlxuaW1wb3J0IFVJUElNZXNzYWdlIGZyb20gXCIuLi91aXBpL3VpcGktbWVzc2FnZS5qc1wiXG5pbXBvcnQgVUlNZXNzYWdlIGZyb20gXCIuL3VpLW1lc3NhZ2UuanNcIlxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBVSSBleHRlbmRzIFVJQ29tcG9uZW50IHtcblxuXHQvKipcblx0ICpcblx0ICogQHJldHVybnMge1Byb21pc2U+fVxuXHQgKi9cblx0YXN5bmMgZmV0Y2hBbmRSZW5kZXJUaHJlYWROZXh0TWVzc2FnZVBhZ2UoKSB7XG5cdFx0cmV0dXJuIGF3YWl0IHRoaXMuaWRlbnRpZmllci51aU1lc3NhZ2VzV3JhcHBlci5mZXRjaEFuZFJlbmRlclRocmVhZE5leHRNZXNzYWdlUGFnZSgpXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHJldHVybnMge1Byb21pc2U8VUlQSU1lc3NhZ2VbXT59XG5cdCAqL1xuXHRhc3luYyBjcmVhdGVVSVBJTWVzc2FnZXMoKSB7XG5cdFx0Y29uc3QgdWlwaU1lc3NhZ2VzID0gW11cblx0XHRjb25zdCBtZXNzYWdlRWxlbWVudHMgPSBhd2FpdCBmaW5kTWVzc2FnZXNTdHJhdGVneSh0aGlzLmlkZW50aWZpZXIudWlNZXNzYWdlc1dyYXBwZXIucm9vdClcblx0XHRjb25zb2xlLmRlYnVnKFwiZmluZE1lc3NhZ2VzU3RyYXRlZ3lcIiwgbWVzc2FnZUVsZW1lbnRzKVxuXHRcdGZvcihjb25zdCBtZXNzYWdlRWxlbWVudCBvZiBtZXNzYWdlRWxlbWVudHMpIHtcblx0XHRcdGNvbnN0IHVpTWVzc2FnZSA9IG5ldyBVSU1lc3NhZ2UobWVzc2FnZUVsZW1lbnQpXG5cdFx0XHR1aXBpTWVzc2FnZXMucHVzaChuZXcgVUlQSU1lc3NhZ2UodWlNZXNzYWdlKSlcblx0XHR9XG5cdFx0cmV0dXJuIHVpcGlNZXNzYWdlc1xuXHR9XG5cblx0ZGlzYWJsZVBvaW50ZXJFdmVudHMoKSB7XG5cdFx0dGhpcy5pZGVudGlmaWVyLnVpTWVzc2FnZXNXcmFwcGVyLmRpc2FibGVQb2ludGVyRXZlbnRzKClcblx0fVxuXG5cdGVuYWJsZVBvaW50ZXJFdmVudHMoKSB7XG5cdFx0dGhpcy5pZGVudGlmaWVyLnVpTWVzc2FnZXNXcmFwcGVyLmVuYWJsZVBvaW50ZXJFdmVudHMoKVxuXHR9XG5cbn1cbiIsImltcG9ydCBVSVBJQ29tcG9uZW50IGZyb20gXCIuL3VpcGktY29tcG9uZW50LmpzXCJcbmltcG9ydCBmaW5kTWVzc2FnZXNXcmFwcGVyU3RyYXRlZ3kgZnJvbSBcIi4uL3VpL3N0cmF0ZWd5L2ZpbmQtbWVzc2FnZXMtd3JhcHBlci1zdHJhdGVneS5qc1wiXG5pbXBvcnQgVUlNZXNzYWdlc1dyYXBwZXIgZnJvbSBcIi4uL3VpL3VpLW1lc3NhZ2VzLXdyYXBwZXIuanNcIlxuaW1wb3J0IFVJIGZyb20gXCIuLi91aS91aS5qc1wiXG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFVJUEkgZXh0ZW5kcyBVSVBJQ29tcG9uZW50IHtcblxuXHQjb2JzZXJ2ZXJcblxuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHtVSX0gdWlDb21wb25lbnRcblx0ICovXG5cdGNvbnN0cnVjdG9yKHVpQ29tcG9uZW50KSB7XG5cdFx0c3VwZXIodWlDb21wb25lbnQpXG5cdFx0dGhpcy4jb2JzZXJ2ZXIgPSBudWxsXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHtXaW5kb3d9IHdpbmRvd1xuXHQgKiBAcmV0dXJucyB7VUlQSX1cblx0ICovXG5cdHN0YXRpYyBjcmVhdGUod2luZG93KSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIlVJUEkuY3JlYXRlXCIpXG5cdFx0Y29uc3QgbWVzc2FnZXNXcmFwcGVyRWxlbWVudCA9IGZpbmRNZXNzYWdlc1dyYXBwZXJTdHJhdGVneSh3aW5kb3cpXG5cdFx0bGV0IHVpcGlcblx0XHRpZihtZXNzYWdlc1dyYXBwZXJFbGVtZW50ICE9PSBudWxsKSB7XG5cdFx0XHRjb25zb2xlLmRlYnVnKFwiRm91bmQgbWVzc2FnZXNXcmFwcGVyRWxlbWVudFwiKVxuXHRcdFx0Y29uc29sZS5sb2cobWVzc2FnZXNXcmFwcGVyRWxlbWVudClcblx0XHRcdGNvbnN0IHVpID0gbmV3IFVJKHdpbmRvdylcblx0XHRcdHVpLmlkZW50aWZpZXIudWlNZXNzYWdlc1dyYXBwZXIgPSBuZXcgVUlNZXNzYWdlc1dyYXBwZXIobWVzc2FnZXNXcmFwcGVyRWxlbWVudClcblx0XHRcdHVpcGkgPSBuZXcgVUlQSSh1aSlcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiVW5hYmxlIHRvIGZpbmQgbWVzc2FnZXNXcmFwcGVyRWxlbWVudFwiKVxuXHRcdH1cblx0XHRyZXR1cm4gdWlwaVxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlfVxuXHQgKi9cblx0YXN5bmMgZmV0Y2hBbmRSZW5kZXJUaHJlYWROZXh0TWVzc2FnZVBhZ2UoKSB7XG5cdFx0cmV0dXJuIHRoaXMudWlDb21wb25lbnQuZmV0Y2hBbmRSZW5kZXJUaHJlYWROZXh0TWVzc2FnZVBhZ2UoKVxuXHR9XG5cblx0ZGlzYWJsZVBvaW50ZXJFdmVudHMoKSB7XG5cdFx0dGhpcy51aUNvbXBvbmVudC5pZGVudGlmaWVyLnVpTWVzc2FnZXNXcmFwcGVyLmRpc2FibGVQb2ludGVyRXZlbnRzKClcblx0fVxuXG5cdGVuYWJsZVBvaW50ZXJFdmVudHMoKSB7XG5cdFx0dGhpcy51aUNvbXBvbmVudC5pZGVudGlmaWVyLnVpTWVzc2FnZXNXcmFwcGVyLmVuYWJsZVBvaW50ZXJFdmVudHMoKVxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlPFVJUElNZXNzYWdlW10+fVxuXHQgKi9cblx0YXN5bmMgY3JlYXRlVUlQSU1lc3NhZ2VzKCkge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJjcmVhdGVVSVBJTWVzc2FnZXNcIilcblx0XHRyZXR1cm4gdGhpcy51aUNvbXBvbmVudC5jcmVhdGVVSVBJTWVzc2FnZXMoKVxuXHR9XG5cbn1cbiIsImltcG9ydCBVSVBJIGZyb20gXCIuLi91aXBpL3VpcGkuanNcIlxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBJRE1VIHtcblxuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHtXaW5kb3d9IHdpbmRvd1xuXHQgKi9cblx0Y29uc3RydWN0b3Iod2luZG93KSB7XG5cdFx0dGhpcy53aW5kb3cgPSB3aW5kb3dcblx0XHR0aGlzLnVpcGkgPSBudWxsXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHJldHVybnMge1Byb21pc2U8VUlQSU1lc3NhZ2VbXT59XG5cdCAqL1xuXHRhc3luYyBjcmVhdGVVSVBJTWVzc2FnZXMoKSB7XG5cdFx0cmV0dXJuIHRoaXMuI2dldFVJUEkoKS5jcmVhdGVVSVBJTWVzc2FnZXMoKVxuXHR9XG5cblxuXHQvKipcblx0ICpcblx0ICogQHJldHVybnMge1Byb21pc2V9XG5cdCAqL1xuXHRhc3luYyBmZXRjaEFuZFJlbmRlclRocmVhZE5leHRNZXNzYWdlUGFnZSgpIHtcblx0XHRyZXR1cm4gdGhpcy4jZ2V0VUlQSSgpLmZldGNoQW5kUmVuZGVyVGhyZWFkTmV4dE1lc3NhZ2VQYWdlKClcblx0fVxuXG5cdGRpc2FibGVQb2ludGVyRXZlbnRzKCkge1xuXHRcdHRoaXMuI2dldFVJUEkoKS5kaXNhYmxlUG9pbnRlckV2ZW50cygpXG5cdH1cblxuXHRlbmFibGVQb2ludGVyRXZlbnRzKCkge1xuXHRcdHRoaXMuI2dldFVJUEkoKS5lbmFibGVQb2ludGVyRXZlbnRzKClcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcmV0dXJucyB7VUlQSX1cblx0ICovXG5cdCNnZXRVSVBJKCkge1xuXHRcdGlmKHRoaXMudWlwaSA9PT0gbnVsbCkge1xuXHRcdFx0dGhpcy51aXBpID0gVUlQSS5jcmVhdGUodGhpcy53aW5kb3cpXG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLnVpcGlcblx0fVxuXG59XG4iLCJjbGFzcyBRdWV1ZUl0ZW0ge1xuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHtUYXNrfSAgICB0YXNrXG5cdCAqIEBwYXJhbSB7UHJvbWlzZX0gcHJvbWlzZVxuXHQgKi9cblx0Y29uc3RydWN0b3IodGFzaywgcHJvbWlzZSkge1xuXHRcdHRoaXMuX3Rhc2sgPSB0YXNrXG5cdFx0dGhpcy5fcHJvbWlzZSA9IHByb21pc2Vcblx0fVxuXG5cdC8qKlxuXHQgKiBAcmVhZG9ubHlcblx0ICogQHR5cGUge1Rhc2t9XG5cdCAqL1xuXHRnZXQgdGFzaygpIHtcblx0XHRyZXR1cm4gdGhpcy5fdGFza1xuXHR9XG5cblx0LyoqXG5cdCAqIEByZWFkb25seVxuXHQgKiBAdHlwZSB7UHJvbWlzZX1cblx0ICovXG5cdGdldCBwcm9taXNlKCkge1xuXHRcdHJldHVybiB0aGlzLl9wcm9taXNlXG5cdH1cblxufVxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBRdWV1ZSB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0dGhpcy5faXRlbXMgPSBbXVxuXHR9XG5cblx0LyoqXG5cdCpcblx0KiBAcGFyYW0ge1Rhc2t9IHRhc2tcblx0KiBAcmV0dXJucyB7UXVldWVJdGVtfVxuXHQqL1xuXHRhZGQodGFzaykge1xuXHRcdGNvbnN0IHByb21pc2UgPSAoKSA9PiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cdFx0XHR0YXNrLnJ1bigpLnRoZW4oKCkgPT4gcmVzb2x2ZSh0YXNrKSkuY2F0Y2goKCkgPT4ge1xuXHRcdFx0XHRjb25zb2xlLmRlYnVnKFwiVGFzayBmYWlsZWRcIilcblx0XHRcdFx0cmVqZWN0KG5ldyBFcnJvcihcIlRhc2sgZmFpbGVkXCIpKVxuXHRcdFx0fSlcblx0XHR9KVxuXHRcdGNvbnN0IGl0ZW0gPSBuZXcgUXVldWVJdGVtKHRhc2ssIHByb21pc2UpXG5cdFx0dGhpcy5pdGVtcy5wdXNoKGl0ZW0pXG5cdFx0cmV0dXJuIGl0ZW1cblx0fVxuXG5cdGdldCBpdGVtcygpIHtcblx0XHRyZXR1cm4gdGhpcy5faXRlbXNcblx0fVxuXG5cdGdldCBsZW5ndGgoKSB7XG5cdFx0cmV0dXJuIHRoaXMuaXRlbXMubGVuZ3RoXG5cdH1cblxufVxuIiwiZXhwb3J0IGNsYXNzIFRhc2sge1xuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHtudW1iZXJ9IGlkXG5cdCAqL1xuXHRjb25zdHJ1Y3RvcihpZCkge1xuXHRcdHRoaXMuaWQgPSBpZFxuXHR9XG5cblx0LyoqXG5cdCogQGFic3RyYWN0XG5cdCogQHJldHVybnMge1Byb21pc2V9XG5cdCovXG5cdHJ1bigpIHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoXCJydW4gbWV0aG9kIG5vdCBpbXBsZW1lbnRlZFwiKVxuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBVSVBJTWVzc2FnZVVuc2VuZFRhc2sgZXh0ZW5kcyBUYXNrIHtcblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7bnVtYmVyfSBpZFxuXHQgKiBAcGFyYW0ge21lc3NhZ2V9IFVJUElNZXNzYWdlXG5cdCAqL1xuXHRjb25zdHJ1Y3RvcihpZCwgbWVzc2FnZSkge1xuXHRcdHN1cGVyKGlkKVxuXHRcdHRoaXMubWVzc2FnZSA9IG1lc3NhZ2Vcblx0fVxuXHQvKipcblx0ICpcblx0ICogQHJldHVybnMge1Byb21pc2V9XG5cdCAqL1xuXHRydW4oKSB7XG5cdFx0cmV0dXJuIHRoaXMubWVzc2FnZS51bnNlbmQoKVxuXHR9XG59XG4iLCJcbmltcG9ydCBRdWV1ZSBmcm9tIFwiLi4vcXVldWUuanNcIlxuaW1wb3J0IHsgVUlQSU1lc3NhZ2VVbnNlbmRUYXNrIH0gZnJvbSBcIi4uL3Rhc2suanNcIlxuXG5leHBvcnQgY2xhc3MgVW5zZW5kVGhyZWFkTWVzc2FnZXNCYXRjaFN0cmF0ZWd5IHtcblx0I2lkbXVcblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7SURNVX0gaWRtdVxuXHQgKi9cblx0Y29uc3RydWN0b3IoaWRtdSkge1xuXHRcdHRoaXMuX3N0YXJ0ZWQgPSBmYWxzZVxuXHRcdHRoaXMuX3N0b3BwZWQgPSBmYWxzZVxuXHRcdHRoaXMuI2lkbXUgPSBpZG11XG5cdH1cblx0c3RvcCgpIHtcblx0XHR0aGlzLl9zdG9wcGVkID0gdHJ1ZVxuXHRcdHRoaXMuI2lkbXUuZW5hYmxlUG9pbnRlckV2ZW50cygpXG5cdH1cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7bnVtYmVyfSBiYXRjaFNpemVcblx0ICogQHJldHVybnMge1Byb21pc2V9XG5cdCAqL1xuXHRhc3luYyBydW4oYmF0Y2hTaXplKSB7XG5cdFx0dGhpcy4jaWRtdS5kaXNhYmxlUG9pbnRlckV2ZW50cygpXG5cdFx0Y29uc29sZS5kZWJ1ZyhcIlVuc2VuZFRocmVhZE1lc3NhZ2VzQmF0Y2hTdHJhdGVneS5ydW4oKVwiLCBiYXRjaFNpemUpXG5cdFx0bGV0IGRvbmUgPSBmYWxzZVxuXHRcdHRoaXMuX3N0YXJ0ZWQgPSB0cnVlXG5cdFx0dGhpcy5fc3RvcHBlZCA9IGZhbHNlXG5cdFx0Zm9yKGxldCBpID0gMDsgaSA8IGJhdGNoU2l6ZTtpKyspIHtcblx0XHRcdGlmKHRoaXMuX3N0b3BwZWQpIHtcblx0XHRcdFx0YnJlYWtcblx0XHRcdH1cblx0XHRcdGRvbmUgPSBhd2FpdCBQcm9taXNlLnJhY2UoW1xuXHRcdFx0XHRuZXcgUHJvbWlzZShyZXNvbHZlID0+IHNldFRpbWVvdXQoKCkgPT4gcmVzb2x2ZSh0cnVlKSwgMTAwMDApKSxcblx0XHRcdFx0dGhpcy4jaWRtdS5mZXRjaEFuZFJlbmRlclRocmVhZE5leHRNZXNzYWdlUGFnZSgpXG5cdFx0XHRdKVxuXHRcdFx0aWYoZG9uZSkge1xuXHRcdFx0XHRicmVha1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0YXdhaXQgbmV3IFByb21pc2UocmVzb2x2ZSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIDEwMDApKVxuXHRcdFx0fVxuXHRcdH1cblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgcXVldWUgPSBuZXcgUXVldWUoKVxuXHRcdFx0Zm9yKGNvbnN0IHVpcGlNZXNzYWdlIG9mIGF3YWl0IHRoaXMuI2lkbXUuY3JlYXRlVUlQSU1lc3NhZ2VzKCkpIHtcblx0XHRcdFx0cXVldWUuYWRkKG5ldyBVSVBJTWVzc2FnZVVuc2VuZFRhc2socXVldWUubGVuZ3RoICsgMSwgdWlwaU1lc3NhZ2UpKVxuXHRcdFx0fVxuXHRcdFx0Zm9yKGNvbnN0IGl0ZW0gb2YgcXVldWUuaXRlbXMuc2xpY2UoKSkge1xuXHRcdFx0XHRpZih0aGlzLl9zdG9wcGVkKSB7XG5cdFx0XHRcdFx0YnJlYWtcblx0XHRcdFx0fVxuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdGF3YWl0IGl0ZW0ucHJvbWlzZSgpXG5cdFx0XHRcdFx0Y29uc29sZS5kZWJ1ZyhgQ29tcGxldGVkIFRhc2sgJHtpdGVtLnRhc2suaWR9IHdpbGwgY29udGludWUgYWdhaW4gaW4gJHt3aW5kb3cuSURNVV9NRVNTQUdFX1FVRVVFX0RFTEFZfW1zYClcblx0XHRcdFx0XHRhd2FpdCBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgd2luZG93LklETVVfTUVTU0FHRV9RVUVVRV9ERUxBWSkpXG5cdFx0XHRcdH0gY2F0Y2gocmVzdWx0KSB7XG5cdFx0XHRcdFx0Y29uc29sZS5lcnJvcihyZXN1bHQpXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9IGNhdGNoKGV4KSB7XG5cdFx0XHRjb25zb2xlLmVycm9yKGV4KVxuXHRcdH1cblx0XHRpZihkb25lKSB7XG5cdFx0XHR0aGlzLiNpZG11LmVuYWJsZVBvaW50ZXJFdmVudHMoKVxuXHRcdFx0Y29uc29sZS5kZWJ1ZyhcIlVuc2VuZFRocmVhZE1lc3NhZ2VzQmF0Y2hTdHJhdGVneSBkb25lXCIsIGRvbmUpXG5cdFx0fSBlbHNlIGlmKCF0aGlzLl9zdG9wcGVkKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5ydW4oYmF0Y2hTaXplKVxuXHRcdH1cblx0fVxufVxuIiwiaW1wb3J0IHsgY3JlYXRlTWVudUJ1dHRvbkVsZW1lbnQgfSBmcm9tIFwiLi9tZW51LWJ1dHRvbi5qc1wiXG5pbXBvcnQgeyBjcmVhdGVNZW51RWxlbWVudCB9IGZyb20gXCIuL21lbnUuanNcIlxuaW1wb3J0IElETVUgZnJvbSBcIi4uLy4uLy4uL2lkbXUvaWRtdS5qc1wiXG5pbXBvcnQgeyBVbnNlbmRUaHJlYWRNZXNzYWdlc0JhdGNoU3RyYXRlZ3kgfSBmcm9tIFwiLi4vc3RyYXRlZ3kuanNcIlxuXG4vKipcbiAqXG4gKiBAcGFyYW0ge3dpbmRvd30gd2luZG93XG4gKiBAcmV0dXJucyB7SFRNTERpdkVsZW1lbnR9ICAgIG9iamVjdC51aUVsZW1lbnRcbiAqIEByZXR1cm5zIHtIVE1MQnV0dG9uRWxlbWVudH0gb2JqZWN0LnVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uXG4gKiBAcmV0dXJucyB7SFRNTEJ1dHRvbkVsZW1lbnR9IG9iamVjdC5sb2FkVGhyZWFkTWVzc2FnZXNCdXR0b25cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlbmRlcih3aW5kb3cpIHtcblx0Y29uc3QgaWRtdSA9IG5ldyBJRE1VKHdpbmRvdylcblx0Y29uc3Qgc3RyYXRlZ3kgPSBuZXcgVW5zZW5kVGhyZWFkTWVzc2FnZXNCYXRjaFN0cmF0ZWd5KGlkbXUpXG5cdGNvbnN0IHsgdWlFbGVtZW50LCB1bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbiwgbG9hZFRocmVhZE1lc3NhZ2VzQnV0dG9uIH0gPSBjcmVhdGVVSUVsZW1lbnQod2luZG93LmRvY3VtZW50KVxuXHR1bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbi5kYXRhVGV4dENvbnRlbnQgPSB1bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbi50ZXh0Q29udGVudFxuXHR1bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbi5kYXRhQmFja2dyb3VuZENvbG9yID0gdW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24uc3R5bGUuYmFja2dyb3VuZENvbG9yXG5cdHVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCBhc3luYyAoKSA9PiB7XG5cdFx0aWYoc3RyYXRlZ3kuX3N0YXJ0ZWQgJiYgIXN0cmF0ZWd5Ll9zdG9wcGVkKSB7XG5cdFx0XHRjb25zb2xlLmRlYnVnKFwiVXNlciBhc2tlZCB0byBzdG9wIG1lc3NhZ2VzIHVuc2VuZGluZ1wiKVxuXHRcdFx0c3RyYXRlZ3kuc3RvcCgpXG5cdFx0XHR1bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbi50ZXh0Q29udGVudCA9IHVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uLmRhdGFUZXh0Q29udGVudFxuXHRcdFx0dW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24uc3R5bGUuYmFja2dyb3VuZENvbG9yID0gdW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24uZGF0YUJhY2tncm91bmRDb2xvclxuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zb2xlLmRlYnVnKFwiVXNlciBhc2tlZCB0byBzdGFydCBtZXNzYWdlcyB1bnNlbmRpbmdcIilcblx0XHRcdHVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uLnRleHRDb250ZW50ID0gXCJTdG9wIHByb2Nlc3NpbmdcIlxuXHRcdFx0dW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24uc3R5bGUuYmFja2dyb3VuZENvbG9yID0gXCIjRkEzODNFXCJcblx0XHRcdGNvbnN0IGJhdGNoU2l6ZSA9IGxvY2FsU3RvcmFnZS5nZXRJdGVtKFwiSURNVV9CQVRDSF9TSVpFXCIpIHx8IDFcblx0XHRcdGF3YWl0IHN0cmF0ZWd5LnJ1bihiYXRjaFNpemUpXG5cdFx0XHR1bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbi50ZXh0Q29udGVudCA9IHVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uLmRhdGFUZXh0Q29udGVudFxuXHRcdFx0dW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24uc3R5bGUuYmFja2dyb3VuZENvbG9yID0gdW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24uZGF0YUJhY2tncm91bmRDb2xvclxuXHRcdFx0YWxlcnQoXCJJRE1VOiBGaW5pc2hlZFwiKVxuXHRcdH1cblx0fSlcblx0bG9hZFRocmVhZE1lc3NhZ2VzQnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc29sZS5sb2coXCJsb2FkVGhyZWFkTWVzc2FnZXNCdXR0b24gY2xpY2tcIilcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgYmF0Y2hTaXplID0gcGFyc2VJbnQod2luZG93LnByb21wdChcIkhvdyBtYW55IHBhZ2VzIHNob3VsZCB3ZSBsb2FkID8gXCIsIGxvY2FsU3RvcmFnZS5nZXRJdGVtKFwiSURNVV9CQVRDSF9TSVpFXCIpIHx8IDUgKSlcblx0XHRcdGlmKHBhcnNlSW50KGJhdGNoU2l6ZSkpIHtcblx0XHRcdFx0bG9jYWxTdG9yYWdlLnNldEl0ZW0oXCJJRE1VX0JBVENIX1NJWkVcIiwgcGFyc2VJbnQoYmF0Y2hTaXplKSlcblx0XHRcdH1cblx0XHRcdGNvbnNvbGUuZGVidWcoYFNldHRpbmcgSURNVV9CQVRDSF9TSVpFIHRvICR7YmF0Y2hTaXplfWApXG5cdFx0fSBjYXRjaChleCkge1xuXHRcdFx0Y29uc29sZS5lcnJvcihleClcblx0XHR9XG5cdH0pXG5cdHdpbmRvdy5kb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHVpRWxlbWVudClcblx0cmV0dXJuIHsgdWlFbGVtZW50LCB1bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbiwgbG9hZFRocmVhZE1lc3NhZ2VzQnV0dG9uIH1cbn1cblxuLyoqXG4gKlxuICogQHBhcmFtICAge0RvY3VtZW50fSAgICAgICAgICBkb2N1bWVudFxuICogQHBhcmFtICAge3N0cmluZ30gICAgICAgICAgICB0ZXh0XG4gKiBAcGFyYW0gICB7c3RyaW5nfSAgICAgICAgICAgIHRleHRcbiAqIEBwYXJhbSAgIHtzdHJpbmd9ICAgICAgICAgICAgc3R5bGVOYW1lXG4gKiBAcmV0dXJucyB7b2JqZWN0fVxuICogQHJldHVybnMge0hUTUxEaXZFbGVtZW50fSAgICBvYmplY3QudWlFbGVtZW50XG4gKiBAcmV0dXJucyB7SFRNTERpdkVsZW1lbnR9ICAgIG9iamVjdC5tZW51RWxlbWVudFxuICogQHJldHVybnMge0hUTUxCdXR0b25FbGVtZW50fSBvYmplY3QudW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b25cbiAqIEByZXR1cm5zIHtIVE1MQnV0dG9uRWxlbWVudH0gb2JqZWN0LmxvYWRUaHJlYWRNZXNzYWdlc0J1dHRvblxuICovXG5mdW5jdGlvbiBjcmVhdGVVSUVsZW1lbnQoZG9jdW1lbnQpIHtcblx0Y29uc3QgdWlFbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKVxuXHRjb25zdCBtZW51RWxlbWVudCA9IGNyZWF0ZU1lbnVFbGVtZW50KGRvY3VtZW50KVxuXG5cdGNvbnN0IHVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uID0gY3JlYXRlTWVudUJ1dHRvbkVsZW1lbnQoZG9jdW1lbnQsIFwiVW5zZW5kIGFsbCBETXNcIilcblx0Y29uc3QgbG9hZFRocmVhZE1lc3NhZ2VzQnV0dG9uID0gY3JlYXRlTWVudUJ1dHRvbkVsZW1lbnQoZG9jdW1lbnQsIFwiTG9hZCBETXNcIiwgXCJzZWNvbmRhcnlcIilcblxuXG5cdG1lbnVFbGVtZW50LmFwcGVuZENoaWxkKHVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uKVxuXHRtZW51RWxlbWVudC5hcHBlbmRDaGlsZChsb2FkVGhyZWFkTWVzc2FnZXNCdXR0b24pXG5cblx0dWlFbGVtZW50LmFwcGVuZENoaWxkKG1lbnVFbGVtZW50KVxuXHRyZXR1cm4geyB1aUVsZW1lbnQsIG1lbnVFbGVtZW50LCB1bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbiwgbG9hZFRocmVhZE1lc3NhZ2VzQnV0dG9uIH1cbn1cbiIsIi8vIFRoaXMgc2NyaXB0IGF1dG9tYXRlcyB0aGUgcHJvY2VzcyBvZiB1bnNlbmRpbmcgRE0ncyBvbiBpbnN0YWdyYW0uY29tXG4vLyBUaGlzIHNjcmlwdCBpcyBtZWFudCB0byBiZSBydW4gb24gdGhlIHBhZ2UgdGhhdCBsaXN0cyB0aGUgbWVzc2FnZSB0aHJlYWRzXG4vLyBUaGUgd29ya2Zsb3cgd29ya3MgYXMgZm9sbG93OlxuLy8gLSBDcmVhdGUgYSBsaXN0IG9mIGFsbCBtZXNzYWdlcyBieSBxdWVyeWluZyBvbiB0aGUgW3JvbGU9bGlzdGJveF0gc2VsZWN0b3Jcbi8vICAtIEZvciBlYWNoIG1lc3NhZ2UgYW5vdGhlciB3b3JrZmxvdyBiZWdpbnM6XG4vLyAgICAgIC0gT3ZlciB0aGUgbWVzc2FnZSBub2RlIHNvIHRoYXQgdGhlIHRocmVlIGRvdHMgYnV0dG9uIGFwcGVhcnNcbi8vICAgICAgLSBDbGljayB0aGUgdGhyZWUgZG90cyBidXR0b24gdG8gb3BlbiB0aGUgbWVzc2FnZSBhY3Rpb25zXG4vLyAgICAgIC0gQ2xpY2sgdGhlIFwiVW5zZW5kXCIgYWN0aW9uIGJ1dHRvbiwgYSBtb2RhbCB3aWxsIG9wZW4gd2l0aCBhIGRpYWxvZyB0aGF0IGFza3MgdXNlciB0byBjb25maXJtIHRoZSBpbnRlbnRcbi8vICAgICAgLSBDbGljayB0aGUgXCJVbnNlbmRcIiBidXR0b24gaW5zaWRlIHRoZSBtb2RhbFxuLy8gVGhlcmUgaXMgbm8gY29uY3VycmVuY3ksIG1lc3NhZ2UgYXJlIHVuc2VudCBvbmUgYWZ0ZXIgYW5vdGhlciBieSB1c2luZyBhIHF1ZXVlLlxuXG5pbXBvcnQgeyByZW5kZXIgfSBmcm9tIFwiLi91aS91aS5qc1wiXG5cbnJlbmRlcih3aW5kb3cpXG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQUFBLE1BQU0sWUFBWSxHQUFHO0NBQ3JCLENBQUMsU0FBUyxFQUFFLFNBQVM7Q0FDckIsQ0FBQyxXQUFXLEVBQUUsV0FBVztDQUN6QixFQUFDO0FBQ0Q7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtD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
