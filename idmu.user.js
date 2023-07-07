
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
// @version				0.5.4
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
		const { overlayElement, uiElement, menuElement, unsendThreadMessagesButton, loadThreadMessagesButton } = createUIElement(window.document);
		function onUnsendingFinished() {
			console.debug("onUnsendingFinished")
			;[...menuElement.querySelectorAll("button")].filter(button => button !== unsendThreadMessagesButton).forEach(button => {
				button.style.display = "";
			});
			unsendThreadMessagesButton.textContent = unsendThreadMessagesButton.dataTextContent;
			unsendThreadMessagesButton.style.backgroundColor = unsendThreadMessagesButton.dataBackgroundColor;
			overlayElement.style.display = "none";
			if(!strategy._stopped) {
				window.alert("IDMU: Finished");
			}
		}
		async function startUnsending() {
			[...menuElement.querySelectorAll("button")].filter(button => button !== unsendThreadMessagesButton).forEach(button => {
				button.style.display = "none";
			});
			overlayElement.style.display = "";
			console.debug("User asked to start messages unsending; UI i1nteraction will be disabled");
			unsendThreadMessagesButton.textContent = "Stop processing";
			unsendThreadMessagesButton.style.backgroundColor = "#FA383E";
			const batchSize = window.localStorage.getItem("IDMU_BATCH_SIZE") || UnsendThreadMessagesBatchStrategy.DEFAULT_BATCH_SIZE;
			await strategy.run(batchSize);
			onUnsendingFinished();
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
				startUnsending();
			}
		});
		loadThreadMessagesButton.addEventListener("click", async () => {
			console.debug("loadThreadMessagesButton click");
			try {
				const batchSize = parseInt(window.prompt("How many pages should we load before each unsending? ", window.localStorage.getItem("IDMU_BATCH_SIZE") || UnsendThreadMessagesBatchStrategy.DEFAULT_BATCH_SIZE ));
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaWRtdS51c2VyLmpzIiwic291cmNlcyI6WyIuLi9zcmMvcnVudGltZS91c2Vyc2NyaXB0L3VpL3N0eWxlL2luc3RhZ3JhbS5qcyIsIi4uL3NyYy9ydW50aW1lL3VzZXJzY3JpcHQvdWkvbWVudS1idXR0b24uanMiLCIuLi9zcmMvcnVudGltZS91c2Vyc2NyaXB0L3VpL21lbnUuanMiLCIuLi9zcmMvdWlwaS91aXBpLWNvbXBvbmVudC5qcyIsIi4uL3NyYy9kb20vYXN5bmMtZXZlbnRzLmpzIiwiLi4vc3JjL3VpL3VpLWNvbXBvbmVudC5qcyIsIi4uL3NyYy91aS9zdHJhdGVneS9sb2FkLW1vcmUtbWVzc2FnZXMtc3RyYXRlZ3kuanMiLCIuLi9zcmMvdWkvdWktbWVzc2FnZXMtd3JhcHBlci5qcyIsIi4uL3NyYy91aS9zdHJhdGVneS9maW5kLW1lc3NhZ2VzLXdyYXBwZXItc3RyYXRlZ3kuanMiLCIuLi9zcmMvdWkvdWktbWVzc2FnZS5qcyIsIi4uL3NyYy91aS9zdHJhdGVneS9maW5kLW1lc3NhZ2VzLXN0cmF0ZWd5LmpzIiwiLi4vc3JjL3VpcGkvdWlwaS1tZXNzYWdlLmpzIiwiLi4vc3JjL3VpL3VpLmpzIiwiLi4vc3JjL3VpcGkvdWlwaS5qcyIsIi4uL3NyYy9pZG11L2lkbXUuanMiLCIuLi9zcmMvcnVudGltZS91c2Vyc2NyaXB0L3N0cmF0ZWd5LmpzIiwiLi4vc3JjL3J1bnRpbWUvdXNlcnNjcmlwdC91aS9hbGVydC5qcyIsIi4uL3NyYy9ydW50aW1lL3VzZXJzY3JpcHQvdWkvb3ZlcmxheS5qcyIsIi4uL3NyYy9ydW50aW1lL3VzZXJzY3JpcHQvdWkvdWkuanMiLCIuLi9zcmMvcnVudGltZS91c2Vyc2NyaXB0L21haW4uanMiXSwic291cmNlc0NvbnRlbnQiOlsiY29uc3QgQlVUVE9OX1NUWUxFID0ge1xuXHRcIlBSSU1BUllcIjogXCJwcmltYXJ5XCIsXG5cdFwiU0VDT05EQVJZXCI6IFwic2Vjb25kYXJ5XCIsXG59XG5cbi8qKlxuICpcbiAqIEBwYXJhbSB7SFRNTEJ1dHRvbkVsZW1lbnR9IGJ1dHRvbkVsZW1lbnRcbiAqIEBwYXJhbSB7c3RyaW5nfSAgICAgICAgICAgIHN0eWxlTmFtZVxuICovXG5leHBvcnQgZnVuY3Rpb24gYXBwbHlCdXR0b25TdHlsZShidXR0b25FbGVtZW50LCBzdHlsZU5hbWU9QlVUVE9OX1NUWUxFLlBSSU1BUlkpIHtcblx0YnV0dG9uRWxlbWVudC5zdHlsZS5mb250U2l6ZSA9IFwidmFyKC0tc3lzdGVtLTE0LWZvbnQtc2l6ZSlcIlxuXHRidXR0b25FbGVtZW50LnN0eWxlLmNvbG9yID0gXCJ3aGl0ZVwiXG5cdGJ1dHRvbkVsZW1lbnQuc3R5bGUuYm9yZGVyID0gXCIwcHhcIlxuXHRidXR0b25FbGVtZW50LnN0eWxlLmJvcmRlclJhZGl1cyA9IFwiOHB4XCJcblx0YnV0dG9uRWxlbWVudC5zdHlsZS5wYWRkaW5nID0gXCI4cHhcIlxuXHRidXR0b25FbGVtZW50LnN0eWxlLmZvbnRXZWlnaHQgPSBcImJvbGRcIlxuXHRidXR0b25FbGVtZW50LnN0eWxlLmN1cnNvciA9IFwicG9pbnRlclwiXG5cdGJ1dHRvbkVsZW1lbnQuc3R5bGUubGluZUhlaWdodCA9IFwidmFyKC0tc3lzdGVtLTE0LWxpbmUtaGVpZ2h0KVwiXG5cdGJ1dHRvbkVsZW1lbnQuc3R5bGUuYmFja2dyb3VuZENvbG9yID0gYHJnYih2YXIoLS1pZy0ke3N0eWxlTmFtZX0tYnV0dG9uKSlgXG59XG4iLCJpbXBvcnQgeyBhcHBseUJ1dHRvblN0eWxlIH0gZnJvbSBcIi4vc3R5bGUvaW5zdGFncmFtLmpzXCJcblxuLyoqXG4gKlxuICogQHBhcmFtIHtEb2N1bWVudH0gZG9jdW1lbnRcbiAqIEBwYXJhbSB7c3RyaW5nfSAgIHRleHRcbiAqIEBwYXJhbSB7c3RyaW5nfSAgIHN0eWxlTmFtZVxuICogQHJldHVybnMge0hUTUxCdXR0b25FbGVtZW50fVxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlTWVudUJ1dHRvbkVsZW1lbnQoZG9jdW1lbnQsIHRleHQsIHN0eWxlTmFtZSkge1xuXHRjb25zdCBidXR0b25FbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImJ1dHRvblwiKVxuXHRidXR0b25FbGVtZW50LnRleHRDb250ZW50ID0gdGV4dFxuXHRhcHBseUJ1dHRvblN0eWxlKGJ1dHRvbkVsZW1lbnQsIHN0eWxlTmFtZSlcblx0YnV0dG9uRWxlbWVudC5hZGRFdmVudExpc3RlbmVyKFwibW91c2VvdmVyXCIsIGFzeW5jICgpID0+IHtcblx0XHRidXR0b25FbGVtZW50LnN0eWxlLmZpbHRlciA9IGBicmlnaHRuZXNzKDEuMTUpYFxuXHR9KVxuXHRidXR0b25FbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJtb3VzZW91dFwiLCBhc3luYyAoKSA9PiB7XG5cdFx0YnV0dG9uRWxlbWVudC5zdHlsZS5maWx0ZXIgPSBgYFxuXHR9KVxuXHRyZXR1cm4gYnV0dG9uRWxlbWVudFxufVxuIiwiLyoqXG4gKiBAcGFyYW0ge0RvY3VtZW50fSBkb2N1bWVudFxuICogQHJldHVybnMge0hUTUxCdXR0b25FbGVtZW50fVxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlTWVudUVsZW1lbnQoZG9jdW1lbnQpIHtcblx0Y29uc3QgbWVudUVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpXG5cdG1lbnVFbGVtZW50LnN0eWxlLnRvcCA9IFwiMjBweFwiXG5cdG1lbnVFbGVtZW50LnN0eWxlLnJpZ2h0ID0gXCI0MzBweFwiXG5cdG1lbnVFbGVtZW50LnN0eWxlLnBvc2l0aW9uID0gXCJmaXhlZFwiXG5cdG1lbnVFbGVtZW50LnN0eWxlLnpJbmRleCA9IDk5OVxuXHRtZW51RWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gXCJmbGV4XCJcblx0bWVudUVsZW1lbnQuc3R5bGUuZ2FwID0gXCIxMHB4XCJcblx0cmV0dXJuIG1lbnVFbGVtZW50XG59XG4iLCJleHBvcnQgZGVmYXVsdCBjbGFzcyBVSVBJQ29tcG9uZW50IHtcblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7VUlDb21wb25lbnR9IHVpQ29tcG9uZW50XG5cdCAqL1xuXHRjb25zdHJ1Y3Rvcih1aUNvbXBvbmVudCkge1xuXHRcdHRoaXMuX3VpQ29tcG9uZW50ID0gdWlDb21wb25lbnRcblx0fVxuXG5cdC8qKlxuXHQgKiBAcmVhZG9ubHlcblx0ICogQHR5cGUge1VJQ29tcG9uZW50fVxuXHQgKi9cblx0Z2V0IHVpQ29tcG9uZW50KCkge1xuXHRcdHJldHVybiB0aGlzLl91aUNvbXBvbmVudFxuXHR9XG59XG4iLCIvKipcbiAqXG4gKiBAY2FsbGJhY2sgZ2V0RWxlbWVudFxuICogQHJldHVybnMge0VsZW1lbnR9XG4gKi9cblxuLyoqXG4gKlxuICogQHBhcmFtIHtFbGVtZW50fSB0YXJnZXRcbiAqIEBwYXJhbSB7Z2V0RWxlbWVudH0gZ2V0RWxlbWVudFxuICogQHJldHVybnMge1Byb21pc2U8RWxlbWVudD59XG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiB3YWl0Rm9yRWxlbWVudCh0YXJnZXQsIGdldEVsZW1lbnQpIHtcblx0cmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG5cdFx0bGV0IGVsZW1lbnQgPSBnZXRFbGVtZW50KClcblx0XHRpZihlbGVtZW50KSB7XG5cdFx0XHRyZXNvbHZlKGVsZW1lbnQpXG5cdFx0fSBlbHNlIHtcblx0XHRcdG5ldyBNdXRhdGlvbk9ic2VydmVyKChtdXRhdGlvbnMsIG9ic2VydmVyKSA9PiB7XG5cdFx0XHRcdGVsZW1lbnQgPSBnZXRFbGVtZW50KClcblx0XHRcdFx0aWYoZWxlbWVudCkge1xuXHRcdFx0XHRcdG9ic2VydmVyLmRpc2Nvbm5lY3QoKVxuXHRcdFx0XHRcdHJlc29sdmUoZWxlbWVudClcblx0XHRcdFx0fVxuXHRcdFx0fSkub2JzZXJ2ZSh0YXJnZXQsIHsgc3VidHJlZTogdHJ1ZSwgY2hpbGRMaXN0OnRydWUgfSlcblx0XHR9XG5cdH0pXG59XG5cbi8qKlxuICpcbiAqIEBwYXJhbSB7RWxlbWVudH0gY2xpY2tUYXJnZXRcbiAqIEBwYXJhbSB7RWxlbWVudH0gdGFyZ2V0XG4gKiBAcGFyYW0ge2dldEVsZW1lbnR9IGdldEVsZW1lbnRcbiAqIEByZXR1cm5zIHtFbGVtZW50fFByb21pc2U8RWxlbWVudD59XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjbGlja0VsZW1lbnRBbmRXYWl0Rm9yKGNsaWNrVGFyZ2V0LCB0YXJnZXQsIGdldEVsZW1lbnQpIHtcblx0Y29uc3QgcHJvbWlzZSA9IHdhaXRGb3JFbGVtZW50KHRhcmdldCwgZ2V0RWxlbWVudClcblx0Y2xpY2tUYXJnZXQuY2xpY2soKVxuXHRyZXR1cm4gZ2V0RWxlbWVudCgpIHx8IHByb21pc2Vcbn1cbiIsImltcG9ydCB7IHdhaXRGb3JFbGVtZW50LCBjbGlja0VsZW1lbnRBbmRXYWl0Rm9yIH0gZnJvbSBcIi4uL2RvbS9hc3luYy1ldmVudHMuanNcIlxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBVSUNvbXBvbmVudCB7XG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge0VsZW1lbnR9IHJvb3Rcblx0ICogQHBhcmFtIHtvYmplY3R9IGlkZW50aWZpZXJcblx0ICovXG5cdGNvbnN0cnVjdG9yKHJvb3QsIGlkZW50aWZpZXI9e30pIHtcblx0XHR0aGlzLnJvb3QgPSByb290XG5cdFx0dGhpcy5pZGVudGlmaWVyID0gaWRlbnRpZmllclxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7RWxlbWVudH0gdGFyZ2V0XG5cdCAqIEBwYXJhbSB7ZnVuY3Rpb259IGdldEVsZW1lbnRcblx0ICogQHJldHVybnMge1Byb21pc2U8RWxlbWVudD59XG5cdCAqL1xuXHRhc3luYyB3YWl0Rm9yRWxlbWVudCh0YXJnZXQsIGdldEVsZW1lbnQpIHtcblx0XHRyZXR1cm4gZ2V0RWxlbWVudCgpIHx8IHdhaXRGb3JFbGVtZW50KHRhcmdldCwgZ2V0RWxlbWVudClcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge0VsZW1lbnR9IGNsaWNrVGFyZ2V0XG5cdCAqIEBwYXJhbSB7RWxlbWVudH0gdGFyZ2V0XG5cdCAqIEBwYXJhbSB7ZnVuY3Rpb259IGdldEVsZW1lbnRcblx0ICogQHJldHVybnMge1Byb21pc2U8RWxlbWVudD59XG5cdCAqL1xuXHRhc3luYyBjbGlja0VsZW1lbnRBbmRXYWl0Rm9yKGNsaWNrVGFyZ2V0LCB0YXJnZXQsIGdldEVsZW1lbnQpIHtcblx0XHRyZXR1cm4gY2xpY2tFbGVtZW50QW5kV2FpdEZvcihjbGlja1RhcmdldCwgdGFyZ2V0LCBnZXRFbGVtZW50KVxuXHR9XG5cbn1cbiIsIi8qKlxuICpcbiAqIEBwYXJhbSB7RWxlbWVudH0gcm9vdFxuICogQHJldHVybnMge1Byb21pc2U8Ym9vbGVhbj59XG4gKi9cbmV4cG9ydCBkZWZhdWx0IGFzeW5jIGZ1bmN0aW9uIGxvYWRNb3JlTWVzc2FnZVN0cmF0ZWd5KHJvb3QpIHtcblx0bGV0IF9vYnNlcnZlclxuXHRjb25zdCBwcm9taXNlID0gUHJvbWlzZS5yYWNlKFtcblx0XHRuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuXHRcdFx0X29ic2VydmVyID0gbmV3IE11dGF0aW9uT2JzZXJ2ZXIoKG11dGF0aW9ucywgb2JzZXJ2ZXIpID0+IHtcblx0XHRcdFx0aWYocm9vdC5zY3JvbGxUb3AgIT09IDApIHtcblx0XHRcdFx0XHRvYnNlcnZlci5kaXNjb25uZWN0KClcblx0XHRcdFx0XHRyZXNvbHZlKGZhbHNlKVxuXHRcdFx0XHR9XG5cdFx0XHR9KS5vYnNlcnZlKHJvb3QsIHsgc3VidHJlZTogdHJ1ZSwgY2hpbGRMaXN0OnRydWUgfSlcblx0XHR9KSxcblx0XHRuZXcgUHJvbWlzZShyZXNvbHZlID0+IHNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0aWYoX29ic2VydmVyKSB7XG5cdFx0XHRcdF9vYnNlcnZlci5kaXNjb25uZWN0KClcblx0XHRcdH1cblx0XHRcdHJlc29sdmUodHJ1ZSlcblx0XHR9LCByb290Lm93bmVyRG9jdW1lbnQuZGVmYXVsdFZpZXcuSURNVV9TQ1JPTExfREVURUNUSU9OX1RJTUVPVVQpKVxuXHRdKVxuXHRyb290LnNjcm9sbFRvcCA9IDBcblx0cmV0dXJuIHByb21pc2Vcbn1cbiIsImltcG9ydCBVSUNvbXBvbmVudCBmcm9tIFwiLi91aS1jb21wb25lbnQuanNcIlxuaW1wb3J0IGxvYWRNb3JlTWVzc2FnZVN0cmF0ZWd5IGZyb20gXCIuL3N0cmF0ZWd5L2xvYWQtbW9yZS1tZXNzYWdlcy1zdHJhdGVneS5qc1wiXG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFVJTWVzc2FnZXNXcmFwcGVyIGV4dGVuZHMgVUlDb21wb25lbnQge1xuXG5cdC8qKlxuXHQgKiBAcGFyYW0ge1dpbmRvd31cblx0ICogQHJldHVybnMge0VsZW1lbnR9XG5cdCAqL1xuXHRzdGF0aWMgZmluZCh3aW5kb3cpIHtcblx0XHRyZXR1cm4gd2luZG93LmRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCJkaXZbcm9sZT1ncmlkXSA+IGRpdiA+IGRpdiA+IGRpdiA+IGRpdlwiKVxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlPn1cblx0ICovXG5cdGFzeW5jIGZldGNoQW5kUmVuZGVyVGhyZWFkTmV4dE1lc3NhZ2VQYWdlKCkge1xuXHRcdHJldHVybiBsb2FkTW9yZU1lc3NhZ2VTdHJhdGVneSh0aGlzLnJvb3QpXG5cdH1cblxufVxuIiwiaW1wb3J0IFVJTWVzc2FnZXNXcmFwcGVyIGZyb20gXCIuLi91aS1tZXNzYWdlcy13cmFwcGVyLmpzXCI7XG5cbi8qKlxuICpcbiAqIEBwYXJhbSB7V2luZG93fSB3aW5kb3dcbiAqIEByZXR1cm5zIHtFbGVtZW50fVxuICovXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBmaW5kTWVzc2FnZXNXcmFwcGVyU3RyYXRlZ3kod2luZG93KSB7XG5cdHJldHVybiBVSU1lc3NhZ2VzV3JhcHBlci5maW5kKHdpbmRvdylcbn1cbiIsImltcG9ydCBVSUNvbXBvbmVudCBmcm9tIFwiLi91aS1jb21wb25lbnQuanNcIlxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBVSU1lc3NhZ2UgZXh0ZW5kcyBVSUNvbXBvbmVudCB7XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7SFRNTERpdkVsZW1lbnR9IGVsZW1lbnRcblx0ICogQHJldHVybnMge1Byb21pc2U8Ym9vbGVhbj59XG5cdCAqL1xuXHRzdGF0aWMgYXN5bmMgaXNNeU93bk1lc3NhZ2UoZWxlbWVudCkge1xuXHRcdGNvbnN0IHVpTWVzc2FnZSA9IG5ldyBVSU1lc3NhZ2UoZWxlbWVudClcblx0XHRjb25zdCBhY3Rpb25CdXR0b24gPSBhd2FpdCBQcm9taXNlLnJhY2UoW1xuXHRcdFx0dWlNZXNzYWdlLnNob3dBY3Rpb25zTWVudUJ1dHRvbigpLFxuXHRcdFx0bmV3IFByb21pc2UocmVzb2x2ZSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIDIwKSlcblx0XHRdKVxuXHRcdGlmKGFjdGlvbkJ1dHRvbikge1xuXHRcdFx0Y29uc3QgYWN0aW9uc01lbnVFbGVtZW50ID0gYXdhaXQgdWlNZXNzYWdlLm9wZW5BY3Rpb25zTWVudShhY3Rpb25CdXR0b24pIC8vIFRPRE8gaTE4blxuXHRcdFx0YXdhaXQgdWlNZXNzYWdlLmNsb3NlQWN0aW9uc01lbnUoYWN0aW9uQnV0dG9uLCBhY3Rpb25zTWVudUVsZW1lbnQpXG5cdFx0XHRhd2FpdCB1aU1lc3NhZ2UuaGlkZUFjdGlvbk1lbnVCdXR0b24oKVxuXHRcdFx0cmV0dXJuIGFjdGlvbnNNZW51RWxlbWVudCAmJiBhY3Rpb25zTWVudUVsZW1lbnQudGV4dENvbnRlbnQudG9Mb2NhbGVMb3dlckNhc2UoKSA9PT0gXCJ1bnNlbmRcIlxuXHRcdH1cblx0XHRyZXR1cm4gZmFsc2Vcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZX1cblx0ICovXG5cdGFzeW5jIHNjcm9sbEludG9WaWV3KCkge1xuXHRcdHRoaXMucm9vdC5zY3JvbGxJbnRvVmlldygpXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHJldHVybnMge1Byb21pc2U8SFRNTEJ1dHRvbkVsZW1lbnQ+fVxuXHQgKi9cblx0YXN5bmMgc2hvd0FjdGlvbnNNZW51QnV0dG9uKCkge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJXb3JrZmxvdyBzdGVwIDEgOiBzaG93QWN0aW9uc01lbnVCdXR0b25cIilcblx0XHR0aGlzLnJvb3QuZGlzcGF0Y2hFdmVudChuZXcgTW91c2VFdmVudChcIm1vdXNlbW92ZVwiLCB7IGJ1YmJsZXM6IHRydWUgfSkpXG5cdFx0dGhpcy5yb290LmRpc3BhdGNoRXZlbnQobmV3IE1vdXNlRXZlbnQoXCJtb3VzZW92ZXJcIiwgeyBidWJibGVzOiB0cnVlIH0pKVxuXHRcdHRoaXMucm9vdC5kaXNwYXRjaEV2ZW50KG5ldyBNb3VzZUV2ZW50KFwibW91c2VudGVyXCIsIHsgYnViYmxlczogdHJ1ZSB9KSlcblx0XHRyZXR1cm4gdGhpcy53YWl0Rm9yRWxlbWVudCh0aGlzLnJvb3QsICgpID0+IHRoaXMucm9vdC5xdWVyeVNlbGVjdG9yKFwiW2FyaWEtbGFiZWw9TW9yZV1cIikpIC8vIFRPRE8gaTE4blxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlPGJvb2xlYW4+fVxuXHQgKi9cblx0aGlkZUFjdGlvbk1lbnVCdXR0b24oKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcImhpZGVBY3Rpb25NZW51QnV0dG9uXCIpXG5cdFx0dGhpcy5yb290LmRpc3BhdGNoRXZlbnQobmV3IE1vdXNlRXZlbnQoXCJtb3VzZW1vdmVcIiwgeyBidWJibGVzOiB0cnVlIH0pKVxuXHRcdHRoaXMucm9vdC5kaXNwYXRjaEV2ZW50KG5ldyBNb3VzZUV2ZW50KFwibW91c2VvdXRcIiwgeyBidWJibGVzOiB0cnVlIH0pKVxuXHRcdHRoaXMucm9vdC5kaXNwYXRjaEV2ZW50KG5ldyBNb3VzZUV2ZW50KFwibW91c2VsZWF2ZVwiLCB7IGJ1YmJsZXM6IHRydWUgfSkpXG5cdFx0cmV0dXJuIHRoaXMud2FpdEZvckVsZW1lbnQodGhpcy5yb290LCAoKSA9PiB0aGlzLnJvb3QucXVlcnlTZWxlY3RvcihcIlthcmlhLWxhYmVsPU1vcmVdXCIpID09PSBudWxsKSAvLyBUT0RPIGkxOG5cblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge0hUTUxCdXR0b25FbGVtZW50fSBhY3Rpb25CdXR0b25cblx0ICogQHJldHVybnMge1Byb21pc2V9XG5cdCAqL1xuXHRhc3luYyBvcGVuQWN0aW9uc01lbnUoYWN0aW9uQnV0dG9uKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIldvcmtmbG93IHN0ZXAgMiA6IG9wZW5BY3Rpb25zTWVudVwiLCBhY3Rpb25CdXR0b24pXG5cdFx0cmV0dXJuIHRoaXMuY2xpY2tFbGVtZW50QW5kV2FpdEZvcihcblx0XHRcdGFjdGlvbkJ1dHRvbixcblx0XHRcdHRoaXMucm9vdC5vd25lckRvY3VtZW50LmJvZHksXG5cdFx0XHQoKSA9PiB7XG5cdFx0XHRcdGNvbnN0IG1lbnVFbGVtZW50cyA9IFsuLi50aGlzLnJvb3Qub3duZXJEb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKFwiW3JvbGU9bWVudV0gW3JvbGU9bWVudWl0ZW1dXCIpXVxuXHRcdFx0XHRtZW51RWxlbWVudHMuc29ydChub2RlID0+IG5vZGUudGV4dENvbnRlbnQudG9Mb2NhbGVMb3dlckNhc2UoKSA9PT0gXCJ1bnNlbmRcIiA/IC0xIDogMCkgLy8gVE9ETyBpMThuXG5cdFx0XHRcdC8vIHJldHVybiBbLi4udGhpcy5yb290Lm93bmVyRG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChcIltyb2xlPWRpYWxvZ10gW3JvbGU9bWVudV0gW3JvbGU9bWVudWl0ZW1dXCIpXS5maWx0ZXIobm9kZSA9PiBub2RlLnRleHRDb250ZW50LnRvTG9jYWxlTG93ZXJDYXNlKCkgPT09IFwidW5zZW5kXCIpLnBvcCgpIC8vIFRPRE8gaTE4blxuXHRcdFx0XHRyZXR1cm4gbWVudUVsZW1lbnRzLnNoaWZ0KClcblx0XHRcdH0sXG5cdFx0KVxuXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHtIVE1MQnV0dG9uRWxlbWVudH0gYWN0aW9uQnV0dG9uXG5cdCAqIEBwYXJhbSB7SFRNTERpdkVsZW1lbnR9IGFjdGlvbnNNZW51RWxlbWVudFxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZTxib29sZWFuPn1cblx0ICovXG5cdGFzeW5jIGNsb3NlQWN0aW9uc01lbnUoYWN0aW9uQnV0dG9uLCBhY3Rpb25zTWVudUVsZW1lbnQpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwiY2xvc2VBY3Rpb25zTWVudVwiKVxuXHRcdHJldHVybiB0aGlzLmNsaWNrRWxlbWVudEFuZFdhaXRGb3IoXG5cdFx0XHRhY3Rpb25CdXR0b24sXG5cdFx0XHR0aGlzLnJvb3Qub3duZXJEb2N1bWVudC5ib2R5LFxuXHRcdFx0KCkgPT4gdGhpcy5yb290Lm93bmVyRG9jdW1lbnQuYm9keS5jb250YWlucyhhY3Rpb25zTWVudUVsZW1lbnQpID09PSBmYWxzZSxcblx0XHQpXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHJldHVybnMge1Byb21pc2U8SFRNTEJ1dHRvbkVsZW1lbnQ+fFByb21pc2U8RXJyb3I+fVxuXHQgKi9cblx0YXN5bmMgb3BlbkNvbmZpcm1VbnNlbmRNb2RhbCgpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwiV29ya2Zsb3cgc3RlcCAzIDogb3BlbkNvbmZpcm1VbnNlbmRNb2RhbFwiKVxuXHRcdGNvbnN0IHVuU2VuZEJ1dHRvbiA9IGF3YWl0IHRoaXMud2FpdEZvckVsZW1lbnQoXG5cdFx0XHR0aGlzLnJvb3Qub3duZXJEb2N1bWVudC5ib2R5LFxuXHRcdFx0KCkgPT4gWy4uLnRoaXMucm9vdC5vd25lckRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoXCJbcm9sZT1kaWFsb2ddIFtyb2xlPW1lbnVdIFtyb2xlPW1lbnVpdGVtXVwiKV0uZmlsdGVyKG5vZGUgPT4gbm9kZS50ZXh0Q29udGVudC50b0xvY2FsZUxvd2VyQ2FzZSgpID09PSBcInVuc2VuZFwiKS5wb3AoKSwgLy8gVE9ETyBpMThuXG5cdFx0KVxuXHRcdHJldHVybiB0aGlzLmNsaWNrRWxlbWVudEFuZFdhaXRGb3IoXG5cdFx0XHR1blNlbmRCdXR0b24sXG5cdFx0XHR0aGlzLnJvb3Qub3duZXJEb2N1bWVudC5ib2R5LFxuXHRcdFx0KCkgPT4gdGhpcy5yb290Lm93bmVyRG9jdW1lbnQucXVlcnlTZWxlY3RvcihcIltyb2xlPWRpYWxvZ10gYnV0dG9uXCIpLFxuXHRcdClcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge0hUTUxCdXR0b25FbGVtZW50fSBkaWFsb2dCdXR0b25cblx0ICogQHJldHVybnMge1Byb21pc2V9XG5cdCAqL1xuXHRhc3luYyBjb25maXJtVW5zZW5kKGRpYWxvZ0J1dHRvbikge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJXb3JrZmxvdyBmaW5hbCBzdGVwIDogY29uZmlybVVuc2VuZFwiLCBkaWFsb2dCdXR0b24pXG5cdFx0YXdhaXQgdGhpcy5jbGlja0VsZW1lbnRBbmRXYWl0Rm9yKFxuXHRcdFx0ZGlhbG9nQnV0dG9uLFxuXHRcdFx0dGhpcy5yb290Lm93bmVyRG9jdW1lbnQuYm9keSxcblx0XHRcdCgpID0+IHRoaXMucm9vdC5vd25lckRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCJbcm9sZT1kaWFsb2ddIGJ1dHRvblwiKSA9PT0gbnVsbFxuXHRcdClcblx0fVxuXG59XG4iLCJpbXBvcnQgVUlNZXNzYWdlIGZyb20gXCIuLi91aS1tZXNzYWdlLmpzXCJcblxuLyoqXG4gKlxuICogQHBhcmFtIHtFbGVtZW50fSByb290XG4gKiBAcmV0dXJucyB7UHJvbWlzZTxFbGVtZW50W10+fVxuICovXG5leHBvcnQgZGVmYXVsdCBhc3luYyBmdW5jdGlvbiBmaW5kTWVzc2FnZXNTdHJhdGVneShyb290KSB7XG5cdGNvbnN0IGVsZW1lbnRzID0gWy4uLnJvb3QucXVlcnlTZWxlY3RvckFsbChcImRpdltyb2xlPXJvd106bm90KFtkYXRhLWlkbXUtaWdub3JlXSlcIildXG5cdGNvbnN0IG1lc3NhZ2VFbGVtZW50cyA9IFtdXG5cdGZvcihjb25zdCBlbGVtZW50IG9mIGVsZW1lbnRzKSB7XG5cdFx0Y29uc3QgaXNNeU93bk1lc3NhZ2UgPSBhd2FpdCBVSU1lc3NhZ2UuaXNNeU93bk1lc3NhZ2UoZWxlbWVudClcblx0XHRpZihpc015T3duTWVzc2FnZSkge1xuXHRcdFx0bWVzc2FnZUVsZW1lbnRzLnB1c2goZWxlbWVudClcblx0XHR9IGVsc2Uge1xuXHRcdFx0ZWxlbWVudC5zZXRBdHRyaWJ1dGUoXCJkYXRhLWlkbXUtaWdub3JlXCIsIFwiXCIpXG5cdFx0fVxuXHR9XG5cdGNvbnNvbGUuZGVidWcobWVzc2FnZUVsZW1lbnRzKVxuXHRyZXR1cm4gbWVzc2FnZUVsZW1lbnRzXG59XG4iLCJpbXBvcnQgVUlQSUNvbXBvbmVudCBmcm9tIFwiLi91aXBpLWNvbXBvbmVudC5qc1wiXG5cblxuY2xhc3MgRmFpbGVkV29ya2Zsb3dFeGNlcHRpb24gZXh0ZW5kcyBFcnJvciB7fVxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBVSVBJTWVzc2FnZSBleHRlbmRzIFVJUElDb21wb25lbnQge1xuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge1VJTWVzc2FnZX0gdWlDb21wb25lbnRcblx0ICovXG5cdGNvbnN0cnVjdG9yKHVpQ29tcG9uZW50KSB7XG5cdFx0c3VwZXIodWlDb21wb25lbnQpXG5cdH1cblxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZTxib29sZWFuPn1cblx0ICovXG5cdGFzeW5jIHVuc2VuZCgpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwiVUlQSU1lc3NhZ2UgdW5zZW5kXCIpXG5cdFx0bGV0IGFjdGlvbkJ1dHRvblxuXHRcdGxldCBhY3Rpb25zTWVudUVsZW1lbnRcblx0XHR0cnkge1xuXHRcdFx0YXdhaXQgdGhpcy51aUNvbXBvbmVudC5zY3JvbGxJbnRvVmlldygpXG5cdFx0XHRhY3Rpb25CdXR0b24gPSBhd2FpdCB0aGlzLnVpQ29tcG9uZW50LnNob3dBY3Rpb25zTWVudUJ1dHRvbigpXG5cdFx0XHRhY3Rpb25zTWVudUVsZW1lbnQgPSBhd2FpdCB0aGlzLnVpQ29tcG9uZW50Lm9wZW5BY3Rpb25zTWVudShhY3Rpb25CdXR0b24pXG5cdFx0XHRjb25zdCBkaWFsb2dCdXR0b24gPSBhd2FpdCB0aGlzLnVpQ29tcG9uZW50Lm9wZW5Db25maXJtVW5zZW5kTW9kYWwoKVxuXHRcdFx0YXdhaXQgdGhpcy51aUNvbXBvbmVudC5jb25maXJtVW5zZW5kKGRpYWxvZ0J1dHRvbilcblx0XHRcdHRoaXMudWlDb21wb25lbnQucm9vdC5zZXRBdHRyaWJ1dGUoXCJkYXRhLWlkbXUtdW5zZW50XCIsIFwiXCIpXG5cdFx0XHRyZXR1cm4gdHJ1ZVxuXHRcdH0gY2F0Y2goZXgpIHtcblx0XHRcdGNvbnNvbGUuZXJyb3IoZXgpXG5cdFx0XHRpZihhY3Rpb25CdXR0b24gJiYgYWN0aW9uc01lbnVFbGVtZW50KSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMudWlDb21wb25lbnQuY2xvc2VBY3Rpb25zTWVudShhY3Rpb25CdXR0b24sIGFjdGlvbnNNZW51RWxlbWVudClcblx0XHRcdH1cblx0XHRcdGF3YWl0IHRoaXMudWlDb21wb25lbnQuaGlkZUFjdGlvbk1lbnVCdXR0b24oKVxuXHRcdFx0dGhyb3cgbmV3IEZhaWxlZFdvcmtmbG93RXhjZXB0aW9uKFwiRmFpbGVkIHRvIGV4ZWN1dGUgd29ya2Zsb3cgZm9yIHRoaXMgbWVzc2FnZVwiKVxuXHRcdH1cblx0fVxuXG59XG4iLCJpbXBvcnQgVUlDb21wb25lbnQgZnJvbSBcIi4vdWktY29tcG9uZW50LmpzXCJcbmltcG9ydCBmaW5kTWVzc2FnZXNTdHJhdGVneSBmcm9tIFwiLi4vdWkvc3RyYXRlZ3kvZmluZC1tZXNzYWdlcy1zdHJhdGVneS5qc1wiXG5pbXBvcnQgVUlQSU1lc3NhZ2UgZnJvbSBcIi4uL3VpcGkvdWlwaS1tZXNzYWdlLmpzXCJcbmltcG9ydCBVSU1lc3NhZ2UgZnJvbSBcIi4vdWktbWVzc2FnZS5qc1wiXG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFVJIGV4dGVuZHMgVUlDb21wb25lbnQge1xuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZT59XG5cdCAqL1xuXHRhc3luYyBmZXRjaEFuZFJlbmRlclRocmVhZE5leHRNZXNzYWdlUGFnZSgpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwiVUkgZmV0Y2hBbmRSZW5kZXJUaHJlYWROZXh0TWVzc2FnZVBhZ2VcIilcblx0XHRyZXR1cm4gYXdhaXQgdGhpcy5pZGVudGlmaWVyLnVpTWVzc2FnZXNXcmFwcGVyLmZldGNoQW5kUmVuZGVyVGhyZWFkTmV4dE1lc3NhZ2VQYWdlKClcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZTxVSVBJTWVzc2FnZVtdPn1cblx0ICovXG5cdGFzeW5jIGNyZWF0ZVVJUElNZXNzYWdlcygpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwiVUkgY3JlYXRlVUlQSU1lc3NhZ2VzXCIpXG5cdFx0Y29uc3QgdWlwaU1lc3NhZ2VzID0gW11cblx0XHRjb25zdCBtZXNzYWdlRWxlbWVudHMgPSBhd2FpdCBmaW5kTWVzc2FnZXNTdHJhdGVneSh0aGlzLmlkZW50aWZpZXIudWlNZXNzYWdlc1dyYXBwZXIucm9vdClcblx0XHRjb25zb2xlLmRlYnVnKFwiZmluZE1lc3NhZ2VzU3RyYXRlZ3lcIiwgbWVzc2FnZUVsZW1lbnRzKVxuXHRcdGZvcihjb25zdCBtZXNzYWdlRWxlbWVudCBvZiBtZXNzYWdlRWxlbWVudHMpIHtcblx0XHRcdGNvbnN0IHVpTWVzc2FnZSA9IG5ldyBVSU1lc3NhZ2UobWVzc2FnZUVsZW1lbnQpXG5cdFx0XHR1aXBpTWVzc2FnZXMucHVzaChuZXcgVUlQSU1lc3NhZ2UodWlNZXNzYWdlKSlcblx0XHR9XG5cdFx0cmV0dXJuIHVpcGlNZXNzYWdlc1xuXHR9XG5cbn1cbiIsImltcG9ydCBVSVBJQ29tcG9uZW50IGZyb20gXCIuL3VpcGktY29tcG9uZW50LmpzXCJcbmltcG9ydCBmaW5kTWVzc2FnZXNXcmFwcGVyU3RyYXRlZ3kgZnJvbSBcIi4uL3VpL3N0cmF0ZWd5L2ZpbmQtbWVzc2FnZXMtd3JhcHBlci1zdHJhdGVneS5qc1wiXG5pbXBvcnQgVUlNZXNzYWdlc1dyYXBwZXIgZnJvbSBcIi4uL3VpL3VpLW1lc3NhZ2VzLXdyYXBwZXIuanNcIlxuaW1wb3J0IFVJIGZyb20gXCIuLi91aS91aS5qc1wiXG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFVJUEkgZXh0ZW5kcyBVSVBJQ29tcG9uZW50IHtcblxuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHtVSX0gdWlDb21wb25lbnRcblx0ICovXG5cdGNvbnN0cnVjdG9yKHVpQ29tcG9uZW50KSB7XG5cdFx0c3VwZXIodWlDb21wb25lbnQpXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHtXaW5kb3d9IHdpbmRvd1xuXHQgKiBAcmV0dXJucyB7VUlQSX1cblx0ICovXG5cdHN0YXRpYyBjcmVhdGUod2luZG93KSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIlVJUEkuY3JlYXRlXCIpXG5cdFx0Y29uc3QgbWVzc2FnZXNXcmFwcGVyRWxlbWVudCA9IGZpbmRNZXNzYWdlc1dyYXBwZXJTdHJhdGVneSh3aW5kb3cpXG5cdFx0bGV0IHVpcGlcblx0XHRpZihtZXNzYWdlc1dyYXBwZXJFbGVtZW50ICE9PSBudWxsKSB7XG5cdFx0XHRjb25zb2xlLmRlYnVnKFwiRm91bmQgbWVzc2FnZXNXcmFwcGVyRWxlbWVudFwiKVxuXHRcdFx0Y29uc29sZS5kZWJ1ZyhtZXNzYWdlc1dyYXBwZXJFbGVtZW50KVxuXHRcdFx0Y29uc3QgdWkgPSBuZXcgVUkod2luZG93KVxuXHRcdFx0dWkuaWRlbnRpZmllci51aU1lc3NhZ2VzV3JhcHBlciA9IG5ldyBVSU1lc3NhZ2VzV3JhcHBlcihtZXNzYWdlc1dyYXBwZXJFbGVtZW50KVxuXHRcdFx0dWlwaSA9IG5ldyBVSVBJKHVpKVxuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCJVbmFibGUgdG8gZmluZCBtZXNzYWdlc1dyYXBwZXJFbGVtZW50XCIpXG5cdFx0fVxuXHRcdHJldHVybiB1aXBpXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHJldHVybnMge1Byb21pc2V9XG5cdCAqL1xuXHRhc3luYyBmZXRjaEFuZFJlbmRlclRocmVhZE5leHRNZXNzYWdlUGFnZSgpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwiVUlQSSBmZXRjaEFuZFJlbmRlclRocmVhZE5leHRNZXNzYWdlUGFnZVwiKVxuXHRcdHJldHVybiB0aGlzLnVpQ29tcG9uZW50LmZldGNoQW5kUmVuZGVyVGhyZWFkTmV4dE1lc3NhZ2VQYWdlKClcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZTxVSVBJTWVzc2FnZVtdPn1cblx0ICovXG5cdGFzeW5jIGNyZWF0ZVVJUElNZXNzYWdlcygpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwiVUlQSSBjcmVhdGVVSVBJTWVzc2FnZXNcIilcblx0XHRyZXR1cm4gdGhpcy51aUNvbXBvbmVudC5jcmVhdGVVSVBJTWVzc2FnZXMoKVxuXHR9XG5cbn1cbiIsImltcG9ydCBVSVBJIGZyb20gXCIuLi91aXBpL3VpcGkuanNcIlxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBJRE1VIHtcblxuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHtXaW5kb3d9IHdpbmRvd1xuXHQgKi9cblx0Y29uc3RydWN0b3Iod2luZG93KSB7XG5cdFx0dGhpcy53aW5kb3cgPSB3aW5kb3dcblx0XHR0aGlzLnVpcGkgPSBudWxsXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHJldHVybnMge1Byb21pc2U8VUlQSU1lc3NhZ2VbXT59XG5cdCAqL1xuXHRhc3luYyBjcmVhdGVVSVBJTWVzc2FnZXMoKSB7XG5cdFx0cmV0dXJuIHRoaXMuI2dldFVJUEkoKS5jcmVhdGVVSVBJTWVzc2FnZXMoKVxuXHR9XG5cblxuXHQvKipcblx0ICpcblx0ICogQHJldHVybnMge1Byb21pc2V9XG5cdCAqL1xuXHRhc3luYyBmZXRjaEFuZFJlbmRlclRocmVhZE5leHRNZXNzYWdlUGFnZSgpIHtcblx0XHRyZXR1cm4gdGhpcy4jZ2V0VUlQSSgpLmZldGNoQW5kUmVuZGVyVGhyZWFkTmV4dE1lc3NhZ2VQYWdlKClcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcmV0dXJucyB7VUlQSX1cblx0ICovXG5cdCNnZXRVSVBJKCkge1xuXHRcdGlmKHRoaXMudWlwaSA9PT0gbnVsbCkge1xuXHRcdFx0dGhpcy51aXBpID0gVUlQSS5jcmVhdGUodGhpcy53aW5kb3cpXG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLnVpcGlcblx0fVxuXG59XG4iLCJcbmV4cG9ydCBjbGFzcyBVbnNlbmRUaHJlYWRNZXNzYWdlc0JhdGNoU3RyYXRlZ3kge1xuXG5cdHN0YXRpYyBERUZBVUxUX0JBVENIX1NJWkUgPSA1XG5cblx0I2lkbXVcblx0I29uVW5zdWNjZXNzZnVsV29ya2Zsb3dzXG5cdCNmaW5pc2hlZF93b3JrZmxvd3NcblxuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHtJRE1VfSBpZG11XG5cdCAqL1xuXHRjb25zdHJ1Y3RvcihpZG11LCBvblVuc3VjY2Vzc2Z1bFdvcmtmbG93cz1udWxsKSB7XG5cdFx0dGhpcy5fcnVubmluZyA9IGZhbHNlXG5cdFx0dGhpcy5fc3RvcHBlZCA9IGZhbHNlXG5cdFx0dGhpcy4jZmluaXNoZWRfd29ya2Zsb3dzID0gW11cblx0XHR0aGlzLiNpZG11ID0gaWRtdVxuXHRcdHRoaXMuI29uVW5zdWNjZXNzZnVsV29ya2Zsb3dzID0gb25VbnN1Y2Nlc3NmdWxXb3JrZmxvd3Ncblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcmV0dXJucyB7Ym9vbGVhbn1cblx0ICovXG5cdGlzUnVubmluZygpIHtcblx0XHRyZXR1cm4gdGhpcy5fcnVubmluZyAmJiAhdGhpcy5fc3RvcHBlZFxuXHR9XG5cblx0c3RvcCgpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwiVW5zZW5kVGhyZWFkTWVzc2FnZXNCYXRjaFN0cmF0ZWd5IHN0b3BcIilcblx0XHR0aGlzLl9zdG9wcGVkID0gdHJ1ZVxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7bnVtYmVyfSBiYXRjaFNpemVcblx0ICogQHJldHVybnMge1Byb21pc2V9XG5cdCAqL1xuXHRhc3luYyBydW4oYmF0Y2hTaXplKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIlVuc2VuZFRocmVhZE1lc3NhZ2VzQmF0Y2hTdHJhdGVneS5ydW4oKVwiLCBiYXRjaFNpemUpXG5cdFx0dGhpcy5fcnVubmluZyA9IHRydWVcblx0XHR0aGlzLl9zdG9wcGVkID0gZmFsc2Vcblx0XHRyZXR1cm4gdGhpcy4jcHJvY2Vzc0JhdGNoZXMoYmF0Y2hTaXplKVxuXHR9XG5cblx0I2RvbmUoKSB7XG5cdFx0dGhpcy5fcnVubmluZyA9IGZhbHNlXG5cdFx0Y29uc29sZS5kZWJ1ZyhcIlVuc2VuZFRocmVhZE1lc3NhZ2VzQmF0Y2hTdHJhdGVneSBkb25lXCIpXG5cdH1cblxuXHQjdW5zdWNjZXNzZnVsV29ya2Zsb3dBbGVydCgpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwiVW5zZW5kVGhyZWFkTWVzc2FnZXNCYXRjaFN0cmF0ZWd5IHVuc3VjY2Vzc2Z1bFdvcmtmbG93QWxlcnRcIilcblx0XHRpZighdGhpcy5fcnVubmluZykge1xuXHRcdFx0Y2xlYXJJbnRlcnZhbCh0aGlzLmludGVydmFsKVxuXHRcdH1cblx0XHRjb25zdCB1bnN1Y2Nlc3NmdWxXb3JrZmxvd3MgPSB0aGlzLiNmaW5pc2hlZF93b3JrZmxvd3MuZmlsdGVyKHVpTWVzc2FnZSA9PiB0aGlzLiNpZG11LndpbmRvdy5kb2N1bWVudC5jb250YWlucyh1aU1lc3NhZ2UudWlDb21wb25lbnQucm9vdCkpXG5cdFx0aWYodW5zdWNjZXNzZnVsV29ya2Zsb3dzLmxlbmd0aCA+PSAxKSB7XG5cdFx0XHR1bnN1Y2Nlc3NmdWxXb3JrZmxvd3MuZm9yRWFjaChmYWlsZWRXb3JrZmxvdyA9PiB0aGlzLiNmaW5pc2hlZF93b3JrZmxvd3Muc3BsaWNlKHRoaXMuI2ZpbmlzaGVkX3dvcmtmbG93cy5pbmRleE9mKGZhaWxlZFdvcmtmbG93KSwgMSkpXG5cdFx0XHR0aGlzLiNvblVuc3VjY2Vzc2Z1bFdvcmtmbG93cyh1bnN1Y2Nlc3NmdWxXb3JrZmxvd3MpXG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgI3Byb2Nlc3NCYXRjaGVzKGJhdGNoU2l6ZSkge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJVbnNlbmRUaHJlYWRNZXNzYWdlc0JhdGNoU3RyYXRlZ3kgcHJvY2Vzc0JhdGNoZXNcIilcblx0XHRsZXQgZG9uZSA9IGZhbHNlXG5cdFx0Zm9yKGxldCBpID0gMDsgaSA8IGJhdGNoU2l6ZTtpKyspIHtcblx0XHRcdGlmKHRoaXMuX3N0b3BwZWQpIHtcblx0XHRcdFx0YnJlYWtcblx0XHRcdH1cblx0XHRcdGRvbmUgPSBhd2FpdCB0aGlzLiNpZG11LmZldGNoQW5kUmVuZGVyVGhyZWFkTmV4dE1lc3NhZ2VQYWdlKClcblx0XHRcdGlmKGRvbmUpIHtcblx0XHRcdFx0YnJlYWtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGF3YWl0IG5ldyBQcm9taXNlKHJlc29sdmUgPT4gc2V0VGltZW91dChyZXNvbHZlLCB0aGlzLiNpZG11LndpbmRvdy5JRE1VX05FWFRfTUVTU0FHRV9QQUdFX0RFTEFZKSlcblx0XHRcdH1cblx0XHR9XG5cdFx0dHJ5IHtcblx0XHRcdGZvcihjb25zdCB1aXBpTWVzc2FnZSBvZiBhd2FpdCB0aGlzLiNpZG11LmNyZWF0ZVVJUElNZXNzYWdlcygpKSB7XG5cdFx0XHRcdGlmKHRoaXMuX3N0b3BwZWQpIHtcblx0XHRcdFx0XHRicmVha1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0YXdhaXQgdWlwaU1lc3NhZ2UudW5zZW5kKClcblx0XHRcdFx0XHR0aGlzLiNmaW5pc2hlZF93b3JrZmxvd3MucHVzaCh1aXBpTWVzc2FnZSlcblx0XHRcdFx0XHRhd2FpdCBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgdGhpcy4jaWRtdS53aW5kb3cuSURNVV9NRVNTQUdFX1FVRVVFX0RFTEFZKSlcblx0XHRcdFx0fSBjYXRjaChyZXN1bHQpIHtcblx0XHRcdFx0XHRjb25zb2xlLmVycm9yKHJlc3VsdClcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0gY2F0Y2goZXgpIHtcblx0XHRcdGNvbnNvbGUuZXJyb3IoZXgpXG5cdFx0fVxuXHRcdGlmKCF0aGlzLmludGVydmFsICYmIHRoaXMuI29uVW5zdWNjZXNzZnVsV29ya2Zsb3dzKSB7XG5cdFx0XHR0aGlzLmludGVydmFsID0gc2V0SW50ZXJ2YWwoKCkgPT4gdGhpcy4jdW5zdWNjZXNzZnVsV29ya2Zsb3dBbGVydCgpLCB0aGlzLiNpZG11LndpbmRvdy5JRE1VX1VOU1VDRVNTRlVMX1dPUktGTE9XX0FMRVJUX0lOVEVSVkFMKVxuXHRcdH1cblx0XHRpZihkb25lKSB7XG5cdFx0XHR0aGlzLiNkb25lKClcblx0XHR9IGVsc2UgaWYoIXRoaXMuX3N0b3BwZWQpIHtcblx0XHRcdHJldHVybiB0aGlzLiNwcm9jZXNzQmF0Y2hlcyhiYXRjaFNpemUpXG5cdFx0fVxuXHR9XG59XG4iLCIvKipcbiAqXG4gKiBAcGFyYW0ge0RvY3VtZW50fSBkb2N1bWVudFxuICogQHJldHVybnMge0hUTUxCdXR0b25FbGVtZW50fVxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQWxlcnRzV3JhcHBlckVsZW1lbnQoZG9jdW1lbnQpIHtcblx0Y29uc3QgYWxlcnRzV3JhcHBlckVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpXG5cdGFsZXJ0c1dyYXBwZXJFbGVtZW50LmlkID0gXCJpZG11LWFsZXJ0c1wiXG5cdGFsZXJ0c1dyYXBwZXJFbGVtZW50LnN0eWxlLnBvc2l0aW9uID0gXCJmaXhlZFwiXG5cdGFsZXJ0c1dyYXBwZXJFbGVtZW50LnN0eWxlLnRvcCA9IFwiMjBweFwiXG5cdGFsZXJ0c1dyYXBwZXJFbGVtZW50LnN0eWxlLnJpZ2h0ID0gXCIyMHB4XCJcblx0YWxlcnRzV3JhcHBlckVsZW1lbnQuc3R5bGUuZGlzcGxheSA9IFwiZ3JpZFwiXG5cdHJldHVybiBhbGVydHNXcmFwcGVyRWxlbWVudFxufVxuXG4vKipcbiAqXG4gKiBAcGFyYW0ge0RvY3VtZW50fSBkb2N1bWVudFxuICogQHBhcmFtIHtzdHJpbmd9ICAgdGV4dFxuICogQHJldHVybnMge0hUTUxCdXR0b25FbGVtZW50fVxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQWxlcnRFbGVtZW50KGRvY3VtZW50LCB0ZXh0KSB7XG5cdGNvbnN0IGFsZXJ0RWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIilcblx0YWxlcnRFbGVtZW50LnRleHRDb250ZW50ID0gdGV4dFxuXHRyZXR1cm4gYWxlcnRFbGVtZW50XG59XG4iLCIvKipcbiAqIEBwYXJhbSB7RG9jdW1lbnR9IGRvY3VtZW50XG4gKiBAcmV0dXJucyB7SFRNTERpdkVsZW1lbnR9XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVPdmVybGF5RWxlbWVudChkb2N1bWVudCkge1xuXHRjb25zdCBvdmVybGF5RWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIilcblx0b3ZlcmxheUVsZW1lbnQuaWQgPSBcImlkbXUtb3ZlcmxheVwiXG5cdG92ZXJsYXlFbGVtZW50LnN0eWxlLnRvcCA9IFwiMFwiXG5cdG92ZXJsYXlFbGVtZW50LnN0eWxlLnJpZ2h0ID0gXCIwXCJcblx0b3ZlcmxheUVsZW1lbnQuc3R5bGUucG9zaXRpb24gPSBcImZpeGVkXCJcblx0b3ZlcmxheUVsZW1lbnQuc3R5bGUud2lkdGggPSBcIjEwMHZ3XCJcblx0b3ZlcmxheUVsZW1lbnQuc3R5bGUuaGVpZ2h0ID0gXCIxMDB2aFwiXG5cdG92ZXJsYXlFbGVtZW50LnN0eWxlLnpJbmRleCA9IFwiOTk4XCJcblx0b3ZlcmxheUVsZW1lbnQuc3R5bGUuYmFja2dyb3VuZENvbG9yID0gXCIjMDAwMDAwZDZcIlxuXHRvdmVybGF5RWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCJcblx0cmV0dXJuIG92ZXJsYXlFbGVtZW50XG59XG4iLCJpbXBvcnQgeyBjcmVhdGVNZW51QnV0dG9uRWxlbWVudCB9IGZyb20gXCIuL21lbnUtYnV0dG9uLmpzXCJcbmltcG9ydCB7IGNyZWF0ZU1lbnVFbGVtZW50IH0gZnJvbSBcIi4vbWVudS5qc1wiXG5pbXBvcnQgSURNVSBmcm9tIFwiLi4vLi4vLi4vaWRtdS9pZG11LmpzXCJcbmltcG9ydCB7IFVuc2VuZFRocmVhZE1lc3NhZ2VzQmF0Y2hTdHJhdGVneSB9IGZyb20gXCIuLi9zdHJhdGVneS5qc1wiXG5pbXBvcnQgeyBjcmVhdGVBbGVydHNXcmFwcGVyRWxlbWVudCB9IGZyb20gXCIuL2FsZXJ0LmpzXCJcbmltcG9ydCB7IGNyZWF0ZU92ZXJsYXlFbGVtZW50IH0gZnJvbSBcIi4vb3ZlcmxheS5qc1wiXG5cbi8qKlxuICpcbiAqIEBwYXJhbSB7d2luZG93fSB3aW5kb3dcbiAqIEByZXR1cm5zIHtIVE1MRGl2RWxlbWVudH0gICAgb2JqZWN0LnVpRWxlbWVudFxuICogQHJldHVybnMge0hUTUxCdXR0b25FbGVtZW50fSBvYmplY3QudW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b25cbiAqIEByZXR1cm5zIHtIVE1MQnV0dG9uRWxlbWVudH0gb2JqZWN0LmxvYWRUaHJlYWRNZXNzYWdlc0J1dHRvblxuICovXG5leHBvcnQgZnVuY3Rpb24gcmVuZGVyKHdpbmRvdykge1xuXHRjb25zdCBpZG11ID0gbmV3IElETVUod2luZG93KVxuXHRjb25zdCBzdHJhdGVneSA9IG5ldyBVbnNlbmRUaHJlYWRNZXNzYWdlc0JhdGNoU3RyYXRlZ3koaWRtdSwgKHVuc3VjY2Vzc2Z1bFdvcmtmbG93cykgPT4ge1xuXHRcdGNvbnNvbGUubG9nKHVuc3VjY2Vzc2Z1bFdvcmtmbG93cylcblx0fSlcblx0Y29uc3QgeyBvdmVybGF5RWxlbWVudCwgdWlFbGVtZW50LCBtZW51RWxlbWVudCwgdW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24sIGxvYWRUaHJlYWRNZXNzYWdlc0J1dHRvbiB9ID0gY3JlYXRlVUlFbGVtZW50KHdpbmRvdy5kb2N1bWVudClcblx0ZnVuY3Rpb24gb25VbnNlbmRpbmdGaW5pc2hlZCgpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwib25VbnNlbmRpbmdGaW5pc2hlZFwiKVxuXHRcdDtbLi4ubWVudUVsZW1lbnQucXVlcnlTZWxlY3RvckFsbChcImJ1dHRvblwiKV0uZmlsdGVyKGJ1dHRvbiA9PiBidXR0b24gIT09IHVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uKS5mb3JFYWNoKGJ1dHRvbiA9PiB7XG5cdFx0XHRidXR0b24uc3R5bGUuZGlzcGxheSA9IFwiXCJcblx0XHR9KVxuXHRcdHVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uLnRleHRDb250ZW50ID0gdW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24uZGF0YVRleHRDb250ZW50XG5cdFx0dW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24uc3R5bGUuYmFja2dyb3VuZENvbG9yID0gdW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24uZGF0YUJhY2tncm91bmRDb2xvclxuXHRcdG92ZXJsYXlFbGVtZW50LnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIlxuXHRcdGlmKCFzdHJhdGVneS5fc3RvcHBlZCkge1xuXHRcdFx0d2luZG93LmFsZXJ0KFwiSURNVTogRmluaXNoZWRcIilcblx0XHR9XG5cdH1cblx0YXN5bmMgZnVuY3Rpb24gc3RhcnRVbnNlbmRpbmcoKSB7XG5cdFx0Wy4uLm1lbnVFbGVtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoXCJidXR0b25cIildLmZpbHRlcihidXR0b24gPT4gYnV0dG9uICE9PSB1bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbikuZm9yRWFjaChidXR0b24gPT4ge1xuXHRcdFx0YnV0dG9uLnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIlxuXHRcdH0pXG5cdFx0b3ZlcmxheUVsZW1lbnQuc3R5bGUuZGlzcGxheSA9IFwiXCJcblx0XHRjb25zb2xlLmRlYnVnKFwiVXNlciBhc2tlZCB0byBzdGFydCBtZXNzYWdlcyB1bnNlbmRpbmc7IFVJIGkxbnRlcmFjdGlvbiB3aWxsIGJlIGRpc2FibGVkXCIpXG5cdFx0dW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24udGV4dENvbnRlbnQgPSBcIlN0b3AgcHJvY2Vzc2luZ1wiXG5cdFx0dW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24uc3R5bGUuYmFja2dyb3VuZENvbG9yID0gXCIjRkEzODNFXCJcblx0XHRjb25zdCBiYXRjaFNpemUgPSB3aW5kb3cubG9jYWxTdG9yYWdlLmdldEl0ZW0oXCJJRE1VX0JBVENIX1NJWkVcIikgfHwgVW5zZW5kVGhyZWFkTWVzc2FnZXNCYXRjaFN0cmF0ZWd5LkRFRkFVTFRfQkFUQ0hfU0laRVxuXHRcdGF3YWl0IHN0cmF0ZWd5LnJ1bihiYXRjaFNpemUpXG5cdFx0b25VbnNlbmRpbmdGaW5pc2hlZCgpXG5cdH1cblx0ZnVuY3Rpb24gaGFuZGxlRXZlbnRzKGV2ZW50KSB7XG5cdFx0aWYoc3RyYXRlZ3kuaXNSdW5uaW5nKCkgJiYgIXVpRWxlbWVudC5jb250YWlucyhldmVudC50YXJnZXQpKSB7XG5cdFx0XHRjb25zb2xlLmluZm8oXCJVc2VyIGludGVyYWN0aW9uIGlzIGRpc2FibGVkIGFzIHRoZSBzdHJhdGVneSBpcyBzdGlsbCBydW5uaW5nOyBQbGVhc2Ugc3RvcCB0aGUgZXhlY3V0aW9uIGZpcnN0LlwiKVxuXHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKVxuXHRcdH1cblx0fVxuXHR3aW5kb3cuZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcImtleWRvd25cIiwgaGFuZGxlRXZlbnRzKVxuXHR1bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbi5kYXRhVGV4dENvbnRlbnQgPSB1bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbi50ZXh0Q29udGVudFxuXHR1bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbi5kYXRhQmFja2dyb3VuZENvbG9yID0gdW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24uc3R5bGUuYmFja2dyb3VuZENvbG9yXG5cdHVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCBhc3luYyAoKSA9PiB7XG5cdFx0aWYoc3RyYXRlZ3kuaXNSdW5uaW5nKCkpIHtcblx0XHRcdGNvbnNvbGUuZGVidWcoXCJVc2VyIGFza2VkIHRvIHN0b3AgbWVzc2FnZXMgdW5zZW5kaW5nXCIpXG5cdFx0XHRzdHJhdGVneS5zdG9wKClcblx0XHRcdG9uVW5zZW5kaW5nRmluaXNoZWQoKVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRzdGFydFVuc2VuZGluZygpXG5cdFx0fVxuXHR9KVxuXHRsb2FkVGhyZWFkTWVzc2FnZXNCdXR0b24uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIGFzeW5jICgpID0+IHtcblx0XHRjb25zb2xlLmRlYnVnKFwibG9hZFRocmVhZE1lc3NhZ2VzQnV0dG9uIGNsaWNrXCIpXG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IGJhdGNoU2l6ZSA9IHBhcnNlSW50KHdpbmRvdy5wcm9tcHQoXCJIb3cgbWFueSBwYWdlcyBzaG91bGQgd2UgbG9hZCBiZWZvcmUgZWFjaCB1bnNlbmRpbmc/IFwiLCB3aW5kb3cubG9jYWxTdG9yYWdlLmdldEl0ZW0oXCJJRE1VX0JBVENIX1NJWkVcIikgfHwgVW5zZW5kVGhyZWFkTWVzc2FnZXNCYXRjaFN0cmF0ZWd5LkRFRkFVTFRfQkFUQ0hfU0laRSApKVxuXHRcdFx0aWYocGFyc2VJbnQoYmF0Y2hTaXplKSkge1xuXHRcdFx0XHR3aW5kb3cubG9jYWxTdG9yYWdlLnNldEl0ZW0oXCJJRE1VX0JBVENIX1NJWkVcIiwgcGFyc2VJbnQoYmF0Y2hTaXplKSlcblx0XHRcdH1cblx0XHRcdGNvbnNvbGUuZGVidWcoYFNldHRpbmcgSURNVV9CQVRDSF9TSVpFIHRvICR7YmF0Y2hTaXplfWApXG5cdFx0fSBjYXRjaChleCkge1xuXHRcdFx0Y29uc29sZS5lcnJvcihleClcblx0XHR9XG5cdH0pXG5cdHdpbmRvdy5kb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHVpRWxlbWVudClcblx0cmV0dXJuIHsgdWlFbGVtZW50LCB1bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbiwgbG9hZFRocmVhZE1lc3NhZ2VzQnV0dG9uIH1cbn1cblxuLyoqXG4gKlxuICogQHBhcmFtICAge0RvY3VtZW50fSAgICAgICAgICBkb2N1bWVudFxuICogQHJldHVybnMge29iamVjdH1cbiAqIEByZXR1cm5zIHtIVE1MRGl2RWxlbWVudH0gICAgb2JqZWN0LnVpRWxlbWVudFxuICogQHJldHVybnMge0hUTUxEaXZFbGVtZW50fSAgICBvYmplY3Qub3ZlcmxheUVsZW1lbnRcbiAqIEByZXR1cm5zIHtIVE1MRGl2RWxlbWVudH0gICAgb2JqZWN0Lm1lbnVFbGVtZW50XG4gKiBAcmV0dXJucyB7SFRNTEJ1dHRvbkVsZW1lbnR9IG9iamVjdC51bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvblxuICogQHJldHVybnMge0hUTUxCdXR0b25FbGVtZW50fSBvYmplY3QubG9hZFRocmVhZE1lc3NhZ2VzQnV0dG9uXG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZVVJRWxlbWVudChkb2N1bWVudCkge1xuXHRjb25zdCB1aUVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpXG5cdGNvbnN0IG1lbnVFbGVtZW50ID0gY3JlYXRlTWVudUVsZW1lbnQoZG9jdW1lbnQpXG5cdGNvbnN0IG92ZXJsYXlFbGVtZW50ID0gY3JlYXRlT3ZlcmxheUVsZW1lbnQoZG9jdW1lbnQpXG5cdGNvbnN0IGFsZXJ0c1dyYXBwZXJFbGVtZW50ID0gY3JlYXRlQWxlcnRzV3JhcHBlckVsZW1lbnQoZG9jdW1lbnQpXG5cdGNvbnN0IHVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uID0gY3JlYXRlTWVudUJ1dHRvbkVsZW1lbnQoZG9jdW1lbnQsIFwiVW5zZW5kIGFsbCBETXNcIilcblx0Y29uc3QgbG9hZFRocmVhZE1lc3NhZ2VzQnV0dG9uID0gY3JlYXRlTWVudUJ1dHRvbkVsZW1lbnQoZG9jdW1lbnQsIFwiQmF0Y2ggc2l6ZVwiLCBcInNlY29uZGFyeVwiKVxuXHRkb2N1bWVudC5ib2R5LnByZXBlbmQob3ZlcmxheUVsZW1lbnQpXG5cdGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoYWxlcnRzV3JhcHBlckVsZW1lbnQpXG5cdG1lbnVFbGVtZW50LmFwcGVuZENoaWxkKHVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uKVxuXHRtZW51RWxlbWVudC5hcHBlbmRDaGlsZChsb2FkVGhyZWFkTWVzc2FnZXNCdXR0b24pXG5cdHVpRWxlbWVudC5hcHBlbmRDaGlsZChtZW51RWxlbWVudClcblx0cmV0dXJuIHsgdWlFbGVtZW50LCBvdmVybGF5RWxlbWVudCwgbWVudUVsZW1lbnQsIHVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uLCBsb2FkVGhyZWFkTWVzc2FnZXNCdXR0b24gfVxufVxuIiwiaW1wb3J0IHsgcmVuZGVyIH0gZnJvbSBcIi4vdWkvdWkuanNcIlxuXG5pZighd2luZG93LklETVVfREVCVUcpIHtcblx0Y29uc29sZS5kZWJ1ZyA9ICgpID0+IHt9XG59XG5cbnJlbmRlcih3aW5kb3cpXG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Q0FBQSxNQUFNLFlBQVksR0FBRztDQUNyQixDQUFDLFNBQVMsRUFBRSxTQUFTO0NBQ3JCLENBQUMsV0FBVyxFQUFFLFdBQVc7Q0FDekIsRUFBQztBQUNEO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNPLFNBQVMsZ0JBQWdCLENBQUMsYUFBYSxFQUFFLFNBQVMsQ0FBQyxZQUFZLENBQUMsT0FBTyxFQUFFO0NBQ2hGLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxRQUFRLEdBQUcsNkJBQTRCO0NBQzVELENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxLQUFLLEdBQUcsUUFBTztDQUNwQyxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLE1BQUs7Q0FDbkMsQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLFlBQVksR0FBRyxNQUFLO0NBQ3pDLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxPQUFPLEdB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
