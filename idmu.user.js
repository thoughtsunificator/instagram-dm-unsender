
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
// @version				0.5.7
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
		buttonElement.addEventListener("mouseover", () => {
			buttonElement.style.filter = `brightness(1.15)`;
		});
		buttonElement.addEventListener("mouseout", () => {
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
	function waitForElement(target, getElement) {
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
		waitForElement(target, getElement) {
			return getElement() || waitForElement(target, getElement)
		}

		/**
		 *
		 * @param {Element} clickTarget
		 * @param {Element} target
		 * @param {function} getElement
		 * @returns {Promise<Element>}
		 */
		clickElementAndWaitFor(clickTarget, target, getElement) {
			return clickElementAndWaitFor(clickTarget, target, getElement)
		}

	}

	/**
	 *
	 * @param {Element} root
	 * @returns {Promise<boolean>}
	 */
	async function loadMoreMessageStrategy(root) {
		console.debug("loadMoreMessageStrategy");
		root.scrollTop = 0;
		let findLoaderTimeout;
		const loadingElement = await Promise.race([
			waitForElement(root, () => root.ownerDocument.body.querySelector(`[role="progressbar"]`)),
			new Promise(resolve => {
				findLoaderTimeout = setTimeout(resolve, 500);
			})
		]);
		clearTimeout(findLoaderTimeout);
		if(loadingElement) {
			console.debug("Found loader; waiting for messages mutations");
			console.debug("scrollTop", root.scrollTop);
			const hasReachedLastPage = await waitForElement(root, () => root.scrollTop !== 0);
			console.debug("hasReachedLastPage", hasReachedLastPage);
			console.debug("scrollTop", root.scrollTop);
			return root.scrollTop === 0
		} else {
			console.debug("Could not find loader");
			return true
		}
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
		fetchAndRenderThreadNextMessagePage() {
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
			element.querySelector("[aria-label=More][aria-expanded=true]")?.click();
			element.querySelector(`[aria-label="Close details and actions"]`)?.click();
			element.dispatchEvent(new MouseEvent("mouseout", { bubbles: true }));
			const uiMessage = new UIMessage(element);
			let timeout;
			const actionButton = await Promise.race([
				uiMessage.showActionsMenuButton(),
				new Promise(resolve => {
					timeout = setTimeout(resolve, 20);
				})
			]);
			clearTimeout(timeout);
			if(actionButton) {
				const actionsMenuElement = await uiMessage.openActionsMenu(actionButton);
				await uiMessage.closeActionsMenu(actionButton, actionsMenuElement);
				await uiMessage.hideActionMenuButton();
				return actionsMenuElement && actionsMenuElement.textContent.toLocaleLowerCase() === "unsend"
			}
			return false
		}

		scrollIntoView() {
			this.root.scrollIntoView();
		}

		/**
		 *
		 * @returns {Promise<HTMLButtonElement>}
		 */
		showActionsMenuButton() {
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
			const actionMenuElement = await this.clickElementAndWaitFor(
				actionButton,
				this.root.ownerDocument.body,
				() => {
					const menuElements = [...this.root.ownerDocument.querySelectorAll("[role=menu] [role=menuitem]")];
					menuElements.sort(node => node.textContent.toLocaleLowerCase() === "unsend" ? -1 : 0); // TODO i18n
					return menuElements.shift()
				},
			)
			;[...actionMenuElement.parentNode.parentNode.querySelectorAll("[role=menuitem]")].forEach(element => {
				if(element !== actionMenuElement) {
					element.remove();
				}
			});
			return actionMenuElement

		}

		/**
		 *
		 * @param {HTMLButtonElement} actionButton
		 * @param {HTMLDivElement} actionsMenuElement
		 * @returns {Promise<boolean>}
		 */
		closeActionsMenu(actionButton, actionsMenuElement) {
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
		fetchAndRenderThreadNextMessagePage() {
			console.debug("UIPI fetchAndRenderThreadNextMessagePage");
			return this.uiComponent.fetchAndRenderThreadNextMessagePage()
		}

		/**
		 *
		 * @returns {Promise<UIPIMessage[]>}
		 */
		createUIPIMessages() {
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
		createUIPIMessages() {
			return this.#getUIPI().createUIPIMessages()
		}


		/**
		 *
		 * @returns {Promise}
		 */
		fetchAndRenderThreadNextMessagePage() {
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
		run(batchSize) {
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
		overlayElement.tabIndex = 0;
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
				button.style.visibility = "";
				button.disabled = false;
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
				button.style.visibility = "hidden";
				button.disabled = true;

			});
			overlayElement.style.display = "";
			overlayElement.focus();
			console.debug("User asked to start messages unsending; UI i1nteraction will be disabled");
			unsendThreadMessagesButton.textContent = "Stop processing";
			unsendThreadMessagesButton.style.backgroundColor = "#FA383E";
			const batchSize = window.localStorage.getItem("IDMU_BATCH_SIZE") || UnsendThreadMessagesBatchStrategy.DEFAULT_BATCH_SIZE;
			await strategy.run(batchSize);
			onUnsendingFinished();
		}
		function handleEvents(event) {
			if(strategy.isRunning()) {
				console.info("User interaction is disabled as the strategy is still running; Please stop the execution first.");
				event.stopImmediatePropagation();
				event.preventDefault();
				event.stopPropagation();
				overlayElement.focus();
				return false
			}
		}
		function onMutations() {
			if(window.location.pathname.startsWith("/direct/t/")) {
				uiElement.style.display = "";
			} else {
				uiElement.style.display = "none";
				strategy.stop();
			}
		}
		window.document.addEventListener("keydown", handleEvents);
		window.document.addEventListener("keyup", handleEvents);
		new MutationObserver(onMutations).observe(window.document.body, { childList: true });
		new MutationObserver(onMutations).observe(window.document.querySelector("[id^=mount] > div > div > div"), { childList: true, attributes: true });
		unsendThreadMessagesButton.dataTextContent = unsendThreadMessagesButton.textContent;
		unsendThreadMessagesButton.dataBackgroundColor = unsendThreadMessagesButton.style.backgroundColor;
		unsendThreadMessagesButton.addEventListener("click", () => {
			if(strategy.isRunning()) {
				console.debug("User asked to stop messages unsending");
				strategy.stop();
				onUnsendingFinished();
			} else {
				startUnsending();
			}
		});
		loadThreadMessagesButton.addEventListener("click", () => {
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaWRtdS51c2VyLmpzIiwic291cmNlcyI6WyIuLi9zcmMvcnVudGltZS91c2Vyc2NyaXB0L3VpL3N0eWxlL2luc3RhZ3JhbS5qcyIsIi4uL3NyYy9ydW50aW1lL3VzZXJzY3JpcHQvdWkvbWVudS1idXR0b24uanMiLCIuLi9zcmMvcnVudGltZS91c2Vyc2NyaXB0L3VpL21lbnUuanMiLCIuLi9zcmMvdWlwaS91aXBpLWNvbXBvbmVudC5qcyIsIi4uL3NyYy9kb20vYXN5bmMtZXZlbnRzLmpzIiwiLi4vc3JjL3VpL3VpLWNvbXBvbmVudC5qcyIsIi4uL3NyYy91aS9zdHJhdGVneS9sb2FkLW1vcmUtbWVzc2FnZXMtc3RyYXRlZ3kuanMiLCIuLi9zcmMvdWkvdWktbWVzc2FnZXMtd3JhcHBlci5qcyIsIi4uL3NyYy91aS9zdHJhdGVneS9maW5kLW1lc3NhZ2VzLXdyYXBwZXItc3RyYXRlZ3kuanMiLCIuLi9zcmMvdWkvdWktbWVzc2FnZS5qcyIsIi4uL3NyYy91aS9zdHJhdGVneS9maW5kLW1lc3NhZ2VzLXN0cmF0ZWd5LmpzIiwiLi4vc3JjL3VpcGkvdWlwaS1tZXNzYWdlLmpzIiwiLi4vc3JjL3VpL3VpLmpzIiwiLi4vc3JjL3VpcGkvdWlwaS5qcyIsIi4uL3NyYy9pZG11L2lkbXUuanMiLCIuLi9zcmMvcnVudGltZS91c2Vyc2NyaXB0L3N0cmF0ZWd5LmpzIiwiLi4vc3JjL3J1bnRpbWUvdXNlcnNjcmlwdC91aS9hbGVydC5qcyIsIi4uL3NyYy9ydW50aW1lL3VzZXJzY3JpcHQvdWkvb3ZlcmxheS5qcyIsIi4uL3NyYy9ydW50aW1lL3VzZXJzY3JpcHQvdWkvdWkuanMiLCIuLi9zcmMvcnVudGltZS91c2Vyc2NyaXB0L21haW4uanMiXSwic291cmNlc0NvbnRlbnQiOlsiY29uc3QgQlVUVE9OX1NUWUxFID0ge1xuXHRcIlBSSU1BUllcIjogXCJwcmltYXJ5XCIsXG5cdFwiU0VDT05EQVJZXCI6IFwic2Vjb25kYXJ5XCIsXG59XG5cbi8qKlxuICpcbiAqIEBwYXJhbSB7SFRNTEJ1dHRvbkVsZW1lbnR9IGJ1dHRvbkVsZW1lbnRcbiAqIEBwYXJhbSB7c3RyaW5nfSAgICAgICAgICAgIHN0eWxlTmFtZVxuICovXG5leHBvcnQgZnVuY3Rpb24gYXBwbHlCdXR0b25TdHlsZShidXR0b25FbGVtZW50LCBzdHlsZU5hbWU9QlVUVE9OX1NUWUxFLlBSSU1BUlkpIHtcblx0YnV0dG9uRWxlbWVudC5zdHlsZS5mb250U2l6ZSA9IFwidmFyKC0tc3lzdGVtLTE0LWZvbnQtc2l6ZSlcIlxuXHRidXR0b25FbGVtZW50LnN0eWxlLmNvbG9yID0gXCJ3aGl0ZVwiXG5cdGJ1dHRvbkVsZW1lbnQuc3R5bGUuYm9yZGVyID0gXCIwcHhcIlxuXHRidXR0b25FbGVtZW50LnN0eWxlLmJvcmRlclJhZGl1cyA9IFwiOHB4XCJcblx0YnV0dG9uRWxlbWVudC5zdHlsZS5wYWRkaW5nID0gXCI4cHhcIlxuXHRidXR0b25FbGVtZW50LnN0eWxlLmZvbnRXZWlnaHQgPSBcImJvbGRcIlxuXHRidXR0b25FbGVtZW50LnN0eWxlLmN1cnNvciA9IFwicG9pbnRlclwiXG5cdGJ1dHRvbkVsZW1lbnQuc3R5bGUubGluZUhlaWdodCA9IFwidmFyKC0tc3lzdGVtLTE0LWxpbmUtaGVpZ2h0KVwiXG5cdGJ1dHRvbkVsZW1lbnQuc3R5bGUuYmFja2dyb3VuZENvbG9yID0gYHJnYih2YXIoLS1pZy0ke3N0eWxlTmFtZX0tYnV0dG9uKSlgXG59XG4iLCJpbXBvcnQgeyBhcHBseUJ1dHRvblN0eWxlIH0gZnJvbSBcIi4vc3R5bGUvaW5zdGFncmFtLmpzXCJcblxuLyoqXG4gKlxuICogQHBhcmFtIHtEb2N1bWVudH0gZG9jdW1lbnRcbiAqIEBwYXJhbSB7c3RyaW5nfSAgIHRleHRcbiAqIEBwYXJhbSB7c3RyaW5nfSAgIHN0eWxlTmFtZVxuICogQHJldHVybnMge0hUTUxCdXR0b25FbGVtZW50fVxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlTWVudUJ1dHRvbkVsZW1lbnQoZG9jdW1lbnQsIHRleHQsIHN0eWxlTmFtZSkge1xuXHRjb25zdCBidXR0b25FbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImJ1dHRvblwiKVxuXHRidXR0b25FbGVtZW50LnRleHRDb250ZW50ID0gdGV4dFxuXHRhcHBseUJ1dHRvblN0eWxlKGJ1dHRvbkVsZW1lbnQsIHN0eWxlTmFtZSlcblx0YnV0dG9uRWxlbWVudC5hZGRFdmVudExpc3RlbmVyKFwibW91c2VvdmVyXCIsICgpID0+IHtcblx0XHRidXR0b25FbGVtZW50LnN0eWxlLmZpbHRlciA9IGBicmlnaHRuZXNzKDEuMTUpYFxuXHR9KVxuXHRidXR0b25FbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJtb3VzZW91dFwiLCAoKSA9PiB7XG5cdFx0YnV0dG9uRWxlbWVudC5zdHlsZS5maWx0ZXIgPSBgYFxuXHR9KVxuXHRyZXR1cm4gYnV0dG9uRWxlbWVudFxufVxuIiwiLyoqXG4gKiBAcGFyYW0ge0RvY3VtZW50fSBkb2N1bWVudFxuICogQHJldHVybnMge0hUTUxCdXR0b25FbGVtZW50fVxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlTWVudUVsZW1lbnQoZG9jdW1lbnQpIHtcblx0Y29uc3QgbWVudUVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpXG5cdG1lbnVFbGVtZW50LnN0eWxlLnRvcCA9IFwiMjBweFwiXG5cdG1lbnVFbGVtZW50LnN0eWxlLnJpZ2h0ID0gXCI0MzBweFwiXG5cdG1lbnVFbGVtZW50LnN0eWxlLnBvc2l0aW9uID0gXCJmaXhlZFwiXG5cdG1lbnVFbGVtZW50LnN0eWxlLnpJbmRleCA9IDk5OVxuXHRtZW51RWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gXCJmbGV4XCJcblx0bWVudUVsZW1lbnQuc3R5bGUuZ2FwID0gXCIxMHB4XCJcblx0cmV0dXJuIG1lbnVFbGVtZW50XG59XG4iLCJleHBvcnQgZGVmYXVsdCBjbGFzcyBVSVBJQ29tcG9uZW50IHtcblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7VUlDb21wb25lbnR9IHVpQ29tcG9uZW50XG5cdCAqL1xuXHRjb25zdHJ1Y3Rvcih1aUNvbXBvbmVudCkge1xuXHRcdHRoaXMuX3VpQ29tcG9uZW50ID0gdWlDb21wb25lbnRcblx0fVxuXG5cdC8qKlxuXHQgKiBAcmVhZG9ubHlcblx0ICogQHR5cGUge1VJQ29tcG9uZW50fVxuXHQgKi9cblx0Z2V0IHVpQ29tcG9uZW50KCkge1xuXHRcdHJldHVybiB0aGlzLl91aUNvbXBvbmVudFxuXHR9XG59XG4iLCIvKipcbiAqXG4gKiBAY2FsbGJhY2sgZ2V0RWxlbWVudFxuICogQHJldHVybnMge0VsZW1lbnR9XG4gKi9cblxuLyoqXG4gKlxuICogQHBhcmFtIHtFbGVtZW50fSB0YXJnZXRcbiAqIEBwYXJhbSB7Z2V0RWxlbWVudH0gZ2V0RWxlbWVudFxuICogQHJldHVybnMge1Byb21pc2U8RWxlbWVudD59XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB3YWl0Rm9yRWxlbWVudCh0YXJnZXQsIGdldEVsZW1lbnQpIHtcblx0cmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG5cdFx0bGV0IGVsZW1lbnQgPSBnZXRFbGVtZW50KClcblx0XHRpZihlbGVtZW50KSB7XG5cdFx0XHRyZXNvbHZlKGVsZW1lbnQpXG5cdFx0fSBlbHNlIHtcblx0XHRcdG5ldyBNdXRhdGlvbk9ic2VydmVyKChtdXRhdGlvbnMsIG9ic2VydmVyKSA9PiB7XG5cdFx0XHRcdGVsZW1lbnQgPSBnZXRFbGVtZW50KClcblx0XHRcdFx0aWYoZWxlbWVudCkge1xuXHRcdFx0XHRcdG9ic2VydmVyLmRpc2Nvbm5lY3QoKVxuXHRcdFx0XHRcdHJlc29sdmUoZWxlbWVudClcblx0XHRcdFx0fVxuXHRcdFx0fSkub2JzZXJ2ZSh0YXJnZXQsIHsgc3VidHJlZTogdHJ1ZSwgY2hpbGRMaXN0OnRydWUgfSlcblx0XHR9XG5cdH0pXG59XG5cbi8qKlxuICpcbiAqIEBwYXJhbSB7RWxlbWVudH0gY2xpY2tUYXJnZXRcbiAqIEBwYXJhbSB7RWxlbWVudH0gdGFyZ2V0XG4gKiBAcGFyYW0ge2dldEVsZW1lbnR9IGdldEVsZW1lbnRcbiAqIEByZXR1cm5zIHtFbGVtZW50fFByb21pc2U8RWxlbWVudD59XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjbGlja0VsZW1lbnRBbmRXYWl0Rm9yKGNsaWNrVGFyZ2V0LCB0YXJnZXQsIGdldEVsZW1lbnQpIHtcblx0Y29uc3QgcHJvbWlzZSA9IHdhaXRGb3JFbGVtZW50KHRhcmdldCwgZ2V0RWxlbWVudClcblx0Y2xpY2tUYXJnZXQuY2xpY2soKVxuXHRyZXR1cm4gZ2V0RWxlbWVudCgpIHx8IHByb21pc2Vcbn1cbiIsImltcG9ydCB7IHdhaXRGb3JFbGVtZW50LCBjbGlja0VsZW1lbnRBbmRXYWl0Rm9yIH0gZnJvbSBcIi4uL2RvbS9hc3luYy1ldmVudHMuanNcIlxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBVSUNvbXBvbmVudCB7XG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge0VsZW1lbnR9IHJvb3Rcblx0ICogQHBhcmFtIHtvYmplY3R9IGlkZW50aWZpZXJcblx0ICovXG5cdGNvbnN0cnVjdG9yKHJvb3QsIGlkZW50aWZpZXI9e30pIHtcblx0XHR0aGlzLnJvb3QgPSByb290XG5cdFx0dGhpcy5pZGVudGlmaWVyID0gaWRlbnRpZmllclxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7RWxlbWVudH0gdGFyZ2V0XG5cdCAqIEBwYXJhbSB7ZnVuY3Rpb259IGdldEVsZW1lbnRcblx0ICogQHJldHVybnMge1Byb21pc2U8RWxlbWVudD59XG5cdCAqL1xuXHR3YWl0Rm9yRWxlbWVudCh0YXJnZXQsIGdldEVsZW1lbnQpIHtcblx0XHRyZXR1cm4gZ2V0RWxlbWVudCgpIHx8IHdhaXRGb3JFbGVtZW50KHRhcmdldCwgZ2V0RWxlbWVudClcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge0VsZW1lbnR9IGNsaWNrVGFyZ2V0XG5cdCAqIEBwYXJhbSB7RWxlbWVudH0gdGFyZ2V0XG5cdCAqIEBwYXJhbSB7ZnVuY3Rpb259IGdldEVsZW1lbnRcblx0ICogQHJldHVybnMge1Byb21pc2U8RWxlbWVudD59XG5cdCAqL1xuXHRjbGlja0VsZW1lbnRBbmRXYWl0Rm9yKGNsaWNrVGFyZ2V0LCB0YXJnZXQsIGdldEVsZW1lbnQpIHtcblx0XHRyZXR1cm4gY2xpY2tFbGVtZW50QW5kV2FpdEZvcihjbGlja1RhcmdldCwgdGFyZ2V0LCBnZXRFbGVtZW50KVxuXHR9XG5cbn1cbiIsImltcG9ydCB7IHdhaXRGb3JFbGVtZW50IH0gZnJvbSBcIi4uLy4uL2RvbS9hc3luYy1ldmVudHMuanNcIlxuXG4vKipcbiAqXG4gKiBAcGFyYW0ge0VsZW1lbnR9IHJvb3RcbiAqIEByZXR1cm5zIHtQcm9taXNlPGJvb2xlYW4+fVxuICovXG5leHBvcnQgZGVmYXVsdCBhc3luYyBmdW5jdGlvbiBsb2FkTW9yZU1lc3NhZ2VTdHJhdGVneShyb290KSB7XG5cdGNvbnNvbGUuZGVidWcoXCJsb2FkTW9yZU1lc3NhZ2VTdHJhdGVneVwiKVxuXHRyb290LnNjcm9sbFRvcCA9IDBcblx0bGV0IGZpbmRMb2FkZXJUaW1lb3V0XG5cdGNvbnN0IGxvYWRpbmdFbGVtZW50ID0gYXdhaXQgUHJvbWlzZS5yYWNlKFtcblx0XHR3YWl0Rm9yRWxlbWVudChyb290LCAoKSA9PiByb290Lm93bmVyRG9jdW1lbnQuYm9keS5xdWVyeVNlbGVjdG9yKGBbcm9sZT1cInByb2dyZXNzYmFyXCJdYCkpLFxuXHRcdG5ldyBQcm9taXNlKHJlc29sdmUgPT4ge1xuXHRcdFx0ZmluZExvYWRlclRpbWVvdXQgPSBzZXRUaW1lb3V0KHJlc29sdmUsIDUwMClcblx0XHR9KVxuXHRdKVxuXHRjbGVhclRpbWVvdXQoZmluZExvYWRlclRpbWVvdXQpXG5cdGlmKGxvYWRpbmdFbGVtZW50KSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIkZvdW5kIGxvYWRlcjsgd2FpdGluZyBmb3IgbWVzc2FnZXMgbXV0YXRpb25zXCIpXG5cdFx0Y29uc29sZS5kZWJ1ZyhcInNjcm9sbFRvcFwiLCByb290LnNjcm9sbFRvcClcblx0XHRjb25zdCBoYXNSZWFjaGVkTGFzdFBhZ2UgPSBhd2FpdCB3YWl0Rm9yRWxlbWVudChyb290LCAoKSA9PiByb290LnNjcm9sbFRvcCAhPT0gMClcblx0XHRjb25zb2xlLmRlYnVnKFwiaGFzUmVhY2hlZExhc3RQYWdlXCIsIGhhc1JlYWNoZWRMYXN0UGFnZSlcblx0XHRjb25zb2xlLmRlYnVnKFwic2Nyb2xsVG9wXCIsIHJvb3Quc2Nyb2xsVG9wKVxuXHRcdHJldHVybiByb290LnNjcm9sbFRvcCA9PT0gMFxuXHR9IGVsc2Uge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJDb3VsZCBub3QgZmluZCBsb2FkZXJcIilcblx0XHRyZXR1cm4gdHJ1ZVxuXHR9XG59XG4iLCJpbXBvcnQgVUlDb21wb25lbnQgZnJvbSBcIi4vdWktY29tcG9uZW50LmpzXCJcbmltcG9ydCBsb2FkTW9yZU1lc3NhZ2VTdHJhdGVneSBmcm9tIFwiLi9zdHJhdGVneS9sb2FkLW1vcmUtbWVzc2FnZXMtc3RyYXRlZ3kuanNcIlxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBVSU1lc3NhZ2VzV3JhcHBlciBleHRlbmRzIFVJQ29tcG9uZW50IHtcblxuXHQvKipcblx0ICogQHBhcmFtIHtXaW5kb3d9XG5cdCAqIEByZXR1cm5zIHtFbGVtZW50fVxuXHQgKi9cblx0c3RhdGljIGZpbmQod2luZG93KSB7XG5cdFx0cmV0dXJuIHdpbmRvdy5kb2N1bWVudC5xdWVyeVNlbGVjdG9yKFwiZGl2W3JvbGU9Z3JpZF0gPiBkaXYgPiBkaXYgPiBkaXYgPiBkaXZcIilcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZT59XG5cdCAqL1xuXHRmZXRjaEFuZFJlbmRlclRocmVhZE5leHRNZXNzYWdlUGFnZSgpIHtcblx0XHRyZXR1cm4gbG9hZE1vcmVNZXNzYWdlU3RyYXRlZ3kodGhpcy5yb290KVxuXHR9XG5cbn1cbiIsImltcG9ydCBVSU1lc3NhZ2VzV3JhcHBlciBmcm9tIFwiLi4vdWktbWVzc2FnZXMtd3JhcHBlci5qc1wiXG5cbi8qKlxuICpcbiAqIEBwYXJhbSB7V2luZG93fSB3aW5kb3dcbiAqIEByZXR1cm5zIHtFbGVtZW50fVxuICovXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBmaW5kTWVzc2FnZXNXcmFwcGVyU3RyYXRlZ3kod2luZG93KSB7XG5cdHJldHVybiBVSU1lc3NhZ2VzV3JhcHBlci5maW5kKHdpbmRvdylcbn1cbiIsImltcG9ydCBVSUNvbXBvbmVudCBmcm9tIFwiLi91aS1jb21wb25lbnQuanNcIlxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBVSU1lc3NhZ2UgZXh0ZW5kcyBVSUNvbXBvbmVudCB7XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7SFRNTERpdkVsZW1lbnR9IGVsZW1lbnRcblx0ICogQHJldHVybnMge1Byb21pc2U8Ym9vbGVhbj59XG5cdCAqL1xuXHRzdGF0aWMgYXN5bmMgaXNNeU93bk1lc3NhZ2UoZWxlbWVudCkge1xuXHRcdGVsZW1lbnQucXVlcnlTZWxlY3RvcihcIlthcmlhLWxhYmVsPU1vcmVdW2FyaWEtZXhwYW5kZWQ9dHJ1ZV1cIik/LmNsaWNrKClcblx0XHRlbGVtZW50LnF1ZXJ5U2VsZWN0b3IoYFthcmlhLWxhYmVsPVwiQ2xvc2UgZGV0YWlscyBhbmQgYWN0aW9uc1wiXWApPy5jbGljaygpXG5cdFx0ZWxlbWVudC5kaXNwYXRjaEV2ZW50KG5ldyBNb3VzZUV2ZW50KFwibW91c2VvdXRcIiwgeyBidWJibGVzOiB0cnVlIH0pKVxuXHRcdGNvbnN0IHVpTWVzc2FnZSA9IG5ldyBVSU1lc3NhZ2UoZWxlbWVudClcblx0XHRsZXQgdGltZW91dFxuXHRcdGNvbnN0IGFjdGlvbkJ1dHRvbiA9IGF3YWl0IFByb21pc2UucmFjZShbXG5cdFx0XHR1aU1lc3NhZ2Uuc2hvd0FjdGlvbnNNZW51QnV0dG9uKCksXG5cdFx0XHRuZXcgUHJvbWlzZShyZXNvbHZlID0+IHtcblx0XHRcdFx0dGltZW91dCA9IHNldFRpbWVvdXQocmVzb2x2ZSwgMjApXG5cdFx0XHR9KVxuXHRcdF0pXG5cdFx0Y2xlYXJUaW1lb3V0KHRpbWVvdXQpXG5cdFx0aWYoYWN0aW9uQnV0dG9uKSB7XG5cdFx0XHRjb25zdCBhY3Rpb25zTWVudUVsZW1lbnQgPSBhd2FpdCB1aU1lc3NhZ2Uub3BlbkFjdGlvbnNNZW51KGFjdGlvbkJ1dHRvbilcblx0XHRcdGF3YWl0IHVpTWVzc2FnZS5jbG9zZUFjdGlvbnNNZW51KGFjdGlvbkJ1dHRvbiwgYWN0aW9uc01lbnVFbGVtZW50KVxuXHRcdFx0YXdhaXQgdWlNZXNzYWdlLmhpZGVBY3Rpb25NZW51QnV0dG9uKClcblx0XHRcdHJldHVybiBhY3Rpb25zTWVudUVsZW1lbnQgJiYgYWN0aW9uc01lbnVFbGVtZW50LnRleHRDb250ZW50LnRvTG9jYWxlTG93ZXJDYXNlKCkgPT09IFwidW5zZW5kXCJcblx0XHR9XG5cdFx0cmV0dXJuIGZhbHNlXG5cdH1cblxuXHRzY3JvbGxJbnRvVmlldygpIHtcblx0XHR0aGlzLnJvb3Quc2Nyb2xsSW50b1ZpZXcoKVxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlPEhUTUxCdXR0b25FbGVtZW50Pn1cblx0ICovXG5cdHNob3dBY3Rpb25zTWVudUJ1dHRvbigpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwiV29ya2Zsb3cgc3RlcCAxIDogc2hvd0FjdGlvbnNNZW51QnV0dG9uXCIpXG5cdFx0dGhpcy5yb290LmRpc3BhdGNoRXZlbnQobmV3IE1vdXNlRXZlbnQoXCJtb3VzZW1vdmVcIiwgeyBidWJibGVzOiB0cnVlIH0pKVxuXHRcdHRoaXMucm9vdC5kaXNwYXRjaEV2ZW50KG5ldyBNb3VzZUV2ZW50KFwibW91c2VvdmVyXCIsIHsgYnViYmxlczogdHJ1ZSB9KSlcblx0XHR0aGlzLnJvb3QuZGlzcGF0Y2hFdmVudChuZXcgTW91c2VFdmVudChcIm1vdXNlbnRlclwiLCB7IGJ1YmJsZXM6IHRydWUgfSkpXG5cdFx0cmV0dXJuIHRoaXMud2FpdEZvckVsZW1lbnQodGhpcy5yb290LCAoKSA9PiB0aGlzLnJvb3QucXVlcnlTZWxlY3RvcihcIlthcmlhLWxhYmVsPU1vcmVdXCIpKSAvLyBUT0RPIGkxOG5cblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZTxib29sZWFuPn1cblx0ICovXG5cdGhpZGVBY3Rpb25NZW51QnV0dG9uKCkge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJoaWRlQWN0aW9uTWVudUJ1dHRvblwiKVxuXHRcdHRoaXMucm9vdC5kaXNwYXRjaEV2ZW50KG5ldyBNb3VzZUV2ZW50KFwibW91c2Vtb3ZlXCIsIHsgYnViYmxlczogdHJ1ZSB9KSlcblx0XHR0aGlzLnJvb3QuZGlzcGF0Y2hFdmVudChuZXcgTW91c2VFdmVudChcIm1vdXNlb3V0XCIsIHsgYnViYmxlczogdHJ1ZSB9KSlcblx0XHR0aGlzLnJvb3QuZGlzcGF0Y2hFdmVudChuZXcgTW91c2VFdmVudChcIm1vdXNlbGVhdmVcIiwgeyBidWJibGVzOiB0cnVlIH0pKVxuXHRcdHJldHVybiB0aGlzLndhaXRGb3JFbGVtZW50KHRoaXMucm9vdCwgKCkgPT4gdGhpcy5yb290LnF1ZXJ5U2VsZWN0b3IoXCJbYXJpYS1sYWJlbD1Nb3JlXVwiKSA9PT0gbnVsbCkgLy8gVE9ETyBpMThuXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHtIVE1MQnV0dG9uRWxlbWVudH0gYWN0aW9uQnV0dG9uXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlfVxuXHQgKi9cblx0YXN5bmMgb3BlbkFjdGlvbnNNZW51KGFjdGlvbkJ1dHRvbikge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJXb3JrZmxvdyBzdGVwIDIgOiBvcGVuQWN0aW9uc01lbnVcIiwgYWN0aW9uQnV0dG9uKVxuXHRcdGNvbnN0IGFjdGlvbk1lbnVFbGVtZW50ID0gYXdhaXQgdGhpcy5jbGlja0VsZW1lbnRBbmRXYWl0Rm9yKFxuXHRcdFx0YWN0aW9uQnV0dG9uLFxuXHRcdFx0dGhpcy5yb290Lm93bmVyRG9jdW1lbnQuYm9keSxcblx0XHRcdCgpID0+IHtcblx0XHRcdFx0Y29uc3QgbWVudUVsZW1lbnRzID0gWy4uLnRoaXMucm9vdC5vd25lckRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoXCJbcm9sZT1tZW51XSBbcm9sZT1tZW51aXRlbV1cIildXG5cdFx0XHRcdG1lbnVFbGVtZW50cy5zb3J0KG5vZGUgPT4gbm9kZS50ZXh0Q29udGVudC50b0xvY2FsZUxvd2VyQ2FzZSgpID09PSBcInVuc2VuZFwiID8gLTEgOiAwKSAvLyBUT0RPIGkxOG5cblx0XHRcdFx0cmV0dXJuIG1lbnVFbGVtZW50cy5zaGlmdCgpXG5cdFx0XHR9LFxuXHRcdClcblx0XHQ7Wy4uLmFjdGlvbk1lbnVFbGVtZW50LnBhcmVudE5vZGUucGFyZW50Tm9kZS5xdWVyeVNlbGVjdG9yQWxsKFwiW3JvbGU9bWVudWl0ZW1dXCIpXS5mb3JFYWNoKGVsZW1lbnQgPT4ge1xuXHRcdFx0aWYoZWxlbWVudCAhPT0gYWN0aW9uTWVudUVsZW1lbnQpIHtcblx0XHRcdFx0ZWxlbWVudC5yZW1vdmUoKVxuXHRcdFx0fVxuXHRcdH0pXG5cdFx0cmV0dXJuIGFjdGlvbk1lbnVFbGVtZW50XG5cblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge0hUTUxCdXR0b25FbGVtZW50fSBhY3Rpb25CdXR0b25cblx0ICogQHBhcmFtIHtIVE1MRGl2RWxlbWVudH0gYWN0aW9uc01lbnVFbGVtZW50XG5cdCAqIEByZXR1cm5zIHtQcm9taXNlPGJvb2xlYW4+fVxuXHQgKi9cblx0Y2xvc2VBY3Rpb25zTWVudShhY3Rpb25CdXR0b24sIGFjdGlvbnNNZW51RWxlbWVudCkge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJjbG9zZUFjdGlvbnNNZW51XCIpXG5cdFx0cmV0dXJuIHRoaXMuY2xpY2tFbGVtZW50QW5kV2FpdEZvcihcblx0XHRcdGFjdGlvbkJ1dHRvbixcblx0XHRcdHRoaXMucm9vdC5vd25lckRvY3VtZW50LmJvZHksXG5cdFx0XHQoKSA9PiB0aGlzLnJvb3Qub3duZXJEb2N1bWVudC5ib2R5LmNvbnRhaW5zKGFjdGlvbnNNZW51RWxlbWVudCkgPT09IGZhbHNlLFxuXHRcdClcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZTxIVE1MQnV0dG9uRWxlbWVudD58UHJvbWlzZTxFcnJvcj59XG5cdCAqL1xuXHRhc3luYyBvcGVuQ29uZmlybVVuc2VuZE1vZGFsKCkge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJXb3JrZmxvdyBzdGVwIDMgOiBvcGVuQ29uZmlybVVuc2VuZE1vZGFsXCIpXG5cdFx0Y29uc3QgdW5TZW5kQnV0dG9uID0gYXdhaXQgdGhpcy53YWl0Rm9yRWxlbWVudChcblx0XHRcdHRoaXMucm9vdC5vd25lckRvY3VtZW50LmJvZHksXG5cdFx0XHQoKSA9PiBbLi4udGhpcy5yb290Lm93bmVyRG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChcIltyb2xlPWRpYWxvZ10gW3JvbGU9bWVudV0gW3JvbGU9bWVudWl0ZW1dXCIpXS5maWx0ZXIobm9kZSA9PiBub2RlLnRleHRDb250ZW50LnRvTG9jYWxlTG93ZXJDYXNlKCkgPT09IFwidW5zZW5kXCIpLnBvcCgpLCAvLyBUT0RPIGkxOG5cblx0XHQpXG5cdFx0cmV0dXJuIHRoaXMuY2xpY2tFbGVtZW50QW5kV2FpdEZvcihcblx0XHRcdHVuU2VuZEJ1dHRvbixcblx0XHRcdHRoaXMucm9vdC5vd25lckRvY3VtZW50LmJvZHksXG5cdFx0XHQoKSA9PiB0aGlzLnJvb3Qub3duZXJEb2N1bWVudC5xdWVyeVNlbGVjdG9yKFwiW3JvbGU9ZGlhbG9nXSBidXR0b25cIiksXG5cdFx0KVxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7SFRNTEJ1dHRvbkVsZW1lbnR9IGRpYWxvZ0J1dHRvblxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZX1cblx0ICovXG5cdGFzeW5jIGNvbmZpcm1VbnNlbmQoZGlhbG9nQnV0dG9uKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIldvcmtmbG93IGZpbmFsIHN0ZXAgOiBjb25maXJtVW5zZW5kXCIsIGRpYWxvZ0J1dHRvbilcblx0XHRhd2FpdCB0aGlzLmNsaWNrRWxlbWVudEFuZFdhaXRGb3IoXG5cdFx0XHRkaWFsb2dCdXR0b24sXG5cdFx0XHR0aGlzLnJvb3Qub3duZXJEb2N1bWVudC5ib2R5LFxuXHRcdFx0KCkgPT4gdGhpcy5yb290Lm93bmVyRG9jdW1lbnQucXVlcnlTZWxlY3RvcihcIltyb2xlPWRpYWxvZ10gYnV0dG9uXCIpID09PSBudWxsXG5cdFx0KVxuXHR9XG5cbn1cbiIsImltcG9ydCBVSU1lc3NhZ2UgZnJvbSBcIi4uL3VpLW1lc3NhZ2UuanNcIlxuXG4vKipcbiAqXG4gKiBAcGFyYW0ge0VsZW1lbnR9IHJvb3RcbiAqIEByZXR1cm5zIHtQcm9taXNlPEVsZW1lbnRbXT59XG4gKi9cbmV4cG9ydCBkZWZhdWx0IGFzeW5jIGZ1bmN0aW9uIGZpbmRNZXNzYWdlc1N0cmF0ZWd5KHJvb3QpIHtcblx0Y29uc3QgZWxlbWVudHMgPSBbLi4ucm9vdC5xdWVyeVNlbGVjdG9yQWxsKFwiZGl2W3JvbGU9cm93XTpub3QoW2RhdGEtaWRtdS1pZ25vcmVdKVwiKV1cblx0Y29uc3QgbWVzc2FnZUVsZW1lbnRzID0gW11cblx0Zm9yKGNvbnN0IGVsZW1lbnQgb2YgZWxlbWVudHMpIHtcblx0XHRjb25zdCBpc015T3duTWVzc2FnZSA9IGF3YWl0IFVJTWVzc2FnZS5pc015T3duTWVzc2FnZShlbGVtZW50KVxuXHRcdGlmKGlzTXlPd25NZXNzYWdlKSB7XG5cdFx0XHRtZXNzYWdlRWxlbWVudHMucHVzaChlbGVtZW50KVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRlbGVtZW50LnNldEF0dHJpYnV0ZShcImRhdGEtaWRtdS1pZ25vcmVcIiwgXCJcIilcblx0XHR9XG5cdH1cblx0Y29uc29sZS5kZWJ1ZyhtZXNzYWdlRWxlbWVudHMpXG5cdHJldHVybiBtZXNzYWdlRWxlbWVudHNcbn1cbiIsImltcG9ydCBVSVBJQ29tcG9uZW50IGZyb20gXCIuL3VpcGktY29tcG9uZW50LmpzXCJcblxuXG5jbGFzcyBGYWlsZWRXb3JrZmxvd0V4Y2VwdGlvbiBleHRlbmRzIEVycm9yIHt9XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFVJUElNZXNzYWdlIGV4dGVuZHMgVUlQSUNvbXBvbmVudCB7XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7VUlNZXNzYWdlfSB1aUNvbXBvbmVudFxuXHQgKi9cblx0Y29uc3RydWN0b3IodWlDb21wb25lbnQpIHtcblx0XHRzdXBlcih1aUNvbXBvbmVudClcblx0fVxuXG5cblx0LyoqXG5cdCAqXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlPGJvb2xlYW4+fVxuXHQgKi9cblx0YXN5bmMgdW5zZW5kKCkge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJVSVBJTWVzc2FnZSB1bnNlbmRcIilcblx0XHRsZXQgYWN0aW9uQnV0dG9uXG5cdFx0bGV0IGFjdGlvbnNNZW51RWxlbWVudFxuXHRcdHRyeSB7XG5cdFx0XHRhd2FpdCB0aGlzLnVpQ29tcG9uZW50LnNjcm9sbEludG9WaWV3KClcblx0XHRcdGFjdGlvbkJ1dHRvbiA9IGF3YWl0IHRoaXMudWlDb21wb25lbnQuc2hvd0FjdGlvbnNNZW51QnV0dG9uKClcblx0XHRcdGFjdGlvbnNNZW51RWxlbWVudCA9IGF3YWl0IHRoaXMudWlDb21wb25lbnQub3BlbkFjdGlvbnNNZW51KGFjdGlvbkJ1dHRvbilcblx0XHRcdGNvbnN0IGRpYWxvZ0J1dHRvbiA9IGF3YWl0IHRoaXMudWlDb21wb25lbnQub3BlbkNvbmZpcm1VbnNlbmRNb2RhbCgpXG5cdFx0XHRhd2FpdCB0aGlzLnVpQ29tcG9uZW50LmNvbmZpcm1VbnNlbmQoZGlhbG9nQnV0dG9uKVxuXHRcdFx0dGhpcy51aUNvbXBvbmVudC5yb290LnNldEF0dHJpYnV0ZShcImRhdGEtaWRtdS11bnNlbnRcIiwgXCJcIilcblx0XHRcdHJldHVybiB0cnVlXG5cdFx0fSBjYXRjaChleCkge1xuXHRcdFx0Y29uc29sZS5lcnJvcihleClcblx0XHRcdGlmKGFjdGlvbkJ1dHRvbiAmJiBhY3Rpb25zTWVudUVsZW1lbnQpIHtcblx0XHRcdFx0YXdhaXQgdGhpcy51aUNvbXBvbmVudC5jbG9zZUFjdGlvbnNNZW51KGFjdGlvbkJ1dHRvbiwgYWN0aW9uc01lbnVFbGVtZW50KVxuXHRcdFx0fVxuXHRcdFx0YXdhaXQgdGhpcy51aUNvbXBvbmVudC5oaWRlQWN0aW9uTWVudUJ1dHRvbigpXG5cdFx0XHR0aHJvdyBuZXcgRmFpbGVkV29ya2Zsb3dFeGNlcHRpb24oXCJGYWlsZWQgdG8gZXhlY3V0ZSB3b3JrZmxvdyBmb3IgdGhpcyBtZXNzYWdlXCIpXG5cdFx0fVxuXHR9XG5cbn1cbiIsImltcG9ydCBVSUNvbXBvbmVudCBmcm9tIFwiLi91aS1jb21wb25lbnQuanNcIlxuaW1wb3J0IGZpbmRNZXNzYWdlc1N0cmF0ZWd5IGZyb20gXCIuLi91aS9zdHJhdGVneS9maW5kLW1lc3NhZ2VzLXN0cmF0ZWd5LmpzXCJcbmltcG9ydCBVSVBJTWVzc2FnZSBmcm9tIFwiLi4vdWlwaS91aXBpLW1lc3NhZ2UuanNcIlxuaW1wb3J0IFVJTWVzc2FnZSBmcm9tIFwiLi91aS1tZXNzYWdlLmpzXCJcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgVUkgZXh0ZW5kcyBVSUNvbXBvbmVudCB7XG5cblx0LyoqXG5cdCAqXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlPn1cblx0ICovXG5cdGFzeW5jIGZldGNoQW5kUmVuZGVyVGhyZWFkTmV4dE1lc3NhZ2VQYWdlKCkge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJVSSBmZXRjaEFuZFJlbmRlclRocmVhZE5leHRNZXNzYWdlUGFnZVwiKVxuXHRcdHJldHVybiBhd2FpdCB0aGlzLmlkZW50aWZpZXIudWlNZXNzYWdlc1dyYXBwZXIuZmV0Y2hBbmRSZW5kZXJUaHJlYWROZXh0TWVzc2FnZVBhZ2UoKVxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlPFVJUElNZXNzYWdlW10+fVxuXHQgKi9cblx0YXN5bmMgY3JlYXRlVUlQSU1lc3NhZ2VzKCkge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJVSSBjcmVhdGVVSVBJTWVzc2FnZXNcIilcblx0XHRjb25zdCB1aXBpTWVzc2FnZXMgPSBbXVxuXHRcdGNvbnN0IG1lc3NhZ2VFbGVtZW50cyA9IGF3YWl0IGZpbmRNZXNzYWdlc1N0cmF0ZWd5KHRoaXMuaWRlbnRpZmllci51aU1lc3NhZ2VzV3JhcHBlci5yb290KVxuXHRcdGNvbnNvbGUuZGVidWcoXCJmaW5kTWVzc2FnZXNTdHJhdGVneVwiLCBtZXNzYWdlRWxlbWVudHMpXG5cdFx0Zm9yKGNvbnN0IG1lc3NhZ2VFbGVtZW50IG9mIG1lc3NhZ2VFbGVtZW50cykge1xuXHRcdFx0Y29uc3QgdWlNZXNzYWdlID0gbmV3IFVJTWVzc2FnZShtZXNzYWdlRWxlbWVudClcblx0XHRcdHVpcGlNZXNzYWdlcy5wdXNoKG5ldyBVSVBJTWVzc2FnZSh1aU1lc3NhZ2UpKVxuXHRcdH1cblx0XHRyZXR1cm4gdWlwaU1lc3NhZ2VzXG5cdH1cblxufVxuIiwiaW1wb3J0IFVJUElDb21wb25lbnQgZnJvbSBcIi4vdWlwaS1jb21wb25lbnQuanNcIlxuaW1wb3J0IGZpbmRNZXNzYWdlc1dyYXBwZXJTdHJhdGVneSBmcm9tIFwiLi4vdWkvc3RyYXRlZ3kvZmluZC1tZXNzYWdlcy13cmFwcGVyLXN0cmF0ZWd5LmpzXCJcbmltcG9ydCBVSU1lc3NhZ2VzV3JhcHBlciBmcm9tIFwiLi4vdWkvdWktbWVzc2FnZXMtd3JhcHBlci5qc1wiXG5pbXBvcnQgVUkgZnJvbSBcIi4uL3VpL3VpLmpzXCJcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgVUlQSSBleHRlbmRzIFVJUElDb21wb25lbnQge1xuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge1VJfSB1aUNvbXBvbmVudFxuXHQgKi9cblx0Y29uc3RydWN0b3IodWlDb21wb25lbnQpIHtcblx0XHRzdXBlcih1aUNvbXBvbmVudClcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge1dpbmRvd30gd2luZG93XG5cdCAqIEByZXR1cm5zIHtVSVBJfVxuXHQgKi9cblx0c3RhdGljIGNyZWF0ZSh3aW5kb3cpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwiVUlQSS5jcmVhdGVcIilcblx0XHRjb25zdCBtZXNzYWdlc1dyYXBwZXJFbGVtZW50ID0gZmluZE1lc3NhZ2VzV3JhcHBlclN0cmF0ZWd5KHdpbmRvdylcblx0XHRsZXQgdWlwaVxuXHRcdGlmKG1lc3NhZ2VzV3JhcHBlckVsZW1lbnQgIT09IG51bGwpIHtcblx0XHRcdGNvbnNvbGUuZGVidWcoXCJGb3VuZCBtZXNzYWdlc1dyYXBwZXJFbGVtZW50XCIpXG5cdFx0XHRjb25zb2xlLmRlYnVnKG1lc3NhZ2VzV3JhcHBlckVsZW1lbnQpXG5cdFx0XHRjb25zdCB1aSA9IG5ldyBVSSh3aW5kb3cpXG5cdFx0XHR1aS5pZGVudGlmaWVyLnVpTWVzc2FnZXNXcmFwcGVyID0gbmV3IFVJTWVzc2FnZXNXcmFwcGVyKG1lc3NhZ2VzV3JhcHBlckVsZW1lbnQpXG5cdFx0XHR1aXBpID0gbmV3IFVJUEkodWkpXG5cdFx0fSBlbHNlIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihcIlVuYWJsZSB0byBmaW5kIG1lc3NhZ2VzV3JhcHBlckVsZW1lbnRcIilcblx0XHR9XG5cdFx0cmV0dXJuIHVpcGlcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZX1cblx0ICovXG5cdGZldGNoQW5kUmVuZGVyVGhyZWFkTmV4dE1lc3NhZ2VQYWdlKCkge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJVSVBJIGZldGNoQW5kUmVuZGVyVGhyZWFkTmV4dE1lc3NhZ2VQYWdlXCIpXG5cdFx0cmV0dXJuIHRoaXMudWlDb21wb25lbnQuZmV0Y2hBbmRSZW5kZXJUaHJlYWROZXh0TWVzc2FnZVBhZ2UoKVxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlPFVJUElNZXNzYWdlW10+fVxuXHQgKi9cblx0Y3JlYXRlVUlQSU1lc3NhZ2VzKCkge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJVSVBJIGNyZWF0ZVVJUElNZXNzYWdlc1wiKVxuXHRcdHJldHVybiB0aGlzLnVpQ29tcG9uZW50LmNyZWF0ZVVJUElNZXNzYWdlcygpXG5cdH1cblxufVxuIiwiaW1wb3J0IFVJUEkgZnJvbSBcIi4uL3VpcGkvdWlwaS5qc1wiXG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIElETVUge1xuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge1dpbmRvd30gd2luZG93XG5cdCAqL1xuXHRjb25zdHJ1Y3Rvcih3aW5kb3cpIHtcblx0XHR0aGlzLndpbmRvdyA9IHdpbmRvd1xuXHRcdHRoaXMudWlwaSA9IG51bGxcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZTxVSVBJTWVzc2FnZVtdPn1cblx0ICovXG5cdGNyZWF0ZVVJUElNZXNzYWdlcygpIHtcblx0XHRyZXR1cm4gdGhpcy4jZ2V0VUlQSSgpLmNyZWF0ZVVJUElNZXNzYWdlcygpXG5cdH1cblxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZX1cblx0ICovXG5cdGZldGNoQW5kUmVuZGVyVGhyZWFkTmV4dE1lc3NhZ2VQYWdlKCkge1xuXHRcdHJldHVybiB0aGlzLiNnZXRVSVBJKCkuZmV0Y2hBbmRSZW5kZXJUaHJlYWROZXh0TWVzc2FnZVBhZ2UoKVxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEByZXR1cm5zIHtVSVBJfVxuXHQgKi9cblx0I2dldFVJUEkoKSB7XG5cdFx0aWYodGhpcy51aXBpID09PSBudWxsKSB7XG5cdFx0XHR0aGlzLnVpcGkgPSBVSVBJLmNyZWF0ZSh0aGlzLndpbmRvdylcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMudWlwaVxuXHR9XG5cbn1cbiIsIlxuZXhwb3J0IGNsYXNzIFVuc2VuZFRocmVhZE1lc3NhZ2VzQmF0Y2hTdHJhdGVneSB7XG5cblx0c3RhdGljIERFRkFVTFRfQkFUQ0hfU0laRSA9IDVcblxuXHQjaWRtdVxuXHQjb25VbnN1Y2Nlc3NmdWxXb3JrZmxvd3Ncblx0I2ZpbmlzaGVkX3dvcmtmbG93c1xuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge0lETVV9IGlkbXVcblx0ICovXG5cdGNvbnN0cnVjdG9yKGlkbXUsIG9uVW5zdWNjZXNzZnVsV29ya2Zsb3dzPW51bGwpIHtcblx0XHR0aGlzLl9ydW5uaW5nID0gZmFsc2Vcblx0XHR0aGlzLl9zdG9wcGVkID0gZmFsc2Vcblx0XHR0aGlzLiNmaW5pc2hlZF93b3JrZmxvd3MgPSBbXVxuXHRcdHRoaXMuI2lkbXUgPSBpZG11XG5cdFx0dGhpcy4jb25VbnN1Y2Nlc3NmdWxXb3JrZmxvd3MgPSBvblVuc3VjY2Vzc2Z1bFdvcmtmbG93c1xuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEByZXR1cm5zIHtib29sZWFufVxuXHQgKi9cblx0aXNSdW5uaW5nKCkge1xuXHRcdHJldHVybiB0aGlzLl9ydW5uaW5nICYmICF0aGlzLl9zdG9wcGVkXG5cdH1cblxuXHRzdG9wKCkge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJVbnNlbmRUaHJlYWRNZXNzYWdlc0JhdGNoU3RyYXRlZ3kgc3RvcFwiKVxuXHRcdHRoaXMuX3N0b3BwZWQgPSB0cnVlXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHtudW1iZXJ9IGJhdGNoU2l6ZVxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZX1cblx0ICovXG5cdHJ1bihiYXRjaFNpemUpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwiVW5zZW5kVGhyZWFkTWVzc2FnZXNCYXRjaFN0cmF0ZWd5LnJ1bigpXCIsIGJhdGNoU2l6ZSlcblx0XHR0aGlzLl9ydW5uaW5nID0gdHJ1ZVxuXHRcdHRoaXMuX3N0b3BwZWQgPSBmYWxzZVxuXHRcdHJldHVybiB0aGlzLiNwcm9jZXNzQmF0Y2hlcyhiYXRjaFNpemUpXG5cdH1cblxuXHQjZG9uZSgpIHtcblx0XHR0aGlzLl9ydW5uaW5nID0gZmFsc2Vcblx0XHRjb25zb2xlLmRlYnVnKFwiVW5zZW5kVGhyZWFkTWVzc2FnZXNCYXRjaFN0cmF0ZWd5IGRvbmVcIilcblx0fVxuXG5cdCN1bnN1Y2Nlc3NmdWxXb3JrZmxvd0FsZXJ0KCkge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJVbnNlbmRUaHJlYWRNZXNzYWdlc0JhdGNoU3RyYXRlZ3kgdW5zdWNjZXNzZnVsV29ya2Zsb3dBbGVydFwiKVxuXHRcdGlmKCF0aGlzLl9ydW5uaW5nKSB7XG5cdFx0XHRjbGVhckludGVydmFsKHRoaXMuaW50ZXJ2YWwpXG5cdFx0fVxuXHRcdGNvbnN0IHVuc3VjY2Vzc2Z1bFdvcmtmbG93cyA9IHRoaXMuI2ZpbmlzaGVkX3dvcmtmbG93cy5maWx0ZXIodWlNZXNzYWdlID0+IHRoaXMuI2lkbXUud2luZG93LmRvY3VtZW50LmNvbnRhaW5zKHVpTWVzc2FnZS51aUNvbXBvbmVudC5yb290KSlcblx0XHRpZih1bnN1Y2Nlc3NmdWxXb3JrZmxvd3MubGVuZ3RoID49IDEpIHtcblx0XHRcdHVuc3VjY2Vzc2Z1bFdvcmtmbG93cy5mb3JFYWNoKGZhaWxlZFdvcmtmbG93ID0+IHRoaXMuI2ZpbmlzaGVkX3dvcmtmbG93cy5zcGxpY2UodGhpcy4jZmluaXNoZWRfd29ya2Zsb3dzLmluZGV4T2YoZmFpbGVkV29ya2Zsb3cpLCAxKSlcblx0XHRcdHRoaXMuI29uVW5zdWNjZXNzZnVsV29ya2Zsb3dzKHVuc3VjY2Vzc2Z1bFdvcmtmbG93cylcblx0XHR9XG5cdH1cblxuXHRhc3luYyAjcHJvY2Vzc0JhdGNoZXMoYmF0Y2hTaXplKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIlVuc2VuZFRocmVhZE1lc3NhZ2VzQmF0Y2hTdHJhdGVneSBwcm9jZXNzQmF0Y2hlc1wiKVxuXHRcdGxldCBkb25lID0gZmFsc2Vcblx0XHRmb3IobGV0IGkgPSAwOyBpIDwgYmF0Y2hTaXplO2krKykge1xuXHRcdFx0aWYodGhpcy5fc3RvcHBlZCkge1xuXHRcdFx0XHRicmVha1xuXHRcdFx0fVxuXHRcdFx0ZG9uZSA9IGF3YWl0IHRoaXMuI2lkbXUuZmV0Y2hBbmRSZW5kZXJUaHJlYWROZXh0TWVzc2FnZVBhZ2UoKVxuXHRcdFx0aWYoZG9uZSkge1xuXHRcdFx0XHRicmVha1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0YXdhaXQgbmV3IFByb21pc2UocmVzb2x2ZSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIHRoaXMuI2lkbXUud2luZG93LklETVVfTkVYVF9NRVNTQUdFX1BBR0VfREVMQVkpKVxuXHRcdFx0fVxuXHRcdH1cblx0XHR0cnkge1xuXHRcdFx0Zm9yKGNvbnN0IHVpcGlNZXNzYWdlIG9mIGF3YWl0IHRoaXMuI2lkbXUuY3JlYXRlVUlQSU1lc3NhZ2VzKCkpIHtcblx0XHRcdFx0aWYodGhpcy5fc3RvcHBlZCkge1xuXHRcdFx0XHRcdGJyZWFrXG5cdFx0XHRcdH1cblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRhd2FpdCB1aXBpTWVzc2FnZS51bnNlbmQoKVxuXHRcdFx0XHRcdHRoaXMuI2ZpbmlzaGVkX3dvcmtmbG93cy5wdXNoKHVpcGlNZXNzYWdlKVxuXHRcdFx0XHRcdGF3YWl0IG5ldyBQcm9taXNlKHJlc29sdmUgPT4gc2V0VGltZW91dChyZXNvbHZlLCB0aGlzLiNpZG11LndpbmRvdy5JRE1VX01FU1NBR0VfUVVFVUVfREVMQVkpKVxuXHRcdFx0XHR9IGNhdGNoKHJlc3VsdCkge1xuXHRcdFx0XHRcdGNvbnNvbGUuZXJyb3IocmVzdWx0KVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSBjYXRjaChleCkge1xuXHRcdFx0Y29uc29sZS5lcnJvcihleClcblx0XHR9XG5cdFx0aWYoIXRoaXMuaW50ZXJ2YWwgJiYgdGhpcy4jb25VbnN1Y2Nlc3NmdWxXb3JrZmxvd3MpIHtcblx0XHRcdHRoaXMuaW50ZXJ2YWwgPSBzZXRJbnRlcnZhbCgoKSA9PiB0aGlzLiN1bnN1Y2Nlc3NmdWxXb3JrZmxvd0FsZXJ0KCksIHRoaXMuI2lkbXUud2luZG93LklETVVfVU5TVUNFU1NGVUxfV09SS0ZMT1dfQUxFUlRfSU5URVJWQUwpXG5cdFx0fVxuXHRcdGlmKGRvbmUpIHtcblx0XHRcdHRoaXMuI2RvbmUoKVxuXHRcdH0gZWxzZSBpZighdGhpcy5fc3RvcHBlZCkge1xuXHRcdFx0cmV0dXJuIHRoaXMuI3Byb2Nlc3NCYXRjaGVzKGJhdGNoU2l6ZSlcblx0XHR9XG5cdH1cbn1cbiIsIi8qKlxuICpcbiAqIEBwYXJhbSB7RG9jdW1lbnR9IGRvY3VtZW50XG4gKiBAcmV0dXJucyB7SFRNTEJ1dHRvbkVsZW1lbnR9XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVBbGVydHNXcmFwcGVyRWxlbWVudChkb2N1bWVudCkge1xuXHRjb25zdCBhbGVydHNXcmFwcGVyRWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIilcblx0YWxlcnRzV3JhcHBlckVsZW1lbnQuaWQgPSBcImlkbXUtYWxlcnRzXCJcblx0YWxlcnRzV3JhcHBlckVsZW1lbnQuc3R5bGUucG9zaXRpb24gPSBcImZpeGVkXCJcblx0YWxlcnRzV3JhcHBlckVsZW1lbnQuc3R5bGUudG9wID0gXCIyMHB4XCJcblx0YWxlcnRzV3JhcHBlckVsZW1lbnQuc3R5bGUucmlnaHQgPSBcIjIwcHhcIlxuXHRhbGVydHNXcmFwcGVyRWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gXCJncmlkXCJcblx0cmV0dXJuIGFsZXJ0c1dyYXBwZXJFbGVtZW50XG59XG5cbi8qKlxuICpcbiAqIEBwYXJhbSB7RG9jdW1lbnR9IGRvY3VtZW50XG4gKiBAcGFyYW0ge3N0cmluZ30gICB0ZXh0XG4gKiBAcmV0dXJucyB7SFRNTEJ1dHRvbkVsZW1lbnR9XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVBbGVydEVsZW1lbnQoZG9jdW1lbnQsIHRleHQpIHtcblx0Y29uc3QgYWxlcnRFbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKVxuXHRhbGVydEVsZW1lbnQudGV4dENvbnRlbnQgPSB0ZXh0XG5cdHJldHVybiBhbGVydEVsZW1lbnRcbn1cbiIsIi8qKlxuICogQHBhcmFtIHtEb2N1bWVudH0gZG9jdW1lbnRcbiAqIEByZXR1cm5zIHtIVE1MRGl2RWxlbWVudH1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZU92ZXJsYXlFbGVtZW50KGRvY3VtZW50KSB7XG5cdGNvbnN0IG92ZXJsYXlFbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKVxuXHRvdmVybGF5RWxlbWVudC5pZCA9IFwiaWRtdS1vdmVybGF5XCJcblx0b3ZlcmxheUVsZW1lbnQudGFiSW5kZXggPSAwXG5cdG92ZXJsYXlFbGVtZW50LnN0eWxlLnRvcCA9IFwiMFwiXG5cdG92ZXJsYXlFbGVtZW50LnN0eWxlLnJpZ2h0ID0gXCIwXCJcblx0b3ZlcmxheUVsZW1lbnQuc3R5bGUucG9zaXRpb24gPSBcImZpeGVkXCJcblx0b3ZlcmxheUVsZW1lbnQuc3R5bGUud2lkdGggPSBcIjEwMHZ3XCJcblx0b3ZlcmxheUVsZW1lbnQuc3R5bGUuaGVpZ2h0ID0gXCIxMDB2aFwiXG5cdG92ZXJsYXlFbGVtZW50LnN0eWxlLnpJbmRleCA9IFwiOTk4XCJcblx0b3ZlcmxheUVsZW1lbnQuc3R5bGUuYmFja2dyb3VuZENvbG9yID0gXCIjMDAwMDAwZDZcIlxuXHRvdmVybGF5RWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCJcblx0cmV0dXJuIG92ZXJsYXlFbGVtZW50XG59XG4iLCJpbXBvcnQgeyBjcmVhdGVNZW51QnV0dG9uRWxlbWVudCB9IGZyb20gXCIuL21lbnUtYnV0dG9uLmpzXCJcbmltcG9ydCB7IGNyZWF0ZU1lbnVFbGVtZW50IH0gZnJvbSBcIi4vbWVudS5qc1wiXG5pbXBvcnQgSURNVSBmcm9tIFwiLi4vLi4vLi4vaWRtdS9pZG11LmpzXCJcbmltcG9ydCB7IFVuc2VuZFRocmVhZE1lc3NhZ2VzQmF0Y2hTdHJhdGVneSB9IGZyb20gXCIuLi9zdHJhdGVneS5qc1wiXG5pbXBvcnQgeyBjcmVhdGVBbGVydHNXcmFwcGVyRWxlbWVudCB9IGZyb20gXCIuL2FsZXJ0LmpzXCJcbmltcG9ydCB7IGNyZWF0ZU92ZXJsYXlFbGVtZW50IH0gZnJvbSBcIi4vb3ZlcmxheS5qc1wiXG5cbi8qKlxuICpcbiAqIEBwYXJhbSB7d2luZG93fSB3aW5kb3dcbiAqIEByZXR1cm5zIHtIVE1MRGl2RWxlbWVudH0gICAgb2JqZWN0LnVpRWxlbWVudFxuICogQHJldHVybnMge0hUTUxCdXR0b25FbGVtZW50fSBvYmplY3QudW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b25cbiAqIEByZXR1cm5zIHtIVE1MQnV0dG9uRWxlbWVudH0gb2JqZWN0LmxvYWRUaHJlYWRNZXNzYWdlc0J1dHRvblxuICovXG5leHBvcnQgZnVuY3Rpb24gcmVuZGVyKHdpbmRvdykge1xuXHRjb25zdCBpZG11ID0gbmV3IElETVUod2luZG93KVxuXHRjb25zdCBzdHJhdGVneSA9IG5ldyBVbnNlbmRUaHJlYWRNZXNzYWdlc0JhdGNoU3RyYXRlZ3koaWRtdSwgKHVuc3VjY2Vzc2Z1bFdvcmtmbG93cykgPT4ge1xuXHRcdGNvbnNvbGUubG9nKHVuc3VjY2Vzc2Z1bFdvcmtmbG93cylcblx0fSlcblx0Y29uc3QgeyBvdmVybGF5RWxlbWVudCwgdWlFbGVtZW50LCBtZW51RWxlbWVudCwgdW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24sIGxvYWRUaHJlYWRNZXNzYWdlc0J1dHRvbiB9ID0gY3JlYXRlVUlFbGVtZW50KHdpbmRvdy5kb2N1bWVudClcblx0ZnVuY3Rpb24gb25VbnNlbmRpbmdGaW5pc2hlZCgpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwib25VbnNlbmRpbmdGaW5pc2hlZFwiKVxuXHRcdDtbLi4ubWVudUVsZW1lbnQucXVlcnlTZWxlY3RvckFsbChcImJ1dHRvblwiKV0uZmlsdGVyKGJ1dHRvbiA9PiBidXR0b24gIT09IHVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uKS5mb3JFYWNoKGJ1dHRvbiA9PiB7XG5cdFx0XHRidXR0b24uc3R5bGUudmlzaWJpbGl0eSA9IFwiXCJcblx0XHRcdGJ1dHRvbi5kaXNhYmxlZCA9IGZhbHNlXG5cdFx0fSlcblx0XHR1bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbi50ZXh0Q29udGVudCA9IHVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uLmRhdGFUZXh0Q29udGVudFxuXHRcdHVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uLnN0eWxlLmJhY2tncm91bmRDb2xvciA9IHVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uLmRhdGFCYWNrZ3JvdW5kQ29sb3Jcblx0XHRvdmVybGF5RWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCJcblx0XHRpZighc3RyYXRlZ3kuX3N0b3BwZWQpIHtcblx0XHRcdHdpbmRvdy5hbGVydChcIklETVU6IEZpbmlzaGVkXCIpXG5cdFx0fVxuXHR9XG5cdGFzeW5jIGZ1bmN0aW9uIHN0YXJ0VW5zZW5kaW5nKCkge1xuXHRcdFsuLi5tZW51RWxlbWVudC5xdWVyeVNlbGVjdG9yQWxsKFwiYnV0dG9uXCIpXS5maWx0ZXIoYnV0dG9uID0+IGJ1dHRvbiAhPT0gdW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24pLmZvckVhY2goYnV0dG9uID0+IHtcblx0XHRcdGJ1dHRvbi5zdHlsZS52aXNpYmlsaXR5ID0gXCJoaWRkZW5cIlxuXHRcdFx0YnV0dG9uLmRpc2FibGVkID0gdHJ1ZVxuXG5cdFx0fSlcblx0XHRvdmVybGF5RWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gXCJcIlxuXHRcdG92ZXJsYXlFbGVtZW50LmZvY3VzKClcblx0XHRjb25zb2xlLmRlYnVnKFwiVXNlciBhc2tlZCB0byBzdGFydCBtZXNzYWdlcyB1bnNlbmRpbmc7IFVJIGkxbnRlcmFjdGlvbiB3aWxsIGJlIGRpc2FibGVkXCIpXG5cdFx0dW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24udGV4dENvbnRlbnQgPSBcIlN0b3AgcHJvY2Vzc2luZ1wiXG5cdFx0dW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24uc3R5bGUuYmFja2dyb3VuZENvbG9yID0gXCIjRkEzODNFXCJcblx0XHRjb25zdCBiYXRjaFNpemUgPSB3aW5kb3cubG9jYWxTdG9yYWdlLmdldEl0ZW0oXCJJRE1VX0JBVENIX1NJWkVcIikgfHwgVW5zZW5kVGhyZWFkTWVzc2FnZXNCYXRjaFN0cmF0ZWd5LkRFRkFVTFRfQkFUQ0hfU0laRVxuXHRcdGF3YWl0IHN0cmF0ZWd5LnJ1bihiYXRjaFNpemUpXG5cdFx0b25VbnNlbmRpbmdGaW5pc2hlZCgpXG5cdH1cblx0ZnVuY3Rpb24gaGFuZGxlRXZlbnRzKGV2ZW50KSB7XG5cdFx0aWYoc3RyYXRlZ3kuaXNSdW5uaW5nKCkpIHtcblx0XHRcdGNvbnNvbGUuaW5mbyhcIlVzZXIgaW50ZXJhY3Rpb24gaXMgZGlzYWJsZWQgYXMgdGhlIHN0cmF0ZWd5IGlzIHN0aWxsIHJ1bm5pbmc7IFBsZWFzZSBzdG9wIHRoZSBleGVjdXRpb24gZmlyc3QuXCIpXG5cdFx0XHRldmVudC5zdG9wSW1tZWRpYXRlUHJvcGFnYXRpb24oKVxuXHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKVxuXHRcdFx0ZXZlbnQuc3RvcFByb3BhZ2F0aW9uKClcblx0XHRcdG92ZXJsYXlFbGVtZW50LmZvY3VzKClcblx0XHRcdHJldHVybiBmYWxzZVxuXHRcdH1cblx0fVxuXHRmdW5jdGlvbiBvbk11dGF0aW9ucygpIHtcblx0XHRpZih3aW5kb3cubG9jYXRpb24ucGF0aG5hbWUuc3RhcnRzV2l0aChcIi9kaXJlY3QvdC9cIikpIHtcblx0XHRcdHVpRWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gXCJcIlxuXHRcdH0gZWxzZSB7XG5cdFx0XHR1aUVsZW1lbnQuc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiXG5cdFx0XHRzdHJhdGVneS5zdG9wKClcblx0XHR9XG5cdH1cblx0d2luZG93LmRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJrZXlkb3duXCIsIGhhbmRsZUV2ZW50cylcblx0d2luZG93LmRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJrZXl1cFwiLCBoYW5kbGVFdmVudHMpXG5cdG5ldyBNdXRhdGlvbk9ic2VydmVyKG9uTXV0YXRpb25zKS5vYnNlcnZlKHdpbmRvdy5kb2N1bWVudC5ib2R5LCB7IGNoaWxkTGlzdDogdHJ1ZSB9KVxuXHRuZXcgTXV0YXRpb25PYnNlcnZlcihvbk11dGF0aW9ucykub2JzZXJ2ZSh3aW5kb3cuZG9jdW1lbnQucXVlcnlTZWxlY3RvcihcIltpZF49bW91bnRdID4gZGl2ID4gZGl2ID4gZGl2XCIpLCB7IGNoaWxkTGlzdDogdHJ1ZSwgYXR0cmlidXRlczogdHJ1ZSB9KVxuXHR1bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbi5kYXRhVGV4dENvbnRlbnQgPSB1bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbi50ZXh0Q29udGVudFxuXHR1bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbi5kYXRhQmFja2dyb3VuZENvbG9yID0gdW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24uc3R5bGUuYmFja2dyb3VuZENvbG9yXG5cdHVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XG5cdFx0aWYoc3RyYXRlZ3kuaXNSdW5uaW5nKCkpIHtcblx0XHRcdGNvbnNvbGUuZGVidWcoXCJVc2VyIGFza2VkIHRvIHN0b3AgbWVzc2FnZXMgdW5zZW5kaW5nXCIpXG5cdFx0XHRzdHJhdGVneS5zdG9wKClcblx0XHRcdG9uVW5zZW5kaW5nRmluaXNoZWQoKVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRzdGFydFVuc2VuZGluZygpXG5cdFx0fVxuXHR9KVxuXHRsb2FkVGhyZWFkTWVzc2FnZXNCdXR0b24uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcblx0XHRjb25zb2xlLmRlYnVnKFwibG9hZFRocmVhZE1lc3NhZ2VzQnV0dG9uIGNsaWNrXCIpXG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IGJhdGNoU2l6ZSA9IHBhcnNlSW50KHdpbmRvdy5wcm9tcHQoXCJIb3cgbWFueSBwYWdlcyBzaG91bGQgd2UgbG9hZCBiZWZvcmUgZWFjaCB1bnNlbmRpbmc/IFwiLCB3aW5kb3cubG9jYWxTdG9yYWdlLmdldEl0ZW0oXCJJRE1VX0JBVENIX1NJWkVcIikgfHwgVW5zZW5kVGhyZWFkTWVzc2FnZXNCYXRjaFN0cmF0ZWd5LkRFRkFVTFRfQkFUQ0hfU0laRSApKVxuXHRcdFx0aWYocGFyc2VJbnQoYmF0Y2hTaXplKSkge1xuXHRcdFx0XHR3aW5kb3cubG9jYWxTdG9yYWdlLnNldEl0ZW0oXCJJRE1VX0JBVENIX1NJWkVcIiwgcGFyc2VJbnQoYmF0Y2hTaXplKSlcblx0XHRcdH1cblx0XHRcdGNvbnNvbGUuZGVidWcoYFNldHRpbmcgSURNVV9CQVRDSF9TSVpFIHRvICR7YmF0Y2hTaXplfWApXG5cdFx0fSBjYXRjaChleCkge1xuXHRcdFx0Y29uc29sZS5lcnJvcihleClcblx0XHR9XG5cdH0pXG5cdHdpbmRvdy5kb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHVpRWxlbWVudClcblx0cmV0dXJuIHsgdWlFbGVtZW50LCB1bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbiwgbG9hZFRocmVhZE1lc3NhZ2VzQnV0dG9uIH1cbn1cblxuLyoqXG4gKlxuICogQHBhcmFtICAge0RvY3VtZW50fSAgICAgICAgICBkb2N1bWVudFxuICogQHJldHVybnMge29iamVjdH1cbiAqIEByZXR1cm5zIHtIVE1MRGl2RWxlbWVudH0gICAgb2JqZWN0LnVpRWxlbWVudFxuICogQHJldHVybnMge0hUTUxEaXZFbGVtZW50fSAgICBvYmplY3Qub3ZlcmxheUVsZW1lbnRcbiAqIEByZXR1cm5zIHtIVE1MRGl2RWxlbWVudH0gICAgb2JqZWN0Lm1lbnVFbGVtZW50XG4gKiBAcmV0dXJucyB7SFRNTEJ1dHRvbkVsZW1lbnR9IG9iamVjdC51bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvblxuICogQHJldHVybnMge0hUTUxCdXR0b25FbGVtZW50fSBvYmplY3QubG9hZFRocmVhZE1lc3NhZ2VzQnV0dG9uXG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZVVJRWxlbWVudChkb2N1bWVudCkge1xuXHRjb25zdCB1aUVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpXG5cdGNvbnN0IG1lbnVFbGVtZW50ID0gY3JlYXRlTWVudUVsZW1lbnQoZG9jdW1lbnQpXG5cdGNvbnN0IG92ZXJsYXlFbGVtZW50ID0gY3JlYXRlT3ZlcmxheUVsZW1lbnQoZG9jdW1lbnQpXG5cdGNvbnN0IGFsZXJ0c1dyYXBwZXJFbGVtZW50ID0gY3JlYXRlQWxlcnRzV3JhcHBlckVsZW1lbnQoZG9jdW1lbnQpXG5cdGNvbnN0IHVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uID0gY3JlYXRlTWVudUJ1dHRvbkVsZW1lbnQoZG9jdW1lbnQsIFwiVW5zZW5kIGFsbCBETXNcIilcblx0Y29uc3QgbG9hZFRocmVhZE1lc3NhZ2VzQnV0dG9uID0gY3JlYXRlTWVudUJ1dHRvbkVsZW1lbnQoZG9jdW1lbnQsIFwiQmF0Y2ggc2l6ZVwiLCBcInNlY29uZGFyeVwiKVxuXHRkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKG92ZXJsYXlFbGVtZW50KVxuXHRkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGFsZXJ0c1dyYXBwZXJFbGVtZW50KVxuXHRtZW51RWxlbWVudC5hcHBlbmRDaGlsZCh1bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbilcblx0bWVudUVsZW1lbnQuYXBwZW5kQ2hpbGQobG9hZFRocmVhZE1lc3NhZ2VzQnV0dG9uKVxuXHR1aUVsZW1lbnQuYXBwZW5kQ2hpbGQobWVudUVsZW1lbnQpXG5cdHJldHVybiB7IHVpRWxlbWVudCwgb3ZlcmxheUVsZW1lbnQsIG1lbnVFbGVtZW50LCB1bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbiwgbG9hZFRocmVhZE1lc3NhZ2VzQnV0dG9uIH1cbn1cbiIsImltcG9ydCB7IHJlbmRlciB9IGZyb20gXCIuL3VpL3VpLmpzXCJcblxuaWYoIXdpbmRvdy5JRE1VX0RFQlVHKSB7XG5cdGNvbnNvbGUuZGVidWcgPSAoKSA9PiB7fVxufVxuXG5yZW5kZXIod2luZG93KVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0NBQUEsTUFBTSxZQUFZLEdBQUc7Q0FDckIsQ0FBQyxTQUFTLEVB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
