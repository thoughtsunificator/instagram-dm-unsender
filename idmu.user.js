
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
// @version				0.5.2
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
		function handleEvents(event) {
			if(strategy.isRunning() && !uiElement.contains(event.target)) {
				console.info("User interaction is disabled as the strategy is still running; Please stop the execution first.");
				event.preventDefault();
			}
		}
		window.document.addEventListener("keydown", handleEvents);
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
		document.body.prepend(overlayElement);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaWRtdS51c2VyLmpzIiwic291cmNlcyI6WyIuLi9zcmMvcnVudGltZS91c2Vyc2NyaXB0L3VpL3N0eWxlL2luc3RhZ3JhbS5qcyIsIi4uL3NyYy9ydW50aW1lL3VzZXJzY3JpcHQvdWkvbWVudS1idXR0b24uanMiLCIuLi9zcmMvcnVudGltZS91c2Vyc2NyaXB0L3VpL21lbnUuanMiLCIuLi9zcmMvdWlwaS91aXBpLWNvbXBvbmVudC5qcyIsIi4uL3NyYy9kb20vYXN5bmMtZXZlbnRzLmpzIiwiLi4vc3JjL3VpL3VpLWNvbXBvbmVudC5qcyIsIi4uL3NyYy91aS9zdHJhdGVneS9sb2FkLW1vcmUtbWVzc2FnZXMtc3RyYXRlZ3kuanMiLCIuLi9zcmMvdWkvdWktbWVzc2FnZXMtd3JhcHBlci5qcyIsIi4uL3NyYy91aS9zdHJhdGVneS9maW5kLW1lc3NhZ2VzLXdyYXBwZXItc3RyYXRlZ3kuanMiLCIuLi9zcmMvdWkvdWktbWVzc2FnZS5qcyIsIi4uL3NyYy91aS9zdHJhdGVneS9maW5kLW1lc3NhZ2VzLXN0cmF0ZWd5LmpzIiwiLi4vc3JjL3VpcGkvdWlwaS1tZXNzYWdlLmpzIiwiLi4vc3JjL3VpL3VpLmpzIiwiLi4vc3JjL3VpcGkvdWlwaS5qcyIsIi4uL3NyYy9pZG11L2lkbXUuanMiLCIuLi9zcmMvcnVudGltZS91c2Vyc2NyaXB0L3N0cmF0ZWd5LmpzIiwiLi4vc3JjL3J1bnRpbWUvdXNlcnNjcmlwdC91aS9hbGVydC5qcyIsIi4uL3NyYy9ydW50aW1lL3VzZXJzY3JpcHQvdWkvb3ZlcmxheS5qcyIsIi4uL3NyYy9ydW50aW1lL3VzZXJzY3JpcHQvdWkvdWkuanMiLCIuLi9zcmMvcnVudGltZS91c2Vyc2NyaXB0L21haW4uanMiXSwic291cmNlc0NvbnRlbnQiOlsiY29uc3QgQlVUVE9OX1NUWUxFID0ge1xuXHRcIlBSSU1BUllcIjogXCJwcmltYXJ5XCIsXG5cdFwiU0VDT05EQVJZXCI6IFwic2Vjb25kYXJ5XCIsXG59XG5cbi8qKlxuICpcbiAqIEBwYXJhbSB7SFRNTEJ1dHRvbkVsZW1lbnR9IGJ1dHRvbkVsZW1lbnRcbiAqIEBwYXJhbSB7c3RyaW5nfSAgICAgICAgICAgIHN0eWxlTmFtZVxuICovXG5leHBvcnQgZnVuY3Rpb24gYXBwbHlCdXR0b25TdHlsZShidXR0b25FbGVtZW50LCBzdHlsZU5hbWU9QlVUVE9OX1NUWUxFLlBSSU1BUlkpIHtcblx0YnV0dG9uRWxlbWVudC5zdHlsZS56SW5kZXggPSA5OTk5XG5cdGJ1dHRvbkVsZW1lbnQuc3R5bGUuZm9udFNpemUgPSBcInZhcigtLXN5c3RlbS0xNC1mb250LXNpemUpXCJcblx0YnV0dG9uRWxlbWVudC5zdHlsZS5jb2xvciA9IFwid2hpdGVcIlxuXHRidXR0b25FbGVtZW50LnN0eWxlLmJvcmRlciA9IFwiMHB4XCJcblx0YnV0dG9uRWxlbWVudC5zdHlsZS5ib3JkZXJSYWRpdXMgPSBcIjhweFwiXG5cdGJ1dHRvbkVsZW1lbnQuc3R5bGUucGFkZGluZyA9IFwiOHB4XCJcblx0YnV0dG9uRWxlbWVudC5zdHlsZS5mb250V2VpZ2h0ID0gXCJib2xkXCJcblx0YnV0dG9uRWxlbWVudC5zdHlsZS5jdXJzb3IgPSBcInBvaW50ZXJcIlxuXHRidXR0b25FbGVtZW50LnN0eWxlLmxpbmVIZWlnaHQgPSBcInZhcigtLXN5c3RlbS0xNC1saW5lLWhlaWdodClcIlxuXHRidXR0b25FbGVtZW50LnN0eWxlLmJhY2tncm91bmRDb2xvciA9IGByZ2IodmFyKC0taWctJHtzdHlsZU5hbWV9LWJ1dHRvbikpYFxufVxuIiwiaW1wb3J0IHsgYXBwbHlCdXR0b25TdHlsZSB9IGZyb20gXCIuL3N0eWxlL2luc3RhZ3JhbS5qc1wiXG5cbi8qKlxuICpcbiAqIEBwYXJhbSB7RG9jdW1lbnR9IGRvY3VtZW50XG4gKiBAcGFyYW0ge3N0cmluZ30gICB0ZXh0XG4gKiBAcGFyYW0ge3N0cmluZ30gICBzdHlsZU5hbWVcbiAqIEByZXR1cm5zIHtIVE1MQnV0dG9uRWxlbWVudH1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZU1lbnVCdXR0b25FbGVtZW50KGRvY3VtZW50LCB0ZXh0LCBzdHlsZU5hbWUpIHtcblx0Y29uc3QgYnV0dG9uRWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJidXR0b25cIilcblx0YnV0dG9uRWxlbWVudC50ZXh0Q29udGVudCA9IHRleHRcblx0YXBwbHlCdXR0b25TdHlsZShidXR0b25FbGVtZW50LCBzdHlsZU5hbWUpXG5cdGJ1dHRvbkVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNlb3ZlclwiLCBhc3luYyAoKSA9PiB7XG5cdFx0YnV0dG9uRWxlbWVudC5zdHlsZS5maWx0ZXIgPSBgYnJpZ2h0bmVzcygxLjE1KWBcblx0fSlcblx0YnV0dG9uRWxlbWVudC5hZGRFdmVudExpc3RlbmVyKFwibW91c2VvdXRcIiwgYXN5bmMgKCkgPT4ge1xuXHRcdGJ1dHRvbkVsZW1lbnQuc3R5bGUuZmlsdGVyID0gYGBcblx0fSlcblx0cmV0dXJuIGJ1dHRvbkVsZW1lbnRcbn1cbiIsIi8qKlxuICogQHBhcmFtIHtEb2N1bWVudH0gZG9jdW1lbnRcbiAqIEByZXR1cm5zIHtIVE1MQnV0dG9uRWxlbWVudH1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZU1lbnVFbGVtZW50KGRvY3VtZW50KSB7XG5cdGNvbnN0IG1lbnVFbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKVxuXHRtZW51RWxlbWVudC5zdHlsZS50b3AgPSBcIjIwcHhcIlxuXHRtZW51RWxlbWVudC5zdHlsZS5yaWdodCA9IFwiNDMwcHhcIlxuXHRtZW51RWxlbWVudC5zdHlsZS5wb3NpdGlvbiA9IFwiZml4ZWRcIlxuXHRtZW51RWxlbWVudC5zdHlsZS56SW5kZXggPSA5OTlcblx0bWVudUVsZW1lbnQuc3R5bGUuZGlzcGxheSA9IFwiZmxleFwiXG5cdG1lbnVFbGVtZW50LnN0eWxlLmdhcCA9IFwiMTBweFwiXG5cdHJldHVybiBtZW51RWxlbWVudFxufVxuIiwiZXhwb3J0IGRlZmF1bHQgY2xhc3MgVUlQSUNvbXBvbmVudCB7XG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge1VJQ29tcG9uZW50fSB1aUNvbXBvbmVudFxuXHQgKi9cblx0Y29uc3RydWN0b3IodWlDb21wb25lbnQpIHtcblx0XHR0aGlzLl91aUNvbXBvbmVudCA9IHVpQ29tcG9uZW50XG5cdH1cblxuXHQvKipcblx0ICogQHJlYWRvbmx5XG5cdCAqIEB0eXBlIHtVSUNvbXBvbmVudH1cblx0ICovXG5cdGdldCB1aUNvbXBvbmVudCgpIHtcblx0XHRyZXR1cm4gdGhpcy5fdWlDb21wb25lbnRcblx0fVxufVxuIiwiLyoqXG4gKlxuICogQGNhbGxiYWNrIGdldEVsZW1lbnRcbiAqIEByZXR1cm5zIHtFbGVtZW50fVxuICovXG5cbi8qKlxuICpcbiAqIEBwYXJhbSB7RWxlbWVudH0gdGFyZ2V0XG4gKiBAcGFyYW0ge2dldEVsZW1lbnR9IGdldEVsZW1lbnRcbiAqIEByZXR1cm5zIHtQcm9taXNlPEVsZW1lbnQ+fVxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gd2FpdEZvckVsZW1lbnQodGFyZ2V0LCBnZXRFbGVtZW50KSB7XG5cdHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuXHRcdGxldCBlbGVtZW50ID0gZ2V0RWxlbWVudCgpXG5cdFx0aWYoZWxlbWVudCkge1xuXHRcdFx0cmVzb2x2ZShlbGVtZW50KVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRuZXcgTXV0YXRpb25PYnNlcnZlcigobXV0YXRpb25zLCBvYnNlcnZlcikgPT4ge1xuXHRcdFx0XHRlbGVtZW50ID0gZ2V0RWxlbWVudCgpXG5cdFx0XHRcdGlmKGVsZW1lbnQpIHtcblx0XHRcdFx0XHRvYnNlcnZlci5kaXNjb25uZWN0KClcblx0XHRcdFx0XHRyZXNvbHZlKGVsZW1lbnQpXG5cdFx0XHRcdH1cblx0XHRcdH0pLm9ic2VydmUodGFyZ2V0LCB7IHN1YnRyZWU6IHRydWUsIGNoaWxkTGlzdDp0cnVlIH0pXG5cdFx0fVxuXHR9KVxufVxuXG4vKipcbiAqXG4gKiBAcGFyYW0ge0VsZW1lbnR9IGNsaWNrVGFyZ2V0XG4gKiBAcGFyYW0ge0VsZW1lbnR9IHRhcmdldFxuICogQHBhcmFtIHtnZXRFbGVtZW50fSBnZXRFbGVtZW50XG4gKiBAcmV0dXJucyB7RWxlbWVudHxQcm9taXNlPEVsZW1lbnQ+fVxuICovXG5leHBvcnQgZnVuY3Rpb24gY2xpY2tFbGVtZW50QW5kV2FpdEZvcihjbGlja1RhcmdldCwgdGFyZ2V0LCBnZXRFbGVtZW50KSB7XG5cdGNvbnN0IHByb21pc2UgPSB3YWl0Rm9yRWxlbWVudCh0YXJnZXQsIGdldEVsZW1lbnQpXG5cdGNsaWNrVGFyZ2V0LmNsaWNrKClcblx0cmV0dXJuIGdldEVsZW1lbnQoKSB8fCBwcm9taXNlXG59XG4iLCJpbXBvcnQgeyB3YWl0Rm9yRWxlbWVudCwgY2xpY2tFbGVtZW50QW5kV2FpdEZvciB9IGZyb20gXCIuLi9kb20vYXN5bmMtZXZlbnRzLmpzXCJcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgVUlDb21wb25lbnQge1xuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHtFbGVtZW50fSByb290XG5cdCAqIEBwYXJhbSB7b2JqZWN0fSBpZGVudGlmaWVyXG5cdCAqL1xuXHRjb25zdHJ1Y3Rvcihyb290LCBpZGVudGlmaWVyPXt9KSB7XG5cdFx0dGhpcy5yb290ID0gcm9vdFxuXHRcdHRoaXMuaWRlbnRpZmllciA9IGlkZW50aWZpZXJcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge0VsZW1lbnR9IHRhcmdldFxuXHQgKiBAcGFyYW0ge2Z1bmN0aW9ufSBnZXRFbGVtZW50XG5cdCAqIEByZXR1cm5zIHtQcm9taXNlPEVsZW1lbnQ+fVxuXHQgKi9cblx0YXN5bmMgd2FpdEZvckVsZW1lbnQodGFyZ2V0LCBnZXRFbGVtZW50KSB7XG5cdFx0cmV0dXJuIGdldEVsZW1lbnQoKSB8fCB3YWl0Rm9yRWxlbWVudCh0YXJnZXQsIGdldEVsZW1lbnQpXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHtFbGVtZW50fSBjbGlja1RhcmdldFxuXHQgKiBAcGFyYW0ge0VsZW1lbnR9IHRhcmdldFxuXHQgKiBAcGFyYW0ge2Z1bmN0aW9ufSBnZXRFbGVtZW50XG5cdCAqIEByZXR1cm5zIHtQcm9taXNlPEVsZW1lbnQ+fVxuXHQgKi9cblx0YXN5bmMgY2xpY2tFbGVtZW50QW5kV2FpdEZvcihjbGlja1RhcmdldCwgdGFyZ2V0LCBnZXRFbGVtZW50KSB7XG5cdFx0cmV0dXJuIGNsaWNrRWxlbWVudEFuZFdhaXRGb3IoY2xpY2tUYXJnZXQsIHRhcmdldCwgZ2V0RWxlbWVudClcblx0fVxuXG59XG4iLCIvKipcbiAqXG4gKiBAcGFyYW0ge0VsZW1lbnR9IHJvb3RcbiAqIEByZXR1cm5zIHtQcm9taXNlPGJvb2xlYW4+fVxuICovXG5leHBvcnQgZGVmYXVsdCBhc3luYyBmdW5jdGlvbiBsb2FkTW9yZU1lc3NhZ2VTdHJhdGVneShyb290KSB7XG5cdGxldCBfb2JzZXJ2ZXJcblx0Y29uc3QgcHJvbWlzZSA9IFByb21pc2UucmFjZShbXG5cdFx0bmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcblx0XHRcdF9vYnNlcnZlciA9IG5ldyBNdXRhdGlvbk9ic2VydmVyKChtdXRhdGlvbnMsIG9ic2VydmVyKSA9PiB7XG5cdFx0XHRcdGlmKHJvb3Quc2Nyb2xsVG9wICE9PSAwKSB7XG5cdFx0XHRcdFx0b2JzZXJ2ZXIuZGlzY29ubmVjdCgpXG5cdFx0XHRcdFx0cmVzb2x2ZShmYWxzZSlcblx0XHRcdFx0fVxuXHRcdFx0fSkub2JzZXJ2ZShyb290LCB7IHN1YnRyZWU6IHRydWUsIGNoaWxkTGlzdDp0cnVlIH0pXG5cdFx0fSksXG5cdFx0bmV3IFByb21pc2UocmVzb2x2ZSA9PiBzZXRUaW1lb3V0KCgpID0+IHtcblx0XHRcdGlmKF9vYnNlcnZlcikge1xuXHRcdFx0XHRfb2JzZXJ2ZXIuZGlzY29ubmVjdCgpXG5cdFx0XHR9XG5cdFx0XHRyZXNvbHZlKHRydWUpXG5cdFx0fSwgcm9vdC5vd25lckRvY3VtZW50LmRlZmF1bHRWaWV3LklETVVfU0NST0xMX0RFVEVDVElPTl9USU1FT1VUKSlcblx0XSlcblx0cm9vdC5zY3JvbGxUb3AgPSAwXG5cdHJldHVybiBwcm9taXNlXG59XG4iLCJpbXBvcnQgVUlDb21wb25lbnQgZnJvbSBcIi4vdWktY29tcG9uZW50LmpzXCJcbmltcG9ydCBsb2FkTW9yZU1lc3NhZ2VTdHJhdGVneSBmcm9tIFwiLi9zdHJhdGVneS9sb2FkLW1vcmUtbWVzc2FnZXMtc3RyYXRlZ3kuanNcIlxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBVSU1lc3NhZ2VzV3JhcHBlciBleHRlbmRzIFVJQ29tcG9uZW50IHtcblxuXHQvKipcblx0ICogQHBhcmFtIHtXaW5kb3d9XG5cdCAqIEByZXR1cm5zIHtFbGVtZW50fVxuXHQgKi9cblx0c3RhdGljIGZpbmQod2luZG93KSB7XG5cdFx0cmV0dXJuIHdpbmRvdy5kb2N1bWVudC5xdWVyeVNlbGVjdG9yKFwiZGl2W3JvbGU9Z3JpZF0gPiBkaXYgPiBkaXYgPiBkaXYgPiBkaXZcIilcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZT59XG5cdCAqL1xuXHRhc3luYyBmZXRjaEFuZFJlbmRlclRocmVhZE5leHRNZXNzYWdlUGFnZSgpIHtcblx0XHRyZXR1cm4gbG9hZE1vcmVNZXNzYWdlU3RyYXRlZ3kodGhpcy5yb290KVxuXHR9XG5cbn1cbiIsImltcG9ydCBVSU1lc3NhZ2VzV3JhcHBlciBmcm9tIFwiLi4vdWktbWVzc2FnZXMtd3JhcHBlci5qc1wiO1xuXG4vKipcbiAqXG4gKiBAcGFyYW0ge1dpbmRvd30gd2luZG93XG4gKiBAcmV0dXJucyB7RWxlbWVudH1cbiAqL1xuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gZmluZE1lc3NhZ2VzV3JhcHBlclN0cmF0ZWd5KHdpbmRvdykge1xuXHRyZXR1cm4gVUlNZXNzYWdlc1dyYXBwZXIuZmluZCh3aW5kb3cpXG59XG4iLCJpbXBvcnQgVUlDb21wb25lbnQgZnJvbSBcIi4vdWktY29tcG9uZW50LmpzXCJcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgVUlNZXNzYWdlIGV4dGVuZHMgVUlDb21wb25lbnQge1xuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge0hUTUxEaXZFbGVtZW50fSBlbGVtZW50XG5cdCAqIEByZXR1cm5zIHtQcm9taXNlPGJvb2xlYW4+fVxuXHQgKi9cblx0c3RhdGljIGFzeW5jIGlzTXlPd25NZXNzYWdlKGVsZW1lbnQpIHtcblx0XHRjb25zdCB1aU1lc3NhZ2UgPSBuZXcgVUlNZXNzYWdlKGVsZW1lbnQpXG5cdFx0Y29uc3QgYWN0aW9uQnV0dG9uID0gYXdhaXQgUHJvbWlzZS5yYWNlKFtcblx0XHRcdHVpTWVzc2FnZS5zaG93QWN0aW9uc01lbnVCdXR0b24oKSxcblx0XHRcdG5ldyBQcm9taXNlKHJlc29sdmUgPT4gc2V0VGltZW91dChyZXNvbHZlLCAyMCkpXG5cdFx0XSlcblx0XHRpZihhY3Rpb25CdXR0b24pIHtcblx0XHRcdGNvbnN0IGFjdGlvbnNNZW51RWxlbWVudCA9IGF3YWl0IHVpTWVzc2FnZS5vcGVuQWN0aW9uc01lbnUoYWN0aW9uQnV0dG9uKSAvLyBUT0RPIGkxOG5cblx0XHRcdGF3YWl0IHVpTWVzc2FnZS5jbG9zZUFjdGlvbnNNZW51KGFjdGlvbkJ1dHRvbiwgYWN0aW9uc01lbnVFbGVtZW50KVxuXHRcdFx0YXdhaXQgdWlNZXNzYWdlLmhpZGVBY3Rpb25NZW51QnV0dG9uKClcblx0XHRcdHJldHVybiBhY3Rpb25zTWVudUVsZW1lbnQgJiYgYWN0aW9uc01lbnVFbGVtZW50LnRleHRDb250ZW50LnRvTG9jYWxlTG93ZXJDYXNlKCkgPT09IFwidW5zZW5kXCJcblx0XHR9XG5cdFx0cmV0dXJuIGZhbHNlXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHJldHVybnMge1Byb21pc2V9XG5cdCAqL1xuXHRhc3luYyBzY3JvbGxJbnRvVmlldygpIHtcblx0XHR0aGlzLnJvb3Quc2Nyb2xsSW50b1ZpZXcoKVxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlPEhUTUxCdXR0b25FbGVtZW50Pn1cblx0ICovXG5cdGFzeW5jIHNob3dBY3Rpb25zTWVudUJ1dHRvbigpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwiV29ya2Zsb3cgc3RlcCAxIDogc2hvd0FjdGlvbnNNZW51QnV0dG9uXCIpXG5cdFx0dGhpcy5yb290LmRpc3BhdGNoRXZlbnQobmV3IE1vdXNlRXZlbnQoXCJtb3VzZW1vdmVcIiwgeyBidWJibGVzOiB0cnVlIH0pKVxuXHRcdHRoaXMucm9vdC5kaXNwYXRjaEV2ZW50KG5ldyBNb3VzZUV2ZW50KFwibW91c2VvdmVyXCIsIHsgYnViYmxlczogdHJ1ZSB9KSlcblx0XHR0aGlzLnJvb3QuZGlzcGF0Y2hFdmVudChuZXcgTW91c2VFdmVudChcIm1vdXNlbnRlclwiLCB7IGJ1YmJsZXM6IHRydWUgfSkpXG5cdFx0cmV0dXJuIHRoaXMud2FpdEZvckVsZW1lbnQodGhpcy5yb290LCAoKSA9PiB0aGlzLnJvb3QucXVlcnlTZWxlY3RvcihcIlthcmlhLWxhYmVsPU1vcmVdXCIpKSAvLyBUT0RPIGkxOG5cblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZTxib29sZWFuPn1cblx0ICovXG5cdGhpZGVBY3Rpb25NZW51QnV0dG9uKCkge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJoaWRlQWN0aW9uTWVudUJ1dHRvblwiKVxuXHRcdHRoaXMucm9vdC5kaXNwYXRjaEV2ZW50KG5ldyBNb3VzZUV2ZW50KFwibW91c2Vtb3ZlXCIsIHsgYnViYmxlczogdHJ1ZSB9KSlcblx0XHR0aGlzLnJvb3QuZGlzcGF0Y2hFdmVudChuZXcgTW91c2VFdmVudChcIm1vdXNlb3V0XCIsIHsgYnViYmxlczogdHJ1ZSB9KSlcblx0XHR0aGlzLnJvb3QuZGlzcGF0Y2hFdmVudChuZXcgTW91c2VFdmVudChcIm1vdXNlbGVhdmVcIiwgeyBidWJibGVzOiB0cnVlIH0pKVxuXHRcdHJldHVybiB0aGlzLndhaXRGb3JFbGVtZW50KHRoaXMucm9vdCwgKCkgPT4gdGhpcy5yb290LnF1ZXJ5U2VsZWN0b3IoXCJbYXJpYS1sYWJlbD1Nb3JlXVwiKSA9PT0gbnVsbCkgLy8gVE9ETyBpMThuXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHtIVE1MQnV0dG9uRWxlbWVudH0gYWN0aW9uQnV0dG9uXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlfVxuXHQgKi9cblx0YXN5bmMgb3BlbkFjdGlvbnNNZW51KGFjdGlvbkJ1dHRvbikge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJXb3JrZmxvdyBzdGVwIDIgOiBvcGVuQWN0aW9uc01lbnVcIiwgYWN0aW9uQnV0dG9uKVxuXHRcdHJldHVybiB0aGlzLmNsaWNrRWxlbWVudEFuZFdhaXRGb3IoXG5cdFx0XHRhY3Rpb25CdXR0b24sXG5cdFx0XHR0aGlzLnJvb3Qub3duZXJEb2N1bWVudC5ib2R5LFxuXHRcdFx0KCkgPT4ge1xuXHRcdFx0XHRjb25zdCBtZW51RWxlbWVudHMgPSBbLi4udGhpcy5yb290Lm93bmVyRG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChcIltyb2xlPW1lbnVdIFtyb2xlPW1lbnVpdGVtXVwiKV1cblx0XHRcdFx0bWVudUVsZW1lbnRzLnNvcnQobm9kZSA9PiBub2RlLnRleHRDb250ZW50LnRvTG9jYWxlTG93ZXJDYXNlKCkgPT09IFwidW5zZW5kXCIgPyAtMSA6IDApIC8vIFRPRE8gaTE4blxuXHRcdFx0XHQvLyByZXR1cm4gWy4uLnRoaXMucm9vdC5vd25lckRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoXCJbcm9sZT1kaWFsb2ddIFtyb2xlPW1lbnVdIFtyb2xlPW1lbnVpdGVtXVwiKV0uZmlsdGVyKG5vZGUgPT4gbm9kZS50ZXh0Q29udGVudC50b0xvY2FsZUxvd2VyQ2FzZSgpID09PSBcInVuc2VuZFwiKS5wb3AoKSAvLyBUT0RPIGkxOG5cblx0XHRcdFx0cmV0dXJuIG1lbnVFbGVtZW50cy5zaGlmdCgpXG5cdFx0XHR9LFxuXHRcdClcblxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7SFRNTEJ1dHRvbkVsZW1lbnR9IGFjdGlvbkJ1dHRvblxuXHQgKiBAcGFyYW0ge0hUTUxEaXZFbGVtZW50fSBhY3Rpb25zTWVudUVsZW1lbnRcblx0ICogQHJldHVybnMge1Byb21pc2U8Ym9vbGVhbj59XG5cdCAqL1xuXHRhc3luYyBjbG9zZUFjdGlvbnNNZW51KGFjdGlvbkJ1dHRvbiwgYWN0aW9uc01lbnVFbGVtZW50KSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcImNsb3NlQWN0aW9uc01lbnVcIilcblx0XHRyZXR1cm4gdGhpcy5jbGlja0VsZW1lbnRBbmRXYWl0Rm9yKFxuXHRcdFx0YWN0aW9uQnV0dG9uLFxuXHRcdFx0dGhpcy5yb290Lm93bmVyRG9jdW1lbnQuYm9keSxcblx0XHRcdCgpID0+IHRoaXMucm9vdC5vd25lckRvY3VtZW50LmJvZHkuY29udGFpbnMoYWN0aW9uc01lbnVFbGVtZW50KSA9PT0gZmFsc2UsXG5cdFx0KVxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlPEhUTUxCdXR0b25FbGVtZW50PnxQcm9taXNlPEVycm9yPn1cblx0ICovXG5cdGFzeW5jIG9wZW5Db25maXJtVW5zZW5kTW9kYWwoKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIldvcmtmbG93IHN0ZXAgMyA6IG9wZW5Db25maXJtVW5zZW5kTW9kYWxcIilcblx0XHRjb25zdCB1blNlbmRCdXR0b24gPSBhd2FpdCB0aGlzLndhaXRGb3JFbGVtZW50KFxuXHRcdFx0dGhpcy5yb290Lm93bmVyRG9jdW1lbnQuYm9keSxcblx0XHRcdCgpID0+IFsuLi50aGlzLnJvb3Qub3duZXJEb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKFwiW3JvbGU9ZGlhbG9nXSBbcm9sZT1tZW51XSBbcm9sZT1tZW51aXRlbV1cIildLmZpbHRlcihub2RlID0+IG5vZGUudGV4dENvbnRlbnQudG9Mb2NhbGVMb3dlckNhc2UoKSA9PT0gXCJ1bnNlbmRcIikucG9wKCksIC8vIFRPRE8gaTE4blxuXHRcdClcblx0XHRyZXR1cm4gdGhpcy5jbGlja0VsZW1lbnRBbmRXYWl0Rm9yKFxuXHRcdFx0dW5TZW5kQnV0dG9uLFxuXHRcdFx0dGhpcy5yb290Lm93bmVyRG9jdW1lbnQuYm9keSxcblx0XHRcdCgpID0+IHRoaXMucm9vdC5vd25lckRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCJbcm9sZT1kaWFsb2ddIGJ1dHRvblwiKSxcblx0XHQpXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHtIVE1MQnV0dG9uRWxlbWVudH0gZGlhbG9nQnV0dG9uXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlfVxuXHQgKi9cblx0YXN5bmMgY29uZmlybVVuc2VuZChkaWFsb2dCdXR0b24pIHtcblx0XHRjb25zb2xlLmRlYnVnKFwiV29ya2Zsb3cgZmluYWwgc3RlcCA6IGNvbmZpcm1VbnNlbmRcIiwgZGlhbG9nQnV0dG9uKVxuXHRcdGF3YWl0IHRoaXMuY2xpY2tFbGVtZW50QW5kV2FpdEZvcihcblx0XHRcdGRpYWxvZ0J1dHRvbixcblx0XHRcdHRoaXMucm9vdC5vd25lckRvY3VtZW50LmJvZHksXG5cdFx0XHQoKSA9PiB0aGlzLnJvb3Qub3duZXJEb2N1bWVudC5xdWVyeVNlbGVjdG9yKFwiW3JvbGU9ZGlhbG9nXSBidXR0b25cIikgPT09IG51bGxcblx0XHQpXG5cdH1cblxufVxuIiwiaW1wb3J0IFVJTWVzc2FnZSBmcm9tIFwiLi4vdWktbWVzc2FnZS5qc1wiXG5cbi8qKlxuICpcbiAqIEBwYXJhbSB7RWxlbWVudH0gcm9vdFxuICogQHJldHVybnMge1Byb21pc2U8RWxlbWVudFtdPn1cbiAqL1xuZXhwb3J0IGRlZmF1bHQgYXN5bmMgZnVuY3Rpb24gZmluZE1lc3NhZ2VzU3RyYXRlZ3kocm9vdCkge1xuXHRjb25zdCBlbGVtZW50cyA9IFsuLi5yb290LnF1ZXJ5U2VsZWN0b3JBbGwoXCJkaXZbcm9sZT1yb3ddOm5vdChbZGF0YS1pZG11LWlnbm9yZV0pXCIpXVxuXHRjb25zdCBtZXNzYWdlRWxlbWVudHMgPSBbXVxuXHRmb3IoY29uc3QgZWxlbWVudCBvZiBlbGVtZW50cykge1xuXHRcdGNvbnN0IGlzTXlPd25NZXNzYWdlID0gYXdhaXQgVUlNZXNzYWdlLmlzTXlPd25NZXNzYWdlKGVsZW1lbnQpXG5cdFx0aWYoaXNNeU93bk1lc3NhZ2UpIHtcblx0XHRcdG1lc3NhZ2VFbGVtZW50cy5wdXNoKGVsZW1lbnQpXG5cdFx0fSBlbHNlIHtcblx0XHRcdGVsZW1lbnQuc2V0QXR0cmlidXRlKFwiZGF0YS1pZG11LWlnbm9yZVwiLCBcIlwiKVxuXHRcdH1cblx0fVxuXHRjb25zb2xlLmRlYnVnKG1lc3NhZ2VFbGVtZW50cylcblx0cmV0dXJuIG1lc3NhZ2VFbGVtZW50c1xufVxuIiwiaW1wb3J0IFVJUElDb21wb25lbnQgZnJvbSBcIi4vdWlwaS1jb21wb25lbnQuanNcIlxuXG5cbmNsYXNzIEZhaWxlZFdvcmtmbG93RXhjZXB0aW9uIGV4dGVuZHMgRXJyb3Ige31cblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgVUlQSU1lc3NhZ2UgZXh0ZW5kcyBVSVBJQ29tcG9uZW50IHtcblxuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHtVSU1lc3NhZ2V9IHVpQ29tcG9uZW50XG5cdCAqL1xuXHRjb25zdHJ1Y3Rvcih1aUNvbXBvbmVudCkge1xuXHRcdHN1cGVyKHVpQ29tcG9uZW50KVxuXHR9XG5cblxuXHQvKipcblx0ICpcblx0ICogQHJldHVybnMge1Byb21pc2U8Ym9vbGVhbj59XG5cdCAqL1xuXHRhc3luYyB1bnNlbmQoKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIlVJUElNZXNzYWdlIHVuc2VuZFwiKVxuXHRcdGxldCBhY3Rpb25CdXR0b25cblx0XHRsZXQgYWN0aW9uc01lbnVFbGVtZW50XG5cdFx0dHJ5IHtcblx0XHRcdGF3YWl0IHRoaXMudWlDb21wb25lbnQuc2Nyb2xsSW50b1ZpZXcoKVxuXHRcdFx0YWN0aW9uQnV0dG9uID0gYXdhaXQgdGhpcy51aUNvbXBvbmVudC5zaG93QWN0aW9uc01lbnVCdXR0b24oKVxuXHRcdFx0YWN0aW9uc01lbnVFbGVtZW50ID0gYXdhaXQgdGhpcy51aUNvbXBvbmVudC5vcGVuQWN0aW9uc01lbnUoYWN0aW9uQnV0dG9uKVxuXHRcdFx0Y29uc3QgZGlhbG9nQnV0dG9uID0gYXdhaXQgdGhpcy51aUNvbXBvbmVudC5vcGVuQ29uZmlybVVuc2VuZE1vZGFsKClcblx0XHRcdGF3YWl0IHRoaXMudWlDb21wb25lbnQuY29uZmlybVVuc2VuZChkaWFsb2dCdXR0b24pXG5cdFx0XHR0aGlzLnVpQ29tcG9uZW50LnJvb3Quc2V0QXR0cmlidXRlKFwiZGF0YS1pZG11LXVuc2VudFwiLCBcIlwiKVxuXHRcdFx0cmV0dXJuIHRydWVcblx0XHR9IGNhdGNoKGV4KSB7XG5cdFx0XHRjb25zb2xlLmVycm9yKGV4KVxuXHRcdFx0aWYoYWN0aW9uQnV0dG9uICYmIGFjdGlvbnNNZW51RWxlbWVudCkge1xuXHRcdFx0XHRhd2FpdCB0aGlzLnVpQ29tcG9uZW50LmNsb3NlQWN0aW9uc01lbnUoYWN0aW9uQnV0dG9uLCBhY3Rpb25zTWVudUVsZW1lbnQpXG5cdFx0XHR9XG5cdFx0XHRhd2FpdCB0aGlzLnVpQ29tcG9uZW50LmhpZGVBY3Rpb25NZW51QnV0dG9uKClcblx0XHRcdHRocm93IG5ldyBGYWlsZWRXb3JrZmxvd0V4Y2VwdGlvbihcIkZhaWxlZCB0byBleGVjdXRlIHdvcmtmbG93IGZvciB0aGlzIG1lc3NhZ2VcIilcblx0XHR9XG5cdH1cblxufVxuIiwiaW1wb3J0IFVJQ29tcG9uZW50IGZyb20gXCIuL3VpLWNvbXBvbmVudC5qc1wiXG5pbXBvcnQgZmluZE1lc3NhZ2VzU3RyYXRlZ3kgZnJvbSBcIi4uL3VpL3N0cmF0ZWd5L2ZpbmQtbWVzc2FnZXMtc3RyYXRlZ3kuanNcIlxuaW1wb3J0IFVJUElNZXNzYWdlIGZyb20gXCIuLi91aXBpL3VpcGktbWVzc2FnZS5qc1wiXG5pbXBvcnQgVUlNZXNzYWdlIGZyb20gXCIuL3VpLW1lc3NhZ2UuanNcIlxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBVSSBleHRlbmRzIFVJQ29tcG9uZW50IHtcblxuXHQvKipcblx0ICpcblx0ICogQHJldHVybnMge1Byb21pc2U+fVxuXHQgKi9cblx0YXN5bmMgZmV0Y2hBbmRSZW5kZXJUaHJlYWROZXh0TWVzc2FnZVBhZ2UoKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIlVJIGZldGNoQW5kUmVuZGVyVGhyZWFkTmV4dE1lc3NhZ2VQYWdlXCIpXG5cdFx0cmV0dXJuIGF3YWl0IHRoaXMuaWRlbnRpZmllci51aU1lc3NhZ2VzV3JhcHBlci5mZXRjaEFuZFJlbmRlclRocmVhZE5leHRNZXNzYWdlUGFnZSgpXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHJldHVybnMge1Byb21pc2U8VUlQSU1lc3NhZ2VbXT59XG5cdCAqL1xuXHRhc3luYyBjcmVhdGVVSVBJTWVzc2FnZXMoKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIlVJIGNyZWF0ZVVJUElNZXNzYWdlc1wiKVxuXHRcdGNvbnN0IHVpcGlNZXNzYWdlcyA9IFtdXG5cdFx0Y29uc3QgbWVzc2FnZUVsZW1lbnRzID0gYXdhaXQgZmluZE1lc3NhZ2VzU3RyYXRlZ3kodGhpcy5pZGVudGlmaWVyLnVpTWVzc2FnZXNXcmFwcGVyLnJvb3QpXG5cdFx0Y29uc29sZS5kZWJ1ZyhcImZpbmRNZXNzYWdlc1N0cmF0ZWd5XCIsIG1lc3NhZ2VFbGVtZW50cylcblx0XHRmb3IoY29uc3QgbWVzc2FnZUVsZW1lbnQgb2YgbWVzc2FnZUVsZW1lbnRzKSB7XG5cdFx0XHRjb25zdCB1aU1lc3NhZ2UgPSBuZXcgVUlNZXNzYWdlKG1lc3NhZ2VFbGVtZW50KVxuXHRcdFx0dWlwaU1lc3NhZ2VzLnB1c2gobmV3IFVJUElNZXNzYWdlKHVpTWVzc2FnZSkpXG5cdFx0fVxuXHRcdHJldHVybiB1aXBpTWVzc2FnZXNcblx0fVxuXG59XG4iLCJpbXBvcnQgVUlQSUNvbXBvbmVudCBmcm9tIFwiLi91aXBpLWNvbXBvbmVudC5qc1wiXG5pbXBvcnQgZmluZE1lc3NhZ2VzV3JhcHBlclN0cmF0ZWd5IGZyb20gXCIuLi91aS9zdHJhdGVneS9maW5kLW1lc3NhZ2VzLXdyYXBwZXItc3RyYXRlZ3kuanNcIlxuaW1wb3J0IFVJTWVzc2FnZXNXcmFwcGVyIGZyb20gXCIuLi91aS91aS1tZXNzYWdlcy13cmFwcGVyLmpzXCJcbmltcG9ydCBVSSBmcm9tIFwiLi4vdWkvdWkuanNcIlxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBVSVBJIGV4dGVuZHMgVUlQSUNvbXBvbmVudCB7XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7VUl9IHVpQ29tcG9uZW50XG5cdCAqL1xuXHRjb25zdHJ1Y3Rvcih1aUNvbXBvbmVudCkge1xuXHRcdHN1cGVyKHVpQ29tcG9uZW50KVxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7V2luZG93fSB3aW5kb3dcblx0ICogQHJldHVybnMge1VJUEl9XG5cdCAqL1xuXHRzdGF0aWMgY3JlYXRlKHdpbmRvdykge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJVSVBJLmNyZWF0ZVwiKVxuXHRcdGNvbnN0IG1lc3NhZ2VzV3JhcHBlckVsZW1lbnQgPSBmaW5kTWVzc2FnZXNXcmFwcGVyU3RyYXRlZ3kod2luZG93KVxuXHRcdGxldCB1aXBpXG5cdFx0aWYobWVzc2FnZXNXcmFwcGVyRWxlbWVudCAhPT0gbnVsbCkge1xuXHRcdFx0Y29uc29sZS5kZWJ1ZyhcIkZvdW5kIG1lc3NhZ2VzV3JhcHBlckVsZW1lbnRcIilcblx0XHRcdGNvbnNvbGUuZGVidWcobWVzc2FnZXNXcmFwcGVyRWxlbWVudClcblx0XHRcdGNvbnN0IHVpID0gbmV3IFVJKHdpbmRvdylcblx0XHRcdHVpLmlkZW50aWZpZXIudWlNZXNzYWdlc1dyYXBwZXIgPSBuZXcgVUlNZXNzYWdlc1dyYXBwZXIobWVzc2FnZXNXcmFwcGVyRWxlbWVudClcblx0XHRcdHVpcGkgPSBuZXcgVUlQSSh1aSlcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiVW5hYmxlIHRvIGZpbmQgbWVzc2FnZXNXcmFwcGVyRWxlbWVudFwiKVxuXHRcdH1cblx0XHRyZXR1cm4gdWlwaVxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlfVxuXHQgKi9cblx0YXN5bmMgZmV0Y2hBbmRSZW5kZXJUaHJlYWROZXh0TWVzc2FnZVBhZ2UoKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIlVJUEkgZmV0Y2hBbmRSZW5kZXJUaHJlYWROZXh0TWVzc2FnZVBhZ2VcIilcblx0XHRyZXR1cm4gdGhpcy51aUNvbXBvbmVudC5mZXRjaEFuZFJlbmRlclRocmVhZE5leHRNZXNzYWdlUGFnZSgpXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHJldHVybnMge1Byb21pc2U8VUlQSU1lc3NhZ2VbXT59XG5cdCAqL1xuXHRhc3luYyBjcmVhdGVVSVBJTWVzc2FnZXMoKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIlVJUEkgY3JlYXRlVUlQSU1lc3NhZ2VzXCIpXG5cdFx0cmV0dXJuIHRoaXMudWlDb21wb25lbnQuY3JlYXRlVUlQSU1lc3NhZ2VzKClcblx0fVxuXG59XG4iLCJpbXBvcnQgVUlQSSBmcm9tIFwiLi4vdWlwaS91aXBpLmpzXCJcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgSURNVSB7XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7V2luZG93fSB3aW5kb3dcblx0ICovXG5cdGNvbnN0cnVjdG9yKHdpbmRvdykge1xuXHRcdHRoaXMud2luZG93ID0gd2luZG93XG5cdFx0dGhpcy51aXBpID0gbnVsbFxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlPFVJUElNZXNzYWdlW10+fVxuXHQgKi9cblx0YXN5bmMgY3JlYXRlVUlQSU1lc3NhZ2VzKCkge1xuXHRcdHJldHVybiB0aGlzLiNnZXRVSVBJKCkuY3JlYXRlVUlQSU1lc3NhZ2VzKClcblx0fVxuXG5cblx0LyoqXG5cdCAqXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlfVxuXHQgKi9cblx0YXN5bmMgZmV0Y2hBbmRSZW5kZXJUaHJlYWROZXh0TWVzc2FnZVBhZ2UoKSB7XG5cdFx0cmV0dXJuIHRoaXMuI2dldFVJUEkoKS5mZXRjaEFuZFJlbmRlclRocmVhZE5leHRNZXNzYWdlUGFnZSgpXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHJldHVybnMge1VJUEl9XG5cdCAqL1xuXHQjZ2V0VUlQSSgpIHtcblx0XHRpZih0aGlzLnVpcGkgPT09IG51bGwpIHtcblx0XHRcdHRoaXMudWlwaSA9IFVJUEkuY3JlYXRlKHRoaXMud2luZG93KVxuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy51aXBpXG5cdH1cblxufVxuIiwiXG5leHBvcnQgY2xhc3MgVW5zZW5kVGhyZWFkTWVzc2FnZXNCYXRjaFN0cmF0ZWd5IHtcblxuXHRzdGF0aWMgREVGQVVMVF9CQVRDSF9TSVpFID0gNVxuXG5cdCNpZG11XG5cdCNvblVuc3VjY2Vzc2Z1bFdvcmtmbG93c1xuXHQjZmluaXNoZWRfd29ya2Zsb3dzXG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7SURNVX0gaWRtdVxuXHQgKi9cblx0Y29uc3RydWN0b3IoaWRtdSwgb25VbnN1Y2Nlc3NmdWxXb3JrZmxvd3M9bnVsbCkge1xuXHRcdHRoaXMuX3J1bm5pbmcgPSBmYWxzZVxuXHRcdHRoaXMuX3N0b3BwZWQgPSBmYWxzZVxuXHRcdHRoaXMuI2ZpbmlzaGVkX3dvcmtmbG93cyA9IFtdXG5cdFx0dGhpcy4jaWRtdSA9IGlkbXVcblx0XHR0aGlzLiNvblVuc3VjY2Vzc2Z1bFdvcmtmbG93cyA9IG9uVW5zdWNjZXNzZnVsV29ya2Zsb3dzXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHJldHVybnMge2Jvb2xlYW59XG5cdCAqL1xuXHRpc1J1bm5pbmcoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX3J1bm5pbmcgJiYgIXRoaXMuX3N0b3BwZWRcblx0fVxuXG5cdHN0b3AoKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIlVuc2VuZFRocmVhZE1lc3NhZ2VzQmF0Y2hTdHJhdGVneSBzdG9wXCIpXG5cdFx0dGhpcy5fc3RvcHBlZCA9IHRydWVcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge251bWJlcn0gYmF0Y2hTaXplXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlfVxuXHQgKi9cblx0YXN5bmMgcnVuKGJhdGNoU2l6ZSkge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJVbnNlbmRUaHJlYWRNZXNzYWdlc0JhdGNoU3RyYXRlZ3kucnVuKClcIiwgYmF0Y2hTaXplKVxuXHRcdHRoaXMuX3J1bm5pbmcgPSB0cnVlXG5cdFx0dGhpcy5fc3RvcHBlZCA9IGZhbHNlXG5cdFx0cmV0dXJuIHRoaXMuI3Byb2Nlc3NCYXRjaGVzKGJhdGNoU2l6ZSlcblx0fVxuXG5cdCNkb25lKCkge1xuXHRcdHRoaXMuX3J1bm5pbmcgPSBmYWxzZVxuXHRcdGNvbnNvbGUuZGVidWcoXCJVbnNlbmRUaHJlYWRNZXNzYWdlc0JhdGNoU3RyYXRlZ3kgZG9uZVwiKVxuXHR9XG5cblx0I3Vuc3VjY2Vzc2Z1bFdvcmtmbG93QWxlcnQoKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIlVuc2VuZFRocmVhZE1lc3NhZ2VzQmF0Y2hTdHJhdGVneSB1bnN1Y2Nlc3NmdWxXb3JrZmxvd0FsZXJ0XCIpXG5cdFx0aWYoIXRoaXMuX3J1bm5pbmcpIHtcblx0XHRcdGNsZWFySW50ZXJ2YWwodGhpcy5pbnRlcnZhbClcblx0XHR9XG5cdFx0Y29uc3QgdW5zdWNjZXNzZnVsV29ya2Zsb3dzID0gdGhpcy4jZmluaXNoZWRfd29ya2Zsb3dzLmZpbHRlcih1aU1lc3NhZ2UgPT4gdGhpcy4jaWRtdS53aW5kb3cuZG9jdW1lbnQuY29udGFpbnModWlNZXNzYWdlLnVpQ29tcG9uZW50LnJvb3QpKVxuXHRcdGlmKHVuc3VjY2Vzc2Z1bFdvcmtmbG93cy5sZW5ndGggPj0gMSkge1xuXHRcdFx0dW5zdWNjZXNzZnVsV29ya2Zsb3dzLmZvckVhY2goZmFpbGVkV29ya2Zsb3cgPT4gdGhpcy4jZmluaXNoZWRfd29ya2Zsb3dzLnNwbGljZSh0aGlzLiNmaW5pc2hlZF93b3JrZmxvd3MuaW5kZXhPZihmYWlsZWRXb3JrZmxvdyksIDEpKVxuXHRcdFx0dGhpcy4jb25VbnN1Y2Nlc3NmdWxXb3JrZmxvd3ModW5zdWNjZXNzZnVsV29ya2Zsb3dzKVxuXHRcdH1cblx0fVxuXG5cdGFzeW5jICNwcm9jZXNzQmF0Y2hlcyhiYXRjaFNpemUpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwiVW5zZW5kVGhyZWFkTWVzc2FnZXNCYXRjaFN0cmF0ZWd5IHByb2Nlc3NCYXRjaGVzXCIpXG5cdFx0bGV0IGRvbmUgPSBmYWxzZVxuXHRcdGZvcihsZXQgaSA9IDA7IGkgPCBiYXRjaFNpemU7aSsrKSB7XG5cdFx0XHRpZih0aGlzLl9zdG9wcGVkKSB7XG5cdFx0XHRcdGJyZWFrXG5cdFx0XHR9XG5cdFx0XHRkb25lID0gYXdhaXQgdGhpcy4jaWRtdS5mZXRjaEFuZFJlbmRlclRocmVhZE5leHRNZXNzYWdlUGFnZSgpXG5cdFx0XHRpZihkb25lKSB7XG5cdFx0XHRcdGJyZWFrXG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRhd2FpdCBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgdGhpcy4jaWRtdS53aW5kb3cuSURNVV9ORVhUX01FU1NBR0VfUEFHRV9ERUxBWSkpXG5cdFx0XHR9XG5cdFx0fVxuXHRcdHRyeSB7XG5cdFx0XHRmb3IoY29uc3QgdWlwaU1lc3NhZ2Ugb2YgYXdhaXQgdGhpcy4jaWRtdS5jcmVhdGVVSVBJTWVzc2FnZXMoKSkge1xuXHRcdFx0XHRpZih0aGlzLl9zdG9wcGVkKSB7XG5cdFx0XHRcdFx0YnJlYWtcblx0XHRcdFx0fVxuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdGF3YWl0IHVpcGlNZXNzYWdlLnVuc2VuZCgpXG5cdFx0XHRcdFx0dGhpcy4jZmluaXNoZWRfd29ya2Zsb3dzLnB1c2godWlwaU1lc3NhZ2UpXG5cdFx0XHRcdFx0YXdhaXQgbmV3IFByb21pc2UocmVzb2x2ZSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIHRoaXMuI2lkbXUud2luZG93LklETVVfTUVTU0FHRV9RVUVVRV9ERUxBWSkpXG5cdFx0XHRcdH0gY2F0Y2gocmVzdWx0KSB7XG5cdFx0XHRcdFx0Y29uc29sZS5lcnJvcihyZXN1bHQpXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9IGNhdGNoKGV4KSB7XG5cdFx0XHRjb25zb2xlLmVycm9yKGV4KVxuXHRcdH1cblx0XHRpZighdGhpcy5pbnRlcnZhbCAmJiB0aGlzLiNvblVuc3VjY2Vzc2Z1bFdvcmtmbG93cykge1xuXHRcdFx0dGhpcy5pbnRlcnZhbCA9IHNldEludGVydmFsKCgpID0+IHRoaXMuI3Vuc3VjY2Vzc2Z1bFdvcmtmbG93QWxlcnQoKSwgdGhpcy4jaWRtdS53aW5kb3cuSURNVV9VTlNVQ0VTU0ZVTF9XT1JLRkxPV19BTEVSVF9JTlRFUlZBTClcblx0XHR9XG5cdFx0aWYoZG9uZSkge1xuXHRcdFx0dGhpcy4jZG9uZSgpXG5cdFx0fSBlbHNlIGlmKCF0aGlzLl9zdG9wcGVkKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy4jcHJvY2Vzc0JhdGNoZXMoYmF0Y2hTaXplKVxuXHRcdH1cblx0fVxufVxuIiwiLyoqXG4gKlxuICogQHBhcmFtIHtEb2N1bWVudH0gZG9jdW1lbnRcbiAqIEByZXR1cm5zIHtIVE1MQnV0dG9uRWxlbWVudH1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUFsZXJ0c1dyYXBwZXJFbGVtZW50KGRvY3VtZW50KSB7XG5cdGNvbnN0IGFsZXJ0c1dyYXBwZXJFbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKVxuXHRhbGVydHNXcmFwcGVyRWxlbWVudC5pZCA9IFwiaWRtdS1hbGVydHNcIlxuXHRhbGVydHNXcmFwcGVyRWxlbWVudC5zdHlsZS5wb3NpdGlvbiA9IFwiZml4ZWRcIlxuXHRhbGVydHNXcmFwcGVyRWxlbWVudC5zdHlsZS50b3AgPSBcIjIwcHhcIlxuXHRhbGVydHNXcmFwcGVyRWxlbWVudC5zdHlsZS5yaWdodCA9IFwiMjBweFwiXG5cdGFsZXJ0c1dyYXBwZXJFbGVtZW50LnN0eWxlLmRpc3BsYXkgPSBcImdyaWRcIlxuXHRyZXR1cm4gYWxlcnRzV3JhcHBlckVsZW1lbnRcbn1cblxuLyoqXG4gKlxuICogQHBhcmFtIHtEb2N1bWVudH0gZG9jdW1lbnRcbiAqIEBwYXJhbSB7c3RyaW5nfSAgIHRleHRcbiAqIEByZXR1cm5zIHtIVE1MQnV0dG9uRWxlbWVudH1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUFsZXJ0RWxlbWVudChkb2N1bWVudCwgdGV4dCkge1xuXHRjb25zdCBhbGVydEVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpXG5cdGFsZXJ0RWxlbWVudC50ZXh0Q29udGVudCA9IHRleHRcblx0cmV0dXJuIGFsZXJ0RWxlbWVudFxufVxuIiwiLyoqXG4gKiBAcGFyYW0ge0RvY3VtZW50fSBkb2N1bWVudFxuICogQHJldHVybnMge0hUTUxEaXZFbGVtZW50fVxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlT3ZlcmxheUVsZW1lbnQoZG9jdW1lbnQpIHtcblx0Y29uc3Qgb3ZlcmxheUVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpXG5cdG92ZXJsYXlFbGVtZW50LmlkID0gXCJpZG11LW92ZXJsYXlcIlxuXHRvdmVybGF5RWxlbWVudC5zdHlsZS50b3AgPSBcIjBcIlxuXHRvdmVybGF5RWxlbWVudC5zdHlsZS5yaWdodCA9IFwiMFwiXG5cdG92ZXJsYXlFbGVtZW50LnN0eWxlLnBvc2l0aW9uID0gXCJmaXhlZFwiXG5cdG92ZXJsYXlFbGVtZW50LnN0eWxlLndpZHRoID0gXCIxMDB2d1wiXG5cdG92ZXJsYXlFbGVtZW50LnN0eWxlLmhlaWdodCA9IFwiMTAwdmhcIlxuXHRvdmVybGF5RWxlbWVudC5zdHlsZS56SW5kZXggPSBcIjk5OFwiXG5cdG92ZXJsYXlFbGVtZW50LnN0eWxlLmJhY2tncm91bmRDb2xvciA9IFwiIzAwMDAwMGQ2XCJcblx0b3ZlcmxheUVsZW1lbnQuc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiXG5cdHJldHVybiBvdmVybGF5RWxlbWVudFxufVxuIiwiaW1wb3J0IHsgY3JlYXRlTWVudUJ1dHRvbkVsZW1lbnQgfSBmcm9tIFwiLi9tZW51LWJ1dHRvbi5qc1wiXG5pbXBvcnQgeyBjcmVhdGVNZW51RWxlbWVudCB9IGZyb20gXCIuL21lbnUuanNcIlxuaW1wb3J0IElETVUgZnJvbSBcIi4uLy4uLy4uL2lkbXUvaWRtdS5qc1wiXG5pbXBvcnQgeyBVbnNlbmRUaHJlYWRNZXNzYWdlc0JhdGNoU3RyYXRlZ3kgfSBmcm9tIFwiLi4vc3RyYXRlZ3kuanNcIlxuaW1wb3J0IHsgY3JlYXRlQWxlcnRzV3JhcHBlckVsZW1lbnQgfSBmcm9tIFwiLi9hbGVydC5qc1wiXG5pbXBvcnQgeyBjcmVhdGVPdmVybGF5RWxlbWVudCB9IGZyb20gXCIuL292ZXJsYXkuanNcIlxuXG4vKipcbiAqXG4gKiBAcGFyYW0ge3dpbmRvd30gd2luZG93XG4gKiBAcmV0dXJucyB7SFRNTERpdkVsZW1lbnR9ICAgIG9iamVjdC51aUVsZW1lbnRcbiAqIEByZXR1cm5zIHtIVE1MQnV0dG9uRWxlbWVudH0gb2JqZWN0LnVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uXG4gKiBAcmV0dXJucyB7SFRNTEJ1dHRvbkVsZW1lbnR9IG9iamVjdC5sb2FkVGhyZWFkTWVzc2FnZXNCdXR0b25cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlbmRlcih3aW5kb3cpIHtcblx0Y29uc3QgaWRtdSA9IG5ldyBJRE1VKHdpbmRvdylcblx0Y29uc3Qgc3RyYXRlZ3kgPSBuZXcgVW5zZW5kVGhyZWFkTWVzc2FnZXNCYXRjaFN0cmF0ZWd5KGlkbXUsICh1bnN1Y2Nlc3NmdWxXb3JrZmxvd3MpID0+IHtcblx0XHRjb25zb2xlLmxvZyh1bnN1Y2Nlc3NmdWxXb3JrZmxvd3MpXG5cdH0pXG5cdGNvbnN0IHsgb3ZlcmxheUVsZW1lbnQsIHVpRWxlbWVudCwgdW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24sIGxvYWRUaHJlYWRNZXNzYWdlc0J1dHRvbiB9ID0gY3JlYXRlVUlFbGVtZW50KHdpbmRvdy5kb2N1bWVudClcblx0ZnVuY3Rpb24gb25VbnNlbmRpbmdGaW5pc2hlZCgpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwib25VbnNlbmRpbmdGaW5pc2hlZFwiKVxuXHRcdHVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uLnRleHRDb250ZW50ID0gdW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24uZGF0YVRleHRDb250ZW50XG5cdFx0dW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24uc3R5bGUuYmFja2dyb3VuZENvbG9yID0gdW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24uZGF0YUJhY2tncm91bmRDb2xvclxuXHRcdG92ZXJsYXlFbGVtZW50LnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIlxuXHRcdGlmKCFzdHJhdGVneS5fc3RvcHBlZCkge1xuXHRcdFx0d2luZG93LmFsZXJ0KFwiSURNVTogRmluaXNoZWRcIilcblx0XHR9XG5cdH1cblx0ZnVuY3Rpb24gaGFuZGxlRXZlbnRzKGV2ZW50KSB7XG5cdFx0aWYoc3RyYXRlZ3kuaXNSdW5uaW5nKCkgJiYgIXVpRWxlbWVudC5jb250YWlucyhldmVudC50YXJnZXQpKSB7XG5cdFx0XHRjb25zb2xlLmluZm8oXCJVc2VyIGludGVyYWN0aW9uIGlzIGRpc2FibGVkIGFzIHRoZSBzdHJhdGVneSBpcyBzdGlsbCBydW5uaW5nOyBQbGVhc2Ugc3RvcCB0aGUgZXhlY3V0aW9uIGZpcnN0LlwiKVxuXHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKVxuXHRcdH1cblx0fVxuXHR3aW5kb3cuZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcImtleWRvd25cIiwgaGFuZGxlRXZlbnRzKVxuXHR1bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbi5kYXRhVGV4dENvbnRlbnQgPSB1bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbi50ZXh0Q29udGVudFxuXHR1bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbi5kYXRhQmFja2dyb3VuZENvbG9yID0gdW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24uc3R5bGUuYmFja2dyb3VuZENvbG9yXG5cdHVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCBhc3luYyAoKSA9PiB7XG5cdFx0aWYoc3RyYXRlZ3kuaXNSdW5uaW5nKCkpIHtcblx0XHRcdGNvbnNvbGUuZGVidWcoXCJVc2VyIGFza2VkIHRvIHN0b3AgbWVzc2FnZXMgdW5zZW5kaW5nXCIpXG5cdFx0XHRzdHJhdGVneS5zdG9wKClcblx0XHRcdG9uVW5zZW5kaW5nRmluaXNoZWQoKVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRvdmVybGF5RWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gXCJcIlxuXHRcdFx0Y29uc29sZS5kZWJ1ZyhcIlVzZXIgYXNrZWQgdG8gc3RhcnQgbWVzc2FnZXMgdW5zZW5kaW5nOyBVSSBpMW50ZXJhY3Rpb24gd2lsbCBiZSBkaXNhYmxlZFwiKVxuXHRcdFx0dW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24udGV4dENvbnRlbnQgPSBcIlN0b3AgcHJvY2Vzc2luZ1wiXG5cdFx0XHR1bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbi5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSBcIiNGQTM4M0VcIlxuXHRcdFx0Y29uc3QgYmF0Y2hTaXplID0gd2luZG93LmxvY2FsU3RvcmFnZS5nZXRJdGVtKFwiSURNVV9CQVRDSF9TSVpFXCIpIHx8IFVuc2VuZFRocmVhZE1lc3NhZ2VzQmF0Y2hTdHJhdGVneS5ERUZBVUxUX0JBVENIX1NJWkVcblx0XHRcdGF3YWl0IHN0cmF0ZWd5LnJ1bihiYXRjaFNpemUpXG5cdFx0XHRvblVuc2VuZGluZ0ZpbmlzaGVkKClcblx0XHR9XG5cdH0pXG5cdGxvYWRUaHJlYWRNZXNzYWdlc0J1dHRvbi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJsb2FkVGhyZWFkTWVzc2FnZXNCdXR0b24gY2xpY2tcIilcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgYmF0Y2hTaXplID0gcGFyc2VJbnQod2luZG93LnByb21wdChcIkhvdyBtYW55IHBhZ2VzIHNob3VsZCB3ZSBsb2FkID8gXCIsIHdpbmRvdy5sb2NhbFN0b3JhZ2UuZ2V0SXRlbShcIklETVVfQkFUQ0hfU0laRVwiKSB8fCBVbnNlbmRUaHJlYWRNZXNzYWdlc0JhdGNoU3RyYXRlZ3kuREVGQVVMVF9CQVRDSF9TSVpFICkpXG5cdFx0XHRpZihwYXJzZUludChiYXRjaFNpemUpKSB7XG5cdFx0XHRcdHdpbmRvdy5sb2NhbFN0b3JhZ2Uuc2V0SXRlbShcIklETVVfQkFUQ0hfU0laRVwiLCBwYXJzZUludChiYXRjaFNpemUpKVxuXHRcdFx0fVxuXHRcdFx0Y29uc29sZS5kZWJ1ZyhgU2V0dGluZyBJRE1VX0JBVENIX1NJWkUgdG8gJHtiYXRjaFNpemV9YClcblx0XHR9IGNhdGNoKGV4KSB7XG5cdFx0XHRjb25zb2xlLmVycm9yKGV4KVxuXHRcdH1cblx0fSlcblx0d2luZG93LmRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQodWlFbGVtZW50KVxuXHRyZXR1cm4geyB1aUVsZW1lbnQsIHVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uLCBsb2FkVGhyZWFkTWVzc2FnZXNCdXR0b24gfVxufVxuXG4vKipcbiAqXG4gKiBAcGFyYW0gICB7RG9jdW1lbnR9ICAgICAgICAgIGRvY3VtZW50XG4gKiBAcmV0dXJucyB7b2JqZWN0fVxuICogQHJldHVybnMge0hUTUxEaXZFbGVtZW50fSAgICBvYmplY3QudWlFbGVtZW50XG4gKiBAcmV0dXJucyB7SFRNTERpdkVsZW1lbnR9ICAgIG9iamVjdC5vdmVybGF5RWxlbWVudFxuICogQHJldHVybnMge0hUTUxEaXZFbGVtZW50fSAgICBvYmplY3QubWVudUVsZW1lbnRcbiAqIEByZXR1cm5zIHtIVE1MQnV0dG9uRWxlbWVudH0gb2JqZWN0LnVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uXG4gKiBAcmV0dXJucyB7SFRNTEJ1dHRvbkVsZW1lbnR9IG9iamVjdC5sb2FkVGhyZWFkTWVzc2FnZXNCdXR0b25cbiAqL1xuZnVuY3Rpb24gY3JlYXRlVUlFbGVtZW50KGRvY3VtZW50KSB7XG5cdGNvbnN0IHVpRWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIilcblx0Y29uc3QgbWVudUVsZW1lbnQgPSBjcmVhdGVNZW51RWxlbWVudChkb2N1bWVudClcblx0Y29uc3Qgb3ZlcmxheUVsZW1lbnQgPSBjcmVhdGVPdmVybGF5RWxlbWVudChkb2N1bWVudClcblx0Y29uc3QgYWxlcnRzV3JhcHBlckVsZW1lbnQgPSBjcmVhdGVBbGVydHNXcmFwcGVyRWxlbWVudChkb2N1bWVudClcblx0Y29uc3QgdW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24gPSBjcmVhdGVNZW51QnV0dG9uRWxlbWVudChkb2N1bWVudCwgXCJVbnNlbmQgYWxsIERNc1wiKVxuXHRjb25zdCBsb2FkVGhyZWFkTWVzc2FnZXNCdXR0b24gPSBjcmVhdGVNZW51QnV0dG9uRWxlbWVudChkb2N1bWVudCwgXCJCYXRjaCBzaXplXCIsIFwic2Vjb25kYXJ5XCIpXG5cdGRvY3VtZW50LmJvZHkucHJlcGVuZChvdmVybGF5RWxlbWVudClcblx0ZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChhbGVydHNXcmFwcGVyRWxlbWVudClcblx0bWVudUVsZW1lbnQuYXBwZW5kQ2hpbGQodW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24pXG5cdG1lbnVFbGVtZW50LmFwcGVuZENoaWxkKGxvYWRUaHJlYWRNZXNzYWdlc0J1dHRvbilcblx0dWlFbGVtZW50LmFwcGVuZENoaWxkKG1lbnVFbGVtZW50KVxuXHRyZXR1cm4geyB1aUVsZW1lbnQsIG92ZXJsYXlFbGVtZW50LCBtZW51RWxlbWVudCwgdW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24sIGxvYWRUaHJlYWRNZXNzYWdlc0J1dHRvbiB9XG59XG4iLCJpbXBvcnQgeyByZW5kZXIgfSBmcm9tIFwiLi91aS91aS5qc1wiXG5cbmlmKCF3aW5kb3cuSURNVV9ERUJVRykge1xuXHRjb25zb2xlLmRlYnVnID0gKCkgPT4ge31cbn1cblxucmVuZGVyKHdpbmRvdylcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQUFBLE1BQU0sWUFBWSxHQUFHO0NBQ3JCLENBQUMsU0FBUyxFQUFFLFNBQVM7Q0FDckIsQ0FBQyxXQUFXLEVBQUUsV0FBVztDQUN6QixFQUFDO0FBQ0Q7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ08sU0FBUyxnQkFBZ0IsQ0FBQyxhQUFhLEVBQUUsU0FBUyxDQUFDLFlBQVksQ0FBQyxPQUFPLEVBQUU7Q0FDaEYsQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxLQUFJO0NBQ2xDLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxRQUFRLEdBQUcsNkJBQTRCO0NBQzVELENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxLQUFLLEdBQUcsUUFBTztDQUNwQyxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLE1BQUs7Q0FDbkMsQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLFlBQVksR0FBRyxNQUFLO0NBQ3pDLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxPQUFPLEdBQUcsTUFBSztDQUNwQyxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsVUFBVSxHQUFHLE9BQU07Q0FDeEMsQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxVQUFTO0NBQ3ZDLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxVQUFVLEdBQUcsK0JBQThCO0NBQ2hFLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxlQUFlLEdBQUcsQ0FBQyxhQUFhLEVBQUUsU0FBUyxDQUFDLFNBQVMsRUFBQztDQUMzRTs7Q0NuQkE7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDTyxTQUFTLHVCQUF1QixDQUFDLFFBQVEsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFO0NBQ25FLENBQUMsTUFBTSxhQUFhLEdBQUcsUUFB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
