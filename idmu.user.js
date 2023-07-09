
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
// @version				0.5.9
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
	window["IDMU_DEBUG"] = true
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
		root.scrollTop = 999;
		root.scrollTop = 0;
		let findLoaderTimeout;
		const loadingElement = await Promise.race([
			waitForElement(root, () => root.querySelector(`[role=progressbar]`)),
			new Promise(resolve => {
				findLoaderTimeout = setTimeout(resolve, 500);
			})
		]);
		clearTimeout(findLoaderTimeout);
		if(loadingElement) {
			console.debug("loadMoreMessageStrategy: Found loader; Stand by until until it is removed");
			console.debug("loadMoreMessageStrategy: scrollTop", root.scrollTop);
			await waitForElement(root, () => root.querySelector(`[role=progressbar]`) === null);
			console.debug("loadMoreMessageStrategy: Loader was removed, older messages loading completed");
			console.debug(`loadMoreMessageStrategy: scrollTop is ${root.scrollTop} we ${root.scrollTop === 0 ? "reached last page" : " did not reach last page and will begin loading older messages shortly"}`, );
			return root.scrollTop === 0
		} else {
			console.debug("loadMoreMessageStrategy: Could not find loader");
			return true
		}
	}

	class UIMessagesWrapper extends UIComponent {

		/**
		 * @param {Window}
		 * @returns {HTMLDivElement}
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
	 * @returns {HTMLDivElement}
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
			console.debug("isMyOwnMessage", element);
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
			console.debug("Workflow rolling back hideActionMenuButton");
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
					console.debug("Workflow step 2 menuElements", menuElements.map(menuElement => menuElement.textContent));
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
			console.debug("Workflow rolling back  closeActionsMenu");
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
		console.debug("findMessagesStrategy elements ", elements);
		const messageElements = [];
		for(const element of elements) {
			const isMyOwnMessage = await UIMessage.isMyOwnMessage(element);
			if(isMyOwnMessage) {
				console.debug("findMessagesStrategy adding ", element);
				messageElements.push(element);
			} else {
				console.debug("findMessagesStrategy ignoring ", element);
				element.setAttribute("data-idmu-ignore", "");
			}
		}
		console.debug("findMessagesStrategy hits", messageElements);
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
				console.debug("actionsMenuElement", actionsMenuElement);
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
			console.debug("UnsendThreadMessagesBatchStrategy finished_workflows", this.#finished_workflows);
			const unsuccessfulWorkflows = this.#finished_workflows.filter(uiMessage => this.#idmu.window.document.contains(uiMessage.uiComponent.root));
			console.debug("UnsendThreadMessagesBatchStrategy unsuccessfulWorkflows", unsuccessfulWorkflows);
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
		console.debug("render");
		const idmu = new IDMU(window);
		const strategy = new UnsendThreadMessagesBatchStrategy(idmu, (unsuccessfulWorkflows) => {
			console.log(unsuccessfulWorkflows);
		});
		const { overlayElement, uiElement, menuElement, unsendThreadMessagesButton, loadThreadMessagesButton } = createUIElement(window.document);
		function onUnsendingFinished() {
			console.debug("render onUnsendingFinished")
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
			console.debug("User asked for messages unsending to start; UI interaction will be disabled in the meantime")
			;[...menuElement.querySelectorAll("button")].filter(button => button !== unsendThreadMessagesButton).forEach(button => {
				button.style.visibility = "hidden";
				button.disabled = true;
			});
			overlayElement.style.display = "";
			overlayElement.focus();
			unsendThreadMessagesButton.textContent = "Stop processing";
			unsendThreadMessagesButton.style.backgroundColor = "#FA383E";
			const batchSize = window.localStorage.getItem("IDMU_BATCH_SIZE") || UnsendThreadMessagesBatchStrategy.DEFAULT_BATCH_SIZE;
			await strategy.run(batchSize);
			onUnsendingFinished();
		}
		function handleEvents(event) {
			if(strategy.isRunning()) {
				console.info("User interaction is disabled as the unsending is still running; Please stop the execution first.");
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
				console.debug("User asked for messages unsending to stop");
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaWRtdS51c2VyLmpzIiwic291cmNlcyI6WyIuLi9zcmMvcnVudGltZS91c2Vyc2NyaXB0L3VpL3N0eWxlL2luc3RhZ3JhbS5qcyIsIi4uL3NyYy9ydW50aW1lL3VzZXJzY3JpcHQvdWkvbWVudS1idXR0b24uanMiLCIuLi9zcmMvcnVudGltZS91c2Vyc2NyaXB0L3VpL21lbnUuanMiLCIuLi9zcmMvdWlwaS91aXBpLWNvbXBvbmVudC5qcyIsIi4uL3NyYy9kb20vYXN5bmMtZXZlbnRzLmpzIiwiLi4vc3JjL3VpL3VpLWNvbXBvbmVudC5qcyIsIi4uL3NyYy91aS9zdHJhdGVneS9sb2FkLW1vcmUtbWVzc2FnZXMtc3RyYXRlZ3kuanMiLCIuLi9zcmMvdWkvdWktbWVzc2FnZXMtd3JhcHBlci5qcyIsIi4uL3NyYy91aS9zdHJhdGVneS9maW5kLW1lc3NhZ2VzLXdyYXBwZXItc3RyYXRlZ3kuanMiLCIuLi9zcmMvdWkvdWktbWVzc2FnZS5qcyIsIi4uL3NyYy91aS9zdHJhdGVneS9maW5kLW1lc3NhZ2VzLXN0cmF0ZWd5LmpzIiwiLi4vc3JjL3VpcGkvdWlwaS1tZXNzYWdlLmpzIiwiLi4vc3JjL3VpL3VpLmpzIiwiLi4vc3JjL3VpcGkvdWlwaS5qcyIsIi4uL3NyYy9pZG11L2lkbXUuanMiLCIuLi9zcmMvcnVudGltZS91c2Vyc2NyaXB0L3N0cmF0ZWd5LmpzIiwiLi4vc3JjL3J1bnRpbWUvdXNlcnNjcmlwdC91aS9hbGVydC5qcyIsIi4uL3NyYy9ydW50aW1lL3VzZXJzY3JpcHQvdWkvb3ZlcmxheS5qcyIsIi4uL3NyYy9ydW50aW1lL3VzZXJzY3JpcHQvdWkvdWkuanMiLCIuLi9zcmMvcnVudGltZS91c2Vyc2NyaXB0L21haW4uanMiXSwic291cmNlc0NvbnRlbnQiOlsiY29uc3QgQlVUVE9OX1NUWUxFID0ge1xuXHRcIlBSSU1BUllcIjogXCJwcmltYXJ5XCIsXG5cdFwiU0VDT05EQVJZXCI6IFwic2Vjb25kYXJ5XCIsXG59XG5cbi8qKlxuICpcbiAqIEBwYXJhbSB7SFRNTEJ1dHRvbkVsZW1lbnR9IGJ1dHRvbkVsZW1lbnRcbiAqIEBwYXJhbSB7c3RyaW5nfSAgICAgICAgICAgIHN0eWxlTmFtZVxuICovXG5leHBvcnQgZnVuY3Rpb24gYXBwbHlCdXR0b25TdHlsZShidXR0b25FbGVtZW50LCBzdHlsZU5hbWU9QlVUVE9OX1NUWUxFLlBSSU1BUlkpIHtcblx0YnV0dG9uRWxlbWVudC5zdHlsZS5mb250U2l6ZSA9IFwidmFyKC0tc3lzdGVtLTE0LWZvbnQtc2l6ZSlcIlxuXHRidXR0b25FbGVtZW50LnN0eWxlLmNvbG9yID0gXCJ3aGl0ZVwiXG5cdGJ1dHRvbkVsZW1lbnQuc3R5bGUuYm9yZGVyID0gXCIwcHhcIlxuXHRidXR0b25FbGVtZW50LnN0eWxlLmJvcmRlclJhZGl1cyA9IFwiOHB4XCJcblx0YnV0dG9uRWxlbWVudC5zdHlsZS5wYWRkaW5nID0gXCI4cHhcIlxuXHRidXR0b25FbGVtZW50LnN0eWxlLmZvbnRXZWlnaHQgPSBcImJvbGRcIlxuXHRidXR0b25FbGVtZW50LnN0eWxlLmN1cnNvciA9IFwicG9pbnRlclwiXG5cdGJ1dHRvbkVsZW1lbnQuc3R5bGUubGluZUhlaWdodCA9IFwidmFyKC0tc3lzdGVtLTE0LWxpbmUtaGVpZ2h0KVwiXG5cdGJ1dHRvbkVsZW1lbnQuc3R5bGUuYmFja2dyb3VuZENvbG9yID0gYHJnYih2YXIoLS1pZy0ke3N0eWxlTmFtZX0tYnV0dG9uKSlgXG59XG4iLCJpbXBvcnQgeyBhcHBseUJ1dHRvblN0eWxlIH0gZnJvbSBcIi4vc3R5bGUvaW5zdGFncmFtLmpzXCJcblxuLyoqXG4gKlxuICogQHBhcmFtIHtEb2N1bWVudH0gZG9jdW1lbnRcbiAqIEBwYXJhbSB7c3RyaW5nfSAgIHRleHRcbiAqIEBwYXJhbSB7c3RyaW5nfSAgIHN0eWxlTmFtZVxuICogQHJldHVybnMge0hUTUxCdXR0b25FbGVtZW50fVxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlTWVudUJ1dHRvbkVsZW1lbnQoZG9jdW1lbnQsIHRleHQsIHN0eWxlTmFtZSkge1xuXHRjb25zdCBidXR0b25FbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImJ1dHRvblwiKVxuXHRidXR0b25FbGVtZW50LnRleHRDb250ZW50ID0gdGV4dFxuXHRhcHBseUJ1dHRvblN0eWxlKGJ1dHRvbkVsZW1lbnQsIHN0eWxlTmFtZSlcblx0YnV0dG9uRWxlbWVudC5hZGRFdmVudExpc3RlbmVyKFwibW91c2VvdmVyXCIsICgpID0+IHtcblx0XHRidXR0b25FbGVtZW50LnN0eWxlLmZpbHRlciA9IGBicmlnaHRuZXNzKDEuMTUpYFxuXHR9KVxuXHRidXR0b25FbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJtb3VzZW91dFwiLCAoKSA9PiB7XG5cdFx0YnV0dG9uRWxlbWVudC5zdHlsZS5maWx0ZXIgPSBgYFxuXHR9KVxuXHRyZXR1cm4gYnV0dG9uRWxlbWVudFxufVxuIiwiLyoqXG4gKiBAcGFyYW0ge0RvY3VtZW50fSBkb2N1bWVudFxuICogQHJldHVybnMge0hUTUxCdXR0b25FbGVtZW50fVxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlTWVudUVsZW1lbnQoZG9jdW1lbnQpIHtcblx0Y29uc3QgbWVudUVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpXG5cdG1lbnVFbGVtZW50LnN0eWxlLnRvcCA9IFwiMjBweFwiXG5cdG1lbnVFbGVtZW50LnN0eWxlLnJpZ2h0ID0gXCI0MzBweFwiXG5cdG1lbnVFbGVtZW50LnN0eWxlLnBvc2l0aW9uID0gXCJmaXhlZFwiXG5cdG1lbnVFbGVtZW50LnN0eWxlLnpJbmRleCA9IDk5OVxuXHRtZW51RWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gXCJmbGV4XCJcblx0bWVudUVsZW1lbnQuc3R5bGUuZ2FwID0gXCIxMHB4XCJcblx0cmV0dXJuIG1lbnVFbGVtZW50XG59XG4iLCJleHBvcnQgZGVmYXVsdCBjbGFzcyBVSVBJQ29tcG9uZW50IHtcblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7VUlDb21wb25lbnR9IHVpQ29tcG9uZW50XG5cdCAqL1xuXHRjb25zdHJ1Y3Rvcih1aUNvbXBvbmVudCkge1xuXHRcdHRoaXMuX3VpQ29tcG9uZW50ID0gdWlDb21wb25lbnRcblx0fVxuXG5cdC8qKlxuXHQgKiBAcmVhZG9ubHlcblx0ICogQHR5cGUge1VJQ29tcG9uZW50fVxuXHQgKi9cblx0Z2V0IHVpQ29tcG9uZW50KCkge1xuXHRcdHJldHVybiB0aGlzLl91aUNvbXBvbmVudFxuXHR9XG59XG4iLCIvKipcbiAqXG4gKiBAY2FsbGJhY2sgZ2V0RWxlbWVudFxuICogQHJldHVybnMge0VsZW1lbnR9XG4gKi9cblxuLyoqXG4gKlxuICogQHBhcmFtIHtFbGVtZW50fSB0YXJnZXRcbiAqIEBwYXJhbSB7Z2V0RWxlbWVudH0gZ2V0RWxlbWVudFxuICogQHJldHVybnMge1Byb21pc2U8RWxlbWVudD59XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB3YWl0Rm9yRWxlbWVudCh0YXJnZXQsIGdldEVsZW1lbnQpIHtcblx0cmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG5cdFx0bGV0IGVsZW1lbnQgPSBnZXRFbGVtZW50KClcblx0XHRpZihlbGVtZW50KSB7XG5cdFx0XHRyZXNvbHZlKGVsZW1lbnQpXG5cdFx0fSBlbHNlIHtcblx0XHRcdG5ldyBNdXRhdGlvbk9ic2VydmVyKChtdXRhdGlvbnMsIG9ic2VydmVyKSA9PiB7XG5cdFx0XHRcdGVsZW1lbnQgPSBnZXRFbGVtZW50KClcblx0XHRcdFx0aWYoZWxlbWVudCkge1xuXHRcdFx0XHRcdG9ic2VydmVyLmRpc2Nvbm5lY3QoKVxuXHRcdFx0XHRcdHJlc29sdmUoZWxlbWVudClcblx0XHRcdFx0fVxuXHRcdFx0fSkub2JzZXJ2ZSh0YXJnZXQsIHsgc3VidHJlZTogdHJ1ZSwgY2hpbGRMaXN0OnRydWUgfSlcblx0XHR9XG5cdH0pXG59XG5cbi8qKlxuICpcbiAqIEBwYXJhbSB7RWxlbWVudH0gY2xpY2tUYXJnZXRcbiAqIEBwYXJhbSB7RWxlbWVudH0gdGFyZ2V0XG4gKiBAcGFyYW0ge2dldEVsZW1lbnR9IGdldEVsZW1lbnRcbiAqIEByZXR1cm5zIHtFbGVtZW50fFByb21pc2U8RWxlbWVudD59XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjbGlja0VsZW1lbnRBbmRXYWl0Rm9yKGNsaWNrVGFyZ2V0LCB0YXJnZXQsIGdldEVsZW1lbnQpIHtcblx0Y29uc3QgcHJvbWlzZSA9IHdhaXRGb3JFbGVtZW50KHRhcmdldCwgZ2V0RWxlbWVudClcblx0Y2xpY2tUYXJnZXQuY2xpY2soKVxuXHRyZXR1cm4gZ2V0RWxlbWVudCgpIHx8IHByb21pc2Vcbn1cbiIsImltcG9ydCB7IHdhaXRGb3JFbGVtZW50LCBjbGlja0VsZW1lbnRBbmRXYWl0Rm9yIH0gZnJvbSBcIi4uL2RvbS9hc3luYy1ldmVudHMuanNcIlxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBVSUNvbXBvbmVudCB7XG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge0VsZW1lbnR9IHJvb3Rcblx0ICogQHBhcmFtIHtvYmplY3R9IGlkZW50aWZpZXJcblx0ICovXG5cdGNvbnN0cnVjdG9yKHJvb3QsIGlkZW50aWZpZXI9e30pIHtcblx0XHR0aGlzLnJvb3QgPSByb290XG5cdFx0dGhpcy5pZGVudGlmaWVyID0gaWRlbnRpZmllclxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7RWxlbWVudH0gdGFyZ2V0XG5cdCAqIEBwYXJhbSB7ZnVuY3Rpb259IGdldEVsZW1lbnRcblx0ICogQHJldHVybnMge1Byb21pc2U8RWxlbWVudD59XG5cdCAqL1xuXHR3YWl0Rm9yRWxlbWVudCh0YXJnZXQsIGdldEVsZW1lbnQpIHtcblx0XHRyZXR1cm4gZ2V0RWxlbWVudCgpIHx8IHdhaXRGb3JFbGVtZW50KHRhcmdldCwgZ2V0RWxlbWVudClcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge0VsZW1lbnR9IGNsaWNrVGFyZ2V0XG5cdCAqIEBwYXJhbSB7RWxlbWVudH0gdGFyZ2V0XG5cdCAqIEBwYXJhbSB7ZnVuY3Rpb259IGdldEVsZW1lbnRcblx0ICogQHJldHVybnMge1Byb21pc2U8RWxlbWVudD59XG5cdCAqL1xuXHRjbGlja0VsZW1lbnRBbmRXYWl0Rm9yKGNsaWNrVGFyZ2V0LCB0YXJnZXQsIGdldEVsZW1lbnQpIHtcblx0XHRyZXR1cm4gY2xpY2tFbGVtZW50QW5kV2FpdEZvcihjbGlja1RhcmdldCwgdGFyZ2V0LCBnZXRFbGVtZW50KVxuXHR9XG5cbn1cbiIsImltcG9ydCB7IHdhaXRGb3JFbGVtZW50IH0gZnJvbSBcIi4uLy4uL2RvbS9hc3luYy1ldmVudHMuanNcIlxuXG4vKipcbiAqXG4gKiBAcGFyYW0ge0VsZW1lbnR9IHJvb3RcbiAqIEByZXR1cm5zIHtQcm9taXNlPGJvb2xlYW4+fVxuICovXG5leHBvcnQgZGVmYXVsdCBhc3luYyBmdW5jdGlvbiBsb2FkTW9yZU1lc3NhZ2VTdHJhdGVneShyb290KSB7XG5cdGNvbnNvbGUuZGVidWcoXCJsb2FkTW9yZU1lc3NhZ2VTdHJhdGVneVwiKVxuXHRyb290LnNjcm9sbFRvcCA9IDk5OVxuXHRyb290LnNjcm9sbFRvcCA9IDBcblx0bGV0IGZpbmRMb2FkZXJUaW1lb3V0XG5cdGNvbnN0IGxvYWRpbmdFbGVtZW50ID0gYXdhaXQgUHJvbWlzZS5yYWNlKFtcblx0XHR3YWl0Rm9yRWxlbWVudChyb290LCAoKSA9PiByb290LnF1ZXJ5U2VsZWN0b3IoYFtyb2xlPXByb2dyZXNzYmFyXWApKSxcblx0XHRuZXcgUHJvbWlzZShyZXNvbHZlID0+IHtcblx0XHRcdGZpbmRMb2FkZXJUaW1lb3V0ID0gc2V0VGltZW91dChyZXNvbHZlLCA1MDApXG5cdFx0fSlcblx0XSlcblx0Y2xlYXJUaW1lb3V0KGZpbmRMb2FkZXJUaW1lb3V0KVxuXHRpZihsb2FkaW5nRWxlbWVudCkge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJsb2FkTW9yZU1lc3NhZ2VTdHJhdGVneTogRm91bmQgbG9hZGVyOyBTdGFuZCBieSB1bnRpbCB1bnRpbCBpdCBpcyByZW1vdmVkXCIpXG5cdFx0Y29uc29sZS5kZWJ1ZyhcImxvYWRNb3JlTWVzc2FnZVN0cmF0ZWd5OiBzY3JvbGxUb3BcIiwgcm9vdC5zY3JvbGxUb3ApXG5cdFx0YXdhaXQgd2FpdEZvckVsZW1lbnQocm9vdCwgKCkgPT4gcm9vdC5xdWVyeVNlbGVjdG9yKGBbcm9sZT1wcm9ncmVzc2Jhcl1gKSA9PT0gbnVsbClcblx0XHRjb25zb2xlLmRlYnVnKFwibG9hZE1vcmVNZXNzYWdlU3RyYXRlZ3k6IExvYWRlciB3YXMgcmVtb3ZlZCwgb2xkZXIgbWVzc2FnZXMgbG9hZGluZyBjb21wbGV0ZWRcIilcblx0XHRjb25zb2xlLmRlYnVnKGBsb2FkTW9yZU1lc3NhZ2VTdHJhdGVneTogc2Nyb2xsVG9wIGlzICR7cm9vdC5zY3JvbGxUb3B9IHdlICR7cm9vdC5zY3JvbGxUb3AgPT09IDAgPyBcInJlYWNoZWQgbGFzdCBwYWdlXCIgOiBcIiBkaWQgbm90IHJlYWNoIGxhc3QgcGFnZSBhbmQgd2lsbCBiZWdpbiBsb2FkaW5nIG9sZGVyIG1lc3NhZ2VzIHNob3J0bHlcIn1gLCApXG5cdFx0cmV0dXJuIHJvb3Quc2Nyb2xsVG9wID09PSAwXG5cdH0gZWxzZSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcImxvYWRNb3JlTWVzc2FnZVN0cmF0ZWd5OiBDb3VsZCBub3QgZmluZCBsb2FkZXJcIilcblx0XHRyZXR1cm4gdHJ1ZVxuXHR9XG59XG4iLCJpbXBvcnQgVUlDb21wb25lbnQgZnJvbSBcIi4vdWktY29tcG9uZW50LmpzXCJcbmltcG9ydCBsb2FkTW9yZU1lc3NhZ2VTdHJhdGVneSBmcm9tIFwiLi9zdHJhdGVneS9sb2FkLW1vcmUtbWVzc2FnZXMtc3RyYXRlZ3kuanNcIlxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBVSU1lc3NhZ2VzV3JhcHBlciBleHRlbmRzIFVJQ29tcG9uZW50IHtcblxuXHQvKipcblx0ICogQHBhcmFtIHtXaW5kb3d9XG5cdCAqIEByZXR1cm5zIHtIVE1MRGl2RWxlbWVudH1cblx0ICovXG5cdHN0YXRpYyBmaW5kKHdpbmRvdykge1xuXHRcdHJldHVybiB3aW5kb3cuZG9jdW1lbnQucXVlcnlTZWxlY3RvcihcImRpdltyb2xlPWdyaWRdID4gZGl2ID4gZGl2ID4gZGl2ID4gZGl2XCIpXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHJldHVybnMge1Byb21pc2U+fVxuXHQgKi9cblx0ZmV0Y2hBbmRSZW5kZXJUaHJlYWROZXh0TWVzc2FnZVBhZ2UoKSB7XG5cdFx0cmV0dXJuIGxvYWRNb3JlTWVzc2FnZVN0cmF0ZWd5KHRoaXMucm9vdClcblx0fVxuXG59XG4iLCJpbXBvcnQgVUlNZXNzYWdlc1dyYXBwZXIgZnJvbSBcIi4uL3VpLW1lc3NhZ2VzLXdyYXBwZXIuanNcIlxuXG4vKipcbiAqXG4gKiBAcGFyYW0ge1dpbmRvd30gd2luZG93XG4gKiBAcmV0dXJucyB7SFRNTERpdkVsZW1lbnR9XG4gKi9cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIGZpbmRNZXNzYWdlc1dyYXBwZXJTdHJhdGVneSh3aW5kb3cpIHtcblx0cmV0dXJuIFVJTWVzc2FnZXNXcmFwcGVyLmZpbmQod2luZG93KVxufVxuIiwiaW1wb3J0IFVJQ29tcG9uZW50IGZyb20gXCIuL3VpLWNvbXBvbmVudC5qc1wiXG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFVJTWVzc2FnZSBleHRlbmRzIFVJQ29tcG9uZW50IHtcblxuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHtIVE1MRGl2RWxlbWVudH0gZWxlbWVudFxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZTxib29sZWFuPn1cblx0ICovXG5cdHN0YXRpYyBhc3luYyBpc015T3duTWVzc2FnZShlbGVtZW50KSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcImlzTXlPd25NZXNzYWdlXCIsIGVsZW1lbnQpXG5cdFx0ZWxlbWVudC5xdWVyeVNlbGVjdG9yKFwiW2FyaWEtbGFiZWw9TW9yZV1bYXJpYS1leHBhbmRlZD10cnVlXVwiKT8uY2xpY2soKVxuXHRcdGVsZW1lbnQucXVlcnlTZWxlY3RvcihgW2FyaWEtbGFiZWw9XCJDbG9zZSBkZXRhaWxzIGFuZCBhY3Rpb25zXCJdYCk/LmNsaWNrKClcblx0XHRlbGVtZW50LmRpc3BhdGNoRXZlbnQobmV3IE1vdXNlRXZlbnQoXCJtb3VzZW91dFwiLCB7IGJ1YmJsZXM6IHRydWUgfSkpXG5cdFx0Y29uc3QgdWlNZXNzYWdlID0gbmV3IFVJTWVzc2FnZShlbGVtZW50KVxuXHRcdGxldCB0aW1lb3V0XG5cdFx0Y29uc3QgYWN0aW9uQnV0dG9uID0gYXdhaXQgUHJvbWlzZS5yYWNlKFtcblx0XHRcdHVpTWVzc2FnZS5zaG93QWN0aW9uc01lbnVCdXR0b24oKSxcblx0XHRcdG5ldyBQcm9taXNlKHJlc29sdmUgPT4ge1xuXHRcdFx0XHR0aW1lb3V0ID0gc2V0VGltZW91dChyZXNvbHZlLCAyMClcblx0XHRcdH0pXG5cdFx0XSlcblx0XHRjbGVhclRpbWVvdXQodGltZW91dClcblx0XHRpZihhY3Rpb25CdXR0b24pIHtcblx0XHRcdGNvbnN0IGFjdGlvbnNNZW51RWxlbWVudCA9IGF3YWl0IHVpTWVzc2FnZS5vcGVuQWN0aW9uc01lbnUoYWN0aW9uQnV0dG9uKVxuXHRcdFx0YXdhaXQgdWlNZXNzYWdlLmNsb3NlQWN0aW9uc01lbnUoYWN0aW9uQnV0dG9uLCBhY3Rpb25zTWVudUVsZW1lbnQpXG5cdFx0XHRhd2FpdCB1aU1lc3NhZ2UuaGlkZUFjdGlvbk1lbnVCdXR0b24oKVxuXHRcdFx0cmV0dXJuIGFjdGlvbnNNZW51RWxlbWVudCAmJiBhY3Rpb25zTWVudUVsZW1lbnQudGV4dENvbnRlbnQudG9Mb2NhbGVMb3dlckNhc2UoKSA9PT0gXCJ1bnNlbmRcIlxuXHRcdH1cblx0XHRyZXR1cm4gZmFsc2Vcblx0fVxuXG5cdHNjcm9sbEludG9WaWV3KCkge1xuXHRcdHRoaXMucm9vdC5zY3JvbGxJbnRvVmlldygpXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHJldHVybnMge1Byb21pc2U8SFRNTEJ1dHRvbkVsZW1lbnQ+fVxuXHQgKi9cblx0c2hvd0FjdGlvbnNNZW51QnV0dG9uKCkge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJXb3JrZmxvdyBzdGVwIDEgOiBzaG93QWN0aW9uc01lbnVCdXR0b25cIilcblx0XHR0aGlzLnJvb3QuZGlzcGF0Y2hFdmVudChuZXcgTW91c2VFdmVudChcIm1vdXNlbW92ZVwiLCB7IGJ1YmJsZXM6IHRydWUgfSkpXG5cdFx0dGhpcy5yb290LmRpc3BhdGNoRXZlbnQobmV3IE1vdXNlRXZlbnQoXCJtb3VzZW92ZXJcIiwgeyBidWJibGVzOiB0cnVlIH0pKVxuXHRcdHRoaXMucm9vdC5kaXNwYXRjaEV2ZW50KG5ldyBNb3VzZUV2ZW50KFwibW91c2VudGVyXCIsIHsgYnViYmxlczogdHJ1ZSB9KSlcblx0XHRyZXR1cm4gdGhpcy53YWl0Rm9yRWxlbWVudCh0aGlzLnJvb3QsICgpID0+IHRoaXMucm9vdC5xdWVyeVNlbGVjdG9yKFwiW2FyaWEtbGFiZWw9TW9yZV1cIikpIC8vIFRPRE8gaTE4blxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlPGJvb2xlYW4+fVxuXHQgKi9cblx0aGlkZUFjdGlvbk1lbnVCdXR0b24oKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIldvcmtmbG93IHJvbGxpbmcgYmFjayBoaWRlQWN0aW9uTWVudUJ1dHRvblwiKVxuXHRcdHRoaXMucm9vdC5kaXNwYXRjaEV2ZW50KG5ldyBNb3VzZUV2ZW50KFwibW91c2Vtb3ZlXCIsIHsgYnViYmxlczogdHJ1ZSB9KSlcblx0XHR0aGlzLnJvb3QuZGlzcGF0Y2hFdmVudChuZXcgTW91c2VFdmVudChcIm1vdXNlb3V0XCIsIHsgYnViYmxlczogdHJ1ZSB9KSlcblx0XHR0aGlzLnJvb3QuZGlzcGF0Y2hFdmVudChuZXcgTW91c2VFdmVudChcIm1vdXNlbGVhdmVcIiwgeyBidWJibGVzOiB0cnVlIH0pKVxuXHRcdHJldHVybiB0aGlzLndhaXRGb3JFbGVtZW50KHRoaXMucm9vdCwgKCkgPT4gdGhpcy5yb290LnF1ZXJ5U2VsZWN0b3IoXCJbYXJpYS1sYWJlbD1Nb3JlXVwiKSA9PT0gbnVsbCkgLy8gVE9ETyBpMThuXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHtIVE1MQnV0dG9uRWxlbWVudH0gYWN0aW9uQnV0dG9uXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlfVxuXHQgKi9cblx0YXN5bmMgb3BlbkFjdGlvbnNNZW51KGFjdGlvbkJ1dHRvbikge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJXb3JrZmxvdyBzdGVwIDIgOiBvcGVuQWN0aW9uc01lbnVcIiwgYWN0aW9uQnV0dG9uKVxuXHRcdGNvbnN0IGFjdGlvbk1lbnVFbGVtZW50ID0gYXdhaXQgdGhpcy5jbGlja0VsZW1lbnRBbmRXYWl0Rm9yKFxuXHRcdFx0YWN0aW9uQnV0dG9uLFxuXHRcdFx0dGhpcy5yb290Lm93bmVyRG9jdW1lbnQuYm9keSxcblx0XHRcdCgpID0+IHtcblx0XHRcdFx0Y29uc3QgbWVudUVsZW1lbnRzID0gWy4uLnRoaXMucm9vdC5vd25lckRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoXCJbcm9sZT1tZW51XSBbcm9sZT1tZW51aXRlbV1cIildXG5cdFx0XHRcdGNvbnNvbGUuZGVidWcoXCJXb3JrZmxvdyBzdGVwIDIgbWVudUVsZW1lbnRzXCIsIG1lbnVFbGVtZW50cy5tYXAobWVudUVsZW1lbnQgPT4gbWVudUVsZW1lbnQudGV4dENvbnRlbnQpKVxuXHRcdFx0XHRtZW51RWxlbWVudHMuc29ydChub2RlID0+IG5vZGUudGV4dENvbnRlbnQudG9Mb2NhbGVMb3dlckNhc2UoKSA9PT0gXCJ1bnNlbmRcIiA/IC0xIDogMCkgLy8gVE9ETyBpMThuXG5cdFx0XHRcdHJldHVybiBtZW51RWxlbWVudHMuc2hpZnQoKVxuXHRcdFx0fSxcblx0XHQpXG5cdFx0XHQ7Wy4uLmFjdGlvbk1lbnVFbGVtZW50LnBhcmVudE5vZGUucGFyZW50Tm9kZS5xdWVyeVNlbGVjdG9yQWxsKFwiW3JvbGU9bWVudWl0ZW1dXCIpXS5mb3JFYWNoKGVsZW1lbnQgPT4ge1xuXHRcdFx0aWYoZWxlbWVudCAhPT0gYWN0aW9uTWVudUVsZW1lbnQpIHtcblx0XHRcdFx0ZWxlbWVudC5yZW1vdmUoKVxuXHRcdFx0fVxuXHRcdH0pXG5cdFx0cmV0dXJuIGFjdGlvbk1lbnVFbGVtZW50XG5cblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge0hUTUxCdXR0b25FbGVtZW50fSBhY3Rpb25CdXR0b25cblx0ICogQHBhcmFtIHtIVE1MRGl2RWxlbWVudH0gYWN0aW9uc01lbnVFbGVtZW50XG5cdCAqIEByZXR1cm5zIHtQcm9taXNlPGJvb2xlYW4+fVxuXHQgKi9cblx0Y2xvc2VBY3Rpb25zTWVudShhY3Rpb25CdXR0b24sIGFjdGlvbnNNZW51RWxlbWVudCkge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJXb3JrZmxvdyByb2xsaW5nIGJhY2sgIGNsb3NlQWN0aW9uc01lbnVcIilcblx0XHRyZXR1cm4gdGhpcy5jbGlja0VsZW1lbnRBbmRXYWl0Rm9yKFxuXHRcdFx0YWN0aW9uQnV0dG9uLFxuXHRcdFx0dGhpcy5yb290Lm93bmVyRG9jdW1lbnQuYm9keSxcblx0XHRcdCgpID0+IHRoaXMucm9vdC5vd25lckRvY3VtZW50LmJvZHkuY29udGFpbnMoYWN0aW9uc01lbnVFbGVtZW50KSA9PT0gZmFsc2UsXG5cdFx0KVxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlPEhUTUxCdXR0b25FbGVtZW50PnxQcm9taXNlPEVycm9yPn1cblx0ICovXG5cdGFzeW5jIG9wZW5Db25maXJtVW5zZW5kTW9kYWwoKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIldvcmtmbG93IHN0ZXAgMyA6IG9wZW5Db25maXJtVW5zZW5kTW9kYWxcIilcblx0XHRjb25zdCB1blNlbmRCdXR0b24gPSBhd2FpdCB0aGlzLndhaXRGb3JFbGVtZW50KFxuXHRcdFx0dGhpcy5yb290Lm93bmVyRG9jdW1lbnQuYm9keSxcblx0XHRcdCgpID0+IFsuLi50aGlzLnJvb3Qub3duZXJEb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKFwiW3JvbGU9ZGlhbG9nXSBbcm9sZT1tZW51XSBbcm9sZT1tZW51aXRlbV1cIildLmZpbHRlcihub2RlID0+IG5vZGUudGV4dENvbnRlbnQudG9Mb2NhbGVMb3dlckNhc2UoKSA9PT0gXCJ1bnNlbmRcIikucG9wKCksIC8vIFRPRE8gaTE4blxuXHRcdClcblx0XHRyZXR1cm4gdGhpcy5jbGlja0VsZW1lbnRBbmRXYWl0Rm9yKFxuXHRcdFx0dW5TZW5kQnV0dG9uLFxuXHRcdFx0dGhpcy5yb290Lm93bmVyRG9jdW1lbnQuYm9keSxcblx0XHRcdCgpID0+IHRoaXMucm9vdC5vd25lckRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCJbcm9sZT1kaWFsb2ddIGJ1dHRvblwiKSxcblx0XHQpXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHtIVE1MQnV0dG9uRWxlbWVudH0gZGlhbG9nQnV0dG9uXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlfVxuXHQgKi9cblx0YXN5bmMgY29uZmlybVVuc2VuZChkaWFsb2dCdXR0b24pIHtcblx0XHRjb25zb2xlLmRlYnVnKFwiV29ya2Zsb3cgZmluYWwgc3RlcCA6IGNvbmZpcm1VbnNlbmRcIiwgZGlhbG9nQnV0dG9uKVxuXHRcdGF3YWl0IHRoaXMuY2xpY2tFbGVtZW50QW5kV2FpdEZvcihcblx0XHRcdGRpYWxvZ0J1dHRvbixcblx0XHRcdHRoaXMucm9vdC5vd25lckRvY3VtZW50LmJvZHksXG5cdFx0XHQoKSA9PiB0aGlzLnJvb3Qub3duZXJEb2N1bWVudC5xdWVyeVNlbGVjdG9yKFwiW3JvbGU9ZGlhbG9nXSBidXR0b25cIikgPT09IG51bGxcblx0XHQpXG5cdH1cblxufVxuIiwiaW1wb3J0IFVJTWVzc2FnZSBmcm9tIFwiLi4vdWktbWVzc2FnZS5qc1wiXG5cbi8qKlxuICpcbiAqIEBwYXJhbSB7RWxlbWVudH0gcm9vdFxuICogQHJldHVybnMge1Byb21pc2U8RWxlbWVudFtdPn1cbiAqL1xuZXhwb3J0IGRlZmF1bHQgYXN5bmMgZnVuY3Rpb24gZmluZE1lc3NhZ2VzU3RyYXRlZ3kocm9vdCkge1xuXHRjb25zdCBlbGVtZW50cyA9IFsuLi5yb290LnF1ZXJ5U2VsZWN0b3JBbGwoXCJkaXZbcm9sZT1yb3ddOm5vdChbZGF0YS1pZG11LWlnbm9yZV0pXCIpXVxuXHRjb25zb2xlLmRlYnVnKFwiZmluZE1lc3NhZ2VzU3RyYXRlZ3kgZWxlbWVudHMgXCIsIGVsZW1lbnRzKVxuXHRjb25zdCBtZXNzYWdlRWxlbWVudHMgPSBbXVxuXHRmb3IoY29uc3QgZWxlbWVudCBvZiBlbGVtZW50cykge1xuXHRcdGNvbnN0IGlzTXlPd25NZXNzYWdlID0gYXdhaXQgVUlNZXNzYWdlLmlzTXlPd25NZXNzYWdlKGVsZW1lbnQpXG5cdFx0aWYoaXNNeU93bk1lc3NhZ2UpIHtcblx0XHRcdGNvbnNvbGUuZGVidWcoXCJmaW5kTWVzc2FnZXNTdHJhdGVneSBhZGRpbmcgXCIsIGVsZW1lbnQpXG5cdFx0XHRtZXNzYWdlRWxlbWVudHMucHVzaChlbGVtZW50KVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zb2xlLmRlYnVnKFwiZmluZE1lc3NhZ2VzU3RyYXRlZ3kgaWdub3JpbmcgXCIsIGVsZW1lbnQpXG5cdFx0XHRlbGVtZW50LnNldEF0dHJpYnV0ZShcImRhdGEtaWRtdS1pZ25vcmVcIiwgXCJcIilcblx0XHR9XG5cdH1cblx0Y29uc29sZS5kZWJ1ZyhcImZpbmRNZXNzYWdlc1N0cmF0ZWd5IGhpdHNcIiwgbWVzc2FnZUVsZW1lbnRzKVxuXHRyZXR1cm4gbWVzc2FnZUVsZW1lbnRzXG59XG4iLCJpbXBvcnQgVUlQSUNvbXBvbmVudCBmcm9tIFwiLi91aXBpLWNvbXBvbmVudC5qc1wiXG5cblxuY2xhc3MgRmFpbGVkV29ya2Zsb3dFeGNlcHRpb24gZXh0ZW5kcyBFcnJvciB7fVxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBVSVBJTWVzc2FnZSBleHRlbmRzIFVJUElDb21wb25lbnQge1xuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge1VJTWVzc2FnZX0gdWlDb21wb25lbnRcblx0ICovXG5cdGNvbnN0cnVjdG9yKHVpQ29tcG9uZW50KSB7XG5cdFx0c3VwZXIodWlDb21wb25lbnQpXG5cdH1cblxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZTxib29sZWFuPn1cblx0ICovXG5cdGFzeW5jIHVuc2VuZCgpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwiVUlQSU1lc3NhZ2UgdW5zZW5kXCIpXG5cdFx0bGV0IGFjdGlvbkJ1dHRvblxuXHRcdGxldCBhY3Rpb25zTWVudUVsZW1lbnRcblx0XHR0cnkge1xuXHRcdFx0YXdhaXQgdGhpcy51aUNvbXBvbmVudC5zY3JvbGxJbnRvVmlldygpXG5cdFx0XHRhY3Rpb25CdXR0b24gPSBhd2FpdCB0aGlzLnVpQ29tcG9uZW50LnNob3dBY3Rpb25zTWVudUJ1dHRvbigpXG5cdFx0XHRhY3Rpb25zTWVudUVsZW1lbnQgPSBhd2FpdCB0aGlzLnVpQ29tcG9uZW50Lm9wZW5BY3Rpb25zTWVudShhY3Rpb25CdXR0b24pXG5cdFx0XHRjb25zb2xlLmRlYnVnKFwiYWN0aW9uc01lbnVFbGVtZW50XCIsIGFjdGlvbnNNZW51RWxlbWVudClcblx0XHRcdGNvbnN0IGRpYWxvZ0J1dHRvbiA9IGF3YWl0IHRoaXMudWlDb21wb25lbnQub3BlbkNvbmZpcm1VbnNlbmRNb2RhbCgpXG5cdFx0XHRhd2FpdCB0aGlzLnVpQ29tcG9uZW50LmNvbmZpcm1VbnNlbmQoZGlhbG9nQnV0dG9uKVxuXHRcdFx0dGhpcy51aUNvbXBvbmVudC5yb290LnNldEF0dHJpYnV0ZShcImRhdGEtaWRtdS11bnNlbnRcIiwgXCJcIilcblx0XHRcdHJldHVybiB0cnVlXG5cdFx0fSBjYXRjaChleCkge1xuXHRcdFx0Y29uc29sZS5lcnJvcihleClcblx0XHRcdGlmKGFjdGlvbkJ1dHRvbiAmJiBhY3Rpb25zTWVudUVsZW1lbnQpIHtcblx0XHRcdFx0YXdhaXQgdGhpcy51aUNvbXBvbmVudC5jbG9zZUFjdGlvbnNNZW51KGFjdGlvbkJ1dHRvbiwgYWN0aW9uc01lbnVFbGVtZW50KVxuXHRcdFx0fVxuXHRcdFx0YXdhaXQgdGhpcy51aUNvbXBvbmVudC5oaWRlQWN0aW9uTWVudUJ1dHRvbigpXG5cdFx0XHR0aHJvdyBuZXcgRmFpbGVkV29ya2Zsb3dFeGNlcHRpb24oXCJGYWlsZWQgdG8gZXhlY3V0ZSB3b3JrZmxvdyBmb3IgdGhpcyBtZXNzYWdlXCIpXG5cdFx0fVxuXHR9XG5cbn1cbiIsImltcG9ydCBVSUNvbXBvbmVudCBmcm9tIFwiLi91aS1jb21wb25lbnQuanNcIlxuaW1wb3J0IGZpbmRNZXNzYWdlc1N0cmF0ZWd5IGZyb20gXCIuLi91aS9zdHJhdGVneS9maW5kLW1lc3NhZ2VzLXN0cmF0ZWd5LmpzXCJcbmltcG9ydCBVSVBJTWVzc2FnZSBmcm9tIFwiLi4vdWlwaS91aXBpLW1lc3NhZ2UuanNcIlxuaW1wb3J0IFVJTWVzc2FnZSBmcm9tIFwiLi91aS1tZXNzYWdlLmpzXCJcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgVUkgZXh0ZW5kcyBVSUNvbXBvbmVudCB7XG5cblx0LyoqXG5cdCAqXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlPn1cblx0ICovXG5cdGFzeW5jIGZldGNoQW5kUmVuZGVyVGhyZWFkTmV4dE1lc3NhZ2VQYWdlKCkge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJVSSBmZXRjaEFuZFJlbmRlclRocmVhZE5leHRNZXNzYWdlUGFnZVwiKVxuXHRcdHJldHVybiBhd2FpdCB0aGlzLmlkZW50aWZpZXIudWlNZXNzYWdlc1dyYXBwZXIuZmV0Y2hBbmRSZW5kZXJUaHJlYWROZXh0TWVzc2FnZVBhZ2UoKVxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlPFVJUElNZXNzYWdlW10+fVxuXHQgKi9cblx0YXN5bmMgY3JlYXRlVUlQSU1lc3NhZ2VzKCkge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJVSSBjcmVhdGVVSVBJTWVzc2FnZXNcIilcblx0XHRjb25zdCB1aXBpTWVzc2FnZXMgPSBbXVxuXHRcdGNvbnN0IG1lc3NhZ2VFbGVtZW50cyA9IGF3YWl0IGZpbmRNZXNzYWdlc1N0cmF0ZWd5KHRoaXMuaWRlbnRpZmllci51aU1lc3NhZ2VzV3JhcHBlci5yb290KVxuXHRcdGZvcihjb25zdCBtZXNzYWdlRWxlbWVudCBvZiBtZXNzYWdlRWxlbWVudHMpIHtcblx0XHRcdGNvbnN0IHVpTWVzc2FnZSA9IG5ldyBVSU1lc3NhZ2UobWVzc2FnZUVsZW1lbnQpXG5cdFx0XHR1aXBpTWVzc2FnZXMucHVzaChuZXcgVUlQSU1lc3NhZ2UodWlNZXNzYWdlKSlcblx0XHR9XG5cdFx0cmV0dXJuIHVpcGlNZXNzYWdlc1xuXHR9XG5cbn1cbiIsImltcG9ydCBVSVBJQ29tcG9uZW50IGZyb20gXCIuL3VpcGktY29tcG9uZW50LmpzXCJcbmltcG9ydCBmaW5kTWVzc2FnZXNXcmFwcGVyU3RyYXRlZ3kgZnJvbSBcIi4uL3VpL3N0cmF0ZWd5L2ZpbmQtbWVzc2FnZXMtd3JhcHBlci1zdHJhdGVneS5qc1wiXG5pbXBvcnQgVUlNZXNzYWdlc1dyYXBwZXIgZnJvbSBcIi4uL3VpL3VpLW1lc3NhZ2VzLXdyYXBwZXIuanNcIlxuaW1wb3J0IFVJIGZyb20gXCIuLi91aS91aS5qc1wiXG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFVJUEkgZXh0ZW5kcyBVSVBJQ29tcG9uZW50IHtcblxuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHtVSX0gdWlDb21wb25lbnRcblx0ICovXG5cdGNvbnN0cnVjdG9yKHVpQ29tcG9uZW50KSB7XG5cdFx0c3VwZXIodWlDb21wb25lbnQpXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHtXaW5kb3d9IHdpbmRvd1xuXHQgKiBAcmV0dXJucyB7VUlQSX1cblx0ICovXG5cdHN0YXRpYyBjcmVhdGUod2luZG93KSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIlVJUEkuY3JlYXRlXCIpXG5cdFx0Y29uc3QgbWVzc2FnZXNXcmFwcGVyRWxlbWVudCA9IGZpbmRNZXNzYWdlc1dyYXBwZXJTdHJhdGVneSh3aW5kb3cpXG5cdFx0bGV0IHVpcGlcblx0XHRpZihtZXNzYWdlc1dyYXBwZXJFbGVtZW50ICE9PSBudWxsKSB7XG5cdFx0XHRjb25zb2xlLmRlYnVnKFwiRm91bmQgbWVzc2FnZXNXcmFwcGVyRWxlbWVudFwiKVxuXHRcdFx0Y29uc29sZS5kZWJ1ZyhtZXNzYWdlc1dyYXBwZXJFbGVtZW50KVxuXHRcdFx0Y29uc3QgdWkgPSBuZXcgVUkod2luZG93KVxuXHRcdFx0dWkuaWRlbnRpZmllci51aU1lc3NhZ2VzV3JhcHBlciA9IG5ldyBVSU1lc3NhZ2VzV3JhcHBlcihtZXNzYWdlc1dyYXBwZXJFbGVtZW50KVxuXHRcdFx0dWlwaSA9IG5ldyBVSVBJKHVpKVxuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCJVbmFibGUgdG8gZmluZCBtZXNzYWdlc1dyYXBwZXJFbGVtZW50XCIpXG5cdFx0fVxuXHRcdHJldHVybiB1aXBpXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHJldHVybnMge1Byb21pc2V9XG5cdCAqL1xuXHRmZXRjaEFuZFJlbmRlclRocmVhZE5leHRNZXNzYWdlUGFnZSgpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwiVUlQSSBmZXRjaEFuZFJlbmRlclRocmVhZE5leHRNZXNzYWdlUGFnZVwiKVxuXHRcdHJldHVybiB0aGlzLnVpQ29tcG9uZW50LmZldGNoQW5kUmVuZGVyVGhyZWFkTmV4dE1lc3NhZ2VQYWdlKClcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZTxVSVBJTWVzc2FnZVtdPn1cblx0ICovXG5cdGNyZWF0ZVVJUElNZXNzYWdlcygpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwiVUlQSSBjcmVhdGVVSVBJTWVzc2FnZXNcIilcblx0XHRyZXR1cm4gdGhpcy51aUNvbXBvbmVudC5jcmVhdGVVSVBJTWVzc2FnZXMoKVxuXHR9XG5cbn1cbiIsImltcG9ydCBVSVBJIGZyb20gXCIuLi91aXBpL3VpcGkuanNcIlxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBJRE1VIHtcblxuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHtXaW5kb3d9IHdpbmRvd1xuXHQgKi9cblx0Y29uc3RydWN0b3Iod2luZG93KSB7XG5cdFx0dGhpcy53aW5kb3cgPSB3aW5kb3dcblx0XHR0aGlzLnVpcGkgPSBudWxsXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHJldHVybnMge1Byb21pc2U8VUlQSU1lc3NhZ2VbXT59XG5cdCAqL1xuXHRjcmVhdGVVSVBJTWVzc2FnZXMoKSB7XG5cdFx0cmV0dXJuIHRoaXMuI2dldFVJUEkoKS5jcmVhdGVVSVBJTWVzc2FnZXMoKVxuXHR9XG5cblxuXHQvKipcblx0ICpcblx0ICogQHJldHVybnMge1Byb21pc2V9XG5cdCAqL1xuXHRmZXRjaEFuZFJlbmRlclRocmVhZE5leHRNZXNzYWdlUGFnZSgpIHtcblx0XHRyZXR1cm4gdGhpcy4jZ2V0VUlQSSgpLmZldGNoQW5kUmVuZGVyVGhyZWFkTmV4dE1lc3NhZ2VQYWdlKClcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcmV0dXJucyB7VUlQSX1cblx0ICovXG5cdCNnZXRVSVBJKCkge1xuXHRcdGlmKHRoaXMudWlwaSA9PT0gbnVsbCkge1xuXHRcdFx0dGhpcy51aXBpID0gVUlQSS5jcmVhdGUodGhpcy53aW5kb3cpXG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLnVpcGlcblx0fVxuXG59XG4iLCJcbmV4cG9ydCBjbGFzcyBVbnNlbmRUaHJlYWRNZXNzYWdlc0JhdGNoU3RyYXRlZ3kge1xuXG5cdHN0YXRpYyBERUZBVUxUX0JBVENIX1NJWkUgPSA1XG5cblx0I2lkbXVcblx0I29uVW5zdWNjZXNzZnVsV29ya2Zsb3dzXG5cdCNmaW5pc2hlZF93b3JrZmxvd3NcblxuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHtJRE1VfSBpZG11XG5cdCAqL1xuXHRjb25zdHJ1Y3RvcihpZG11LCBvblVuc3VjY2Vzc2Z1bFdvcmtmbG93cz1udWxsKSB7XG5cdFx0dGhpcy5fcnVubmluZyA9IGZhbHNlXG5cdFx0dGhpcy5fc3RvcHBlZCA9IGZhbHNlXG5cdFx0dGhpcy4jZmluaXNoZWRfd29ya2Zsb3dzID0gW11cblx0XHR0aGlzLiNpZG11ID0gaWRtdVxuXHRcdHRoaXMuI29uVW5zdWNjZXNzZnVsV29ya2Zsb3dzID0gb25VbnN1Y2Nlc3NmdWxXb3JrZmxvd3Ncblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcmV0dXJucyB7Ym9vbGVhbn1cblx0ICovXG5cdGlzUnVubmluZygpIHtcblx0XHRyZXR1cm4gdGhpcy5fcnVubmluZyAmJiAhdGhpcy5fc3RvcHBlZFxuXHR9XG5cblx0c3RvcCgpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwiVW5zZW5kVGhyZWFkTWVzc2FnZXNCYXRjaFN0cmF0ZWd5IHN0b3BcIilcblx0XHR0aGlzLl9zdG9wcGVkID0gdHJ1ZVxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7bnVtYmVyfSBiYXRjaFNpemVcblx0ICogQHJldHVybnMge1Byb21pc2V9XG5cdCAqL1xuXHRydW4oYmF0Y2hTaXplKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIlVuc2VuZFRocmVhZE1lc3NhZ2VzQmF0Y2hTdHJhdGVneS5ydW4oKVwiLCBiYXRjaFNpemUpXG5cdFx0dGhpcy5fcnVubmluZyA9IHRydWVcblx0XHR0aGlzLl9zdG9wcGVkID0gZmFsc2Vcblx0XHRyZXR1cm4gdGhpcy4jcHJvY2Vzc0JhdGNoZXMoYmF0Y2hTaXplKVxuXHR9XG5cblx0I2RvbmUoKSB7XG5cdFx0dGhpcy5fcnVubmluZyA9IGZhbHNlXG5cdFx0Y29uc29sZS5kZWJ1ZyhcIlVuc2VuZFRocmVhZE1lc3NhZ2VzQmF0Y2hTdHJhdGVneSBkb25lXCIpXG5cdH1cblxuXHQjdW5zdWNjZXNzZnVsV29ya2Zsb3dBbGVydCgpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwiVW5zZW5kVGhyZWFkTWVzc2FnZXNCYXRjaFN0cmF0ZWd5IHVuc3VjY2Vzc2Z1bFdvcmtmbG93QWxlcnRcIilcblx0XHRpZighdGhpcy5fcnVubmluZykge1xuXHRcdFx0Y2xlYXJJbnRlcnZhbCh0aGlzLmludGVydmFsKVxuXHRcdH1cblx0XHRjb25zb2xlLmRlYnVnKFwiVW5zZW5kVGhyZWFkTWVzc2FnZXNCYXRjaFN0cmF0ZWd5IGZpbmlzaGVkX3dvcmtmbG93c1wiLCB0aGlzLiNmaW5pc2hlZF93b3JrZmxvd3MpXG5cdFx0Y29uc3QgdW5zdWNjZXNzZnVsV29ya2Zsb3dzID0gdGhpcy4jZmluaXNoZWRfd29ya2Zsb3dzLmZpbHRlcih1aU1lc3NhZ2UgPT4gdGhpcy4jaWRtdS53aW5kb3cuZG9jdW1lbnQuY29udGFpbnModWlNZXNzYWdlLnVpQ29tcG9uZW50LnJvb3QpKVxuXHRcdGNvbnNvbGUuZGVidWcoXCJVbnNlbmRUaHJlYWRNZXNzYWdlc0JhdGNoU3RyYXRlZ3kgdW5zdWNjZXNzZnVsV29ya2Zsb3dzXCIsIHVuc3VjY2Vzc2Z1bFdvcmtmbG93cylcblx0XHRpZih1bnN1Y2Nlc3NmdWxXb3JrZmxvd3MubGVuZ3RoID49IDEpIHtcblx0XHRcdHVuc3VjY2Vzc2Z1bFdvcmtmbG93cy5mb3JFYWNoKGZhaWxlZFdvcmtmbG93ID0+IHRoaXMuI2ZpbmlzaGVkX3dvcmtmbG93cy5zcGxpY2UodGhpcy4jZmluaXNoZWRfd29ya2Zsb3dzLmluZGV4T2YoZmFpbGVkV29ya2Zsb3cpLCAxKSlcblx0XHRcdHRoaXMuI29uVW5zdWNjZXNzZnVsV29ya2Zsb3dzKHVuc3VjY2Vzc2Z1bFdvcmtmbG93cylcblx0XHR9XG5cdH1cblxuXHRhc3luYyAjcHJvY2Vzc0JhdGNoZXMoYmF0Y2hTaXplKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIlVuc2VuZFRocmVhZE1lc3NhZ2VzQmF0Y2hTdHJhdGVneSBwcm9jZXNzQmF0Y2hlc1wiKVxuXHRcdGxldCBkb25lID0gZmFsc2Vcblx0XHRmb3IobGV0IGkgPSAwOyBpIDwgYmF0Y2hTaXplO2krKykge1xuXHRcdFx0aWYodGhpcy5fc3RvcHBlZCkge1xuXHRcdFx0XHRicmVha1xuXHRcdFx0fVxuXHRcdFx0ZG9uZSA9IGF3YWl0IHRoaXMuI2lkbXUuZmV0Y2hBbmRSZW5kZXJUaHJlYWROZXh0TWVzc2FnZVBhZ2UoKVxuXHRcdFx0aWYoZG9uZSkge1xuXHRcdFx0XHRicmVha1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0YXdhaXQgbmV3IFByb21pc2UocmVzb2x2ZSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIHRoaXMuI2lkbXUud2luZG93LklETVVfTkVYVF9NRVNTQUdFX1BBR0VfREVMQVkpKVxuXHRcdFx0fVxuXHRcdH1cblx0XHR0cnkge1xuXHRcdFx0Zm9yKGNvbnN0IHVpcGlNZXNzYWdlIG9mIGF3YWl0IHRoaXMuI2lkbXUuY3JlYXRlVUlQSU1lc3NhZ2VzKCkpIHtcblx0XHRcdFx0aWYodGhpcy5fc3RvcHBlZCkge1xuXHRcdFx0XHRcdGJyZWFrXG5cdFx0XHRcdH1cblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRhd2FpdCB1aXBpTWVzc2FnZS51bnNlbmQoKVxuXHRcdFx0XHRcdHRoaXMuI2ZpbmlzaGVkX3dvcmtmbG93cy5wdXNoKHVpcGlNZXNzYWdlKVxuXHRcdFx0XHRcdGF3YWl0IG5ldyBQcm9taXNlKHJlc29sdmUgPT4gc2V0VGltZW91dChyZXNvbHZlLCB0aGlzLiNpZG11LndpbmRvdy5JRE1VX01FU1NBR0VfUVVFVUVfREVMQVkpKVxuXHRcdFx0XHR9IGNhdGNoKHJlc3VsdCkge1xuXHRcdFx0XHRcdGNvbnNvbGUuZXJyb3IocmVzdWx0KVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSBjYXRjaChleCkge1xuXHRcdFx0Y29uc29sZS5lcnJvcihleClcblx0XHR9XG5cdFx0aWYoIXRoaXMuaW50ZXJ2YWwgJiYgdGhpcy4jb25VbnN1Y2Nlc3NmdWxXb3JrZmxvd3MpIHtcblx0XHRcdHRoaXMuaW50ZXJ2YWwgPSBzZXRJbnRlcnZhbCgoKSA9PiB0aGlzLiN1bnN1Y2Nlc3NmdWxXb3JrZmxvd0FsZXJ0KCksIHRoaXMuI2lkbXUud2luZG93LklETVVfVU5TVUNFU1NGVUxfV09SS0ZMT1dfQUxFUlRfSU5URVJWQUwpXG5cdFx0fVxuXHRcdGlmKGRvbmUpIHtcblx0XHRcdHRoaXMuI2RvbmUoKVxuXHRcdH0gZWxzZSBpZighdGhpcy5fc3RvcHBlZCkge1xuXHRcdFx0cmV0dXJuIHRoaXMuI3Byb2Nlc3NCYXRjaGVzKGJhdGNoU2l6ZSlcblx0XHR9XG5cdH1cbn1cbiIsIi8qKlxuICpcbiAqIEBwYXJhbSB7RG9jdW1lbnR9IGRvY3VtZW50XG4gKiBAcmV0dXJucyB7SFRNTEJ1dHRvbkVsZW1lbnR9XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVBbGVydHNXcmFwcGVyRWxlbWVudChkb2N1bWVudCkge1xuXHRjb25zdCBhbGVydHNXcmFwcGVyRWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIilcblx0YWxlcnRzV3JhcHBlckVsZW1lbnQuaWQgPSBcImlkbXUtYWxlcnRzXCJcblx0YWxlcnRzV3JhcHBlckVsZW1lbnQuc3R5bGUucG9zaXRpb24gPSBcImZpeGVkXCJcblx0YWxlcnRzV3JhcHBlckVsZW1lbnQuc3R5bGUudG9wID0gXCIyMHB4XCJcblx0YWxlcnRzV3JhcHBlckVsZW1lbnQuc3R5bGUucmlnaHQgPSBcIjIwcHhcIlxuXHRhbGVydHNXcmFwcGVyRWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gXCJncmlkXCJcblx0cmV0dXJuIGFsZXJ0c1dyYXBwZXJFbGVtZW50XG59XG5cbi8qKlxuICpcbiAqIEBwYXJhbSB7RG9jdW1lbnR9IGRvY3VtZW50XG4gKiBAcGFyYW0ge3N0cmluZ30gICB0ZXh0XG4gKiBAcmV0dXJucyB7SFRNTEJ1dHRvbkVsZW1lbnR9XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVBbGVydEVsZW1lbnQoZG9jdW1lbnQsIHRleHQpIHtcblx0Y29uc3QgYWxlcnRFbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKVxuXHRhbGVydEVsZW1lbnQudGV4dENvbnRlbnQgPSB0ZXh0XG5cdHJldHVybiBhbGVydEVsZW1lbnRcbn1cbiIsIi8qKlxuICogQHBhcmFtIHtEb2N1bWVudH0gZG9jdW1lbnRcbiAqIEByZXR1cm5zIHtIVE1MRGl2RWxlbWVudH1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZU92ZXJsYXlFbGVtZW50KGRvY3VtZW50KSB7XG5cdGNvbnN0IG92ZXJsYXlFbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKVxuXHRvdmVybGF5RWxlbWVudC5pZCA9IFwiaWRtdS1vdmVybGF5XCJcblx0b3ZlcmxheUVsZW1lbnQudGFiSW5kZXggPSAwXG5cdG92ZXJsYXlFbGVtZW50LnN0eWxlLnRvcCA9IFwiMFwiXG5cdG92ZXJsYXlFbGVtZW50LnN0eWxlLnJpZ2h0ID0gXCIwXCJcblx0b3ZlcmxheUVsZW1lbnQuc3R5bGUucG9zaXRpb24gPSBcImZpeGVkXCJcblx0b3ZlcmxheUVsZW1lbnQuc3R5bGUud2lkdGggPSBcIjEwMHZ3XCJcblx0b3ZlcmxheUVsZW1lbnQuc3R5bGUuaGVpZ2h0ID0gXCIxMDB2aFwiXG5cdG92ZXJsYXlFbGVtZW50LnN0eWxlLnpJbmRleCA9IFwiOTk4XCJcblx0b3ZlcmxheUVsZW1lbnQuc3R5bGUuYmFja2dyb3VuZENvbG9yID0gXCIjMDAwMDAwZDZcIlxuXHRvdmVybGF5RWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCJcblx0cmV0dXJuIG92ZXJsYXlFbGVtZW50XG59XG4iLCJpbXBvcnQgeyBjcmVhdGVNZW51QnV0dG9uRWxlbWVudCB9IGZyb20gXCIuL21lbnUtYnV0dG9uLmpzXCJcbmltcG9ydCB7IGNyZWF0ZU1lbnVFbGVtZW50IH0gZnJvbSBcIi4vbWVudS5qc1wiXG5pbXBvcnQgSURNVSBmcm9tIFwiLi4vLi4vLi4vaWRtdS9pZG11LmpzXCJcbmltcG9ydCB7IFVuc2VuZFRocmVhZE1lc3NhZ2VzQmF0Y2hTdHJhdGVneSB9IGZyb20gXCIuLi9zdHJhdGVneS5qc1wiXG5pbXBvcnQgeyBjcmVhdGVBbGVydHNXcmFwcGVyRWxlbWVudCB9IGZyb20gXCIuL2FsZXJ0LmpzXCJcbmltcG9ydCB7IGNyZWF0ZU92ZXJsYXlFbGVtZW50IH0gZnJvbSBcIi4vb3ZlcmxheS5qc1wiXG5cbi8qKlxuICpcbiAqIEBwYXJhbSB7d2luZG93fSB3aW5kb3dcbiAqIEByZXR1cm5zIHtIVE1MRGl2RWxlbWVudH0gICAgb2JqZWN0LnVpRWxlbWVudFxuICogQHJldHVybnMge0hUTUxCdXR0b25FbGVtZW50fSBvYmplY3QudW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b25cbiAqIEByZXR1cm5zIHtIVE1MQnV0dG9uRWxlbWVudH0gb2JqZWN0LmxvYWRUaHJlYWRNZXNzYWdlc0J1dHRvblxuICovXG5leHBvcnQgZnVuY3Rpb24gcmVuZGVyKHdpbmRvdykge1xuXHRjb25zb2xlLmRlYnVnKFwicmVuZGVyXCIpXG5cdGNvbnN0IGlkbXUgPSBuZXcgSURNVSh3aW5kb3cpXG5cdGNvbnN0IHN0cmF0ZWd5ID0gbmV3IFVuc2VuZFRocmVhZE1lc3NhZ2VzQmF0Y2hTdHJhdGVneShpZG11LCAodW5zdWNjZXNzZnVsV29ya2Zsb3dzKSA9PiB7XG5cdFx0Y29uc29sZS5sb2codW5zdWNjZXNzZnVsV29ya2Zsb3dzKVxuXHR9KVxuXHRjb25zdCB7IG92ZXJsYXlFbGVtZW50LCB1aUVsZW1lbnQsIG1lbnVFbGVtZW50LCB1bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbiwgbG9hZFRocmVhZE1lc3NhZ2VzQnV0dG9uIH0gPSBjcmVhdGVVSUVsZW1lbnQod2luZG93LmRvY3VtZW50KVxuXHRmdW5jdGlvbiBvblVuc2VuZGluZ0ZpbmlzaGVkKCkge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJyZW5kZXIgb25VbnNlbmRpbmdGaW5pc2hlZFwiKVxuXHRcdDtbLi4ubWVudUVsZW1lbnQucXVlcnlTZWxlY3RvckFsbChcImJ1dHRvblwiKV0uZmlsdGVyKGJ1dHRvbiA9PiBidXR0b24gIT09IHVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uKS5mb3JFYWNoKGJ1dHRvbiA9PiB7XG5cdFx0XHRidXR0b24uc3R5bGUudmlzaWJpbGl0eSA9IFwiXCJcblx0XHRcdGJ1dHRvbi5kaXNhYmxlZCA9IGZhbHNlXG5cdFx0fSlcblx0XHR1bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbi50ZXh0Q29udGVudCA9IHVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uLmRhdGFUZXh0Q29udGVudFxuXHRcdHVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uLnN0eWxlLmJhY2tncm91bmRDb2xvciA9IHVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uLmRhdGFCYWNrZ3JvdW5kQ29sb3Jcblx0XHRvdmVybGF5RWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCJcblx0XHRpZighc3RyYXRlZ3kuX3N0b3BwZWQpIHtcblx0XHRcdHdpbmRvdy5hbGVydChcIklETVU6IEZpbmlzaGVkXCIpXG5cdFx0fVxuXHR9XG5cdGFzeW5jIGZ1bmN0aW9uIHN0YXJ0VW5zZW5kaW5nKCkge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJVc2VyIGFza2VkIGZvciBtZXNzYWdlcyB1bnNlbmRpbmcgdG8gc3RhcnQ7IFVJIGludGVyYWN0aW9uIHdpbGwgYmUgZGlzYWJsZWQgaW4gdGhlIG1lYW50aW1lXCIpXG5cdFx0O1suLi5tZW51RWxlbWVudC5xdWVyeVNlbGVjdG9yQWxsKFwiYnV0dG9uXCIpXS5maWx0ZXIoYnV0dG9uID0+IGJ1dHRvbiAhPT0gdW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24pLmZvckVhY2goYnV0dG9uID0+IHtcblx0XHRcdGJ1dHRvbi5zdHlsZS52aXNpYmlsaXR5ID0gXCJoaWRkZW5cIlxuXHRcdFx0YnV0dG9uLmRpc2FibGVkID0gdHJ1ZVxuXHRcdH0pXG5cdFx0b3ZlcmxheUVsZW1lbnQuc3R5bGUuZGlzcGxheSA9IFwiXCJcblx0XHRvdmVybGF5RWxlbWVudC5mb2N1cygpXG5cdFx0dW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24udGV4dENvbnRlbnQgPSBcIlN0b3AgcHJvY2Vzc2luZ1wiXG5cdFx0dW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24uc3R5bGUuYmFja2dyb3VuZENvbG9yID0gXCIjRkEzODNFXCJcblx0XHRjb25zdCBiYXRjaFNpemUgPSB3aW5kb3cubG9jYWxTdG9yYWdlLmdldEl0ZW0oXCJJRE1VX0JBVENIX1NJWkVcIikgfHwgVW5zZW5kVGhyZWFkTWVzc2FnZXNCYXRjaFN0cmF0ZWd5LkRFRkFVTFRfQkFUQ0hfU0laRVxuXHRcdGF3YWl0IHN0cmF0ZWd5LnJ1bihiYXRjaFNpemUpXG5cdFx0b25VbnNlbmRpbmdGaW5pc2hlZCgpXG5cdH1cblx0ZnVuY3Rpb24gaGFuZGxlRXZlbnRzKGV2ZW50KSB7XG5cdFx0aWYoc3RyYXRlZ3kuaXNSdW5uaW5nKCkpIHtcblx0XHRcdGNvbnNvbGUuaW5mbyhcIlVzZXIgaW50ZXJhY3Rpb24gaXMgZGlzYWJsZWQgYXMgdGhlIHVuc2VuZGluZyBpcyBzdGlsbCBydW5uaW5nOyBQbGVhc2Ugc3RvcCB0aGUgZXhlY3V0aW9uIGZpcnN0LlwiKVxuXHRcdFx0ZXZlbnQuc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uKClcblx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KClcblx0XHRcdGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpXG5cdFx0XHRvdmVybGF5RWxlbWVudC5mb2N1cygpXG5cdFx0XHRyZXR1cm4gZmFsc2Vcblx0XHR9XG5cdH1cblx0ZnVuY3Rpb24gb25NdXRhdGlvbnMoKSB7XG5cdFx0aWYod2luZG93LmxvY2F0aW9uLnBhdGhuYW1lLnN0YXJ0c1dpdGgoXCIvZGlyZWN0L3QvXCIpKSB7XG5cdFx0XHR1aUVsZW1lbnQuc3R5bGUuZGlzcGxheSA9IFwiXCJcblx0XHR9IGVsc2Uge1xuXHRcdFx0dWlFbGVtZW50LnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIlxuXHRcdFx0c3RyYXRlZ3kuc3RvcCgpXG5cdFx0fVxuXHR9XG5cdHdpbmRvdy5kb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKFwia2V5ZG93blwiLCBoYW5kbGVFdmVudHMpXG5cdHdpbmRvdy5kb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKFwia2V5dXBcIiwgaGFuZGxlRXZlbnRzKVxuXHRuZXcgTXV0YXRpb25PYnNlcnZlcihvbk11dGF0aW9ucykub2JzZXJ2ZSh3aW5kb3cuZG9jdW1lbnQuYm9keSwgeyBjaGlsZExpc3Q6IHRydWUgfSlcblx0bmV3IE11dGF0aW9uT2JzZXJ2ZXIob25NdXRhdGlvbnMpLm9ic2VydmUod2luZG93LmRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCJbaWRePW1vdW50XSA+IGRpdiA+IGRpdiA+IGRpdlwiKSwgeyBjaGlsZExpc3Q6IHRydWUsIGF0dHJpYnV0ZXM6IHRydWUgfSlcblx0dW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24uZGF0YVRleHRDb250ZW50ID0gdW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24udGV4dENvbnRlbnRcblx0dW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24uZGF0YUJhY2tncm91bmRDb2xvciA9IHVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uLnN0eWxlLmJhY2tncm91bmRDb2xvclxuXHR1bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xuXHRcdGlmKHN0cmF0ZWd5LmlzUnVubmluZygpKSB7XG5cdFx0XHRjb25zb2xlLmRlYnVnKFwiVXNlciBhc2tlZCBmb3IgbWVzc2FnZXMgdW5zZW5kaW5nIHRvIHN0b3BcIilcblx0XHRcdHN0cmF0ZWd5LnN0b3AoKVxuXHRcdFx0b25VbnNlbmRpbmdGaW5pc2hlZCgpXG5cdFx0fSBlbHNlIHtcblx0XHRcdHN0YXJ0VW5zZW5kaW5nKClcblx0XHR9XG5cdH0pXG5cdGxvYWRUaHJlYWRNZXNzYWdlc0J1dHRvbi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJsb2FkVGhyZWFkTWVzc2FnZXNCdXR0b24gY2xpY2tcIilcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgYmF0Y2hTaXplID0gcGFyc2VJbnQod2luZG93LnByb21wdChcIkhvdyBtYW55IHBhZ2VzIHNob3VsZCB3ZSBsb2FkIGJlZm9yZSBlYWNoIHVuc2VuZGluZz8gXCIsIHdpbmRvdy5sb2NhbFN0b3JhZ2UuZ2V0SXRlbShcIklETVVfQkFUQ0hfU0laRVwiKSB8fCBVbnNlbmRUaHJlYWRNZXNzYWdlc0JhdGNoU3RyYXRlZ3kuREVGQVVMVF9CQVRDSF9TSVpFICkpXG5cdFx0XHRpZihwYXJzZUludChiYXRjaFNpemUpKSB7XG5cdFx0XHRcdHdpbmRvdy5sb2NhbFN0b3JhZ2Uuc2V0SXRlbShcIklETVVfQkFUQ0hfU0laRVwiLCBwYXJzZUludChiYXRjaFNpemUpKVxuXHRcdFx0fVxuXHRcdFx0Y29uc29sZS5kZWJ1ZyhgU2V0dGluZyBJRE1VX0JBVENIX1NJWkUgdG8gJHtiYXRjaFNpemV9YClcblx0XHR9IGNhdGNoKGV4KSB7XG5cdFx0XHRjb25zb2xlLmVycm9yKGV4KVxuXHRcdH1cblx0fSlcblx0d2luZG93LmRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQodWlFbGVtZW50KVxuXHRyZXR1cm4geyB1aUVsZW1lbnQsIHVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uLCBsb2FkVGhyZWFkTWVzc2FnZXNCdXR0b24gfVxufVxuXG4vKipcbiAqXG4gKiBAcGFyYW0gICB7RG9jdW1lbnR9ICAgICAgICAgIGRvY3VtZW50XG4gKiBAcmV0dXJucyB7b2JqZWN0fVxuICogQHJldHVybnMge0hUTUxEaXZFbGVtZW50fSAgICBvYmplY3QudWlFbGVtZW50XG4gKiBAcmV0dXJucyB7SFRNTERpdkVsZW1lbnR9ICAgIG9iamVjdC5vdmVybGF5RWxlbWVudFxuICogQHJldHVybnMge0hUTUxEaXZFbGVtZW50fSAgICBvYmplY3QubWVudUVsZW1lbnRcbiAqIEByZXR1cm5zIHtIVE1MQnV0dG9uRWxlbWVudH0gb2JqZWN0LnVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uXG4gKiBAcmV0dXJucyB7SFRNTEJ1dHRvbkVsZW1lbnR9IG9iamVjdC5sb2FkVGhyZWFkTWVzc2FnZXNCdXR0b25cbiAqL1xuZnVuY3Rpb24gY3JlYXRlVUlFbGVtZW50KGRvY3VtZW50KSB7XG5cdGNvbnN0IHVpRWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIilcblx0Y29uc3QgbWVudUVsZW1lbnQgPSBjcmVhdGVNZW51RWxlbWVudChkb2N1bWVudClcblx0Y29uc3Qgb3ZlcmxheUVsZW1lbnQgPSBjcmVhdGVPdmVybGF5RWxlbWVudChkb2N1bWVudClcblx0Y29uc3QgYWxlcnRzV3JhcHBlckVsZW1lbnQgPSBjcmVhdGVBbGVydHNXcmFwcGVyRWxlbWVudChkb2N1bWVudClcblx0Y29uc3QgdW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24gPSBjcmVhdGVNZW51QnV0dG9uRWxlbWVudChkb2N1bWVudCwgXCJVbnNlbmQgYWxsIERNc1wiKVxuXHRjb25zdCBsb2FkVGhyZWFkTWVzc2FnZXNCdXR0b24gPSBjcmVhdGVNZW51QnV0dG9uRWxlbWVudChkb2N1bWVudCwgXCJCYXRjaCBzaXplXCIsIFwic2Vjb25kYXJ5XCIpXG5cdGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQob3ZlcmxheUVsZW1lbnQpXG5cdGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoYWxlcnRzV3JhcHBlckVsZW1lbnQpXG5cdG1lbnVFbGVtZW50LmFwcGVuZENoaWxkKHVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uKVxuXHRtZW51RWxlbWVudC5hcHBlbmRDaGlsZChsb2FkVGhyZWFkTWVzc2FnZXNCdXR0b24pXG5cdHVpRWxlbWVudC5hcHBlbmRDaGlsZChtZW51RWxlbWVudClcblx0cmV0dXJuIHsgdWlFbGVtZW50LCBvdmVybGF5RWxlbWVudCwgbWVudUVsZW1lbnQsIHVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uLCBsb2FkVGhyZWFkTWVzc2FnZXNCdXR0b24gfVxufVxuIiwiaW1wb3J0IHsgcmVuZGVyIH0gZnJvbSBcIi4vdWkvdWkuanNcIlxuXG5pZighd2luZG93LklETVVfREVCVUcpIHtcblx0Y29uc29sZS5kZWJ1ZyA9ICgpID0+IHt9XG59XG5cbnJlbmRlcih3aW5kb3cpXG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Q0FBQSxNQUFNLFlBQVksR0FBRztDQUNyQixDQUFDLFNBQVMsRUFBRSxTQUFTO0NBQ3JCLENBQUMsV0FBVyxFQUFFLFdBQVc7Q0FDekIsRUFBQztBQUNEO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNPLFNBQVMsZ0JBQWdCLENBQUMsYUFBYSxFQUFFLFNBQVMsQ0FBQyxZQUFZLENBQUMsT0FBTyxFQUFFO0NBQ2hGLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxRQUFRLEdBQUcsNkJBQTRCO0NBQzVELENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxLQUFLLEdBQUcsUUFBTztDQUNwQyxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLE1BQUs7Q0FDbkMsQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLFlBQVksR0FBRyxNQUFLO0NBQ3pDLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxPQUFPLEdBQUcsTUFBSztDQUNwQyxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsVUFBVSxHQUFHLE9BQU07Q0FDeEMsQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxVQUFTO0NBQ3ZDLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxVQUFVLEdBQUcsK0JBQThCO0NBQ2hFLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxlQUFlLEdBQUcsQ0FBQyxhQUFhLEVBQUUsU0FBUyxDQUFDLFNBQVMsRUFBQztDQUMzRTs7Q0NsQkE7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDTyxTQUFTLHVCQUF1QixDQUFDLFFBQVEsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFO0NBQ25FLENBQUMsTUFBTSxhQUFhLEdBQUcsUUFBUSxDQUFDLGFBQWEsQ0FBQyxRQUFRLEVBQUM7Q0FDdkQsQ0FBQyxhQUFhLENBQUMsV0FBVyxHQUFHLEtBQUk7Q0FDakMsQ0FBQyxnQkFBZ0IsQ0FBQyxhQUFhLEVBQUUsU0FBUyxFQUFDO0NBQzNDLENBQUMsYUFBYSxDQUFDLGdCQUFnQixDQUFDLFdBQVcsRUFBRSxNQUFNO0NBQ25ELEVBQUUsYUFBYSxDQUFDLEtBQUssQ0FBQyxNQUFNLEdBQUcsQ0FBQyxnQkFBZ0IsRUFBQztDQUNqRCxFQUFFLEVBQUM7Q0FDSCxDQUFDLGFBQWEsQ0FBQyxnQkFBZ0IsQ0FBQyxVQUFVLEVBQUUsTUFBTTtDQUNsRCxFQUFFLGFBQWEsQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBQztDQUNqQyxFQUFFLEVBQUM7Q0FDSCxDQUFDLE9BQU8sYUFBYTtDQUNyQjs7Q0NwQkE7Q0FDQTtDQUNBO0NBQ0E7Q0FDTyxTQUFTLGlCQUFpQixDQUFDLFFBQVEsRUFBRTtDQUM1QyxDQUFDLE1BQU0sV0FBVyxHQUFHLFFBQVEsQ0FBQyxhQUFhLENBQUMsS0FBSyxFQUFDO0NBQ2xELENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxHQUFHLEdBQUcsT0FBTTtDQUMvQixDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsS0FBSyxHQUFHLFFBQU87Q0FDbEMsQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLFFBQVEsR0FBRyxRQUFPO0NBQ3JDLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxNQUFNLEdBQUcsSUFBRztDQUMvQixDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsT0FBTyxHQUFHLE9BQU07Q0FDbkMsQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLEdBQUcsR0FBRyxPQUFNO0NBQy9CLENBQUMsT0FBTyxXQUFXO0NBQ25COztDQ2JlLE1BQU0sYUFBYSxDQUFDO0NBQ25DO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsQ0FBQyxXQUFXLENBQUMsV0FBVyxFQUFFO0NBQzFCLEVBQUUsSUFBSSxDQUFDLFlBQVksR0FBRyxZQUFXO0NBQ2pDLEVBQUU7QUFDRjtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsQ0FBQyxJQUFJLFdBQVcsR0FBRztDQUNuQixFQUFFLE9BQU8sSUFBSSxDQUFDLFlBQVk7Q0FDMUIsRUFBRTtDQUNGOztDQ2hCQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0FBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDTyxTQUFTLGNBQWMsQ0FBQyxNQUFNLEVBQUUsVUFBVSxFQUFFO0NBQ25ELENBQUMsT0FBTyxJQUFJLE9BQU8sQ0FBQyxDQUFDLE9BQU8sS0FBSztDQUNqQyxFQUFFLElBQUksT0FBTyxHQUFHLFVBQVUsR0FBRTtDQUM1QixFQUFFLEdBQUcsT0FBTyxFQUFFO0NBQ2QsR0FBRyxPQUFPLENBQUMsT0FBTyxFQUFDO0NBQ25CLEdBQUcsTUFBTTtDQUNULEdBQUcsSUFBSSxnQkFBZ0IsQ0FBQyxDQUFDLFNBQVMsRUFBRSxRQUFRLEtBQUs7Q0FDakQsSUFBSSxPQUFPLEdBQUcsVUFBVSxHQUFFO0NBQzFCLElBQUksR0FBRyxPQUFPLEVBQUU7Q0FDaEIsS0FBSyxRQUFRLENBQUMsVUFBVSxHQUFFO0NBQzFCLEtBQUssT0FBTyxDQUFDLE9BQU8sRUFBQztDQUNyQixLQUFLO0NBQ0wsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRSxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsU0FBUyxDQUFDLElBQUksRUFBRSxFQUFDO0NBQ3hELEdBQUc7Q0FDSCxFQUFFLENBQUM7Q0FDSCxDQUFDO0FBQ0Q7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNPLFNBQVMsc0JBQXNCLENBQUMsV0FBVyxFQUFFLE1BQU0sRUFBRSxVQUFVLEVBQUU7Q0FDeEUsQ0FBQyxNQUFNLE9BQU8sR0FBRyxjQUFjLENBQUMsTUFBTSxFQUFFLFVBQVUsRUFBQztDQUNuRCxDQUFDLFdBQVcsQ0FBQyxLQUFLLEdBQUU7Q0FDcEIsQ0FBQyxPQUFPLFVBQVUsRUFBRSxJQUFJLE9BQU87Q0FDL0I7O0NDdENlLE1BQU0sV0FBVyxDQUFDO0NBQ2pDO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLFdBQVcsQ0FBQyxJQUFJLEVBQUUsVUFBVSxDQUFDLEVBQUUsRUFBRTtDQUNsQyxFQUFFLElBQUksQ0FBQyxJQUFJLEdBQUcsS0FBSTtDQUNsQixFQUFFLElBQUksQ0FBQyxVQUFVLEdBQUcsV0FBVTtDQUM5QixFQUFFO0FBQ0Y7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLGNBQWMsQ0FBQyxNQUFNLEVBQUUsVUFBVSxFQUFFO0NBQ3BDLEVBQUUsT0FBTyxVQUFVLEVBQUUsSUFBSSxjQUFjLENBQUMsTUFBTSxFQUFFLFVBQVUsQ0FBQztDQUMzRCxFQUFFO0FBQ0Y7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsc0JBQXNCLENBQUMsV0FBVyxFQUFFLE1BQU0sRUFBRSxVQUFVLEVBQUU7Q0FDekQsRUFBRSxPQUFPLHNCQUFzQixDQUFDLFdBQVcsRUFBRSxNQUFNLEVBQUUsVUFBVSxDQUFDO0NBQ2hFLEVBQUU7QUFDRjtDQUNBOztDQ2hDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ2UsZUFBZSx1QkFBdUIsQ0FBQyxJQUFJLEVBQUU7Q0FDNUQsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLHlCQUF5QixFQUFDO0NBQ3pDLENBQUMsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFHO0NBQ3JCLENBQUMsSUFBSSxDQUFDLFNBQVMsR0FBRyxFQUFDO0NBQ25CLENBQUMsSUFBSSxrQkFBaUI7Q0FDdEIsQ0FBQyxNQUFNLGNBQWMsR0FBRyxNQUFNLE9BQU8sQ0FBQyxJQUFJLENBQUM7Q0FDM0MsRUFBRSxjQUFjLENBQUMsSUFBSSxFQUFFLE1BQU0sSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDLGtCQUFrQixDQUFDLENBQUMsQ0FBQztDQUN0RSxFQUFFLElBQUksT0FBTyxDQUFDLE9BQU8sSUFBSTtDQUN6QixHQUFHLGlCQUFpQixHQUFHLFVBQVUsQ0FBQyxPQUFPLEVBQUUsR0FBRyxFQUFDO0NBQy9DLEdBQUcsQ0FBQztDQUNKLEVBQUUsRUFBQztDQUNILENBQUMsWUFBWSxDQUFDLGlCQUFpQixFQUFDO0NBQ2hDLENBQUMsR0FBRyxjQUFjLEVBQUU7Q0FDcEIsRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLDJFQUEyRSxFQUFDO0NBQzVGLEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyxvQ0FBb0MsRUFBRSxJQUFJLENBQUMsU0FBUyxFQUFDO0NBQ3JFLEVBQUUsTUFBTSxjQUFjLENBQUMsSUFBSSxFQUFFLE1BQU0sSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDLGtCQUFrQixDQUFDLENBQUMsS0FBSyxJQUFJLEVBQUM7Q0FDckYsRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLCtFQUErRSxFQUFDO0NBQ2hHLEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLHNDQUFzQyxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxTQUFTLEtBQUssQ0FBQyxHQUFHLG1CQUFtQixHQUFHLHdFQUF3RSxDQUFDLENBQUMsSUFBRztDQUN4TSxFQUFFLE9BQU8sSUFBSSxDQUFDLFNBQVMsS0FBSyxDQUFDO0NBQzdCLEVBQUUsTUFBTTtDQUNSLEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyxnREFBZ0QsRUFBQztDQUNqRSxFQUFFLE9BQU8sSUFBSTtDQUNiLEVBQUU7Q0FDRjs7Q0MzQmUsTUFBTSxpQkFBaUIsU0FBUyxXQUFXLENBQUM7QUFDM0Q7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsT0FBTyxJQUFJLENBQUMsTUFBTSxFQUFFO0NBQ3JCLEVBQUUsT0FBTyxNQUFNLENBQUMsUUFBUSxDQUFDLGFBQWEsQ0FBQyx3Q0FBd0MsQ0FBQztDQUNoRixFQUFFO0FBQ0Y7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsbUNBQW1DLEdBQUc7Q0FDdkMsRUFBRSxPQUFPLHVCQUF1QixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUM7Q0FDM0MsRUFBRTtBQUNGO0NBQ0E7O0NDbkJBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDZSxTQUFTLDJCQUEyQixDQUFDLE1BQU0sRUFBRTtDQUM1RCxDQUFDLE9BQU8saUJBQWlCLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQztDQUN0Qzs7Q0NQZSxNQUFNLFNBQVMsU0FBUyxXQUFXLENBQUM7QUFDbkQ7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsQ0FBQyxhQUFhLGNBQWMsQ0FBQyxPQUFPLEVBQUU7Q0FDdEMsRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLGdCQUFnQixFQUFFLE9BQU8sRUFBQztDQUMxQyxFQUFFLE9BQU8sQ0FBQyxhQUFhLENBQUMsdUNBQXVDLENBQUMsRUFBRSxLQUFLLEdBQUU7Q0FDekUsRUFBRSxPQUFPLENBQUMsYUFBYSxDQUFDLENBQUMsd0NBQXdDLENBQUMsQ0FBQyxFQUFFLEtBQUssR0FBRTtDQUM1RSxFQUFFLE9BQU8sQ0FBQyxhQUFhLENBQUMsSUFBSSxVQUFVLENBQUMsVUFBVSxFQUFFLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxDQUFDLEVBQUM7Q0FDdEUsRUFBRSxNQUFNLFNBQVMsR0FBRyxJQUFJLFNBQVMsQ0FBQyxPQUFPLEVBQUM7Q0FDMUMsRUFBRSxJQUFJLFFBQU87Q0FDYixFQUFFLE1BQU0sWUFBWSxHQUFHLE1BQU0sT0FBTyxDQUFDLElBQUksQ0FBQztDQUMxQyxHQUFHLFNBQVMsQ0FBQyxxQkFBcUIsRUFBRTtDQUNwQyxHQUFHLElBQUksT0FBTyxDQUFDLE9BQU8sSUFBSTtDQUMxQixJQUFJLE9BQU8sR0FBRyxVQUFVLENBQUMsT0FBTyxFQUFFLEVBQUUsRUFBQztDQUNyQyxJQUFJLENBQUM7Q0FDTCxHQUFHLEVBQUM7Q0FDSixFQUFFLFlBQVksQ0FBQyxPQUFPLEVBQUM7Q0FDdkIsRUFBRSxHQUFHLFlBQVksRUFBRTtDQUNuQixHQUFHLE1BQU0sa0JBQWtCLEdBQUcsTUFBTSxTQUFTLENBQUMsZUFBZSxDQUFDLFlBQVksRUFBQztDQUMzRSxHQUFHLE1BQU0sU0FBUyxDQUFDLGdCQUFnQixDQUFDLFlBQVksRUFBRSxrQkFBa0IsRUFBQztDQUNyRSxHQUFHLE1BQU0sU0FBUyxDQUFDLG9CQUFvQixHQUFFO0NBQ3pDLEdBQUcsT0FBTyxrQkFBa0IsSUFBSSxrQkFBa0IsQ0FBQyxXQUFXLENBQUMsaUJBQWlCLEVBQUUsS0FBSyxRQUFRO0NBQy9GLEdBQUc7Q0FDSCxFQUFFLE9BQU8sS0FBSztDQUNkLEVBQUU7QUFDRjtDQUNBLENBQUMsY0FBYyxHQUFHO0NBQ2xCLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxjQUFjLEdBQUU7Q0FDNUIsRUFBRTtBQUNGO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLHFCQUFxQixHQUFHO0NBQ3pCLEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyx5Q0FBeUMsRUFBQztDQUMxRCxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksVUFBVSxDQUFDLFdBQVcsRUFBRSxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsQ0FBQyxFQUFDO0NBQ3pFLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxVQUFVLENBQUMsV0FBVyxFQUFFLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxDQUFDLEVBQUM7Q0FDekUsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxXQUFXLEVBQUUsRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLENBQUMsRUFBQztDQUN6RSxFQUFFLE9BQU8sSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLE1BQU0sSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsbUJBQW1CLENBQUMsQ0FBQztDQUMzRixFQUFFO0FBQ0Y7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsb0JBQW9CLEdBQUc7Q0FDeEIsRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLDRDQUE0QyxFQUFDO0NBQzdELEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxVQUFVLENBQUMsV0FBVyxFQUFFLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxDQUFDLEVBQUM7Q0FDekUsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxVQUFVLEVBQUUsRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLENBQUMsRUFBQztDQUN4RSxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksVUFBVSxDQUFDLFlBQVksRUFBRSxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsQ0FBQyxFQUFDO0NBQzFFLEVBQUUsT0FBTyxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsTUFBTSxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxtQkFBbUIsQ0FBQyxLQUFLLElBQUksQ0FBQztDQUNwRyxFQUFFO0FBQ0Y7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsQ0FBQyxNQUFNLGVBQWUsQ0FBQyxZQUFZLEVBQUU7Q0FDckMsRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLG1DQUFtQyxFQUFFLFlBQVksRUFBQztDQUNsRSxFQUFFLE1BQU0saUJBQWlCLEdBQUcsTUFBTSxJQUFJLENBQUMsc0JBQXNCO0NBQzdELEdBQUcsWUFBWTtDQUNmLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSTtDQUMvQixHQUFHLE1BQU07Q0FDVCxJQUFJLE1BQU0sWUFBWSxHQUFHLENBQUMsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxnQkFBZ0IsQ0FBQyw2QkFBNkIsQ0FBQyxFQUFDO0NBQ3JHLElBQUksT0FBTyxDQUFDLEtBQUssQ0FBQyw4QkFBOEIsRUFBRSxZQUFZLENBQUMsR0FBRyxDQUFDLFdBQVcsSUFBSSxXQUFXLENBQUMsV0FBVyxDQUFDLEVBQUM7Q0FDM0csSUFBSSxZQUFZLENBQUMsSUFBSSxDQUFDLElBQUksSUFBSSxJQUFJLENBQUMsV0FBVyxDQUFDLGlCQUFpQixFQUFFLEtBQUssUUFBUSxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFBQztDQUN6RixJQUFJLE9BQU8sWUFBWSxDQUFDLEtBQUssRUFBRTtDQUMvQixJQUFJO0NBQ0osR0FBRztDQUNILElBQUksQ0FBQyxHQUFHLGlCQUFpQixDQUFDLFVBQVUsQ0FBQyxVQUFVLENBQUMsZ0JBQWdCLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxPQUFPLElBQUk7Q0FDeEcsR0FBRyxHQUFHLE9BQU8sS0FBSyxpQkFBaUIsRUFBRTtDQUNyQyxJQUFJLE9BQU8sQ0FBQyxNQUFNLEdBQUU7Q0FDcEIsSUFBSTtDQUNKLEdBQUcsRUFBQztDQUNKLEVBQUUsT0FBTyxpQkFBaUI7QUFDMUI7Q0FDQSxFQUFFO0FBQ0Y7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLGdCQUFnQixDQUFDLFlBQVksRUFBRSxrQkFBa0IsRUFBRTtDQUNwRCxFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMseUNBQXlDLEVBQUM7Q0FDMUQsRUFBRSxPQUFPLElBQUksQ0FBQyxzQkFBc0I7Q0FDcEMsR0FBRyxZQUFZO0NBQ2YsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJO0NBQy9CLEdBQUcsTUFBTSxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLGtCQUFrQixDQUFDLEtBQUssS0FBSztDQUM1RSxHQUFHO0NBQ0gsRUFBRTtBQUNGO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLE1BQU0sc0JBQXNCLEdBQUc7Q0FDaEMsRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLDBDQUEwQyxFQUFDO0NBQzNELEVBQUUsTUFBTSxZQUFZLEdBQUcsTUFBTSxJQUFJLENBQUMsY0FBYztDQUNoRCxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUk7Q0FDL0IsR0FBRyxNQUFNLENBQUMsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxnQkFBZ0IsQ0FBQywyQ0FBMkMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksSUFBSSxJQUFJLENBQUMsV0FBVyxDQUFDLGlCQUFpQixFQUFFLEtBQUssUUFBUSxDQUFDLENBQUMsR0FBRyxFQUFFO0NBQzNLLElBQUc7Q0FDSCxFQUFFLE9BQU8sSUFBSSxDQUFDLHNCQUFzQjtDQUNwQyxHQUFHLFlBQVk7Q0FDZixHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUk7Q0FDL0IsR0FBRyxNQUFNLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLGFBQWEsQ0FBQyxzQkFBc0IsQ0FBQztDQUN0RSxHQUFHO0NBQ0gsRUFBRTtBQUNGO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsTUFBTSxhQUFhLENBQUMsWUFBWSxFQUFFO0NBQ25DLEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyxxQ0FBcUMsRUFBRSxZQUFZLEVBQUM7Q0FDcEUsRUFBRSxNQUFNLElBQUksQ0FBQyxzQkFBc0I7Q0FDbkMsR0FBRyxZQUFZO0NBQ2YsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJO0NBQy9CLEdBQUcsTUFBTSxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxhQUFhLENBQUMsc0JBQXNCLENBQUMsS0FBSyxJQUFJO0NBQy9FLElBQUc7Q0FDSCxFQUFFO0FBQ0Y7Q0FDQTs7Q0NsSUE7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNlLGVBQWUsb0JBQW9CLENBQUMsSUFBSSxFQUFFO0NBQ3pELENBQUMsTUFBTSxRQUFRLEdBQUcsQ0FBQyxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyx1Q0FBdUMsQ0FBQyxFQUFDO0NBQ3JGLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxnQ0FBZ0MsRUFBRSxRQUFRLEVBQUM7Q0FDMUQsQ0FBQyxNQUFNLGVBQWUsR0FBRyxHQUFFO0NBQzNCLENBQUMsSUFBSSxNQUFNLE9BQU8sSUFBSSxRQUFRLEVBQUU7Q0FDaEMsRUFBRSxNQUFNLGNBQWMsR0FBRyxNQUFNLFNBQVMsQ0FBQyxjQUFjLENBQUMsT0FBTyxFQUFDO0NBQ2hFLEVBQUUsR0FBRyxjQUFjLEVBQUU7Q0FDckIsR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDLDhCQUE4QixFQUFFLE9BQU8sRUFBQztDQUN6RCxHQUFHLGVBQWUsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFDO0NBQ2hDLEdBQUcsTUFBTTtDQUNULEdBQUcsT0FBTyxDQUFDLEtBQUssQ0FBQyxnQ0FBZ0MsRUFBRSxPQUFPLEVBQUM7Q0FDM0QsR0FBRyxPQUFPLENBQUMsWUFBWSxDQUFDLGtCQUFrQixFQUFFLEVBQUUsRUFBQztDQUMvQyxHQUFHO0NBQ0gsRUFBRTtDQUNGLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQywyQkFBMkIsRUFBRSxlQUFlLEVBQUM7Q0FDNUQsQ0FBQyxPQUFPLGVBQWU7Q0FDdkI7O0NDcEJBLE1BQU0sdUJBQXVCLFNBQVMsS0FBSyxDQUFDLEVBQUU7QUFDOUM7Q0FDZSxNQUFNLFdBQVcsU0FBUyxhQUFhLENBQUM7QUFDdkQ7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsV0FBVyxDQUFDLFdBQVcsRUFBRTtDQUMxQixFQUFFLEtBQUssQ0FBQyxXQUFXLEVBQUM7Q0FDcEIsRUFBRTtBQUNGO0FBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsTUFBTSxNQUFNLEdBQUc7Q0FDaEIsRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLG9CQUFvQixFQUFDO0NBQ3JDLEVBQUUsSUFBSSxhQUFZO0NBQ2xCLEVBQUUsSUFBSSxtQkFBa0I7Q0FDeEIsRUFBRSxJQUFJO0NBQ04sR0FBRyxNQUFNLElBQUksQ0FBQyxXQUFXLENBQUMsY0FBYyxHQUFFO0NBQzFDLEdBQUcsWUFBWSxHQUFHLE1BQU0sSUFBSSxDQUFDLFdBQVcsQ0FBQyxxQkFBcUIsR0FBRTtDQUNoRSxHQUFHLGtCQUFrQixHQUFHLE1BQU0sSUFBSSxDQUFDLFdBQVcsQ0FBQyxlQUFlLENBQUMsWUFBWSxFQUFDO0NBQzVFLEdBQUcsT0FBTyxDQUFDLEtBQUssQ0FBQyxvQkFBb0IsRUFBRSxrQkFBa0IsRUFBQztDQUMxRCxHQUFHLE1BQU0sWUFBWSxHQUFHLE1BQU0sSUFBSSxDQUFDLFdBQVcsQ0FBQyxzQkFBc0IsR0FBRTtDQUN2RSxHQUFHLE1BQU0sSUFBSSxDQUFDLFdBQVcsQ0FBQyxhQUFhLENBQUMsWUFBWSxFQUFDO0NBQ3JELEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLGtCQUFrQixFQUFFLEVBQUUsRUFBQztDQUM3RCxHQUFHLE9BQU8sSUFBSTtDQUNkLEdBQUcsQ0FBQyxNQUFNLEVBQUUsRUFBRTtDQUNkLEdBQUcsT0FBTyxDQUFDLEtBQUssQ0FBQyxFQUFFLEVBQUM7Q0FDcEIsR0FBRyxHQUFHLFlBQVksSUFBSSxrQkFBa0IsRUFBRTtDQUMxQyxJQUFJLE1BQU0sSUFBSSxDQUFDLFdBQVcsQ0FBQyxnQkFBZ0IsQ0FBQyxZQUFZLEVBQUUsa0JBQWtCLEVBQUM7Q0FDN0UsSUFBSTtDQUNKLEdBQUcsTUFBTSxJQUFJLENBQUMsV0FBVyxDQUFDLG9CQUFvQixHQUFFO0NBQ2hELEdBQUcsTUFBTSxJQUFJLHVCQUF1QixDQUFDLDZDQUE2QyxDQUFDO0NBQ25GLEdBQUc7Q0FDSCxFQUFFO0FBQ0Y7Q0FDQTs7Q0N0Q2UsTUFBTSxFQUFFLFNBQVMsV0FBVyxDQUFDO0FBQzVDO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLE1BQU0sbUNBQW1DLEdBQUc7Q0FDN0MsRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLHdDQUF3QyxFQUFDO0NBQ3pELEVBQUUsT0FBTyxNQUFNLElBQUksQ0FBQyxVQUFVLENBQUMsaUJBQWlCLENBQUMsbUNBQW1DLEVBQUU7Q0FDdEYsRUFBRTtBQUNGO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLE1BQU0sa0JBQWtCLEdBQUc7Q0FDNUIsRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLHVCQUF1QixFQUFDO0NBQ3hDLEVBQUUsTUFBTSxZQUFZLEdBQUcsR0FBRTtDQUN6QixFQUFFLE1BQU0sZUFBZSxHQUFHLE1BQU0sb0JBQW9CLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLEVBQUM7Q0FDNUYsRUFBRSxJQUFJLE1BQU0sY0FBYyxJQUFJLGVBQWUsRUFBRTtDQUMvQyxHQUFHLE1BQU0sU0FBUyxHQUFHLElBQUksU0FBUyxDQUFDLGNBQWMsRUFBQztDQUNsRCxHQUFHLFlBQVksQ0FBQyxJQUFJLENBQUMsSUFBSSxXQUFXLENBQUMsU0FBUyxDQUFDLEVBQUM7Q0FDaEQsR0FBRztDQUNILEVBQUUsT0FBTyxZQUFZO0NBQ3JCLEVBQUU7QUFDRjtDQUNBOztDQzFCZSxNQUFNLElBQUksU0FBUyxhQUFhLENBQUM7QUFDaEQ7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsV0FBVyxDQUFDLFdBQVcsRUFBRTtDQUMxQixFQUFFLEtBQUssQ0FBQyxXQUFXLEVBQUM7Q0FDcEIsRUFBRTtBQUNGO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsT0FBTyxNQUFNLENBQUMsTUFBTSxFQUFFO0NBQ3ZCLEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyxhQUFhLEVBQUM7Q0FDOUIsRUFBRSxNQUFNLHNCQUFzQixHQUFHLDJCQUEyQixDQUFDLE1BQU0sRUFBQztDQUNwRSxFQUFFLElBQUksS0FBSTtDQUNWLEVBQUUsR0FBRyxzQkFBc0IsS0FBSyxJQUFJLEVBQUU7Q0FDdEMsR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDLDhCQUE4QixFQUFDO0NBQ2hELEdBQUcsT0FBTyxDQUFDLEtBQUssQ0FBQyxzQkFBc0IsRUFBQztDQUN4QyxHQUFHLE1BQU0sRUFBRSxHQUFHLElBQUksRUFBRSxDQUFDLE1BQU0sRUFBQztDQUM1QixHQUFHLEVBQUUsQ0FBQyxVQUFVLENBQUMsaUJBQWlCLEdBQUcsSUFBSSxpQkFBaUIsQ0FBQyxzQkFBc0IsRUFBQztDQUNsRixHQUFHLElBQUksR0FBRyxJQUFJLElBQUksQ0FBQyxFQUFFLEVBQUM7Q0FDdEIsR0FBRyxNQUFNO0NBQ1QsR0FBRyxNQUFNLElBQUksS0FBSyxDQUFDLHVDQUF1QyxDQUFDO0NBQzNELEdBQUc7Q0FDSCxFQUFFLE9BQU8sSUFBSTtDQUNiLEVBQUU7QUFDRjtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsQ0FBQyxtQ0FBbUMsR0FBRztDQUN2QyxFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMsMENBQTBDLEVBQUM7Q0FDM0QsRUFBRSxPQUFPLElBQUksQ0FBQyxXQUFXLENBQUMsbUNBQW1DLEVBQUU7Q0FDL0QsRUFBRTtBQUNGO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLGtCQUFrQixHQUFHO0NBQ3RCLEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyx5QkFBeUIsRUFBQztDQUMxQyxFQUFFLE9BQU8sSUFBSSxDQUFDLFdBQVcsQ0FBQyxrQkFBa0IsRUFBRTtDQUM5QyxFQUFFO0FBQ0Y7Q0FDQTs7Q0NwRGUsTUFBTSxJQUFJLENBQUM7QUFDMUI7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsV0FBVyxDQUFDLE1BQU0sRUFBRTtDQUNyQixFQUFFLElBQUksQ0FBQyxNQUFNLEdBQUcsT0FBTTtDQUN0QixFQUFFLElBQUksQ0FBQyxJQUFJLEdBQUcsS0FBSTtDQUNsQixFQUFFO0FBQ0Y7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsa0JBQWtCLEdBQUc7Q0FDdEIsRUFBRSxPQUFPLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQyxrQkFBa0IsRUFBRTtDQUM3QyxFQUFFO0FBQ0Y7QUFDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsQ0FBQyxtQ0FBbUMsR0FBRztDQUN2QyxFQUFFLE9BQU8sSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDLG1DQUFtQyxFQUFFO0NBQzlELEVBQUU7QUFDRjtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsQ0FBQyxRQUFRLEdBQUc7Q0FDWixFQUFFLEdBQUcsSUFBSSxDQUFDLElBQUksS0FBSyxJQUFJLEVBQUU7Q0FDekIsR0FBRyxJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBQztDQUN2QyxHQUFHO0NBQ0gsRUFBRSxPQUFPLElBQUksQ0FBQyxJQUFJO0NBQ2xCLEVBQUU7QUFDRjtDQUNBOztDQ3hDTyxNQUFNLGlDQUFpQyxDQUFDO0FBQy9DO0NBQ0EsQ0FBQyxPQUFPLGtCQUFrQixHQUFHLENBQUM7QUFDOUI7Q0FDQSxDQUFDLEtBQUs7Q0FDTixDQUFDLHdCQUF3QjtDQUN6QixDQUFDLG1CQUFtQjtBQUNwQjtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsQ0FBQyxXQUFXLENBQUMsSUFBSSxFQUFFLHVCQUF1QixDQUFDLElBQUksRUFBRTtDQUNqRCxFQUFFLElBQUksQ0FBQyxRQUFRLEdBQUcsTUFBSztDQUN2QixFQUFFLElBQUksQ0FBQyxRQUFRLEdBQUcsTUFBSztDQUN2QixFQUFFLElBQUksQ0FBQyxtQkFBbUIsR0FBRyxHQUFFO0NBQy9CLEVBQUUsSUFBSSxDQUFDLEtBQUssR0FBRyxLQUFJO0NBQ25CLEVBQUUsSUFBSSxDQUFDLHdCQUF3QixHQUFHLHdCQUF1QjtDQUN6RCxFQUFFO0FBQ0Y7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsU0FBUyxHQUFHO0NBQ2IsRUFBRSxPQUFPLElBQUksQ0FBQyxRQUFRLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUTtDQUN4QyxFQUFFO0FBQ0Y7Q0FDQSxDQUFDLElBQUksR0FBRztDQUNSLEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyx3Q0FBd0MsRUFBQztDQUN6RCxFQUFFLElBQUksQ0FBQyxRQUFRLEdBQUcsS0FBSTtDQUN0QixFQUFFO0FBQ0Y7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFO0NBQ2hCLEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyx5Q0FBeUMsRUFBRSxTQUFTLEVBQUM7Q0FDckUsRUFBRSxJQUFJLENBQUMsUUFBUSxHQUFHLEtBQUk7Q0FDdEIsRUFBRSxJQUFJLENBQUMsUUFBUSxHQUFHLE1BQUs7Q0FDdkIsRUFBRSxPQUFPLElBQUksQ0FBQyxlQUFlLENBQUMsU0FBUyxDQUFDO0NBQ3hDLEVBQUU7QUFDRjtDQUNBLENBQUMsS0FBSyxHQUFHO0NBQ1QsRUFBRSxJQUFJLENBQUMsUUFBUSxHQUFHLE1BQUs7Q0FDdkIsRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLHdDQUF3QyxFQUFDO0NBQ3pELEVBQUU7QUFDRjtDQUNBLENBQUMsMEJBQTBCLEdBQUc7Q0FDOUIsRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLDZEQUE2RCxFQUFDO0NBQzlFLEVBQUUsR0FBRyxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUU7Q0FDckIsR0FBRyxhQUFhLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBQztDQUMvQixHQUFHO0NBQ0gsRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLHNEQUFzRCxFQUFFLElBQUksQ0FBQyxtQkFBbUIsRUFBQztDQUNqRyxFQUFFLE1BQU0scUJBQXFCLEdBQUcsSUFBSSxDQUFDLG1CQUFtQixDQUFDLE1BQU0sQ0FBQyxTQUFTLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxFQUFDO0NBQzdJLEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyx5REFBeUQsRUFBRSxxQkFBcUIsRUFBQztDQUNqRyxFQUFFLEdBQUcscUJBQXFCLENBQUMsTUFBTSxJQUFJLENBQUMsRUFBRTtDQUN4QyxHQUFHLHFCQUFxQixDQUFDLE9BQU8sQ0FBQyxjQUFjLElBQUksSUFBSSxDQUFDLG1CQUFtQixDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsbUJBQW1CLENBQUMsT0FBTyxDQUFDLGNBQWMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFDO0NBQ3hJLEdBQUcsSUFBSSxDQUFDLHdCQUF3QixDQUFDLHFCQUFxQixFQUFDO0NBQ3ZELEdBQUc7Q0FDSCxFQUFFO0FBQ0Y7Q0FDQSxDQUFDLE1BQU0sZUFBZSxDQUFDLFNBQVMsRUFBRTtDQUNsQyxFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMsa0RBQWtELEVBQUM7Q0FDbkUsRUFBRSxJQUFJLElBQUksR0FBRyxNQUFLO0NBQ2xCLEVBQUUsSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLFNBQVMsQ0FBQyxDQUFDLEVBQUUsRUFBRTtDQUNwQyxHQUFHLEdBQUcsSUFBSSxDQUFDLFFBQVEsRUFBRTtDQUNyQixJQUFJLEtBQUs7Q0FDVCxJQUFJO0NBQ0osR0FBRyxJQUFJLEdBQUcsTUFBTSxJQUFJLENBQUMsS0FBSyxDQUFDLG1DQUFtQyxHQUFFO0NBQ2hFLEdBQUcsR0FBRyxJQUFJLEVBQUU7Q0FDWixJQUFJLEtBQUs7Q0FDVCxJQUFJLE1BQU07Q0FDVixJQUFJLE1BQU0sSUFBSSxPQUFPLENBQUMsT0FBTyxJQUFJLFVBQVUsQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsNEJBQTRCLENBQUMsRUFBQztDQUNyRyxJQUFJO0NBQ0osR0FBRztDQUNILEVBQUUsSUFBSTtDQUNOLEdBQUcsSUFBSSxNQUFNLFdBQVcsSUFBSSxNQUFNLElBQUksQ0FBQyxLQUFLLENBQUMsa0JBQWtCLEVBQUUsRUFBRTtDQUNuRSxJQUFJLEdBQUcsSUFBSSxDQUFDLFFBQVEsRUFBRTtDQUN0QixLQUFLLEtBQUs7Q0FDVixLQUFLO0NBQ0wsSUFBSSxJQUFJO0NBQ1IsS0FBSyxNQUFNLFdBQVcsQ0FBQyxNQUFNLEdBQUU7Q0FDL0IsS0FBSyxJQUFJLENBQUMsbUJBQW1CLENBQUMsSUFBSSxDQUFDLFdBQVcsRUFBQztDQUMvQyxLQUFLLE1BQU0sSUFBSSxPQUFPLENBQUMsT0FBTyxJQUFJLFVBQVUsQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsd0JBQXdCLENBQUMsRUFBQztDQUNsRyxLQUFLLENBQUMsTUFBTSxNQUFNLEVBQUU7Q0FDcEIsS0FBSyxPQUFPLENBQUMsS0FBSyxDQUFDLE1BQU0sRUFBQztDQUMxQixLQUFLO0NBQ0wsSUFBSTtDQUNKLEdBQUcsQ0FBQyxNQUFNLEVBQUUsRUFBRTtDQUNkLEdBQUcsT0FBTyxDQUFDLEtBQUssQ0FBQyxFQUFFLEVBQUM7Q0FDcEIsR0FBRztDQUNILEVBQUUsR0FBRyxDQUFDLElBQUksQ0FBQyxRQUFRLElBQUksSUFBSSxDQUFDLHdCQUF3QixFQUFFO0NBQ3RELEdBQUcsSUFBSSxDQUFDLFFBQVEsR0FBRyxXQUFXLENBQUMsTUFBTSxJQUFJLENBQUMsMEJBQTBCLEVBQUUsRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyx3Q0FBd0MsRUFBQztDQUNuSSxHQUFHO0NBQ0gsRUFBRSxHQUFHLElBQUksRUFBRTtDQUNYLEdBQUcsSUFBSSxDQUFDLEtBQUssR0FBRTtDQUNmLEdBQUcsTUFBTSxHQUFHLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRTtDQUM1QixHQUFHLE9BQU8sSUFBSSxDQUFDLGVBQWUsQ0FBQyxTQUFTLENBQUM7Q0FDekMsR0FBRztDQUNILEVBQUU7Q0FDRjs7Q0N4R0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNPLFNBQVMsMEJBQTBCLENBQUMsUUFBUSxFQUFFO0NBQ3JELENBQUMsTUFBTSxvQkFBb0IsR0FBRyxRQUFRLENBQUMsYUFBYSxDQUFDLEtBQUssRUFBQztDQUMzRCxDQUFDLG9CQUFvQixDQUFDLEVBQUUsR0FBRyxjQUFhO0NBQ3hDLENBQUMsb0JBQW9CLENBQUMsS0FBSyxDQUFDLFFBQVEsR0FBRyxRQUFPO0NBQzlDLENBQUMsb0JBQW9CLENBQUMsS0FBSyxDQUFDLEdBQUcsR0FBRyxPQUFNO0NBQ3hDLENBQUMsb0JBQW9CLENBQUMsS0FBSyxDQUFDLEtBQUssR0FBRyxPQUFNO0NBQzFDLENBQUMsb0JBQW9CLENBQUMsS0FBSyxDQUFDLE9BQU8sR0FBRyxPQUFNO0NBQzVDLENBQUMsT0FBTyxvQkFBb0I7Q0FDNUI7O0NDYkE7Q0FDQTtDQUNBO0NBQ0E7Q0FDTyxTQUFTLG9CQUFvQixDQUFDLFFBQVEsRUFBRTtDQUMvQyxDQUFDLE1BQU0sY0FBYyxHQUFHLFFBQVEsQ0FBQyxhQUFhLENBQUMsS0FBSyxFQUFDO0NBQ3JELENBQUMsY0FBYyxDQUFDLEVBQUUsR0FBRyxlQUFjO0NBQ25DLENBQUMsY0FBYyxDQUFDLFFBQVEsR0FBRyxFQUFDO0NBQzVCLENBQUMsY0FBYyxDQUFDLEtBQUssQ0FBQyxHQUFHLEdBQUcsSUFBRztDQUMvQixDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsS0FBSyxHQUFHLElBQUc7Q0FDakMsQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLFFBQVEsR0FBRyxRQUFPO0NBQ3hDLENBQUMsY0FBYyxDQUFDLEtBQUssQ0FBQyxLQUFLLEdBQUcsUUFBTztDQUNyQyxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLFFBQU87Q0FDdEMsQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxNQUFLO0NBQ3BDLENBQUMsY0FBYyxDQUFDLEtBQUssQ0FBQyxlQUFlLEdBQUcsWUFBVztDQUNuRCxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsT0FBTyxHQUFHLE9BQU07Q0FDdEMsQ0FBQyxPQUFPLGNBQWM7Q0FDdEI7O0NDVkE7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDTyxTQUFTLE1BQU0sQ0FBQyxNQUFNLEVBQUU7Q0FDL0IsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLFFBQVEsRUFBQztDQUN4QixDQUFDLE1BQU0sSUFBSSxHQUFHLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBQztDQUM5QixDQUFDLE1BQU0sUUFBUSxHQUFHLElBQUksaUNBQWlDLENBQUMsSUFBSSxFQUFFLENBQUMscUJBQXFCLEtBQUs7Q0FDekYsRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLHFCQUFxQixFQUFDO0NBQ3BDLEVBQUUsRUFBQztDQUNILENBQUMsTUFBTSxFQUFFLGNBQWMsRUFBRSxTQUFTLEVBQUUsV0FBVyxFQUFFLDBCQUEwQixFQUFFLHdCQUF3QixFQUFFLEdBQUcsZUFBZSxDQUFDLE1BQU0sQ0FBQyxRQUFRLEVBQUM7Q0FDMUksQ0FBQyxTQUFTLG1CQUFtQixHQUFHO0NBQ2hDLEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyw0QkFBNEIsQ0FBQztDQUM3QyxHQUFHLENBQUMsR0FBRyxXQUFXLENBQUMsZ0JBQWdCLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsTUFBTSxJQUFJLE1BQU0sS0FBSywwQkFBMEIsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxNQUFNLElBQUk7Q0FDekgsR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDLFVBQVUsR0FBRyxHQUFFO0NBQy9CLEdBQUcsTUFBTSxDQUFDLFFBQVEsR0FBRyxNQUFLO0NBQzFCLEdBQUcsRUFBQztDQUNKLEVBQUUsMEJBQTBCLENBQUMsV0FBVyxHQUFHLDBCQUEwQixDQUFDLGdCQUFlO0NBQ3JGLEVBQUUsMEJBQTBCLENBQUMsS0FBSyxDQUFDLGVBQWUsR0FBRywwQkFBMEIsQ0FBQyxvQkFBbUI7Q0FDbkcsRUFBRSxjQUFjLENBQUMsS0FBSyxDQUFDLE9BQU8sR0FBRyxPQUFNO0NBQ3ZDLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxRQUFRLEVBQUU7Q0FDekIsR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDLGdCQUFnQixFQUFDO0NBQ2pDLEdBQUc7Q0FDSCxFQUFFO0NBQ0YsQ0FBQyxlQUFlLGNBQWMsR0FBRztDQUNqQyxFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMsNkZBQTZGLENBQUM7Q0FDOUcsR0FBRyxDQUFDLEdBQUcsV0FBVyxDQUFDLGdCQUFnQixDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLE1BQU0sSUFBSSxNQUFNLEtBQUssMEJBQTBCLENBQUMsQ0FBQyxPQUFPLENBQUMsTUFBTSxJQUFJO0NBQ3pILEdBQUcsTUFBTSxDQUFDLEtBQUssQ0FBQyxVQUFVLEdBQUcsU0FBUTtDQUNyQyxHQUFHLE1BQU0sQ0FBQyxRQUFRLEdBQUcsS0FBSTtDQUN6QixHQUFHLEVBQUM7Q0FDSixFQUFFLGNBQWMsQ0FBQyxLQUFLLENBQUMsT0FBTyxHQUFHLEdBQUU7Q0FDbkMsRUFBRSxjQUFjLENBQUMsS0FBSyxHQUFFO0NBQ3hCLEVBQUUsMEJBQTBCLENBQUMsV0FBVyxHQUFHLGtCQUFpQjtDQUM1RCxFQUFFLDBCQUEwQixDQUFDLEtBQUssQ0FBQyxlQUFlLEdBQUcsVUFBUztDQUM5RCxFQUFFLE1BQU0sU0FBUyxHQUFHLE1BQU0sQ0FBQyxZQUFZLENBQUMsT0FBTyxDQUFDLGlCQUFpQixDQUFDLElBQUksaUNBQWlDLENBQUMsbUJBQWtCO0NBQzFILEVBQUUsTUFBTSxRQUFRLENBQUMsR0FBRyxDQUFDLFNBQVMsRUFBQztDQUMvQixFQUFFLG1CQUFtQixHQUFFO0NBQ3ZCLEVBQUU7Q0FDRixDQUFDLFNBQVMsWUFBWSxDQUFDLEtBQUssRUFBRTtDQUM5QixFQUFFLEdBQUcsUUFBUSxDQUFDLFNBQVMsRUFBRSxFQUFFO0NBQzNCLEdBQUcsT0FBTyxDQUFDLElBQUksQ0FBQyxrR0FBa0csRUFBQztDQUNuSCxHQUFHLEtBQUssQ0FBQyx3QkFBd0IsR0FBRTtDQUNuQyxHQUFHLEtBQUssQ0FBQyxjQUFjLEdBQUU7Q0FDekIsR0FBRyxLQUFLLENBQUMsZUFBZSxHQUFFO0NBQzFCLEdBQUcsY0FBYyxDQUFDLEtBQUssR0FBRTtDQUN6QixHQUFHLE9BQU8sS0FBSztDQUNmLEdBQUc7Q0FDSCxFQUFFO0NBQ0YsQ0FBQyxTQUFTLFdBQVcsR0FBRztDQUN4QixFQUFFLEdBQUcsTUFBTSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLFlBQVksQ0FBQyxFQUFFO0NBQ3hELEdBQUcsU0FBUyxDQUFDLEtBQUssQ0FBQyxPQUFPLEdBQUcsR0FBRTtDQUMvQixHQUFHLE1BQU07Q0FDVCxHQUFHLFNBQVMsQ0FBQyxLQUFLLENBQUMsT0FBTyxHQUFHLE9BQU07Q0FDbkMsR0FBRyxRQUFRLENBQUMsSUFBSSxHQUFFO0NBQ2xCLEdBQUc7Q0FDSCxFQUFFO0NBQ0YsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLGdCQUFnQixDQUFDLFNBQVMsRUFBRSxZQUFZLEVBQUM7Q0FDMUQsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLGdCQUFnQixDQUFDLE9BQU8sRUFBRSxZQUFZLEVBQUM7Q0FDeEQsQ0FBQyxJQUFJLGdCQUFnQixDQUFDLFdBQVcsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsRUFBQztDQUNyRixDQUFDLElBQUksZ0JBQWdCLENBQUMsV0FBVyxDQUFDLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsYUFBYSxDQUFDLCtCQUErQixDQUFDLEVBQUUsRUFBRSxTQUFTLEVBQUUsSUFBSSxFQUFFLFVBQVUsRUFBRSxJQUFJLEVBQUUsRUFBQztDQUNqSixDQUFDLDBCQUEwQixDQUFDLGVBQWUsR0FBRywwQkFBMEIsQ0FBQyxZQUFXO0NBQ3BGLENBQUMsMEJBQTBCLENBQUMsbUJBQW1CLEdBQUcsMEJBQTBCLENBQUMsS0FBSyxDQUFDLGdCQUFlO0NBQ2xHLENBQUMsMEJBQTBCLENBQUMsZ0JBQWdCLENBQUMsT0FBTyxFQUFFLE1BQU07Q0FDNUQsRUFBRSxHQUFHLFFBQVEsQ0FBQyxTQUFTLEVBQUUsRUFBRTtDQUMzQixHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUMsMkNBQTJDLEVBQUM7Q0FDN0QsR0FBRyxRQUFRLENBQUMsSUFBSSxHQUFFO0NBQ2xCLEdBQUcsbUJBQW1CLEdBQUU7Q0FDeEIsR0FBRyxNQUFNO0NBQ1QsR0FBRyxjQUFjLEdBQUU7Q0FDbkIsR0FBRztDQUNILEVBQUUsRUFBQztDQUNILENBQUMsd0JBQXdCLENBQUMsZ0JBQWdCLENBQUMsT0FBTyxFQUFFLE1BQU07Q0FDMUQsRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLGdDQUFnQyxFQUFDO0NBQ2pELEVBQUUsSUFBSTtDQUNOLEdBQUcsTUFBTSxTQUFTLEdBQUcsUUFBUSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsdURBQXVELEVBQUUsTUFBTSxDQUFDLFlBQVksQ0FBQyxPQUFPLENBQUMsaUJBQWlCLENBQUMsSUFBSSxpQ0FBaUMsQ0FBQyxrQkFBa0IsRUFBRSxFQUFDO0NBQzlNLEdBQUcsR0FBRyxRQUFRLENBQUMsU0FBUyxDQUFDLEVBQUU7Q0FDM0IsSUFBSSxNQUFNLENBQUMsWUFBWSxDQUFDLE9BQU8sQ0FBQyxpQkFBaUIsRUFBRSxRQUFRLENBQUMsU0FBUyxDQUFDLEVBQUM7Q0FDdkUsSUFBSTtDQUNKLEdBQUcsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLDJCQUEyQixFQUFFLFNBQVMsQ0FBQyxDQUFDLEVBQUM7Q0FDM0QsR0FBRyxDQUFDLE1BQU0sRUFBRSxFQUFFO0NBQ2QsR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDLEVBQUUsRUFBQztDQUNwQixHQUFHO0NBQ0gsRUFBRSxFQUFDO0NBQ0gsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsU0FBUyxFQUFDO0NBQzVDLENBQUMsT0FBTyxFQUFFLFNBQVMsRUFBRSwwQkFBMEIsRUFBRSx3QkFBd0IsRUFBRTtDQUMzRSxDQUFDO0FBQ0Q7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLFNBQVMsZUFBZSxDQUFDLFFBQVEsRUFBRTtDQUNuQyxDQUFDLE1BQU0sU0FBUyxHQUFHLFFBQVEsQ0FBQyxhQUFhLENBQUMsS0FBSyxFQUFDO0NBQ2hELENBQUMsTUFBTSxXQUFXLEdBQUcsaUJBQWlCLENBQUMsUUFBUSxFQUFDO0NBQ2hELENBQUMsTUFBTSxjQUFjLEdBQUcsb0JBQW9CLENBQUMsUUFBUSxFQUFDO0NBQ3RELENBQUMsTUFBTSxvQkFBb0IsR0FBRywwQkFBMEIsQ0FBQyxRQUFRLEVBQUM7Q0FDbEUsQ0FBQyxNQUFNLDBCQUEwQixHQUFHLHVCQUF1QixDQUFDLFFBQVEsRUFBRSxnQkFBZ0IsRUFBQztDQUN2RixDQUFDLE1BQU0sd0JBQXdCLEdBQUcsdUJBQXVCLENBQUMsUUFBUSxFQUFFLFlBQVksRUFBRSxXQUFXLEVBQUM7Q0FDOUYsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxjQUFjLEVBQUM7Q0FDMUMsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxvQkFBb0IsRUFBQztDQUNoRCxDQUFDLFdBQVcsQ0FBQyxXQUFXLENBQUMsMEJBQTBCLEVBQUM7Q0FDcEQsQ0FBQyxXQUFXLENBQUMsV0FBVyxDQUFDLHdCQUF3QixFQUFDO0NBQ2xELENBQUMsU0FBUyxDQUFDLFdBQVcsQ0FBQyxXQUFXLEVBQUM7Q0FDbkMsQ0FBQyxPQUFPLEVBQUUsU0FBUyxFQUFFLGNBQWMsRUFBRSxXQUFXLEVBQUUsMEJBQTBCLEVBQUUsd0JBQXdCLEVBQUU7Q0FDeEc7O0NDdEhBLEdBQUcsQ0FBQyxNQUFNLENBQUMsVUFBVSxFQUFFO0NBQ3ZCLENBQUMsT0FBTyxDQUFDLEtBQUssR0FBRyxNQUFNLEdBQUU7Q0FDekIsQ0FBQztBQUNEO0NBQ0EsTUFBTSxDQUFDLE1BQU07Ozs7OzsifQ==
