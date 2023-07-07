
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
// @version				0.5.1
// @updateURL				https://raw.githubusercontent.com/thoughtsunificator/instagram-dm-unsender/userscript/idmu.user.js
// @downloadURL				https://raw.githubusercontent.com/thoughtsunificator/instagram-dm-unsender/userscript/idmu.user.js
// @description				Simple script to unsend all DMs in a thread on instagram.com
// @run-at				document-end
// @include				/^https://(www\.)?instagram\.com/direct*/

// ==/UserScript==


;(function() {
	window["IDMU_MESSAGE_QUEUE_DELAY"] = 1000
	window["IDMU_SCROLL_DETECTION_TIMEOUT"] = 10000
	window["IDMU_NEXT_MESSAGE_PAGE_DELAY"] = 1000
	window["IDMU_UNSUCESSFUL_WORKFLOW_ALERT_INTERVAL"] = 5000
	window["IDMU_DEBUG"] = false
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
		menuElement.style.zIndex = 999;
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
	 * @callback getElement
	 * @returns {Element}
	 */

	/**
	 *
	 * @param {Element} target
	 * @param {getElement} getElement
	 * @returns {Promise<Element>}
	 */
	async function waitForElement(target, getElement) {
		return new Promise((resolve) => {
			let element = getElement();
			if(element) {
				resolve(element);
			} else {
				new MutationObserver((mutations, observer) => {
					element = getElement();
					if(element) {
						observer.disconnect();
						resolve(element);
					}
				}).observe(target, { subtree: true, childList:true });
			}
		})
	}

	/**
	 *
	 * @param {Element} clickTarget
	 * @param {Element} target
	 * @param {getElement} getElement
	 * @returns {Element|Promise<Element>}
	 */
	function clickElementAndWaitFor(clickTarget, target, getElement) {
		const promise = waitForElement(target, getElement);
		clickTarget.click();
		return getElement() || promise
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

		/**
		 *
		 * @param {Element} target
		 * @param {function} getElement
		 * @returns {Promise<Element>}
		 */
		async waitForElement(target, getElement) {
			return getElement() || waitForElement(target, getElement)
		}

		/**
		 *
		 * @param {Element} clickTarget
		 * @param {Element} target
		 * @param {function} getElement
		 * @returns {Promise<Element>}
		 */
		async clickElementAndWaitFor(clickTarget, target, getElement) {
			return clickElementAndWaitFor(clickTarget, target, getElement)
		}

	}

	/**
	 *
	 * @param {Element} root
	 * @returns {Promise<boolean>}
	 */
	async function loadMoreMessageStrategy(root) {
		let _observer;
		const promise = Promise.race([
			new Promise((resolve) => {
				_observer = new MutationObserver((mutations, observer) => {
					if(root.scrollTop !== 0) {
						observer.disconnect();
						resolve(false);
					}
				}).observe(root, { subtree: true, childList:true });
			}),
			new Promise(resolve => setTimeout(() => {
				if(_observer) {
					_observer.disconnect();
				}
				resolve(true);
			}, root.ownerDocument.defaultView.IDMU_SCROLL_DETECTION_TIMEOUT))
		]);
		root.scrollTop = 0;
		return promise
	}

	class UIMessagesWrapper extends UIComponent {

		/**
		 * @param {Window}
		 * @returns {Element}
		 */
		static find(window) {
			return window.document.querySelector("div[role=grid] > div > div > div > div")
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
	 * @param {Window} window
	 * @returns {Element}
	 */
	function findMessagesWrapperStrategy(window) {
		return UIMessagesWrapper.find(window)
	}

	class UIMessage extends UIComponent {

		/**
		 *
		 * @param {HTMLDivElement} element
		 * @returns {Promise<boolean>}
		 */
		static async isMyOwnMessage(element) {
			const uiMessage = new UIMessage(element);
			const actionButton = await Promise.race([
				uiMessage.showActionsMenuButton(),
				new Promise(resolve => setTimeout(resolve, 20))
			]);
			if(actionButton) {
				const actionsMenuElement = await uiMessage.openActionsMenu(actionButton); // TODO i18n
				await uiMessage.closeActionsMenu(actionButton, actionsMenuElement);
				await uiMessage.hideActionMenuButton();
				return actionsMenuElement && actionsMenuElement.textContent.toLocaleLowerCase() === "unsend"
			}
			return false
		}

		/**
		 *
		 * @returns {Promise}
		 */
		async scrollIntoView() {
			this.root.scrollIntoView();
		}

		/**
		 *
		 * @returns {Promise<HTMLButtonElement>}
		 */
		async showActionsMenuButton() {
			console.debug("Workflow step 1 : showActionsMenuButton");
			this.root.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
			this.root.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
			this.root.dispatchEvent(new MouseEvent("mousenter", { bubbles: true }));
			return this.waitForElement(this.root, () => this.root.querySelector("[aria-label=More]")) // TODO i18n
		}

		/**
		 *
		 * @returns {Promise<boolean>}
		 */
		hideActionMenuButton() {
			console.debug("hideActionMenuButton");
			this.root.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
			this.root.dispatchEvent(new MouseEvent("mouseout", { bubbles: true }));
			this.root.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true }));
			return this.waitForElement(this.root, () => this.root.querySelector("[aria-label=More]") === null) // TODO i18n
		}

		/**
		 *
		 * @param {HTMLButtonElement} actionButton
		 * @returns {Promise}
		 */
		async openActionsMenu(actionButton) {
			console.debug("Workflow step 2 : openActionsMenu", actionButton);
			return this.clickElementAndWaitFor(
				actionButton,
				this.root.ownerDocument.body,
				() => {
					const menuElements = [...this.root.ownerDocument.querySelectorAll("[role=menu] [role=menuitem]")];
					menuElements.sort(node => node.textContent.toLocaleLowerCase() === "unsend" ? -1 : 0); // TODO i18n
					// return [...this.root.ownerDocument.querySelectorAll("[role=dialog] [role=menu] [role=menuitem]")].filter(node => node.textContent.toLocaleLowerCase() === "unsend").pop() // TODO i18n
					return menuElements.shift()
				},
			)

		}

		/**
		 *
		 * @param {HTMLButtonElement} actionButton
		 * @param {HTMLDivElement} actionsMenuElement
		 * @returns {Promise<boolean>}
		 */
		async closeActionsMenu(actionButton, actionsMenuElement) {
			console.debug("closeActionsMenu");
			return this.clickElementAndWaitFor(
				actionButton,
				this.root.ownerDocument.body,
				() => this.root.ownerDocument.body.contains(actionsMenuElement) === false,
			)
		}

		/**
		 *
		 * @returns {Promise<HTMLButtonElement>|Promise<Error>}
		 */
		async openConfirmUnsendModal() {
			console.debug("Workflow step 3 : openConfirmUnsendModal");
			const unSendButton = await this.waitForElement(
				this.root.ownerDocument.body,
				() => [...this.root.ownerDocument.querySelectorAll("[role=dialog] [role=menu] [role=menuitem]")].filter(node => node.textContent.toLocaleLowerCase() === "unsend").pop(), // TODO i18n
			);
			return this.clickElementAndWaitFor(
				unSendButton,
				this.root.ownerDocument.body,
				() => this.root.ownerDocument.querySelector("[role=dialog] button"),
			)
		}

		/**
		 *
		 * @param {HTMLButtonElement} dialogButton
		 * @returns {Promise}
		 */
		async confirmUnsend(dialogButton) {
			console.debug("Workflow final step : confirmUnsend", dialogButton);
			await this.clickElementAndWaitFor(
				dialogButton,
				this.root.ownerDocument.body,
				() => this.root.ownerDocument.querySelector("[role=dialog] button") === null
			);
		}

	}

	/**
	 *
	 * @param {Element} root
	 * @returns {Promise<Element[]>}
	 */
	async function findMessagesStrategy(root) {
		const elements = [...root.querySelectorAll("div[role=row]:not([data-idmu-ignore])")];
		const messageElements = [];
		for(const element of elements) {
			const isMyOwnMessage = await UIMessage.isMyOwnMessage(element);
			if(isMyOwnMessage) {
				messageElements.push(element);
			} else {
				element.setAttribute("data-idmu-ignore", "");
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
			console.debug("UIPIMessage unsend");
			let actionButton;
			let actionsMenuElement;
			try {
				await this.uiComponent.scrollIntoView();
				actionButton = await this.uiComponent.showActionsMenuButton();
				actionsMenuElement = await this.uiComponent.openActionsMenu(actionButton);
				const dialogButton = await this.uiComponent.openConfirmUnsendModal();
				await this.uiComponent.confirmUnsend(dialogButton);
				this.uiComponent.root.setAttribute("data-idmu-unsent", "");
				return true
			} catch(ex) {
				console.error(ex);
				if(actionButton && actionsMenuElement) {
					await this.uiComponent.closeActionsMenu(actionButton, actionsMenuElement);
				}
				await this.uiComponent.hideActionMenuButton();
				throw new FailedWorkflowException("Failed to execute workflow for this message")
			}
		}

	}

	class UI extends UIComponent {

		/**
		 *
		 * @returns {Promise>}
		 */
		async fetchAndRenderThreadNextMessagePage() {
			console.debug("UI fetchAndRenderThreadNextMessagePage");
			return await this.identifier.uiMessagesWrapper.fetchAndRenderThreadNextMessagePage()
		}

		/**
		 *
		 * @returns {Promise<UIPIMessage[]>}
		 */
		async createUIPIMessages() {
			console.debug("UI createUIPIMessages");
			const uipiMessages = [];
			const messageElements = await findMessagesStrategy(this.identifier.uiMessagesWrapper.root);
			console.debug("findMessagesStrategy", messageElements);
			for(const messageElement of messageElements) {
				const uiMessage = new UIMessage(messageElement);
				uipiMessages.push(new UIPIMessage(uiMessage));
			}
			return uipiMessages
		}

	}

	class UIPI extends UIPIComponent {

		/**
		 *
		 * @param {UI} uiComponent
		 */
		constructor(uiComponent) {
			super(uiComponent);
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
				console.debug(messagesWrapperElement);
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
			console.debug("UIPI fetchAndRenderThreadNextMessagePage");
			return this.uiComponent.fetchAndRenderThreadNextMessagePage()
		}

		/**
		 *
		 * @returns {Promise<UIPIMessage[]>}
		 */
		async createUIPIMessages() {
			console.debug("UIPI createUIPIMessages");
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

	class UnsendThreadMessagesBatchStrategy {

		static DEFAULT_BATCH_SIZE = 5

		#idmu
		#onUnsuccessfulWorkflows
		#finished_workflows

		/**
		 *
		 * @param {IDMU} idmu
		 */
		constructor(idmu, onUnsuccessfulWorkflows=null) {
			this._running = false;
			this._stopped = false;
			this.#finished_workflows = [];
			this.#idmu = idmu;
			this.#onUnsuccessfulWorkflows = onUnsuccessfulWorkflows;
		}

		/**
		 *
		 * @returns {boolean}
		 */
		isRunning() {
			return this._running && !this._stopped
		}

		stop() {
			console.debug("UnsendThreadMessagesBatchStrategy stop");
			this._stopped = true;
		}

		/**
		 *
		 * @param {number} batchSize
		 * @returns {Promise}
		 */
		async run(batchSize) {
			console.debug("UnsendThreadMessagesBatchStrategy.run()", batchSize);
			this._running = true;
			this._stopped = false;
			return this.#processBatches(batchSize)
		}

		#done() {
			this._running = false;
			console.debug("UnsendThreadMessagesBatchStrategy done");
		}

		#unsuccessfulWorkflowAlert() {
			console.debug("UnsendThreadMessagesBatchStrategy unsuccessfulWorkflowAlert");
			if(!this._running) {
				clearInterval(this.interval);
			}
			const unsuccessfulWorkflows = this.#finished_workflows.filter(uiMessage => this.#idmu.window.document.contains(uiMessage.uiComponent.root));
			if(unsuccessfulWorkflows.length >= 1) {
				unsuccessfulWorkflows.forEach(failedWorkflow => this.#finished_workflows.splice(this.#finished_workflows.indexOf(failedWorkflow), 1));
				this.#onUnsuccessfulWorkflows(unsuccessfulWorkflows);
			}
		}

		async #processBatches(batchSize) {
			console.debug("UnsendThreadMessagesBatchStrategy processBatches");
			let done = false;
			for(let i = 0; i < batchSize;i++) {
				if(this._stopped) {
					break
				}
				done = await this.#idmu.fetchAndRenderThreadNextMessagePage();
				if(done) {
					break
				} else {
					await new Promise(resolve => setTimeout(resolve, this.#idmu.window.IDMU_NEXT_MESSAGE_PAGE_DELAY));
				}
			}
			try {
				for(const uipiMessage of await this.#idmu.createUIPIMessages()) {
					if(this._stopped) {
						break
					}
					try {
						await uipiMessage.unsend();
						this.#finished_workflows.push(uipiMessage);
						await new Promise(resolve => setTimeout(resolve, this.#idmu.window.IDMU_MESSAGE_QUEUE_DELAY));
					} catch(result) {
						console.error(result);
					}
				}
			} catch(ex) {
				console.error(ex);
			}
			if(!this.interval && this.#onUnsuccessfulWorkflows) {
				this.interval = setInterval(() => this.#unsuccessfulWorkflowAlert(), this.#idmu.window.IDMU_UNSUCESSFUL_WORKFLOW_ALERT_INTERVAL);
			}
			if(done) {
				this.#done();
			} else if(!this._stopped) {
				return this.#processBatches(batchSize)
			}
		}
	}

	/**
	 *
	 * @param {Document} document
	 * @returns {HTMLButtonElement}
	 */
	function createAlertsWrapperElement(document) {
		const alertsWrapperElement = document.createElement("div");
		alertsWrapperElement.id = "idmu-alerts";
		alertsWrapperElement.style.position = "fixed";
		alertsWrapperElement.style.top = "20px";
		alertsWrapperElement.style.right = "20px";
		alertsWrapperElement.style.display = "grid";
		return alertsWrapperElement
	}

	/**
	 * @param {Document} document
	 * @returns {HTMLDivElement}
	 */
	function createOverlayElement(document) {
		const overlayElement = document.createElement("div");
		overlayElement.id = "idmu-overlay";
		overlayElement.style.top = "0";
		overlayElement.style.right = "0";
		overlayElement.style.position = "fixed";
		overlayElement.style.width = "100vw";
		overlayElement.style.height = "100vh";
		overlayElement.style.zIndex = "998";
		overlayElement.style.backgroundColor = "#000000d6";
		overlayElement.style.pointerEvents = "none";
		overlayElement.style.display = "none";
		return overlayElement
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
		const strategy = new UnsendThreadMessagesBatchStrategy(idmu, (unsuccessfulWorkflows) => {
			console.log(unsuccessfulWorkflows);
		});
		const { overlayElement, uiElement, unsendThreadMessagesButton, loadThreadMessagesButton } = createUIElement(window.document);
		function onUnsendingFinished() {
			console.debug("onUnsendingFinished");
			unsendThreadMessagesButton.textContent = unsendThreadMessagesButton.dataTextContent;
			unsendThreadMessagesButton.style.backgroundColor = unsendThreadMessagesButton.dataBackgroundColor;
			overlayElement.style.display = "none";
			if(!strategy._stopped) {
				window.alert("IDMU: Finished");
			}
		}
		window.document.addEventListener("keydown", event => {
			if(strategy.isRunning()) {
				console.info("User interaction is disabled as the strategy is still running; Please stop the execution first.");
				event.preventDefault();
			}
		});
		unsendThreadMessagesButton.dataTextContent = unsendThreadMessagesButton.textContent;
		unsendThreadMessagesButton.dataBackgroundColor = unsendThreadMessagesButton.style.backgroundColor;
		unsendThreadMessagesButton.addEventListener("click", async () => {
			if(strategy.isRunning()) {
				console.debug("User asked to stop messages unsending");
				strategy.stop();
				onUnsendingFinished();
			} else {
				overlayElement.style.display = "";
				console.debug("User asked to start messages unsending; UI i1nteraction will be disabled");
				unsendThreadMessagesButton.textContent = "Stop processing";
				unsendThreadMessagesButton.style.backgroundColor = "#FA383E";
				const batchSize = window.localStorage.getItem("IDMU_BATCH_SIZE") || UnsendThreadMessagesBatchStrategy.DEFAULT_BATCH_SIZE;
				await strategy.run(batchSize);
				onUnsendingFinished();
			}
		});
		loadThreadMessagesButton.addEventListener("click", async () => {
			console.debug("loadThreadMessagesButton click");
			try {
				const batchSize = parseInt(window.prompt("How many pages should we load ? ", window.localStorage.getItem("IDMU_BATCH_SIZE") || UnsendThreadMessagesBatchStrategy.DEFAULT_BATCH_SIZE ));
				if(parseInt(batchSize)) {
					window.localStorage.setItem("IDMU_BATCH_SIZE", parseInt(batchSize));
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
	 * @returns {object}
	 * @returns {HTMLDivElement}    object.uiElement
	 * @returns {HTMLDivElement}    object.overlayElement
	 * @returns {HTMLDivElement}    object.menuElement
	 * @returns {HTMLButtonElement} object.unsendThreadMessagesButton
	 * @returns {HTMLButtonElement} object.loadThreadMessagesButton
	 */
	function createUIElement(document) {
		const uiElement = document.createElement("div");
		const menuElement = createMenuElement(document);
		const overlayElement = createOverlayElement(document);
		const alertsWrapperElement = createAlertsWrapperElement(document);
		const unsendThreadMessagesButton = createMenuButtonElement(document, "Unsend all DMs");
		const loadThreadMessagesButton = createMenuButtonElement(document, "Batch size", "secondary");
		document.body.appendChild(overlayElement);
		document.body.appendChild(alertsWrapperElement);
		menuElement.appendChild(unsendThreadMessagesButton);
		menuElement.appendChild(loadThreadMessagesButton);
		uiElement.appendChild(menuElement);
		return { uiElement, overlayElement, menuElement, unsendThreadMessagesButton, loadThreadMessagesButton }
	}

	if(!window.IDMU_DEBUG) {
		console.debug = () => {};
	}

	render(window);

})();
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaWRtdS51c2VyLmpzIiwic291cmNlcyI6WyIuLi9zcmMvcnVudGltZS91c2Vyc2NyaXB0L3VpL3N0eWxlL2luc3RhZ3JhbS5qcyIsIi4uL3NyYy9ydW50aW1lL3VzZXJzY3JpcHQvdWkvbWVudS1idXR0b24uanMiLCIuLi9zcmMvcnVudGltZS91c2Vyc2NyaXB0L3VpL21lbnUuanMiLCIuLi9zcmMvdWlwaS91aXBpLWNvbXBvbmVudC5qcyIsIi4uL3NyYy9kb20vYXN5bmMtZXZlbnRzLmpzIiwiLi4vc3JjL3VpL3VpLWNvbXBvbmVudC5qcyIsIi4uL3NyYy91aS9zdHJhdGVneS9sb2FkLW1vcmUtbWVzc2FnZXMtc3RyYXRlZ3kuanMiLCIuLi9zcmMvdWkvdWktbWVzc2FnZXMtd3JhcHBlci5qcyIsIi4uL3NyYy91aS9zdHJhdGVneS9maW5kLW1lc3NhZ2VzLXdyYXBwZXItc3RyYXRlZ3kuanMiLCIuLi9zcmMvdWkvdWktbWVzc2FnZS5qcyIsIi4uL3NyYy91aS9zdHJhdGVneS9maW5kLW1lc3NhZ2VzLXN0cmF0ZWd5LmpzIiwiLi4vc3JjL3VpcGkvdWlwaS1tZXNzYWdlLmpzIiwiLi4vc3JjL3VpL3VpLmpzIiwiLi4vc3JjL3VpcGkvdWlwaS5qcyIsIi4uL3NyYy9pZG11L2lkbXUuanMiLCIuLi9zcmMvcnVudGltZS91c2Vyc2NyaXB0L3N0cmF0ZWd5LmpzIiwiLi4vc3JjL3J1bnRpbWUvdXNlcnNjcmlwdC91aS9hbGVydC5qcyIsIi4uL3NyYy9ydW50aW1lL3VzZXJzY3JpcHQvdWkvb3ZlcmxheS5qcyIsIi4uL3NyYy9ydW50aW1lL3VzZXJzY3JpcHQvdWkvdWkuanMiLCIuLi9zcmMvcnVudGltZS91c2Vyc2NyaXB0L21haW4uanMiXSwic291cmNlc0NvbnRlbnQiOlsiY29uc3QgQlVUVE9OX1NUWUxFID0ge1xuXHRcIlBSSU1BUllcIjogXCJwcmltYXJ5XCIsXG5cdFwiU0VDT05EQVJZXCI6IFwic2Vjb25kYXJ5XCIsXG59XG5cbi8qKlxuICpcbiAqIEBwYXJhbSB7SFRNTEJ1dHRvbkVsZW1lbnR9IGJ1dHRvbkVsZW1lbnRcbiAqIEBwYXJhbSB7c3RyaW5nfSAgICAgICAgICAgIHN0eWxlTmFtZVxuICovXG5leHBvcnQgZnVuY3Rpb24gYXBwbHlCdXR0b25TdHlsZShidXR0b25FbGVtZW50LCBzdHlsZU5hbWU9QlVUVE9OX1NUWUxFLlBSSU1BUlkpIHtcblx0YnV0dG9uRWxlbWVudC5zdHlsZS56SW5kZXggPSA5OTk5XG5cdGJ1dHRvbkVsZW1lbnQuc3R5bGUuZm9udFNpemUgPSBcInZhcigtLXN5c3RlbS0xNC1mb250LXNpemUpXCJcblx0YnV0dG9uRWxlbWVudC5zdHlsZS5jb2xvciA9IFwid2hpdGVcIlxuXHRidXR0b25FbGVtZW50LnN0eWxlLmJvcmRlciA9IFwiMHB4XCJcblx0YnV0dG9uRWxlbWVudC5zdHlsZS5ib3JkZXJSYWRpdXMgPSBcIjhweFwiXG5cdGJ1dHRvbkVsZW1lbnQuc3R5bGUucGFkZGluZyA9IFwiOHB4XCJcblx0YnV0dG9uRWxlbWVudC5zdHlsZS5mb250V2VpZ2h0ID0gXCJib2xkXCJcblx0YnV0dG9uRWxlbWVudC5zdHlsZS5jdXJzb3IgPSBcInBvaW50ZXJcIlxuXHRidXR0b25FbGVtZW50LnN0eWxlLmxpbmVIZWlnaHQgPSBcInZhcigtLXN5c3RlbS0xNC1saW5lLWhlaWdodClcIlxuXHRidXR0b25FbGVtZW50LnN0eWxlLmJhY2tncm91bmRDb2xvciA9IGByZ2IodmFyKC0taWctJHtzdHlsZU5hbWV9LWJ1dHRvbikpYFxufVxuIiwiaW1wb3J0IHsgYXBwbHlCdXR0b25TdHlsZSB9IGZyb20gXCIuL3N0eWxlL2luc3RhZ3JhbS5qc1wiXG5cbi8qKlxuICpcbiAqIEBwYXJhbSB7RG9jdW1lbnR9IGRvY3VtZW50XG4gKiBAcGFyYW0ge3N0cmluZ30gICB0ZXh0XG4gKiBAcGFyYW0ge3N0cmluZ30gICBzdHlsZU5hbWVcbiAqIEByZXR1cm5zIHtIVE1MQnV0dG9uRWxlbWVudH1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZU1lbnVCdXR0b25FbGVtZW50KGRvY3VtZW50LCB0ZXh0LCBzdHlsZU5hbWUpIHtcblx0Y29uc3QgYnV0dG9uRWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJidXR0b25cIilcblx0YnV0dG9uRWxlbWVudC50ZXh0Q29udGVudCA9IHRleHRcblx0YXBwbHlCdXR0b25TdHlsZShidXR0b25FbGVtZW50LCBzdHlsZU5hbWUpXG5cdGJ1dHRvbkVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNlb3ZlclwiLCBhc3luYyAoKSA9PiB7XG5cdFx0YnV0dG9uRWxlbWVudC5zdHlsZS5maWx0ZXIgPSBgYnJpZ2h0bmVzcygxLjE1KWBcblx0fSlcblx0YnV0dG9uRWxlbWVudC5hZGRFdmVudExpc3RlbmVyKFwibW91c2VvdXRcIiwgYXN5bmMgKCkgPT4ge1xuXHRcdGJ1dHRvbkVsZW1lbnQuc3R5bGUuZmlsdGVyID0gYGBcblx0fSlcblx0cmV0dXJuIGJ1dHRvbkVsZW1lbnRcbn1cbiIsIi8qKlxuICogQHBhcmFtIHtEb2N1bWVudH0gZG9jdW1lbnRcbiAqIEByZXR1cm5zIHtIVE1MQnV0dG9uRWxlbWVudH1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZU1lbnVFbGVtZW50KGRvY3VtZW50KSB7XG5cdGNvbnN0IG1lbnVFbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKVxuXHRtZW51RWxlbWVudC5zdHlsZS50b3AgPSBcIjIwcHhcIlxuXHRtZW51RWxlbWVudC5zdHlsZS5yaWdodCA9IFwiNDMwcHhcIlxuXHRtZW51RWxlbWVudC5zdHlsZS5wb3NpdGlvbiA9IFwiZml4ZWRcIlxuXHRtZW51RWxlbWVudC5zdHlsZS56SW5kZXggPSA5OTlcblx0bWVudUVsZW1lbnQuc3R5bGUuZGlzcGxheSA9IFwiZmxleFwiXG5cdG1lbnVFbGVtZW50LnN0eWxlLmdhcCA9IFwiMTBweFwiXG5cdHJldHVybiBtZW51RWxlbWVudFxufVxuIiwiZXhwb3J0IGRlZmF1bHQgY2xhc3MgVUlQSUNvbXBvbmVudCB7XG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge1VJQ29tcG9uZW50fSB1aUNvbXBvbmVudFxuXHQgKi9cblx0Y29uc3RydWN0b3IodWlDb21wb25lbnQpIHtcblx0XHR0aGlzLl91aUNvbXBvbmVudCA9IHVpQ29tcG9uZW50XG5cdH1cblxuXHQvKipcblx0ICogQHJlYWRvbmx5XG5cdCAqIEB0eXBlIHtVSUNvbXBvbmVudH1cblx0ICovXG5cdGdldCB1aUNvbXBvbmVudCgpIHtcblx0XHRyZXR1cm4gdGhpcy5fdWlDb21wb25lbnRcblx0fVxufVxuIiwiLyoqXG4gKlxuICogQGNhbGxiYWNrIGdldEVsZW1lbnRcbiAqIEByZXR1cm5zIHtFbGVtZW50fVxuICovXG5cbi8qKlxuICpcbiAqIEBwYXJhbSB7RWxlbWVudH0gdGFyZ2V0XG4gKiBAcGFyYW0ge2dldEVsZW1lbnR9IGdldEVsZW1lbnRcbiAqIEByZXR1cm5zIHtQcm9taXNlPEVsZW1lbnQ+fVxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gd2FpdEZvckVsZW1lbnQodGFyZ2V0LCBnZXRFbGVtZW50KSB7XG5cdHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuXHRcdGxldCBlbGVtZW50ID0gZ2V0RWxlbWVudCgpXG5cdFx0aWYoZWxlbWVudCkge1xuXHRcdFx0cmVzb2x2ZShlbGVtZW50KVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRuZXcgTXV0YXRpb25PYnNlcnZlcigobXV0YXRpb25zLCBvYnNlcnZlcikgPT4ge1xuXHRcdFx0XHRlbGVtZW50ID0gZ2V0RWxlbWVudCgpXG5cdFx0XHRcdGlmKGVsZW1lbnQpIHtcblx0XHRcdFx0XHRvYnNlcnZlci5kaXNjb25uZWN0KClcblx0XHRcdFx0XHRyZXNvbHZlKGVsZW1lbnQpXG5cdFx0XHRcdH1cblx0XHRcdH0pLm9ic2VydmUodGFyZ2V0LCB7IHN1YnRyZWU6IHRydWUsIGNoaWxkTGlzdDp0cnVlIH0pXG5cdFx0fVxuXHR9KVxufVxuXG4vKipcbiAqXG4gKiBAcGFyYW0ge0VsZW1lbnR9IGNsaWNrVGFyZ2V0XG4gKiBAcGFyYW0ge0VsZW1lbnR9IHRhcmdldFxuICogQHBhcmFtIHtnZXRFbGVtZW50fSBnZXRFbGVtZW50XG4gKiBAcmV0dXJucyB7RWxlbWVudHxQcm9taXNlPEVsZW1lbnQ+fVxuICovXG5leHBvcnQgZnVuY3Rpb24gY2xpY2tFbGVtZW50QW5kV2FpdEZvcihjbGlja1RhcmdldCwgdGFyZ2V0LCBnZXRFbGVtZW50KSB7XG5cdGNvbnN0IHByb21pc2UgPSB3YWl0Rm9yRWxlbWVudCh0YXJnZXQsIGdldEVsZW1lbnQpXG5cdGNsaWNrVGFyZ2V0LmNsaWNrKClcblx0cmV0dXJuIGdldEVsZW1lbnQoKSB8fCBwcm9taXNlXG59XG4iLCJpbXBvcnQgeyB3YWl0Rm9yRWxlbWVudCwgY2xpY2tFbGVtZW50QW5kV2FpdEZvciB9IGZyb20gXCIuLi9kb20vYXN5bmMtZXZlbnRzLmpzXCJcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgVUlDb21wb25lbnQge1xuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHtFbGVtZW50fSByb290XG5cdCAqIEBwYXJhbSB7b2JqZWN0fSBpZGVudGlmaWVyXG5cdCAqL1xuXHRjb25zdHJ1Y3Rvcihyb290LCBpZGVudGlmaWVyPXt9KSB7XG5cdFx0dGhpcy5yb290ID0gcm9vdFxuXHRcdHRoaXMuaWRlbnRpZmllciA9IGlkZW50aWZpZXJcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge0VsZW1lbnR9IHRhcmdldFxuXHQgKiBAcGFyYW0ge2Z1bmN0aW9ufSBnZXRFbGVtZW50XG5cdCAqIEByZXR1cm5zIHtQcm9taXNlPEVsZW1lbnQ+fVxuXHQgKi9cblx0YXN5bmMgd2FpdEZvckVsZW1lbnQodGFyZ2V0LCBnZXRFbGVtZW50KSB7XG5cdFx0cmV0dXJuIGdldEVsZW1lbnQoKSB8fCB3YWl0Rm9yRWxlbWVudCh0YXJnZXQsIGdldEVsZW1lbnQpXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHtFbGVtZW50fSBjbGlja1RhcmdldFxuXHQgKiBAcGFyYW0ge0VsZW1lbnR9IHRhcmdldFxuXHQgKiBAcGFyYW0ge2Z1bmN0aW9ufSBnZXRFbGVtZW50XG5cdCAqIEByZXR1cm5zIHtQcm9taXNlPEVsZW1lbnQ+fVxuXHQgKi9cblx0YXN5bmMgY2xpY2tFbGVtZW50QW5kV2FpdEZvcihjbGlja1RhcmdldCwgdGFyZ2V0LCBnZXRFbGVtZW50KSB7XG5cdFx0cmV0dXJuIGNsaWNrRWxlbWVudEFuZFdhaXRGb3IoY2xpY2tUYXJnZXQsIHRhcmdldCwgZ2V0RWxlbWVudClcblx0fVxuXG59XG4iLCIvKipcbiAqXG4gKiBAcGFyYW0ge0VsZW1lbnR9IHJvb3RcbiAqIEByZXR1cm5zIHtQcm9taXNlPGJvb2xlYW4+fVxuICovXG5leHBvcnQgZGVmYXVsdCBhc3luYyBmdW5jdGlvbiBsb2FkTW9yZU1lc3NhZ2VTdHJhdGVneShyb290KSB7XG5cdGxldCBfb2JzZXJ2ZXJcblx0Y29uc3QgcHJvbWlzZSA9IFByb21pc2UucmFjZShbXG5cdFx0bmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcblx0XHRcdF9vYnNlcnZlciA9IG5ldyBNdXRhdGlvbk9ic2VydmVyKChtdXRhdGlvbnMsIG9ic2VydmVyKSA9PiB7XG5cdFx0XHRcdGlmKHJvb3Quc2Nyb2xsVG9wICE9PSAwKSB7XG5cdFx0XHRcdFx0b2JzZXJ2ZXIuZGlzY29ubmVjdCgpXG5cdFx0XHRcdFx0cmVzb2x2ZShmYWxzZSlcblx0XHRcdFx0fVxuXHRcdFx0fSkub2JzZXJ2ZShyb290LCB7IHN1YnRyZWU6IHRydWUsIGNoaWxkTGlzdDp0cnVlIH0pXG5cdFx0fSksXG5cdFx0bmV3IFByb21pc2UocmVzb2x2ZSA9PiBzZXRUaW1lb3V0KCgpID0+IHtcblx0XHRcdGlmKF9vYnNlcnZlcikge1xuXHRcdFx0XHRfb2JzZXJ2ZXIuZGlzY29ubmVjdCgpXG5cdFx0XHR9XG5cdFx0XHRyZXNvbHZlKHRydWUpXG5cdFx0fSwgcm9vdC5vd25lckRvY3VtZW50LmRlZmF1bHRWaWV3LklETVVfU0NST0xMX0RFVEVDVElPTl9USU1FT1VUKSlcblx0XSlcblx0cm9vdC5zY3JvbGxUb3AgPSAwXG5cdHJldHVybiBwcm9taXNlXG59XG4iLCJpbXBvcnQgVUlDb21wb25lbnQgZnJvbSBcIi4vdWktY29tcG9uZW50LmpzXCJcbmltcG9ydCBsb2FkTW9yZU1lc3NhZ2VTdHJhdGVneSBmcm9tIFwiLi9zdHJhdGVneS9sb2FkLW1vcmUtbWVzc2FnZXMtc3RyYXRlZ3kuanNcIlxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBVSU1lc3NhZ2VzV3JhcHBlciBleHRlbmRzIFVJQ29tcG9uZW50IHtcblxuXHQvKipcblx0ICogQHBhcmFtIHtXaW5kb3d9XG5cdCAqIEByZXR1cm5zIHtFbGVtZW50fVxuXHQgKi9cblx0c3RhdGljIGZpbmQod2luZG93KSB7XG5cdFx0cmV0dXJuIHdpbmRvdy5kb2N1bWVudC5xdWVyeVNlbGVjdG9yKFwiZGl2W3JvbGU9Z3JpZF0gPiBkaXYgPiBkaXYgPiBkaXYgPiBkaXZcIilcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZT59XG5cdCAqL1xuXHRhc3luYyBmZXRjaEFuZFJlbmRlclRocmVhZE5leHRNZXNzYWdlUGFnZSgpIHtcblx0XHRyZXR1cm4gbG9hZE1vcmVNZXNzYWdlU3RyYXRlZ3kodGhpcy5yb290KVxuXHR9XG5cbn1cbiIsImltcG9ydCBVSU1lc3NhZ2VzV3JhcHBlciBmcm9tIFwiLi4vdWktbWVzc2FnZXMtd3JhcHBlci5qc1wiO1xuXG4vKipcbiAqXG4gKiBAcGFyYW0ge1dpbmRvd30gd2luZG93XG4gKiBAcmV0dXJucyB7RWxlbWVudH1cbiAqL1xuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gZmluZE1lc3NhZ2VzV3JhcHBlclN0cmF0ZWd5KHdpbmRvdykge1xuXHRyZXR1cm4gVUlNZXNzYWdlc1dyYXBwZXIuZmluZCh3aW5kb3cpXG59XG4iLCJpbXBvcnQgVUlDb21wb25lbnQgZnJvbSBcIi4vdWktY29tcG9uZW50LmpzXCJcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgVUlNZXNzYWdlIGV4dGVuZHMgVUlDb21wb25lbnQge1xuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge0hUTUxEaXZFbGVtZW50fSBlbGVtZW50XG5cdCAqIEByZXR1cm5zIHtQcm9taXNlPGJvb2xlYW4+fVxuXHQgKi9cblx0c3RhdGljIGFzeW5jIGlzTXlPd25NZXNzYWdlKGVsZW1lbnQpIHtcblx0XHRjb25zdCB1aU1lc3NhZ2UgPSBuZXcgVUlNZXNzYWdlKGVsZW1lbnQpXG5cdFx0Y29uc3QgYWN0aW9uQnV0dG9uID0gYXdhaXQgUHJvbWlzZS5yYWNlKFtcblx0XHRcdHVpTWVzc2FnZS5zaG93QWN0aW9uc01lbnVCdXR0b24oKSxcblx0XHRcdG5ldyBQcm9taXNlKHJlc29sdmUgPT4gc2V0VGltZW91dChyZXNvbHZlLCAyMCkpXG5cdFx0XSlcblx0XHRpZihhY3Rpb25CdXR0b24pIHtcblx0XHRcdGNvbnN0IGFjdGlvbnNNZW51RWxlbWVudCA9IGF3YWl0IHVpTWVzc2FnZS5vcGVuQWN0aW9uc01lbnUoYWN0aW9uQnV0dG9uKSAvLyBUT0RPIGkxOG5cblx0XHRcdGF3YWl0IHVpTWVzc2FnZS5jbG9zZUFjdGlvbnNNZW51KGFjdGlvbkJ1dHRvbiwgYWN0aW9uc01lbnVFbGVtZW50KVxuXHRcdFx0YXdhaXQgdWlNZXNzYWdlLmhpZGVBY3Rpb25NZW51QnV0dG9uKClcblx0XHRcdHJldHVybiBhY3Rpb25zTWVudUVsZW1lbnQgJiYgYWN0aW9uc01lbnVFbGVtZW50LnRleHRDb250ZW50LnRvTG9jYWxlTG93ZXJDYXNlKCkgPT09IFwidW5zZW5kXCJcblx0XHR9XG5cdFx0cmV0dXJuIGZhbHNlXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHJldHVybnMge1Byb21pc2V9XG5cdCAqL1xuXHRhc3luYyBzY3JvbGxJbnRvVmlldygpIHtcblx0XHR0aGlzLnJvb3Quc2Nyb2xsSW50b1ZpZXcoKVxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlPEhUTUxCdXR0b25FbGVtZW50Pn1cblx0ICovXG5cdGFzeW5jIHNob3dBY3Rpb25zTWVudUJ1dHRvbigpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwiV29ya2Zsb3cgc3RlcCAxIDogc2hvd0FjdGlvbnNNZW51QnV0dG9uXCIpXG5cdFx0dGhpcy5yb290LmRpc3BhdGNoRXZlbnQobmV3IE1vdXNlRXZlbnQoXCJtb3VzZW1vdmVcIiwgeyBidWJibGVzOiB0cnVlIH0pKVxuXHRcdHRoaXMucm9vdC5kaXNwYXRjaEV2ZW50KG5ldyBNb3VzZUV2ZW50KFwibW91c2VvdmVyXCIsIHsgYnViYmxlczogdHJ1ZSB9KSlcblx0XHR0aGlzLnJvb3QuZGlzcGF0Y2hFdmVudChuZXcgTW91c2VFdmVudChcIm1vdXNlbnRlclwiLCB7IGJ1YmJsZXM6IHRydWUgfSkpXG5cdFx0cmV0dXJuIHRoaXMud2FpdEZvckVsZW1lbnQodGhpcy5yb290LCAoKSA9PiB0aGlzLnJvb3QucXVlcnlTZWxlY3RvcihcIlthcmlhLWxhYmVsPU1vcmVdXCIpKSAvLyBUT0RPIGkxOG5cblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZTxib29sZWFuPn1cblx0ICovXG5cdGhpZGVBY3Rpb25NZW51QnV0dG9uKCkge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJoaWRlQWN0aW9uTWVudUJ1dHRvblwiKVxuXHRcdHRoaXMucm9vdC5kaXNwYXRjaEV2ZW50KG5ldyBNb3VzZUV2ZW50KFwibW91c2Vtb3ZlXCIsIHsgYnViYmxlczogdHJ1ZSB9KSlcblx0XHR0aGlzLnJvb3QuZGlzcGF0Y2hFdmVudChuZXcgTW91c2VFdmVudChcIm1vdXNlb3V0XCIsIHsgYnViYmxlczogdHJ1ZSB9KSlcblx0XHR0aGlzLnJvb3QuZGlzcGF0Y2hFdmVudChuZXcgTW91c2VFdmVudChcIm1vdXNlbGVhdmVcIiwgeyBidWJibGVzOiB0cnVlIH0pKVxuXHRcdHJldHVybiB0aGlzLndhaXRGb3JFbGVtZW50KHRoaXMucm9vdCwgKCkgPT4gdGhpcy5yb290LnF1ZXJ5U2VsZWN0b3IoXCJbYXJpYS1sYWJlbD1Nb3JlXVwiKSA9PT0gbnVsbCkgLy8gVE9ETyBpMThuXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHtIVE1MQnV0dG9uRWxlbWVudH0gYWN0aW9uQnV0dG9uXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlfVxuXHQgKi9cblx0YXN5bmMgb3BlbkFjdGlvbnNNZW51KGFjdGlvbkJ1dHRvbikge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJXb3JrZmxvdyBzdGVwIDIgOiBvcGVuQWN0aW9uc01lbnVcIiwgYWN0aW9uQnV0dG9uKVxuXHRcdHJldHVybiB0aGlzLmNsaWNrRWxlbWVudEFuZFdhaXRGb3IoXG5cdFx0XHRhY3Rpb25CdXR0b24sXG5cdFx0XHR0aGlzLnJvb3Qub3duZXJEb2N1bWVudC5ib2R5LFxuXHRcdFx0KCkgPT4ge1xuXHRcdFx0XHRjb25zdCBtZW51RWxlbWVudHMgPSBbLi4udGhpcy5yb290Lm93bmVyRG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChcIltyb2xlPW1lbnVdIFtyb2xlPW1lbnVpdGVtXVwiKV1cblx0XHRcdFx0bWVudUVsZW1lbnRzLnNvcnQobm9kZSA9PiBub2RlLnRleHRDb250ZW50LnRvTG9jYWxlTG93ZXJDYXNlKCkgPT09IFwidW5zZW5kXCIgPyAtMSA6IDApIC8vIFRPRE8gaTE4blxuXHRcdFx0XHQvLyByZXR1cm4gWy4uLnRoaXMucm9vdC5vd25lckRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoXCJbcm9sZT1kaWFsb2ddIFtyb2xlPW1lbnVdIFtyb2xlPW1lbnVpdGVtXVwiKV0uZmlsdGVyKG5vZGUgPT4gbm9kZS50ZXh0Q29udGVudC50b0xvY2FsZUxvd2VyQ2FzZSgpID09PSBcInVuc2VuZFwiKS5wb3AoKSAvLyBUT0RPIGkxOG5cblx0XHRcdFx0cmV0dXJuIG1lbnVFbGVtZW50cy5zaGlmdCgpXG5cdFx0XHR9LFxuXHRcdClcblxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7SFRNTEJ1dHRvbkVsZW1lbnR9IGFjdGlvbkJ1dHRvblxuXHQgKiBAcGFyYW0ge0hUTUxEaXZFbGVtZW50fSBhY3Rpb25zTWVudUVsZW1lbnRcblx0ICogQHJldHVybnMge1Byb21pc2U8Ym9vbGVhbj59XG5cdCAqL1xuXHRhc3luYyBjbG9zZUFjdGlvbnNNZW51KGFjdGlvbkJ1dHRvbiwgYWN0aW9uc01lbnVFbGVtZW50KSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcImNsb3NlQWN0aW9uc01lbnVcIilcblx0XHRyZXR1cm4gdGhpcy5jbGlja0VsZW1lbnRBbmRXYWl0Rm9yKFxuXHRcdFx0YWN0aW9uQnV0dG9uLFxuXHRcdFx0dGhpcy5yb290Lm93bmVyRG9jdW1lbnQuYm9keSxcblx0XHRcdCgpID0+IHRoaXMucm9vdC5vd25lckRvY3VtZW50LmJvZHkuY29udGFpbnMoYWN0aW9uc01lbnVFbGVtZW50KSA9PT0gZmFsc2UsXG5cdFx0KVxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlPEhUTUxCdXR0b25FbGVtZW50PnxQcm9taXNlPEVycm9yPn1cblx0ICovXG5cdGFzeW5jIG9wZW5Db25maXJtVW5zZW5kTW9kYWwoKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIldvcmtmbG93IHN0ZXAgMyA6IG9wZW5Db25maXJtVW5zZW5kTW9kYWxcIilcblx0XHRjb25zdCB1blNlbmRCdXR0b24gPSBhd2FpdCB0aGlzLndhaXRGb3JFbGVtZW50KFxuXHRcdFx0dGhpcy5yb290Lm93bmVyRG9jdW1lbnQuYm9keSxcblx0XHRcdCgpID0+IFsuLi50aGlzLnJvb3Qub3duZXJEb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKFwiW3JvbGU9ZGlhbG9nXSBbcm9sZT1tZW51XSBbcm9sZT1tZW51aXRlbV1cIildLmZpbHRlcihub2RlID0+IG5vZGUudGV4dENvbnRlbnQudG9Mb2NhbGVMb3dlckNhc2UoKSA9PT0gXCJ1bnNlbmRcIikucG9wKCksIC8vIFRPRE8gaTE4blxuXHRcdClcblx0XHRyZXR1cm4gdGhpcy5jbGlja0VsZW1lbnRBbmRXYWl0Rm9yKFxuXHRcdFx0dW5TZW5kQnV0dG9uLFxuXHRcdFx0dGhpcy5yb290Lm93bmVyRG9jdW1lbnQuYm9keSxcblx0XHRcdCgpID0+IHRoaXMucm9vdC5vd25lckRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCJbcm9sZT1kaWFsb2ddIGJ1dHRvblwiKSxcblx0XHQpXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHtIVE1MQnV0dG9uRWxlbWVudH0gZGlhbG9nQnV0dG9uXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlfVxuXHQgKi9cblx0YXN5bmMgY29uZmlybVVuc2VuZChkaWFsb2dCdXR0b24pIHtcblx0XHRjb25zb2xlLmRlYnVnKFwiV29ya2Zsb3cgZmluYWwgc3RlcCA6IGNvbmZpcm1VbnNlbmRcIiwgZGlhbG9nQnV0dG9uKVxuXHRcdGF3YWl0IHRoaXMuY2xpY2tFbGVtZW50QW5kV2FpdEZvcihcblx0XHRcdGRpYWxvZ0J1dHRvbixcblx0XHRcdHRoaXMucm9vdC5vd25lckRvY3VtZW50LmJvZHksXG5cdFx0XHQoKSA9PiB0aGlzLnJvb3Qub3duZXJEb2N1bWVudC5xdWVyeVNlbGVjdG9yKFwiW3JvbGU9ZGlhbG9nXSBidXR0b25cIikgPT09IG51bGxcblx0XHQpXG5cdH1cblxufVxuIiwiaW1wb3J0IFVJTWVzc2FnZSBmcm9tIFwiLi4vdWktbWVzc2FnZS5qc1wiXG5cbi8qKlxuICpcbiAqIEBwYXJhbSB7RWxlbWVudH0gcm9vdFxuICogQHJldHVybnMge1Byb21pc2U8RWxlbWVudFtdPn1cbiAqL1xuZXhwb3J0IGRlZmF1bHQgYXN5bmMgZnVuY3Rpb24gZmluZE1lc3NhZ2VzU3RyYXRlZ3kocm9vdCkge1xuXHRjb25zdCBlbGVtZW50cyA9IFsuLi5yb290LnF1ZXJ5U2VsZWN0b3JBbGwoXCJkaXZbcm9sZT1yb3ddOm5vdChbZGF0YS1pZG11LWlnbm9yZV0pXCIpXVxuXHRjb25zdCBtZXNzYWdlRWxlbWVudHMgPSBbXVxuXHRmb3IoY29uc3QgZWxlbWVudCBvZiBlbGVtZW50cykge1xuXHRcdGNvbnN0IGlzTXlPd25NZXNzYWdlID0gYXdhaXQgVUlNZXNzYWdlLmlzTXlPd25NZXNzYWdlKGVsZW1lbnQpXG5cdFx0aWYoaXNNeU93bk1lc3NhZ2UpIHtcblx0XHRcdG1lc3NhZ2VFbGVtZW50cy5wdXNoKGVsZW1lbnQpXG5cdFx0fSBlbHNlIHtcblx0XHRcdGVsZW1lbnQuc2V0QXR0cmlidXRlKFwiZGF0YS1pZG11LWlnbm9yZVwiLCBcIlwiKVxuXHRcdH1cblx0fVxuXHRjb25zb2xlLmRlYnVnKG1lc3NhZ2VFbGVtZW50cylcblx0cmV0dXJuIG1lc3NhZ2VFbGVtZW50c1xufVxuIiwiaW1wb3J0IFVJUElDb21wb25lbnQgZnJvbSBcIi4vdWlwaS1jb21wb25lbnQuanNcIlxuXG5cbmNsYXNzIEZhaWxlZFdvcmtmbG93RXhjZXB0aW9uIGV4dGVuZHMgRXJyb3Ige31cblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgVUlQSU1lc3NhZ2UgZXh0ZW5kcyBVSVBJQ29tcG9uZW50IHtcblxuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHtVSU1lc3NhZ2V9IHVpQ29tcG9uZW50XG5cdCAqL1xuXHRjb25zdHJ1Y3Rvcih1aUNvbXBvbmVudCkge1xuXHRcdHN1cGVyKHVpQ29tcG9uZW50KVxuXHR9XG5cblxuXHQvKipcblx0ICpcblx0ICogQHJldHVybnMge1Byb21pc2U8Ym9vbGVhbj59XG5cdCAqL1xuXHRhc3luYyB1bnNlbmQoKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIlVJUElNZXNzYWdlIHVuc2VuZFwiKVxuXHRcdGxldCBhY3Rpb25CdXR0b25cblx0XHRsZXQgYWN0aW9uc01lbnVFbGVtZW50XG5cdFx0dHJ5IHtcblx0XHRcdGF3YWl0IHRoaXMudWlDb21wb25lbnQuc2Nyb2xsSW50b1ZpZXcoKVxuXHRcdFx0YWN0aW9uQnV0dG9uID0gYXdhaXQgdGhpcy51aUNvbXBvbmVudC5zaG93QWN0aW9uc01lbnVCdXR0b24oKVxuXHRcdFx0YWN0aW9uc01lbnVFbGVtZW50ID0gYXdhaXQgdGhpcy51aUNvbXBvbmVudC5vcGVuQWN0aW9uc01lbnUoYWN0aW9uQnV0dG9uKVxuXHRcdFx0Y29uc3QgZGlhbG9nQnV0dG9uID0gYXdhaXQgdGhpcy51aUNvbXBvbmVudC5vcGVuQ29uZmlybVVuc2VuZE1vZGFsKClcblx0XHRcdGF3YWl0IHRoaXMudWlDb21wb25lbnQuY29uZmlybVVuc2VuZChkaWFsb2dCdXR0b24pXG5cdFx0XHR0aGlzLnVpQ29tcG9uZW50LnJvb3Quc2V0QXR0cmlidXRlKFwiZGF0YS1pZG11LXVuc2VudFwiLCBcIlwiKVxuXHRcdFx0cmV0dXJuIHRydWVcblx0XHR9IGNhdGNoKGV4KSB7XG5cdFx0XHRjb25zb2xlLmVycm9yKGV4KVxuXHRcdFx0aWYoYWN0aW9uQnV0dG9uICYmIGFjdGlvbnNNZW51RWxlbWVudCkge1xuXHRcdFx0XHRhd2FpdCB0aGlzLnVpQ29tcG9uZW50LmNsb3NlQWN0aW9uc01lbnUoYWN0aW9uQnV0dG9uLCBhY3Rpb25zTWVudUVsZW1lbnQpXG5cdFx0XHR9XG5cdFx0XHRhd2FpdCB0aGlzLnVpQ29tcG9uZW50LmhpZGVBY3Rpb25NZW51QnV0dG9uKClcblx0XHRcdHRocm93IG5ldyBGYWlsZWRXb3JrZmxvd0V4Y2VwdGlvbihcIkZhaWxlZCB0byBleGVjdXRlIHdvcmtmbG93IGZvciB0aGlzIG1lc3NhZ2VcIilcblx0XHR9XG5cdH1cblxufVxuIiwiaW1wb3J0IFVJQ29tcG9uZW50IGZyb20gXCIuL3VpLWNvbXBvbmVudC5qc1wiXG5pbXBvcnQgZmluZE1lc3NhZ2VzU3RyYXRlZ3kgZnJvbSBcIi4uL3VpL3N0cmF0ZWd5L2ZpbmQtbWVzc2FnZXMtc3RyYXRlZ3kuanNcIlxuaW1wb3J0IFVJUElNZXNzYWdlIGZyb20gXCIuLi91aXBpL3VpcGktbWVzc2FnZS5qc1wiXG5pbXBvcnQgVUlNZXNzYWdlIGZyb20gXCIuL3VpLW1lc3NhZ2UuanNcIlxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBVSSBleHRlbmRzIFVJQ29tcG9uZW50IHtcblxuXHQvKipcblx0ICpcblx0ICogQHJldHVybnMge1Byb21pc2U+fVxuXHQgKi9cblx0YXN5bmMgZmV0Y2hBbmRSZW5kZXJUaHJlYWROZXh0TWVzc2FnZVBhZ2UoKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIlVJIGZldGNoQW5kUmVuZGVyVGhyZWFkTmV4dE1lc3NhZ2VQYWdlXCIpXG5cdFx0cmV0dXJuIGF3YWl0IHRoaXMuaWRlbnRpZmllci51aU1lc3NhZ2VzV3JhcHBlci5mZXRjaEFuZFJlbmRlclRocmVhZE5leHRNZXNzYWdlUGFnZSgpXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHJldHVybnMge1Byb21pc2U8VUlQSU1lc3NhZ2VbXT59XG5cdCAqL1xuXHRhc3luYyBjcmVhdGVVSVBJTWVzc2FnZXMoKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIlVJIGNyZWF0ZVVJUElNZXNzYWdlc1wiKVxuXHRcdGNvbnN0IHVpcGlNZXNzYWdlcyA9IFtdXG5cdFx0Y29uc3QgbWVzc2FnZUVsZW1lbnRzID0gYXdhaXQgZmluZE1lc3NhZ2VzU3RyYXRlZ3kodGhpcy5pZGVudGlmaWVyLnVpTWVzc2FnZXNXcmFwcGVyLnJvb3QpXG5cdFx0Y29uc29sZS5kZWJ1ZyhcImZpbmRNZXNzYWdlc1N0cmF0ZWd5XCIsIG1lc3NhZ2VFbGVtZW50cylcblx0XHRmb3IoY29uc3QgbWVzc2FnZUVsZW1lbnQgb2YgbWVzc2FnZUVsZW1lbnRzKSB7XG5cdFx0XHRjb25zdCB1aU1lc3NhZ2UgPSBuZXcgVUlNZXNzYWdlKG1lc3NhZ2VFbGVtZW50KVxuXHRcdFx0dWlwaU1lc3NhZ2VzLnB1c2gobmV3IFVJUElNZXNzYWdlKHVpTWVzc2FnZSkpXG5cdFx0fVxuXHRcdHJldHVybiB1aXBpTWVzc2FnZXNcblx0fVxuXG59XG4iLCJpbXBvcnQgVUlQSUNvbXBvbmVudCBmcm9tIFwiLi91aXBpLWNvbXBvbmVudC5qc1wiXG5pbXBvcnQgZmluZE1lc3NhZ2VzV3JhcHBlclN0cmF0ZWd5IGZyb20gXCIuLi91aS9zdHJhdGVneS9maW5kLW1lc3NhZ2VzLXdyYXBwZXItc3RyYXRlZ3kuanNcIlxuaW1wb3J0IFVJTWVzc2FnZXNXcmFwcGVyIGZyb20gXCIuLi91aS91aS1tZXNzYWdlcy13cmFwcGVyLmpzXCJcbmltcG9ydCBVSSBmcm9tIFwiLi4vdWkvdWkuanNcIlxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBVSVBJIGV4dGVuZHMgVUlQSUNvbXBvbmVudCB7XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7VUl9IHVpQ29tcG9uZW50XG5cdCAqL1xuXHRjb25zdHJ1Y3Rvcih1aUNvbXBvbmVudCkge1xuXHRcdHN1cGVyKHVpQ29tcG9uZW50KVxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7V2luZG93fSB3aW5kb3dcblx0ICogQHJldHVybnMge1VJUEl9XG5cdCAqL1xuXHRzdGF0aWMgY3JlYXRlKHdpbmRvdykge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJVSVBJLmNyZWF0ZVwiKVxuXHRcdGNvbnN0IG1lc3NhZ2VzV3JhcHBlckVsZW1lbnQgPSBmaW5kTWVzc2FnZXNXcmFwcGVyU3RyYXRlZ3kod2luZG93KVxuXHRcdGxldCB1aXBpXG5cdFx0aWYobWVzc2FnZXNXcmFwcGVyRWxlbWVudCAhPT0gbnVsbCkge1xuXHRcdFx0Y29uc29sZS5kZWJ1ZyhcIkZvdW5kIG1lc3NhZ2VzV3JhcHBlckVsZW1lbnRcIilcblx0XHRcdGNvbnNvbGUuZGVidWcobWVzc2FnZXNXcmFwcGVyRWxlbWVudClcblx0XHRcdGNvbnN0IHVpID0gbmV3IFVJKHdpbmRvdylcblx0XHRcdHVpLmlkZW50aWZpZXIudWlNZXNzYWdlc1dyYXBwZXIgPSBuZXcgVUlNZXNzYWdlc1dyYXBwZXIobWVzc2FnZXNXcmFwcGVyRWxlbWVudClcblx0XHRcdHVpcGkgPSBuZXcgVUlQSSh1aSlcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiVW5hYmxlIHRvIGZpbmQgbWVzc2FnZXNXcmFwcGVyRWxlbWVudFwiKVxuXHRcdH1cblx0XHRyZXR1cm4gdWlwaVxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlfVxuXHQgKi9cblx0YXN5bmMgZmV0Y2hBbmRSZW5kZXJUaHJlYWROZXh0TWVzc2FnZVBhZ2UoKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIlVJUEkgZmV0Y2hBbmRSZW5kZXJUaHJlYWROZXh0TWVzc2FnZVBhZ2VcIilcblx0XHRyZXR1cm4gdGhpcy51aUNvbXBvbmVudC5mZXRjaEFuZFJlbmRlclRocmVhZE5leHRNZXNzYWdlUGFnZSgpXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHJldHVybnMge1Byb21pc2U8VUlQSU1lc3NhZ2VbXT59XG5cdCAqL1xuXHRhc3luYyBjcmVhdGVVSVBJTWVzc2FnZXMoKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIlVJUEkgY3JlYXRlVUlQSU1lc3NhZ2VzXCIpXG5cdFx0cmV0dXJuIHRoaXMudWlDb21wb25lbnQuY3JlYXRlVUlQSU1lc3NhZ2VzKClcblx0fVxuXG59XG4iLCJpbXBvcnQgVUlQSSBmcm9tIFwiLi4vdWlwaS91aXBpLmpzXCJcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgSURNVSB7XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7V2luZG93fSB3aW5kb3dcblx0ICovXG5cdGNvbnN0cnVjdG9yKHdpbmRvdykge1xuXHRcdHRoaXMud2luZG93ID0gd2luZG93XG5cdFx0dGhpcy51aXBpID0gbnVsbFxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlPFVJUElNZXNzYWdlW10+fVxuXHQgKi9cblx0YXN5bmMgY3JlYXRlVUlQSU1lc3NhZ2VzKCkge1xuXHRcdHJldHVybiB0aGlzLiNnZXRVSVBJKCkuY3JlYXRlVUlQSU1lc3NhZ2VzKClcblx0fVxuXG5cblx0LyoqXG5cdCAqXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlfVxuXHQgKi9cblx0YXN5bmMgZmV0Y2hBbmRSZW5kZXJUaHJlYWROZXh0TWVzc2FnZVBhZ2UoKSB7XG5cdFx0cmV0dXJuIHRoaXMuI2dldFVJUEkoKS5mZXRjaEFuZFJlbmRlclRocmVhZE5leHRNZXNzYWdlUGFnZSgpXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHJldHVybnMge1VJUEl9XG5cdCAqL1xuXHQjZ2V0VUlQSSgpIHtcblx0XHRpZih0aGlzLnVpcGkgPT09IG51bGwpIHtcblx0XHRcdHRoaXMudWlwaSA9IFVJUEkuY3JlYXRlKHRoaXMud2luZG93KVxuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy51aXBpXG5cdH1cblxufVxuIiwiXG5leHBvcnQgY2xhc3MgVW5zZW5kVGhyZWFkTWVzc2FnZXNCYXRjaFN0cmF0ZWd5IHtcblxuXHRzdGF0aWMgREVGQVVMVF9CQVRDSF9TSVpFID0gNVxuXG5cdCNpZG11XG5cdCNvblVuc3VjY2Vzc2Z1bFdvcmtmbG93c1xuXHQjZmluaXNoZWRfd29ya2Zsb3dzXG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7SURNVX0gaWRtdVxuXHQgKi9cblx0Y29uc3RydWN0b3IoaWRtdSwgb25VbnN1Y2Nlc3NmdWxXb3JrZmxvd3M9bnVsbCkge1xuXHRcdHRoaXMuX3J1bm5pbmcgPSBmYWxzZVxuXHRcdHRoaXMuX3N0b3BwZWQgPSBmYWxzZVxuXHRcdHRoaXMuI2ZpbmlzaGVkX3dvcmtmbG93cyA9IFtdXG5cdFx0dGhpcy4jaWRtdSA9IGlkbXVcblx0XHR0aGlzLiNvblVuc3VjY2Vzc2Z1bFdvcmtmbG93cyA9IG9uVW5zdWNjZXNzZnVsV29ya2Zsb3dzXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHJldHVybnMge2Jvb2xlYW59XG5cdCAqL1xuXHRpc1J1bm5pbmcoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX3J1bm5pbmcgJiYgIXRoaXMuX3N0b3BwZWRcblx0fVxuXG5cdHN0b3AoKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIlVuc2VuZFRocmVhZE1lc3NhZ2VzQmF0Y2hTdHJhdGVneSBzdG9wXCIpXG5cdFx0dGhpcy5fc3RvcHBlZCA9IHRydWVcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge251bWJlcn0gYmF0Y2hTaXplXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlfVxuXHQgKi9cblx0YXN5bmMgcnVuKGJhdGNoU2l6ZSkge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJVbnNlbmRUaHJlYWRNZXNzYWdlc0JhdGNoU3RyYXRlZ3kucnVuKClcIiwgYmF0Y2hTaXplKVxuXHRcdHRoaXMuX3J1bm5pbmcgPSB0cnVlXG5cdFx0dGhpcy5fc3RvcHBlZCA9IGZhbHNlXG5cdFx0cmV0dXJuIHRoaXMuI3Byb2Nlc3NCYXRjaGVzKGJhdGNoU2l6ZSlcblx0fVxuXG5cdCNkb25lKCkge1xuXHRcdHRoaXMuX3J1bm5pbmcgPSBmYWxzZVxuXHRcdGNvbnNvbGUuZGVidWcoXCJVbnNlbmRUaHJlYWRNZXNzYWdlc0JhdGNoU3RyYXRlZ3kgZG9uZVwiKVxuXHR9XG5cblx0I3Vuc3VjY2Vzc2Z1bFdvcmtmbG93QWxlcnQoKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIlVuc2VuZFRocmVhZE1lc3NhZ2VzQmF0Y2hTdHJhdGVneSB1bnN1Y2Nlc3NmdWxXb3JrZmxvd0FsZXJ0XCIpXG5cdFx0aWYoIXRoaXMuX3J1bm5pbmcpIHtcblx0XHRcdGNsZWFySW50ZXJ2YWwodGhpcy5pbnRlcnZhbClcblx0XHR9XG5cdFx0Y29uc3QgdW5zdWNjZXNzZnVsV29ya2Zsb3dzID0gdGhpcy4jZmluaXNoZWRfd29ya2Zsb3dzLmZpbHRlcih1aU1lc3NhZ2UgPT4gdGhpcy4jaWRtdS53aW5kb3cuZG9jdW1lbnQuY29udGFpbnModWlNZXNzYWdlLnVpQ29tcG9uZW50LnJvb3QpKVxuXHRcdGlmKHVuc3VjY2Vzc2Z1bFdvcmtmbG93cy5sZW5ndGggPj0gMSkge1xuXHRcdFx0dW5zdWNjZXNzZnVsV29ya2Zsb3dzLmZvckVhY2goZmFpbGVkV29ya2Zsb3cgPT4gdGhpcy4jZmluaXNoZWRfd29ya2Zsb3dzLnNwbGljZSh0aGlzLiNmaW5pc2hlZF93b3JrZmxvd3MuaW5kZXhPZihmYWlsZWRXb3JrZmxvdyksIDEpKVxuXHRcdFx0dGhpcy4jb25VbnN1Y2Nlc3NmdWxXb3JrZmxvd3ModW5zdWNjZXNzZnVsV29ya2Zsb3dzKVxuXHRcdH1cblx0fVxuXG5cdGFzeW5jICNwcm9jZXNzQmF0Y2hlcyhiYXRjaFNpemUpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwiVW5zZW5kVGhyZWFkTWVzc2FnZXNCYXRjaFN0cmF0ZWd5IHByb2Nlc3NCYXRjaGVzXCIpXG5cdFx0bGV0IGRvbmUgPSBmYWxzZVxuXHRcdGZvcihsZXQgaSA9IDA7IGkgPCBiYXRjaFNpemU7aSsrKSB7XG5cdFx0XHRpZih0aGlzLl9zdG9wcGVkKSB7XG5cdFx0XHRcdGJyZWFrXG5cdFx0XHR9XG5cdFx0XHRkb25lID0gYXdhaXQgdGhpcy4jaWRtdS5mZXRjaEFuZFJlbmRlclRocmVhZE5leHRNZXNzYWdlUGFnZSgpXG5cdFx0XHRpZihkb25lKSB7XG5cdFx0XHRcdGJyZWFrXG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRhd2FpdCBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgdGhpcy4jaWRtdS53aW5kb3cuSURNVV9ORVhUX01FU1NBR0VfUEFHRV9ERUxBWSkpXG5cdFx0XHR9XG5cdFx0fVxuXHRcdHRyeSB7XG5cdFx0XHRmb3IoY29uc3QgdWlwaU1lc3NhZ2Ugb2YgYXdhaXQgdGhpcy4jaWRtdS5jcmVhdGVVSVBJTWVzc2FnZXMoKSkge1xuXHRcdFx0XHRpZih0aGlzLl9zdG9wcGVkKSB7XG5cdFx0XHRcdFx0YnJlYWtcblx0XHRcdFx0fVxuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdGF3YWl0IHVpcGlNZXNzYWdlLnVuc2VuZCgpXG5cdFx0XHRcdFx0dGhpcy4jZmluaXNoZWRfd29ya2Zsb3dzLnB1c2godWlwaU1lc3NhZ2UpXG5cdFx0XHRcdFx0YXdhaXQgbmV3IFByb21pc2UocmVzb2x2ZSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIHRoaXMuI2lkbXUud2luZG93LklETVVfTUVTU0FHRV9RVUVVRV9ERUxBWSkpXG5cdFx0XHRcdH0gY2F0Y2gocmVzdWx0KSB7XG5cdFx0XHRcdFx0Y29uc29sZS5lcnJvcihyZXN1bHQpXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9IGNhdGNoKGV4KSB7XG5cdFx0XHRjb25zb2xlLmVycm9yKGV4KVxuXHRcdH1cblx0XHRpZighdGhpcy5pbnRlcnZhbCAmJiB0aGlzLiNvblVuc3VjY2Vzc2Z1bFdvcmtmbG93cykge1xuXHRcdFx0dGhpcy5pbnRlcnZhbCA9IHNldEludGVydmFsKCgpID0+IHRoaXMuI3Vuc3VjY2Vzc2Z1bFdvcmtmbG93QWxlcnQoKSwgdGhpcy4jaWRtdS53aW5kb3cuSURNVV9VTlNVQ0VTU0ZVTF9XT1JLRkxPV19BTEVSVF9JTlRFUlZBTClcblx0XHR9XG5cdFx0aWYoZG9uZSkge1xuXHRcdFx0dGhpcy4jZG9uZSgpXG5cdFx0fSBlbHNlIGlmKCF0aGlzLl9zdG9wcGVkKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy4jcHJvY2Vzc0JhdGNoZXMoYmF0Y2hTaXplKVxuXHRcdH1cblx0fVxufVxuIiwiLyoqXG4gKlxuICogQHBhcmFtIHtEb2N1bWVudH0gZG9jdW1lbnRcbiAqIEByZXR1cm5zIHtIVE1MQnV0dG9uRWxlbWVudH1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUFsZXJ0c1dyYXBwZXJFbGVtZW50KGRvY3VtZW50KSB7XG5cdGNvbnN0IGFsZXJ0c1dyYXBwZXJFbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKVxuXHRhbGVydHNXcmFwcGVyRWxlbWVudC5pZCA9IFwiaWRtdS1hbGVydHNcIlxuXHRhbGVydHNXcmFwcGVyRWxlbWVudC5zdHlsZS5wb3NpdGlvbiA9IFwiZml4ZWRcIlxuXHRhbGVydHNXcmFwcGVyRWxlbWVudC5zdHlsZS50b3AgPSBcIjIwcHhcIlxuXHRhbGVydHNXcmFwcGVyRWxlbWVudC5zdHlsZS5yaWdodCA9IFwiMjBweFwiXG5cdGFsZXJ0c1dyYXBwZXJFbGVtZW50LnN0eWxlLmRpc3BsYXkgPSBcImdyaWRcIlxuXHRyZXR1cm4gYWxlcnRzV3JhcHBlckVsZW1lbnRcbn1cblxuLyoqXG4gKlxuICogQHBhcmFtIHtEb2N1bWVudH0gZG9jdW1lbnRcbiAqIEBwYXJhbSB7c3RyaW5nfSAgIHRleHRcbiAqIEByZXR1cm5zIHtIVE1MQnV0dG9uRWxlbWVudH1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUFsZXJ0RWxlbWVudChkb2N1bWVudCwgdGV4dCkge1xuXHRjb25zdCBhbGVydEVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpXG5cdGFsZXJ0RWxlbWVudC50ZXh0Q29udGVudCA9IHRleHRcblx0cmV0dXJuIGFsZXJ0RWxlbWVudFxufVxuIiwiLyoqXG4gKiBAcGFyYW0ge0RvY3VtZW50fSBkb2N1bWVudFxuICogQHJldHVybnMge0hUTUxEaXZFbGVtZW50fVxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlT3ZlcmxheUVsZW1lbnQoZG9jdW1lbnQpIHtcblx0Y29uc3Qgb3ZlcmxheUVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpXG5cdG92ZXJsYXlFbGVtZW50LmlkID0gXCJpZG11LW92ZXJsYXlcIlxuXHRvdmVybGF5RWxlbWVudC5zdHlsZS50b3AgPSBcIjBcIlxuXHRvdmVybGF5RWxlbWVudC5zdHlsZS5yaWdodCA9IFwiMFwiXG5cdG92ZXJsYXlFbGVtZW50LnN0eWxlLnBvc2l0aW9uID0gXCJmaXhlZFwiXG5cdG92ZXJsYXlFbGVtZW50LnN0eWxlLndpZHRoID0gXCIxMDB2d1wiXG5cdG92ZXJsYXlFbGVtZW50LnN0eWxlLmhlaWdodCA9IFwiMTAwdmhcIlxuXHRvdmVybGF5RWxlbWVudC5zdHlsZS56SW5kZXggPSBcIjk5OFwiXG5cdG92ZXJsYXlFbGVtZW50LnN0eWxlLmJhY2tncm91bmRDb2xvciA9IFwiIzAwMDAwMGQ2XCJcblx0b3ZlcmxheUVsZW1lbnQuc3R5bGUucG9pbnRlckV2ZW50cyA9IFwibm9uZVwiXG5cdG92ZXJsYXlFbGVtZW50LnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIlxuXHRyZXR1cm4gb3ZlcmxheUVsZW1lbnRcbn1cbiIsImltcG9ydCB7IGNyZWF0ZU1lbnVCdXR0b25FbGVtZW50IH0gZnJvbSBcIi4vbWVudS1idXR0b24uanNcIlxuaW1wb3J0IHsgY3JlYXRlTWVudUVsZW1lbnQgfSBmcm9tIFwiLi9tZW51LmpzXCJcbmltcG9ydCBJRE1VIGZyb20gXCIuLi8uLi8uLi9pZG11L2lkbXUuanNcIlxuaW1wb3J0IHsgVW5zZW5kVGhyZWFkTWVzc2FnZXNCYXRjaFN0cmF0ZWd5IH0gZnJvbSBcIi4uL3N0cmF0ZWd5LmpzXCJcbmltcG9ydCB7IGNyZWF0ZUFsZXJ0c1dyYXBwZXJFbGVtZW50IH0gZnJvbSBcIi4vYWxlcnQuanNcIlxuaW1wb3J0IHsgY3JlYXRlT3ZlcmxheUVsZW1lbnQgfSBmcm9tIFwiLi9vdmVybGF5LmpzXCJcblxuLyoqXG4gKlxuICogQHBhcmFtIHt3aW5kb3d9IHdpbmRvd1xuICogQHJldHVybnMge0hUTUxEaXZFbGVtZW50fSAgICBvYmplY3QudWlFbGVtZW50XG4gKiBAcmV0dXJucyB7SFRNTEJ1dHRvbkVsZW1lbnR9IG9iamVjdC51bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvblxuICogQHJldHVybnMge0hUTUxCdXR0b25FbGVtZW50fSBvYmplY3QubG9hZFRocmVhZE1lc3NhZ2VzQnV0dG9uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZW5kZXIod2luZG93KSB7XG5cdGNvbnN0IGlkbXUgPSBuZXcgSURNVSh3aW5kb3cpXG5cdGNvbnN0IHN0cmF0ZWd5ID0gbmV3IFVuc2VuZFRocmVhZE1lc3NhZ2VzQmF0Y2hTdHJhdGVneShpZG11LCAodW5zdWNjZXNzZnVsV29ya2Zsb3dzKSA9PiB7XG5cdFx0Y29uc29sZS5sb2codW5zdWNjZXNzZnVsV29ya2Zsb3dzKVxuXHR9KVxuXHRjb25zdCB7IG92ZXJsYXlFbGVtZW50LCB1aUVsZW1lbnQsIHVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uLCBsb2FkVGhyZWFkTWVzc2FnZXNCdXR0b24gfSA9IGNyZWF0ZVVJRWxlbWVudCh3aW5kb3cuZG9jdW1lbnQpXG5cdGZ1bmN0aW9uIG9uVW5zZW5kaW5nRmluaXNoZWQoKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIm9uVW5zZW5kaW5nRmluaXNoZWRcIilcblx0XHR1bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbi50ZXh0Q29udGVudCA9IHVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uLmRhdGFUZXh0Q29udGVudFxuXHRcdHVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uLnN0eWxlLmJhY2tncm91bmRDb2xvciA9IHVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uLmRhdGFCYWNrZ3JvdW5kQ29sb3Jcblx0XHRvdmVybGF5RWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCJcblx0XHRpZighc3RyYXRlZ3kuX3N0b3BwZWQpIHtcblx0XHRcdHdpbmRvdy5hbGVydChcIklETVU6IEZpbmlzaGVkXCIpXG5cdFx0fVxuXHR9XG5cdHdpbmRvdy5kb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKFwia2V5ZG93blwiLCBldmVudCA9PiB7XG5cdFx0aWYoc3RyYXRlZ3kuaXNSdW5uaW5nKCkpIHtcblx0XHRcdGNvbnNvbGUuaW5mbyhcIlVzZXIgaW50ZXJhY3Rpb24gaXMgZGlzYWJsZWQgYXMgdGhlIHN0cmF0ZWd5IGlzIHN0aWxsIHJ1bm5pbmc7IFBsZWFzZSBzdG9wIHRoZSBleGVjdXRpb24gZmlyc3QuXCIpXG5cdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpXG5cdFx0fVxuXHR9KVxuXHR1bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbi5kYXRhVGV4dENvbnRlbnQgPSB1bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbi50ZXh0Q29udGVudFxuXHR1bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbi5kYXRhQmFja2dyb3VuZENvbG9yID0gdW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24uc3R5bGUuYmFja2dyb3VuZENvbG9yXG5cdHVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCBhc3luYyAoKSA9PiB7XG5cdFx0aWYoc3RyYXRlZ3kuaXNSdW5uaW5nKCkpIHtcblx0XHRcdGNvbnNvbGUuZGVidWcoXCJVc2VyIGFza2VkIHRvIHN0b3AgbWVzc2FnZXMgdW5zZW5kaW5nXCIpXG5cdFx0XHRzdHJhdGVneS5zdG9wKClcblx0XHRcdG9uVW5zZW5kaW5nRmluaXNoZWQoKVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRvdmVybGF5RWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gXCJcIlxuXHRcdFx0Y29uc29sZS5kZWJ1ZyhcIlVzZXIgYXNrZWQgdG8gc3RhcnQgbWVzc2FnZXMgdW5zZW5kaW5nOyBVSSBpMW50ZXJhY3Rpb24gd2lsbCBiZSBkaXNhYmxlZFwiKVxuXHRcdFx0dW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24udGV4dENvbnRlbnQgPSBcIlN0b3AgcHJvY2Vzc2luZ1wiXG5cdFx0XHR1bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbi5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSBcIiNGQTM4M0VcIlxuXHRcdFx0Y29uc3QgYmF0Y2hTaXplID0gd2luZG93LmxvY2FsU3RvcmFnZS5nZXRJdGVtKFwiSURNVV9CQVRDSF9TSVpFXCIpIHx8IFVuc2VuZFRocmVhZE1lc3NhZ2VzQmF0Y2hTdHJhdGVneS5ERUZBVUxUX0JBVENIX1NJWkVcblx0XHRcdGF3YWl0IHN0cmF0ZWd5LnJ1bihiYXRjaFNpemUpXG5cdFx0XHRvblVuc2VuZGluZ0ZpbmlzaGVkKClcblx0XHR9XG5cdH0pXG5cdGxvYWRUaHJlYWRNZXNzYWdlc0J1dHRvbi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJsb2FkVGhyZWFkTWVzc2FnZXNCdXR0b24gY2xpY2tcIilcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgYmF0Y2hTaXplID0gcGFyc2VJbnQod2luZG93LnByb21wdChcIkhvdyBtYW55IHBhZ2VzIHNob3VsZCB3ZSBsb2FkID8gXCIsIHdpbmRvdy5sb2NhbFN0b3JhZ2UuZ2V0SXRlbShcIklETVVfQkFUQ0hfU0laRVwiKSB8fCBVbnNlbmRUaHJlYWRNZXNzYWdlc0JhdGNoU3RyYXRlZ3kuREVGQVVMVF9CQVRDSF9TSVpFICkpXG5cdFx0XHRpZihwYXJzZUludChiYXRjaFNpemUpKSB7XG5cdFx0XHRcdHdpbmRvdy5sb2NhbFN0b3JhZ2Uuc2V0SXRlbShcIklETVVfQkFUQ0hfU0laRVwiLCBwYXJzZUludChiYXRjaFNpemUpKVxuXHRcdFx0fVxuXHRcdFx0Y29uc29sZS5kZWJ1ZyhgU2V0dGluZyBJRE1VX0JBVENIX1NJWkUgdG8gJHtiYXRjaFNpemV9YClcblx0XHR9IGNhdGNoKGV4KSB7XG5cdFx0XHRjb25zb2xlLmVycm9yKGV4KVxuXHRcdH1cblx0fSlcblx0d2luZG93LmRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQodWlFbGVtZW50KVxuXHRyZXR1cm4geyB1aUVsZW1lbnQsIHVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uLCBsb2FkVGhyZWFkTWVzc2FnZXNCdXR0b24gfVxufVxuXG4vKipcbiAqXG4gKiBAcGFyYW0gICB7RG9jdW1lbnR9ICAgICAgICAgIGRvY3VtZW50XG4gKiBAcmV0dXJucyB7b2JqZWN0fVxuICogQHJldHVybnMge0hUTUxEaXZFbGVtZW50fSAgICBvYmplY3QudWlFbGVtZW50XG4gKiBAcmV0dXJucyB7SFRNTERpdkVsZW1lbnR9ICAgIG9iamVjdC5vdmVybGF5RWxlbWVudFxuICogQHJldHVybnMge0hUTUxEaXZFbGVtZW50fSAgICBvYmplY3QubWVudUVsZW1lbnRcbiAqIEByZXR1cm5zIHtIVE1MQnV0dG9uRWxlbWVudH0gb2JqZWN0LnVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uXG4gKiBAcmV0dXJucyB7SFRNTEJ1dHRvbkVsZW1lbnR9IG9iamVjdC5sb2FkVGhyZWFkTWVzc2FnZXNCdXR0b25cbiAqL1xuZnVuY3Rpb24gY3JlYXRlVUlFbGVtZW50KGRvY3VtZW50KSB7XG5cdGNvbnN0IHVpRWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIilcblx0Y29uc3QgbWVudUVsZW1lbnQgPSBjcmVhdGVNZW51RWxlbWVudChkb2N1bWVudClcblx0Y29uc3Qgb3ZlcmxheUVsZW1lbnQgPSBjcmVhdGVPdmVybGF5RWxlbWVudChkb2N1bWVudClcblx0Y29uc3QgYWxlcnRzV3JhcHBlckVsZW1lbnQgPSBjcmVhdGVBbGVydHNXcmFwcGVyRWxlbWVudChkb2N1bWVudClcblx0Y29uc3QgdW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24gPSBjcmVhdGVNZW51QnV0dG9uRWxlbWVudChkb2N1bWVudCwgXCJVbnNlbmQgYWxsIERNc1wiKVxuXHRjb25zdCBsb2FkVGhyZWFkTWVzc2FnZXNCdXR0b24gPSBjcmVhdGVNZW51QnV0dG9uRWxlbWVudChkb2N1bWVudCwgXCJCYXRjaCBzaXplXCIsIFwic2Vjb25kYXJ5XCIpXG5cdGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQob3ZlcmxheUVsZW1lbnQpXG5cdGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoYWxlcnRzV3JhcHBlckVsZW1lbnQpXG5cdG1lbnVFbGVtZW50LmFwcGVuZENoaWxkKHVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uKVxuXHRtZW51RWxlbWVudC5hcHBlbmRDaGlsZChsb2FkVGhyZWFkTWVzc2FnZXNCdXR0b24pXG5cdHVpRWxlbWVudC5hcHBlbmRDaGlsZChtZW51RWxlbWVudClcblx0cmV0dXJuIHsgdWlFbGVtZW50LCBvdmVybGF5RWxlbWVudCwgbWVudUVsZW1lbnQsIHVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uLCBsb2FkVGhyZWFkTWVzc2FnZXNCdXR0b24gfVxufVxuIiwiaW1wb3J0IHsgcmVuZGVyIH0gZnJvbSBcIi4vdWkvdWkuanNcIlxuXG5pZighd2luZG93LklETVVfREVCVUcpIHtcblx0Y29uc29sZS5kZWJ1ZyA9ICgp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
