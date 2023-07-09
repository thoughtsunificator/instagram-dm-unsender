
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
// @version				0.5.11
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
	window["IDMU_MESSAGE_DETECTION_ACTION_MENU_TIMEOUT"] = 20
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
				findLoaderTimeout = setTimeout(resolve, root.ownerDocument.defaultView.IDMU_SCROLL_DETECTION_TIMEOUT);
			})
		]);
		clearTimeout(findLoaderTimeout);
		if(loadingElement) {
			console.debug("loadMoreMessageStrategy: Found loader; Stand-by until it is removed");
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
					timeout = setTimeout(resolve, element.ownerDocument.defaultView.IDMU_MESSAGE_DETECTION_ACTION_MENU_TIMEOUT);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaWRtdS51c2VyLmpzIiwic291cmNlcyI6WyIuLi9zcmMvcnVudGltZS91c2Vyc2NyaXB0L3VpL3N0eWxlL2luc3RhZ3JhbS5qcyIsIi4uL3NyYy9ydW50aW1lL3VzZXJzY3JpcHQvdWkvbWVudS1idXR0b24uanMiLCIuLi9zcmMvcnVudGltZS91c2Vyc2NyaXB0L3VpL21lbnUuanMiLCIuLi9zcmMvdWlwaS91aXBpLWNvbXBvbmVudC5qcyIsIi4uL3NyYy9kb20vYXN5bmMtZXZlbnRzLmpzIiwiLi4vc3JjL3VpL3VpLWNvbXBvbmVudC5qcyIsIi4uL3NyYy91aS9zdHJhdGVneS9sb2FkLW1vcmUtbWVzc2FnZXMtc3RyYXRlZ3kuanMiLCIuLi9zcmMvdWkvdWktbWVzc2FnZXMtd3JhcHBlci5qcyIsIi4uL3NyYy91aS9zdHJhdGVneS9maW5kLW1lc3NhZ2VzLXdyYXBwZXItc3RyYXRlZ3kuanMiLCIuLi9zcmMvdWkvdWktbWVzc2FnZS5qcyIsIi4uL3NyYy91aS9zdHJhdGVneS9maW5kLW1lc3NhZ2VzLXN0cmF0ZWd5LmpzIiwiLi4vc3JjL3VpcGkvdWlwaS1tZXNzYWdlLmpzIiwiLi4vc3JjL3VpL3VpLmpzIiwiLi4vc3JjL3VpcGkvdWlwaS5qcyIsIi4uL3NyYy9pZG11L2lkbXUuanMiLCIuLi9zcmMvcnVudGltZS91c2Vyc2NyaXB0L3N0cmF0ZWd5LmpzIiwiLi4vc3JjL3J1bnRpbWUvdXNlcnNjcmlwdC91aS9hbGVydC5qcyIsIi4uL3NyYy9ydW50aW1lL3VzZXJzY3JpcHQvdWkvb3ZlcmxheS5qcyIsIi4uL3NyYy9ydW50aW1lL3VzZXJzY3JpcHQvdWkvdWkuanMiLCIuLi9zcmMvcnVudGltZS91c2Vyc2NyaXB0L21haW4uanMiXSwic291cmNlc0NvbnRlbnQiOlsiY29uc3QgQlVUVE9OX1NUWUxFID0ge1xuXHRcIlBSSU1BUllcIjogXCJwcmltYXJ5XCIsXG5cdFwiU0VDT05EQVJZXCI6IFwic2Vjb25kYXJ5XCIsXG59XG5cbi8qKlxuICpcbiAqIEBwYXJhbSB7SFRNTEJ1dHRvbkVsZW1lbnR9IGJ1dHRvbkVsZW1lbnRcbiAqIEBwYXJhbSB7c3RyaW5nfSAgICAgICAgICAgIHN0eWxlTmFtZVxuICovXG5leHBvcnQgZnVuY3Rpb24gYXBwbHlCdXR0b25TdHlsZShidXR0b25FbGVtZW50LCBzdHlsZU5hbWU9QlVUVE9OX1NUWUxFLlBSSU1BUlkpIHtcblx0YnV0dG9uRWxlbWVudC5zdHlsZS5mb250U2l6ZSA9IFwidmFyKC0tc3lzdGVtLTE0LWZvbnQtc2l6ZSlcIlxuXHRidXR0b25FbGVtZW50LnN0eWxlLmNvbG9yID0gXCJ3aGl0ZVwiXG5cdGJ1dHRvbkVsZW1lbnQuc3R5bGUuYm9yZGVyID0gXCIwcHhcIlxuXHRidXR0b25FbGVtZW50LnN0eWxlLmJvcmRlclJhZGl1cyA9IFwiOHB4XCJcblx0YnV0dG9uRWxlbWVudC5zdHlsZS5wYWRkaW5nID0gXCI4cHhcIlxuXHRidXR0b25FbGVtZW50LnN0eWxlLmZvbnRXZWlnaHQgPSBcImJvbGRcIlxuXHRidXR0b25FbGVtZW50LnN0eWxlLmN1cnNvciA9IFwicG9pbnRlclwiXG5cdGJ1dHRvbkVsZW1lbnQuc3R5bGUubGluZUhlaWdodCA9IFwidmFyKC0tc3lzdGVtLTE0LWxpbmUtaGVpZ2h0KVwiXG5cdGJ1dHRvbkVsZW1lbnQuc3R5bGUuYmFja2dyb3VuZENvbG9yID0gYHJnYih2YXIoLS1pZy0ke3N0eWxlTmFtZX0tYnV0dG9uKSlgXG59XG4iLCJpbXBvcnQgeyBhcHBseUJ1dHRvblN0eWxlIH0gZnJvbSBcIi4vc3R5bGUvaW5zdGFncmFtLmpzXCJcblxuLyoqXG4gKlxuICogQHBhcmFtIHtEb2N1bWVudH0gZG9jdW1lbnRcbiAqIEBwYXJhbSB7c3RyaW5nfSAgIHRleHRcbiAqIEBwYXJhbSB7c3RyaW5nfSAgIHN0eWxlTmFtZVxuICogQHJldHVybnMge0hUTUxCdXR0b25FbGVtZW50fVxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlTWVudUJ1dHRvbkVsZW1lbnQoZG9jdW1lbnQsIHRleHQsIHN0eWxlTmFtZSkge1xuXHRjb25zdCBidXR0b25FbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImJ1dHRvblwiKVxuXHRidXR0b25FbGVtZW50LnRleHRDb250ZW50ID0gdGV4dFxuXHRhcHBseUJ1dHRvblN0eWxlKGJ1dHRvbkVsZW1lbnQsIHN0eWxlTmFtZSlcblx0YnV0dG9uRWxlbWVudC5hZGRFdmVudExpc3RlbmVyKFwibW91c2VvdmVyXCIsICgpID0+IHtcblx0XHRidXR0b25FbGVtZW50LnN0eWxlLmZpbHRlciA9IGBicmlnaHRuZXNzKDEuMTUpYFxuXHR9KVxuXHRidXR0b25FbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJtb3VzZW91dFwiLCAoKSA9PiB7XG5cdFx0YnV0dG9uRWxlbWVudC5zdHlsZS5maWx0ZXIgPSBgYFxuXHR9KVxuXHRyZXR1cm4gYnV0dG9uRWxlbWVudFxufVxuIiwiLyoqXG4gKiBAcGFyYW0ge0RvY3VtZW50fSBkb2N1bWVudFxuICogQHJldHVybnMge0hUTUxCdXR0b25FbGVtZW50fVxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlTWVudUVsZW1lbnQoZG9jdW1lbnQpIHtcblx0Y29uc3QgbWVudUVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpXG5cdG1lbnVFbGVtZW50LnN0eWxlLnRvcCA9IFwiMjBweFwiXG5cdG1lbnVFbGVtZW50LnN0eWxlLnJpZ2h0ID0gXCI0MzBweFwiXG5cdG1lbnVFbGVtZW50LnN0eWxlLnBvc2l0aW9uID0gXCJmaXhlZFwiXG5cdG1lbnVFbGVtZW50LnN0eWxlLnpJbmRleCA9IDk5OVxuXHRtZW51RWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gXCJmbGV4XCJcblx0bWVudUVsZW1lbnQuc3R5bGUuZ2FwID0gXCIxMHB4XCJcblx0cmV0dXJuIG1lbnVFbGVtZW50XG59XG4iLCJleHBvcnQgZGVmYXVsdCBjbGFzcyBVSVBJQ29tcG9uZW50IHtcblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7VUlDb21wb25lbnR9IHVpQ29tcG9uZW50XG5cdCAqL1xuXHRjb25zdHJ1Y3Rvcih1aUNvbXBvbmVudCkge1xuXHRcdHRoaXMuX3VpQ29tcG9uZW50ID0gdWlDb21wb25lbnRcblx0fVxuXG5cdC8qKlxuXHQgKiBAcmVhZG9ubHlcblx0ICogQHR5cGUge1VJQ29tcG9uZW50fVxuXHQgKi9cblx0Z2V0IHVpQ29tcG9uZW50KCkge1xuXHRcdHJldHVybiB0aGlzLl91aUNvbXBvbmVudFxuXHR9XG59XG4iLCIvKipcbiAqXG4gKiBAY2FsbGJhY2sgZ2V0RWxlbWVudFxuICogQHJldHVybnMge0VsZW1lbnR9XG4gKi9cblxuLyoqXG4gKlxuICogQHBhcmFtIHtFbGVtZW50fSB0YXJnZXRcbiAqIEBwYXJhbSB7Z2V0RWxlbWVudH0gZ2V0RWxlbWVudFxuICogQHJldHVybnMge1Byb21pc2U8RWxlbWVudD59XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB3YWl0Rm9yRWxlbWVudCh0YXJnZXQsIGdldEVsZW1lbnQpIHtcblx0cmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG5cdFx0bGV0IGVsZW1lbnQgPSBnZXRFbGVtZW50KClcblx0XHRpZihlbGVtZW50KSB7XG5cdFx0XHRyZXNvbHZlKGVsZW1lbnQpXG5cdFx0fSBlbHNlIHtcblx0XHRcdG5ldyBNdXRhdGlvbk9ic2VydmVyKChtdXRhdGlvbnMsIG9ic2VydmVyKSA9PiB7XG5cdFx0XHRcdGVsZW1lbnQgPSBnZXRFbGVtZW50KClcblx0XHRcdFx0aWYoZWxlbWVudCkge1xuXHRcdFx0XHRcdG9ic2VydmVyLmRpc2Nvbm5lY3QoKVxuXHRcdFx0XHRcdHJlc29sdmUoZWxlbWVudClcblx0XHRcdFx0fVxuXHRcdFx0fSkub2JzZXJ2ZSh0YXJnZXQsIHsgc3VidHJlZTogdHJ1ZSwgY2hpbGRMaXN0OnRydWUgfSlcblx0XHR9XG5cdH0pXG59XG5cbi8qKlxuICpcbiAqIEBwYXJhbSB7RWxlbWVudH0gY2xpY2tUYXJnZXRcbiAqIEBwYXJhbSB7RWxlbWVudH0gdGFyZ2V0XG4gKiBAcGFyYW0ge2dldEVsZW1lbnR9IGdldEVsZW1lbnRcbiAqIEByZXR1cm5zIHtFbGVtZW50fFByb21pc2U8RWxlbWVudD59XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjbGlja0VsZW1lbnRBbmRXYWl0Rm9yKGNsaWNrVGFyZ2V0LCB0YXJnZXQsIGdldEVsZW1lbnQpIHtcblx0Y29uc3QgcHJvbWlzZSA9IHdhaXRGb3JFbGVtZW50KHRhcmdldCwgZ2V0RWxlbWVudClcblx0Y2xpY2tUYXJnZXQuY2xpY2soKVxuXHRyZXR1cm4gZ2V0RWxlbWVudCgpIHx8IHByb21pc2Vcbn1cbiIsImltcG9ydCB7IHdhaXRGb3JFbGVtZW50LCBjbGlja0VsZW1lbnRBbmRXYWl0Rm9yIH0gZnJvbSBcIi4uL2RvbS9hc3luYy1ldmVudHMuanNcIlxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBVSUNvbXBvbmVudCB7XG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge0VsZW1lbnR9IHJvb3Rcblx0ICogQHBhcmFtIHtvYmplY3R9IGlkZW50aWZpZXJcblx0ICovXG5cdGNvbnN0cnVjdG9yKHJvb3QsIGlkZW50aWZpZXI9e30pIHtcblx0XHR0aGlzLnJvb3QgPSByb290XG5cdFx0dGhpcy5pZGVudGlmaWVyID0gaWRlbnRpZmllclxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7RWxlbWVudH0gdGFyZ2V0XG5cdCAqIEBwYXJhbSB7ZnVuY3Rpb259IGdldEVsZW1lbnRcblx0ICogQHJldHVybnMge1Byb21pc2U8RWxlbWVudD59XG5cdCAqL1xuXHR3YWl0Rm9yRWxlbWVudCh0YXJnZXQsIGdldEVsZW1lbnQpIHtcblx0XHRyZXR1cm4gZ2V0RWxlbWVudCgpIHx8IHdhaXRGb3JFbGVtZW50KHRhcmdldCwgZ2V0RWxlbWVudClcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge0VsZW1lbnR9IGNsaWNrVGFyZ2V0XG5cdCAqIEBwYXJhbSB7RWxlbWVudH0gdGFyZ2V0XG5cdCAqIEBwYXJhbSB7ZnVuY3Rpb259IGdldEVsZW1lbnRcblx0ICogQHJldHVybnMge1Byb21pc2U8RWxlbWVudD59XG5cdCAqL1xuXHRjbGlja0VsZW1lbnRBbmRXYWl0Rm9yKGNsaWNrVGFyZ2V0LCB0YXJnZXQsIGdldEVsZW1lbnQpIHtcblx0XHRyZXR1cm4gY2xpY2tFbGVtZW50QW5kV2FpdEZvcihjbGlja1RhcmdldCwgdGFyZ2V0LCBnZXRFbGVtZW50KVxuXHR9XG5cbn1cbiIsImltcG9ydCB7IHdhaXRGb3JFbGVtZW50IH0gZnJvbSBcIi4uLy4uL2RvbS9hc3luYy1ldmVudHMuanNcIlxuXG4vKipcbiAqXG4gKiBAcGFyYW0ge0VsZW1lbnR9IHJvb3RcbiAqIEByZXR1cm5zIHtQcm9taXNlPGJvb2xlYW4+fVxuICovXG5leHBvcnQgZGVmYXVsdCBhc3luYyBmdW5jdGlvbiBsb2FkTW9yZU1lc3NhZ2VTdHJhdGVneShyb290KSB7XG5cdGNvbnNvbGUuZGVidWcoXCJsb2FkTW9yZU1lc3NhZ2VTdHJhdGVneVwiKVxuXHRyb290LnNjcm9sbFRvcCA9IDk5OVxuXHRyb290LnNjcm9sbFRvcCA9IDBcblx0bGV0IGZpbmRMb2FkZXJUaW1lb3V0XG5cdGNvbnN0IGxvYWRpbmdFbGVtZW50ID0gYXdhaXQgUHJvbWlzZS5yYWNlKFtcblx0XHR3YWl0Rm9yRWxlbWVudChyb290LCAoKSA9PiByb290LnF1ZXJ5U2VsZWN0b3IoYFtyb2xlPXByb2dyZXNzYmFyXWApKSxcblx0XHRuZXcgUHJvbWlzZShyZXNvbHZlID0+IHtcblx0XHRcdGZpbmRMb2FkZXJUaW1lb3V0ID0gc2V0VGltZW91dChyZXNvbHZlLCByb290Lm93bmVyRG9jdW1lbnQuZGVmYXVsdFZpZXcuSURNVV9TQ1JPTExfREVURUNUSU9OX1RJTUVPVVQpXG5cdFx0fSlcblx0XSlcblx0Y2xlYXJUaW1lb3V0KGZpbmRMb2FkZXJUaW1lb3V0KVxuXHRpZihsb2FkaW5nRWxlbWVudCkge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJsb2FkTW9yZU1lc3NhZ2VTdHJhdGVneTogRm91bmQgbG9hZGVyOyBTdGFuZC1ieSB1bnRpbCBpdCBpcyByZW1vdmVkXCIpXG5cdFx0Y29uc29sZS5kZWJ1ZyhcImxvYWRNb3JlTWVzc2FnZVN0cmF0ZWd5OiBzY3JvbGxUb3BcIiwgcm9vdC5zY3JvbGxUb3ApXG5cdFx0YXdhaXQgd2FpdEZvckVsZW1lbnQocm9vdCwgKCkgPT4gcm9vdC5xdWVyeVNlbGVjdG9yKGBbcm9sZT1wcm9ncmVzc2Jhcl1gKSA9PT0gbnVsbClcblx0XHRjb25zb2xlLmRlYnVnKFwibG9hZE1vcmVNZXNzYWdlU3RyYXRlZ3k6IExvYWRlciB3YXMgcmVtb3ZlZCwgb2xkZXIgbWVzc2FnZXMgbG9hZGluZyBjb21wbGV0ZWRcIilcblx0XHRjb25zb2xlLmRlYnVnKGBsb2FkTW9yZU1lc3NhZ2VTdHJhdGVneTogc2Nyb2xsVG9wIGlzICR7cm9vdC5zY3JvbGxUb3B9IHdlICR7cm9vdC5zY3JvbGxUb3AgPT09IDAgPyBcInJlYWNoZWQgbGFzdCBwYWdlXCIgOiBcIiBkaWQgbm90IHJlYWNoIGxhc3QgcGFnZSBhbmQgd2lsbCBiZWdpbiBsb2FkaW5nIG9sZGVyIG1lc3NhZ2VzIHNob3J0bHlcIn1gLCApXG5cdFx0cmV0dXJuIHJvb3Quc2Nyb2xsVG9wID09PSAwXG5cdH0gZWxzZSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcImxvYWRNb3JlTWVzc2FnZVN0cmF0ZWd5OiBDb3VsZCBub3QgZmluZCBsb2FkZXJcIilcblx0XHRyZXR1cm4gdHJ1ZVxuXHR9XG59XG4iLCJpbXBvcnQgVUlDb21wb25lbnQgZnJvbSBcIi4vdWktY29tcG9uZW50LmpzXCJcbmltcG9ydCBsb2FkTW9yZU1lc3NhZ2VTdHJhdGVneSBmcm9tIFwiLi9zdHJhdGVneS9sb2FkLW1vcmUtbWVzc2FnZXMtc3RyYXRlZ3kuanNcIlxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBVSU1lc3NhZ2VzV3JhcHBlciBleHRlbmRzIFVJQ29tcG9uZW50IHtcblxuXHQvKipcblx0ICogQHBhcmFtIHtXaW5kb3d9XG5cdCAqIEByZXR1cm5zIHtIVE1MRGl2RWxlbWVudH1cblx0ICovXG5cdHN0YXRpYyBmaW5kKHdpbmRvdykge1xuXHRcdHJldHVybiB3aW5kb3cuZG9jdW1lbnQucXVlcnlTZWxlY3RvcihcImRpdltyb2xlPWdyaWRdID4gZGl2ID4gZGl2ID4gZGl2ID4gZGl2XCIpXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHJldHVybnMge1Byb21pc2U+fVxuXHQgKi9cblx0ZmV0Y2hBbmRSZW5kZXJUaHJlYWROZXh0TWVzc2FnZVBhZ2UoKSB7XG5cdFx0cmV0dXJuIGxvYWRNb3JlTWVzc2FnZVN0cmF0ZWd5KHRoaXMucm9vdClcblx0fVxuXG59XG4iLCJpbXBvcnQgVUlNZXNzYWdlc1dyYXBwZXIgZnJvbSBcIi4uL3VpLW1lc3NhZ2VzLXdyYXBwZXIuanNcIlxuXG4vKipcbiAqXG4gKiBAcGFyYW0ge1dpbmRvd30gd2luZG93XG4gKiBAcmV0dXJucyB7SFRNTERpdkVsZW1lbnR9XG4gKi9cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIGZpbmRNZXNzYWdlc1dyYXBwZXJTdHJhdGVneSh3aW5kb3cpIHtcblx0cmV0dXJuIFVJTWVzc2FnZXNXcmFwcGVyLmZpbmQod2luZG93KVxufVxuIiwiaW1wb3J0IFVJQ29tcG9uZW50IGZyb20gXCIuL3VpLWNvbXBvbmVudC5qc1wiXG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFVJTWVzc2FnZSBleHRlbmRzIFVJQ29tcG9uZW50IHtcblxuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHtIVE1MRGl2RWxlbWVudH0gZWxlbWVudFxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZTxib29sZWFuPn1cblx0ICovXG5cdHN0YXRpYyBhc3luYyBpc015T3duTWVzc2FnZShlbGVtZW50KSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcImlzTXlPd25NZXNzYWdlXCIsIGVsZW1lbnQpXG5cdFx0ZWxlbWVudC5xdWVyeVNlbGVjdG9yKFwiW2FyaWEtbGFiZWw9TW9yZV1bYXJpYS1leHBhbmRlZD10cnVlXVwiKT8uY2xpY2soKVxuXHRcdGVsZW1lbnQucXVlcnlTZWxlY3RvcihgW2FyaWEtbGFiZWw9XCJDbG9zZSBkZXRhaWxzIGFuZCBhY3Rpb25zXCJdYCk/LmNsaWNrKClcblx0XHRlbGVtZW50LmRpc3BhdGNoRXZlbnQobmV3IE1vdXNlRXZlbnQoXCJtb3VzZW91dFwiLCB7IGJ1YmJsZXM6IHRydWUgfSkpXG5cdFx0Y29uc3QgdWlNZXNzYWdlID0gbmV3IFVJTWVzc2FnZShlbGVtZW50KVxuXHRcdGxldCB0aW1lb3V0XG5cdFx0Y29uc3QgYWN0aW9uQnV0dG9uID0gYXdhaXQgUHJvbWlzZS5yYWNlKFtcblx0XHRcdHVpTWVzc2FnZS5zaG93QWN0aW9uc01lbnVCdXR0b24oKSxcblx0XHRcdG5ldyBQcm9taXNlKHJlc29sdmUgPT4ge1xuXHRcdFx0XHR0aW1lb3V0ID0gc2V0VGltZW91dChyZXNvbHZlLCBlbGVtZW50Lm93bmVyRG9jdW1lbnQuZGVmYXVsdFZpZXcuSURNVV9NRVNTQUdFX0RFVEVDVElPTl9BQ1RJT05fTUVOVV9USU1FT1VUKVxuXHRcdFx0fSlcblx0XHRdKVxuXHRcdGNsZWFyVGltZW91dCh0aW1lb3V0KVxuXHRcdGlmKGFjdGlvbkJ1dHRvbikge1xuXHRcdFx0Y29uc3QgYWN0aW9uc01lbnVFbGVtZW50ID0gYXdhaXQgdWlNZXNzYWdlLm9wZW5BY3Rpb25zTWVudShhY3Rpb25CdXR0b24pXG5cdFx0XHRhd2FpdCB1aU1lc3NhZ2UuY2xvc2VBY3Rpb25zTWVudShhY3Rpb25CdXR0b24sIGFjdGlvbnNNZW51RWxlbWVudClcblx0XHRcdGF3YWl0IHVpTWVzc2FnZS5oaWRlQWN0aW9uTWVudUJ1dHRvbigpXG5cdFx0XHRyZXR1cm4gYWN0aW9uc01lbnVFbGVtZW50ICYmIGFjdGlvbnNNZW51RWxlbWVudC50ZXh0Q29udGVudC50b0xvY2FsZUxvd2VyQ2FzZSgpID09PSBcInVuc2VuZFwiXG5cdFx0fVxuXHRcdHJldHVybiBmYWxzZVxuXHR9XG5cblx0c2Nyb2xsSW50b1ZpZXcoKSB7XG5cdFx0dGhpcy5yb290LnNjcm9sbEludG9WaWV3KClcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZTxIVE1MQnV0dG9uRWxlbWVudD59XG5cdCAqL1xuXHRzaG93QWN0aW9uc01lbnVCdXR0b24oKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIldvcmtmbG93IHN0ZXAgMSA6IHNob3dBY3Rpb25zTWVudUJ1dHRvblwiKVxuXHRcdHRoaXMucm9vdC5kaXNwYXRjaEV2ZW50KG5ldyBNb3VzZUV2ZW50KFwibW91c2Vtb3ZlXCIsIHsgYnViYmxlczogdHJ1ZSB9KSlcblx0XHR0aGlzLnJvb3QuZGlzcGF0Y2hFdmVudChuZXcgTW91c2VFdmVudChcIm1vdXNlb3ZlclwiLCB7IGJ1YmJsZXM6IHRydWUgfSkpXG5cdFx0dGhpcy5yb290LmRpc3BhdGNoRXZlbnQobmV3IE1vdXNlRXZlbnQoXCJtb3VzZW50ZXJcIiwgeyBidWJibGVzOiB0cnVlIH0pKVxuXHRcdHJldHVybiB0aGlzLndhaXRGb3JFbGVtZW50KHRoaXMucm9vdCwgKCkgPT4gdGhpcy5yb290LnF1ZXJ5U2VsZWN0b3IoXCJbYXJpYS1sYWJlbD1Nb3JlXVwiKSkgLy8gVE9ETyBpMThuXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHJldHVybnMge1Byb21pc2U8Ym9vbGVhbj59XG5cdCAqL1xuXHRoaWRlQWN0aW9uTWVudUJ1dHRvbigpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwiV29ya2Zsb3cgcm9sbGluZyBiYWNrIGhpZGVBY3Rpb25NZW51QnV0dG9uXCIpXG5cdFx0dGhpcy5yb290LmRpc3BhdGNoRXZlbnQobmV3IE1vdXNlRXZlbnQoXCJtb3VzZW1vdmVcIiwgeyBidWJibGVzOiB0cnVlIH0pKVxuXHRcdHRoaXMucm9vdC5kaXNwYXRjaEV2ZW50KG5ldyBNb3VzZUV2ZW50KFwibW91c2VvdXRcIiwgeyBidWJibGVzOiB0cnVlIH0pKVxuXHRcdHRoaXMucm9vdC5kaXNwYXRjaEV2ZW50KG5ldyBNb3VzZUV2ZW50KFwibW91c2VsZWF2ZVwiLCB7IGJ1YmJsZXM6IHRydWUgfSkpXG5cdFx0cmV0dXJuIHRoaXMud2FpdEZvckVsZW1lbnQodGhpcy5yb290LCAoKSA9PiB0aGlzLnJvb3QucXVlcnlTZWxlY3RvcihcIlthcmlhLWxhYmVsPU1vcmVdXCIpID09PSBudWxsKSAvLyBUT0RPIGkxOG5cblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge0hUTUxCdXR0b25FbGVtZW50fSBhY3Rpb25CdXR0b25cblx0ICogQHJldHVybnMge1Byb21pc2V9XG5cdCAqL1xuXHRhc3luYyBvcGVuQWN0aW9uc01lbnUoYWN0aW9uQnV0dG9uKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIldvcmtmbG93IHN0ZXAgMiA6IG9wZW5BY3Rpb25zTWVudVwiLCBhY3Rpb25CdXR0b24pXG5cdFx0Y29uc3QgYWN0aW9uTWVudUVsZW1lbnQgPSBhd2FpdCB0aGlzLmNsaWNrRWxlbWVudEFuZFdhaXRGb3IoXG5cdFx0XHRhY3Rpb25CdXR0b24sXG5cdFx0XHR0aGlzLnJvb3Qub3duZXJEb2N1bWVudC5ib2R5LFxuXHRcdFx0KCkgPT4ge1xuXHRcdFx0XHRjb25zdCBtZW51RWxlbWVudHMgPSBbLi4udGhpcy5yb290Lm93bmVyRG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChcIltyb2xlPW1lbnVdIFtyb2xlPW1lbnVpdGVtXVwiKV1cblx0XHRcdFx0Y29uc29sZS5kZWJ1ZyhcIldvcmtmbG93IHN0ZXAgMiBtZW51RWxlbWVudHNcIiwgbWVudUVsZW1lbnRzLm1hcChtZW51RWxlbWVudCA9PiBtZW51RWxlbWVudC50ZXh0Q29udGVudCkpXG5cdFx0XHRcdG1lbnVFbGVtZW50cy5zb3J0KG5vZGUgPT4gbm9kZS50ZXh0Q29udGVudC50b0xvY2FsZUxvd2VyQ2FzZSgpID09PSBcInVuc2VuZFwiID8gLTEgOiAwKSAvLyBUT0RPIGkxOG5cblx0XHRcdFx0cmV0dXJuIG1lbnVFbGVtZW50cy5zaGlmdCgpXG5cdFx0XHR9LFxuXHRcdClcblx0XHRcdDtbLi4uYWN0aW9uTWVudUVsZW1lbnQucGFyZW50Tm9kZS5wYXJlbnROb2RlLnF1ZXJ5U2VsZWN0b3JBbGwoXCJbcm9sZT1tZW51aXRlbV1cIildLmZvckVhY2goZWxlbWVudCA9PiB7XG5cdFx0XHRpZihlbGVtZW50ICE9PSBhY3Rpb25NZW51RWxlbWVudCkge1xuXHRcdFx0XHRlbGVtZW50LnJlbW92ZSgpXG5cdFx0XHR9XG5cdFx0fSlcblx0XHRyZXR1cm4gYWN0aW9uTWVudUVsZW1lbnRcblxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7SFRNTEJ1dHRvbkVsZW1lbnR9IGFjdGlvbkJ1dHRvblxuXHQgKiBAcGFyYW0ge0hUTUxEaXZFbGVtZW50fSBhY3Rpb25zTWVudUVsZW1lbnRcblx0ICogQHJldHVybnMge1Byb21pc2U8Ym9vbGVhbj59XG5cdCAqL1xuXHRjbG9zZUFjdGlvbnNNZW51KGFjdGlvbkJ1dHRvbiwgYWN0aW9uc01lbnVFbGVtZW50KSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIldvcmtmbG93IHJvbGxpbmcgYmFjayAgY2xvc2VBY3Rpb25zTWVudVwiKVxuXHRcdHJldHVybiB0aGlzLmNsaWNrRWxlbWVudEFuZFdhaXRGb3IoXG5cdFx0XHRhY3Rpb25CdXR0b24sXG5cdFx0XHR0aGlzLnJvb3Qub3duZXJEb2N1bWVudC5ib2R5LFxuXHRcdFx0KCkgPT4gdGhpcy5yb290Lm93bmVyRG9jdW1lbnQuYm9keS5jb250YWlucyhhY3Rpb25zTWVudUVsZW1lbnQpID09PSBmYWxzZSxcblx0XHQpXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHJldHVybnMge1Byb21pc2U8SFRNTEJ1dHRvbkVsZW1lbnQ+fFByb21pc2U8RXJyb3I+fVxuXHQgKi9cblx0YXN5bmMgb3BlbkNvbmZpcm1VbnNlbmRNb2RhbCgpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwiV29ya2Zsb3cgc3RlcCAzIDogb3BlbkNvbmZpcm1VbnNlbmRNb2RhbFwiKVxuXHRcdGNvbnN0IHVuU2VuZEJ1dHRvbiA9IGF3YWl0IHRoaXMud2FpdEZvckVsZW1lbnQoXG5cdFx0XHR0aGlzLnJvb3Qub3duZXJEb2N1bWVudC5ib2R5LFxuXHRcdFx0KCkgPT4gWy4uLnRoaXMucm9vdC5vd25lckRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoXCJbcm9sZT1kaWFsb2ddIFtyb2xlPW1lbnVdIFtyb2xlPW1lbnVpdGVtXVwiKV0uZmlsdGVyKG5vZGUgPT4gbm9kZS50ZXh0Q29udGVudC50b0xvY2FsZUxvd2VyQ2FzZSgpID09PSBcInVuc2VuZFwiKS5wb3AoKSwgLy8gVE9ETyBpMThuXG5cdFx0KVxuXHRcdHJldHVybiB0aGlzLmNsaWNrRWxlbWVudEFuZFdhaXRGb3IoXG5cdFx0XHR1blNlbmRCdXR0b24sXG5cdFx0XHR0aGlzLnJvb3Qub3duZXJEb2N1bWVudC5ib2R5LFxuXHRcdFx0KCkgPT4gdGhpcy5yb290Lm93bmVyRG9jdW1lbnQucXVlcnlTZWxlY3RvcihcIltyb2xlPWRpYWxvZ10gYnV0dG9uXCIpLFxuXHRcdClcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge0hUTUxCdXR0b25FbGVtZW50fSBkaWFsb2dCdXR0b25cblx0ICogQHJldHVybnMge1Byb21pc2V9XG5cdCAqL1xuXHRhc3luYyBjb25maXJtVW5zZW5kKGRpYWxvZ0J1dHRvbikge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJXb3JrZmxvdyBmaW5hbCBzdGVwIDogY29uZmlybVVuc2VuZFwiLCBkaWFsb2dCdXR0b24pXG5cdFx0YXdhaXQgdGhpcy5jbGlja0VsZW1lbnRBbmRXYWl0Rm9yKFxuXHRcdFx0ZGlhbG9nQnV0dG9uLFxuXHRcdFx0dGhpcy5yb290Lm93bmVyRG9jdW1lbnQuYm9keSxcblx0XHRcdCgpID0+IHRoaXMucm9vdC5vd25lckRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCJbcm9sZT1kaWFsb2ddIGJ1dHRvblwiKSA9PT0gbnVsbFxuXHRcdClcblx0fVxuXG59XG4iLCJpbXBvcnQgVUlNZXNzYWdlIGZyb20gXCIuLi91aS1tZXNzYWdlLmpzXCJcblxuLyoqXG4gKlxuICogQHBhcmFtIHtFbGVtZW50fSByb290XG4gKiBAcmV0dXJucyB7UHJvbWlzZTxFbGVtZW50W10+fVxuICovXG5leHBvcnQgZGVmYXVsdCBhc3luYyBmdW5jdGlvbiBmaW5kTWVzc2FnZXNTdHJhdGVneShyb290KSB7XG5cdGNvbnN0IGVsZW1lbnRzID0gWy4uLnJvb3QucXVlcnlTZWxlY3RvckFsbChcImRpdltyb2xlPXJvd106bm90KFtkYXRhLWlkbXUtaWdub3JlXSlcIildXG5cdGNvbnNvbGUuZGVidWcoXCJmaW5kTWVzc2FnZXNTdHJhdGVneSBlbGVtZW50cyBcIiwgZWxlbWVudHMpXG5cdGNvbnN0IG1lc3NhZ2VFbGVtZW50cyA9IFtdXG5cdGZvcihjb25zdCBlbGVtZW50IG9mIGVsZW1lbnRzKSB7XG5cdFx0Y29uc3QgaXNNeU93bk1lc3NhZ2UgPSBhd2FpdCBVSU1lc3NhZ2UuaXNNeU93bk1lc3NhZ2UoZWxlbWVudClcblx0XHRpZihpc015T3duTWVzc2FnZSkge1xuXHRcdFx0Y29uc29sZS5kZWJ1ZyhcImZpbmRNZXNzYWdlc1N0cmF0ZWd5IGFkZGluZyBcIiwgZWxlbWVudClcblx0XHRcdG1lc3NhZ2VFbGVtZW50cy5wdXNoKGVsZW1lbnQpXG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnNvbGUuZGVidWcoXCJmaW5kTWVzc2FnZXNTdHJhdGVneSBpZ25vcmluZyBcIiwgZWxlbWVudClcblx0XHRcdGVsZW1lbnQuc2V0QXR0cmlidXRlKFwiZGF0YS1pZG11LWlnbm9yZVwiLCBcIlwiKVxuXHRcdH1cblx0fVxuXHRjb25zb2xlLmRlYnVnKFwiZmluZE1lc3NhZ2VzU3RyYXRlZ3kgaGl0c1wiLCBtZXNzYWdlRWxlbWVudHMpXG5cdHJldHVybiBtZXNzYWdlRWxlbWVudHNcbn1cbiIsImltcG9ydCBVSVBJQ29tcG9uZW50IGZyb20gXCIuL3VpcGktY29tcG9uZW50LmpzXCJcblxuXG5jbGFzcyBGYWlsZWRXb3JrZmxvd0V4Y2VwdGlvbiBleHRlbmRzIEVycm9yIHt9XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFVJUElNZXNzYWdlIGV4dGVuZHMgVUlQSUNvbXBvbmVudCB7XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7VUlNZXNzYWdlfSB1aUNvbXBvbmVudFxuXHQgKi9cblx0Y29uc3RydWN0b3IodWlDb21wb25lbnQpIHtcblx0XHRzdXBlcih1aUNvbXBvbmVudClcblx0fVxuXG5cblx0LyoqXG5cdCAqXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlPGJvb2xlYW4+fVxuXHQgKi9cblx0YXN5bmMgdW5zZW5kKCkge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJVSVBJTWVzc2FnZSB1bnNlbmRcIilcblx0XHRsZXQgYWN0aW9uQnV0dG9uXG5cdFx0bGV0IGFjdGlvbnNNZW51RWxlbWVudFxuXHRcdHRyeSB7XG5cdFx0XHRhd2FpdCB0aGlzLnVpQ29tcG9uZW50LnNjcm9sbEludG9WaWV3KClcblx0XHRcdGFjdGlvbkJ1dHRvbiA9IGF3YWl0IHRoaXMudWlDb21wb25lbnQuc2hvd0FjdGlvbnNNZW51QnV0dG9uKClcblx0XHRcdGFjdGlvbnNNZW51RWxlbWVudCA9IGF3YWl0IHRoaXMudWlDb21wb25lbnQub3BlbkFjdGlvbnNNZW51KGFjdGlvbkJ1dHRvbilcblx0XHRcdGNvbnNvbGUuZGVidWcoXCJhY3Rpb25zTWVudUVsZW1lbnRcIiwgYWN0aW9uc01lbnVFbGVtZW50KVxuXHRcdFx0Y29uc3QgZGlhbG9nQnV0dG9uID0gYXdhaXQgdGhpcy51aUNvbXBvbmVudC5vcGVuQ29uZmlybVVuc2VuZE1vZGFsKClcblx0XHRcdGF3YWl0IHRoaXMudWlDb21wb25lbnQuY29uZmlybVVuc2VuZChkaWFsb2dCdXR0b24pXG5cdFx0XHR0aGlzLnVpQ29tcG9uZW50LnJvb3Quc2V0QXR0cmlidXRlKFwiZGF0YS1pZG11LXVuc2VudFwiLCBcIlwiKVxuXHRcdFx0cmV0dXJuIHRydWVcblx0XHR9IGNhdGNoKGV4KSB7XG5cdFx0XHRjb25zb2xlLmVycm9yKGV4KVxuXHRcdFx0aWYoYWN0aW9uQnV0dG9uICYmIGFjdGlvbnNNZW51RWxlbWVudCkge1xuXHRcdFx0XHRhd2FpdCB0aGlzLnVpQ29tcG9uZW50LmNsb3NlQWN0aW9uc01lbnUoYWN0aW9uQnV0dG9uLCBhY3Rpb25zTWVudUVsZW1lbnQpXG5cdFx0XHR9XG5cdFx0XHRhd2FpdCB0aGlzLnVpQ29tcG9uZW50LmhpZGVBY3Rpb25NZW51QnV0dG9uKClcblx0XHRcdHRocm93IG5ldyBGYWlsZWRXb3JrZmxvd0V4Y2VwdGlvbihcIkZhaWxlZCB0byBleGVjdXRlIHdvcmtmbG93IGZvciB0aGlzIG1lc3NhZ2VcIilcblx0XHR9XG5cdH1cblxufVxuIiwiaW1wb3J0IFVJQ29tcG9uZW50IGZyb20gXCIuL3VpLWNvbXBvbmVudC5qc1wiXG5pbXBvcnQgZmluZE1lc3NhZ2VzU3RyYXRlZ3kgZnJvbSBcIi4uL3VpL3N0cmF0ZWd5L2ZpbmQtbWVzc2FnZXMtc3RyYXRlZ3kuanNcIlxuaW1wb3J0IFVJUElNZXNzYWdlIGZyb20gXCIuLi91aXBpL3VpcGktbWVzc2FnZS5qc1wiXG5pbXBvcnQgVUlNZXNzYWdlIGZyb20gXCIuL3VpLW1lc3NhZ2UuanNcIlxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBVSSBleHRlbmRzIFVJQ29tcG9uZW50IHtcblxuXHQvKipcblx0ICpcblx0ICogQHJldHVybnMge1Byb21pc2U+fVxuXHQgKi9cblx0YXN5bmMgZmV0Y2hBbmRSZW5kZXJUaHJlYWROZXh0TWVzc2FnZVBhZ2UoKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIlVJIGZldGNoQW5kUmVuZGVyVGhyZWFkTmV4dE1lc3NhZ2VQYWdlXCIpXG5cdFx0cmV0dXJuIGF3YWl0IHRoaXMuaWRlbnRpZmllci51aU1lc3NhZ2VzV3JhcHBlci5mZXRjaEFuZFJlbmRlclRocmVhZE5leHRNZXNzYWdlUGFnZSgpXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHJldHVybnMge1Byb21pc2U8VUlQSU1lc3NhZ2VbXT59XG5cdCAqL1xuXHRhc3luYyBjcmVhdGVVSVBJTWVzc2FnZXMoKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIlVJIGNyZWF0ZVVJUElNZXNzYWdlc1wiKVxuXHRcdGNvbnN0IHVpcGlNZXNzYWdlcyA9IFtdXG5cdFx0Y29uc3QgbWVzc2FnZUVsZW1lbnRzID0gYXdhaXQgZmluZE1lc3NhZ2VzU3RyYXRlZ3kodGhpcy5pZGVudGlmaWVyLnVpTWVzc2FnZXNXcmFwcGVyLnJvb3QpXG5cdFx0Zm9yKGNvbnN0IG1lc3NhZ2VFbGVtZW50IG9mIG1lc3NhZ2VFbGVtZW50cykge1xuXHRcdFx0Y29uc3QgdWlNZXNzYWdlID0gbmV3IFVJTWVzc2FnZShtZXNzYWdlRWxlbWVudClcblx0XHRcdHVpcGlNZXNzYWdlcy5wdXNoKG5ldyBVSVBJTWVzc2FnZSh1aU1lc3NhZ2UpKVxuXHRcdH1cblx0XHRyZXR1cm4gdWlwaU1lc3NhZ2VzXG5cdH1cblxufVxuIiwiaW1wb3J0IFVJUElDb21wb25lbnQgZnJvbSBcIi4vdWlwaS1jb21wb25lbnQuanNcIlxuaW1wb3J0IGZpbmRNZXNzYWdlc1dyYXBwZXJTdHJhdGVneSBmcm9tIFwiLi4vdWkvc3RyYXRlZ3kvZmluZC1tZXNzYWdlcy13cmFwcGVyLXN0cmF0ZWd5LmpzXCJcbmltcG9ydCBVSU1lc3NhZ2VzV3JhcHBlciBmcm9tIFwiLi4vdWkvdWktbWVzc2FnZXMtd3JhcHBlci5qc1wiXG5pbXBvcnQgVUkgZnJvbSBcIi4uL3VpL3VpLmpzXCJcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgVUlQSSBleHRlbmRzIFVJUElDb21wb25lbnQge1xuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge1VJfSB1aUNvbXBvbmVudFxuXHQgKi9cblx0Y29uc3RydWN0b3IodWlDb21wb25lbnQpIHtcblx0XHRzdXBlcih1aUNvbXBvbmVudClcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge1dpbmRvd30gd2luZG93XG5cdCAqIEByZXR1cm5zIHtVSVBJfVxuXHQgKi9cblx0c3RhdGljIGNyZWF0ZSh3aW5kb3cpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwiVUlQSS5jcmVhdGVcIilcblx0XHRjb25zdCBtZXNzYWdlc1dyYXBwZXJFbGVtZW50ID0gZmluZE1lc3NhZ2VzV3JhcHBlclN0cmF0ZWd5KHdpbmRvdylcblx0XHRsZXQgdWlwaVxuXHRcdGlmKG1lc3NhZ2VzV3JhcHBlckVsZW1lbnQgIT09IG51bGwpIHtcblx0XHRcdGNvbnNvbGUuZGVidWcoXCJGb3VuZCBtZXNzYWdlc1dyYXBwZXJFbGVtZW50XCIpXG5cdFx0XHRjb25zb2xlLmRlYnVnKG1lc3NhZ2VzV3JhcHBlckVsZW1lbnQpXG5cdFx0XHRjb25zdCB1aSA9IG5ldyBVSSh3aW5kb3cpXG5cdFx0XHR1aS5pZGVudGlmaWVyLnVpTWVzc2FnZXNXcmFwcGVyID0gbmV3IFVJTWVzc2FnZXNXcmFwcGVyKG1lc3NhZ2VzV3JhcHBlckVsZW1lbnQpXG5cdFx0XHR1aXBpID0gbmV3IFVJUEkodWkpXG5cdFx0fSBlbHNlIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihcIlVuYWJsZSB0byBmaW5kIG1lc3NhZ2VzV3JhcHBlckVsZW1lbnRcIilcblx0XHR9XG5cdFx0cmV0dXJuIHVpcGlcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZX1cblx0ICovXG5cdGZldGNoQW5kUmVuZGVyVGhyZWFkTmV4dE1lc3NhZ2VQYWdlKCkge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJVSVBJIGZldGNoQW5kUmVuZGVyVGhyZWFkTmV4dE1lc3NhZ2VQYWdlXCIpXG5cdFx0cmV0dXJuIHRoaXMudWlDb21wb25lbnQuZmV0Y2hBbmRSZW5kZXJUaHJlYWROZXh0TWVzc2FnZVBhZ2UoKVxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlPFVJUElNZXNzYWdlW10+fVxuXHQgKi9cblx0Y3JlYXRlVUlQSU1lc3NhZ2VzKCkge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJVSVBJIGNyZWF0ZVVJUElNZXNzYWdlc1wiKVxuXHRcdHJldHVybiB0aGlzLnVpQ29tcG9uZW50LmNyZWF0ZVVJUElNZXNzYWdlcygpXG5cdH1cblxufVxuIiwiaW1wb3J0IFVJUEkgZnJvbSBcIi4uL3VpcGkvdWlwaS5qc1wiXG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIElETVUge1xuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge1dpbmRvd30gd2luZG93XG5cdCAqL1xuXHRjb25zdHJ1Y3Rvcih3aW5kb3cpIHtcblx0XHR0aGlzLndpbmRvdyA9IHdpbmRvd1xuXHRcdHRoaXMudWlwaSA9IG51bGxcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZTxVSVBJTWVzc2FnZVtdPn1cblx0ICovXG5cdGNyZWF0ZVVJUElNZXNzYWdlcygpIHtcblx0XHRyZXR1cm4gdGhpcy4jZ2V0VUlQSSgpLmNyZWF0ZVVJUElNZXNzYWdlcygpXG5cdH1cblxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZX1cblx0ICovXG5cdGZldGNoQW5kUmVuZGVyVGhyZWFkTmV4dE1lc3NhZ2VQYWdlKCkge1xuXHRcdHJldHVybiB0aGlzLiNnZXRVSVBJKCkuZmV0Y2hBbmRSZW5kZXJUaHJlYWROZXh0TWVzc2FnZVBhZ2UoKVxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEByZXR1cm5zIHtVSVBJfVxuXHQgKi9cblx0I2dldFVJUEkoKSB7XG5cdFx0aWYodGhpcy51aXBpID09PSBudWxsKSB7XG5cdFx0XHR0aGlzLnVpcGkgPSBVSVBJLmNyZWF0ZSh0aGlzLndpbmRvdylcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMudWlwaVxuXHR9XG5cbn1cbiIsIlxuZXhwb3J0IGNsYXNzIFVuc2VuZFRocmVhZE1lc3NhZ2VzQmF0Y2hTdHJhdGVneSB7XG5cblx0c3RhdGljIERFRkFVTFRfQkFUQ0hfU0laRSA9IDVcblxuXHQjaWRtdVxuXHQjb25VbnN1Y2Nlc3NmdWxXb3JrZmxvd3Ncblx0I2ZpbmlzaGVkX3dvcmtmbG93c1xuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge0lETVV9IGlkbXVcblx0ICovXG5cdGNvbnN0cnVjdG9yKGlkbXUsIG9uVW5zdWNjZXNzZnVsV29ya2Zsb3dzPW51bGwpIHtcblx0XHR0aGlzLl9ydW5uaW5nID0gZmFsc2Vcblx0XHR0aGlzLl9zdG9wcGVkID0gZmFsc2Vcblx0XHR0aGlzLiNmaW5pc2hlZF93b3JrZmxvd3MgPSBbXVxuXHRcdHRoaXMuI2lkbXUgPSBpZG11XG5cdFx0dGhpcy4jb25VbnN1Y2Nlc3NmdWxXb3JrZmxvd3MgPSBvblVuc3VjY2Vzc2Z1bFdvcmtmbG93c1xuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEByZXR1cm5zIHtib29sZWFufVxuXHQgKi9cblx0aXNSdW5uaW5nKCkge1xuXHRcdHJldHVybiB0aGlzLl9ydW5uaW5nICYmICF0aGlzLl9zdG9wcGVkXG5cdH1cblxuXHRzdG9wKCkge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJVbnNlbmRUaHJlYWRNZXNzYWdlc0JhdGNoU3RyYXRlZ3kgc3RvcFwiKVxuXHRcdHRoaXMuX3N0b3BwZWQgPSB0cnVlXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHtudW1iZXJ9IGJhdGNoU2l6ZVxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZX1cblx0ICovXG5cdHJ1bihiYXRjaFNpemUpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwiVW5zZW5kVGhyZWFkTWVzc2FnZXNCYXRjaFN0cmF0ZWd5LnJ1bigpXCIsIGJhdGNoU2l6ZSlcblx0XHR0aGlzLl9ydW5uaW5nID0gdHJ1ZVxuXHRcdHRoaXMuX3N0b3BwZWQgPSBmYWxzZVxuXHRcdHJldHVybiB0aGlzLiNwcm9jZXNzQmF0Y2hlcyhiYXRjaFNpemUpXG5cdH1cblxuXHQjZG9uZSgpIHtcblx0XHR0aGlzLl9ydW5uaW5nID0gZmFsc2Vcblx0XHRjb25zb2xlLmRlYnVnKFwiVW5zZW5kVGhyZWFkTWVzc2FnZXNCYXRjaFN0cmF0ZWd5IGRvbmVcIilcblx0fVxuXG5cdCN1bnN1Y2Nlc3NmdWxXb3JrZmxvd0FsZXJ0KCkge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJVbnNlbmRUaHJlYWRNZXNzYWdlc0JhdGNoU3RyYXRlZ3kgdW5zdWNjZXNzZnVsV29ya2Zsb3dBbGVydFwiKVxuXHRcdGlmKCF0aGlzLl9ydW5uaW5nKSB7XG5cdFx0XHRjbGVhckludGVydmFsKHRoaXMuaW50ZXJ2YWwpXG5cdFx0fVxuXHRcdGNvbnNvbGUuZGVidWcoXCJVbnNlbmRUaHJlYWRNZXNzYWdlc0JhdGNoU3RyYXRlZ3kgZmluaXNoZWRfd29ya2Zsb3dzXCIsIHRoaXMuI2ZpbmlzaGVkX3dvcmtmbG93cylcblx0XHRjb25zdCB1bnN1Y2Nlc3NmdWxXb3JrZmxvd3MgPSB0aGlzLiNmaW5pc2hlZF93b3JrZmxvd3MuZmlsdGVyKHVpTWVzc2FnZSA9PiB0aGlzLiNpZG11LndpbmRvdy5kb2N1bWVudC5jb250YWlucyh1aU1lc3NhZ2UudWlDb21wb25lbnQucm9vdCkpXG5cdFx0Y29uc29sZS5kZWJ1ZyhcIlVuc2VuZFRocmVhZE1lc3NhZ2VzQmF0Y2hTdHJhdGVneSB1bnN1Y2Nlc3NmdWxXb3JrZmxvd3NcIiwgdW5zdWNjZXNzZnVsV29ya2Zsb3dzKVxuXHRcdGlmKHVuc3VjY2Vzc2Z1bFdvcmtmbG93cy5sZW5ndGggPj0gMSkge1xuXHRcdFx0dW5zdWNjZXNzZnVsV29ya2Zsb3dzLmZvckVhY2goZmFpbGVkV29ya2Zsb3cgPT4gdGhpcy4jZmluaXNoZWRfd29ya2Zsb3dzLnNwbGljZSh0aGlzLiNmaW5pc2hlZF93b3JrZmxvd3MuaW5kZXhPZihmYWlsZWRXb3JrZmxvdyksIDEpKVxuXHRcdFx0dGhpcy4jb25VbnN1Y2Nlc3NmdWxXb3JrZmxvd3ModW5zdWNjZXNzZnVsV29ya2Zsb3dzKVxuXHRcdH1cblx0fVxuXG5cdGFzeW5jICNwcm9jZXNzQmF0Y2hlcyhiYXRjaFNpemUpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwiVW5zZW5kVGhyZWFkTWVzc2FnZXNCYXRjaFN0cmF0ZWd5IHByb2Nlc3NCYXRjaGVzXCIpXG5cdFx0bGV0IGRvbmUgPSBmYWxzZVxuXHRcdGZvcihsZXQgaSA9IDA7IGkgPCBiYXRjaFNpemU7aSsrKSB7XG5cdFx0XHRpZih0aGlzLl9zdG9wcGVkKSB7XG5cdFx0XHRcdGJyZWFrXG5cdFx0XHR9XG5cdFx0XHRkb25lID0gYXdhaXQgdGhpcy4jaWRtdS5mZXRjaEFuZFJlbmRlclRocmVhZE5leHRNZXNzYWdlUGFnZSgpXG5cdFx0XHRpZihkb25lKSB7XG5cdFx0XHRcdGJyZWFrXG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRhd2FpdCBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgdGhpcy4jaWRtdS53aW5kb3cuSURNVV9ORVhUX01FU1NBR0VfUEFHRV9ERUxBWSkpXG5cdFx0XHR9XG5cdFx0fVxuXHRcdHRyeSB7XG5cdFx0XHRmb3IoY29uc3QgdWlwaU1lc3NhZ2Ugb2YgYXdhaXQgdGhpcy4jaWRtdS5jcmVhdGVVSVBJTWVzc2FnZXMoKSkge1xuXHRcdFx0XHRpZih0aGlzLl9zdG9wcGVkKSB7XG5cdFx0XHRcdFx0YnJlYWtcblx0XHRcdFx0fVxuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdGF3YWl0IHVpcGlNZXNzYWdlLnVuc2VuZCgpXG5cdFx0XHRcdFx0dGhpcy4jZmluaXNoZWRfd29ya2Zsb3dzLnB1c2godWlwaU1lc3NhZ2UpXG5cdFx0XHRcdFx0YXdhaXQgbmV3IFByb21pc2UocmVzb2x2ZSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIHRoaXMuI2lkbXUud2luZG93LklETVVfTUVTU0FHRV9RVUVVRV9ERUxBWSkpXG5cdFx0XHRcdH0gY2F0Y2gocmVzdWx0KSB7XG5cdFx0XHRcdFx0Y29uc29sZS5lcnJvcihyZXN1bHQpXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9IGNhdGNoKGV4KSB7XG5cdFx0XHRjb25zb2xlLmVycm9yKGV4KVxuXHRcdH1cblx0XHRpZighdGhpcy5pbnRlcnZhbCAmJiB0aGlzLiNvblVuc3VjY2Vzc2Z1bFdvcmtmbG93cykge1xuXHRcdFx0dGhpcy5pbnRlcnZhbCA9IHNldEludGVydmFsKCgpID0+IHRoaXMuI3Vuc3VjY2Vzc2Z1bFdvcmtmbG93QWxlcnQoKSwgdGhpcy4jaWRtdS53aW5kb3cuSURNVV9VTlNVQ0VTU0ZVTF9XT1JLRkxPV19BTEVSVF9JTlRFUlZBTClcblx0XHR9XG5cdFx0aWYoZG9uZSkge1xuXHRcdFx0dGhpcy4jZG9uZSgpXG5cdFx0fSBlbHNlIGlmKCF0aGlzLl9zdG9wcGVkKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy4jcHJvY2Vzc0JhdGNoZXMoYmF0Y2hTaXplKVxuXHRcdH1cblx0fVxufVxuIiwiLyoqXG4gKlxuICogQHBhcmFtIHtEb2N1bWVudH0gZG9jdW1lbnRcbiAqIEByZXR1cm5zIHtIVE1MQnV0dG9uRWxlbWVudH1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUFsZXJ0c1dyYXBwZXJFbGVtZW50KGRvY3VtZW50KSB7XG5cdGNvbnN0IGFsZXJ0c1dyYXBwZXJFbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKVxuXHRhbGVydHNXcmFwcGVyRWxlbWVudC5pZCA9IFwiaWRtdS1hbGVydHNcIlxuXHRhbGVydHNXcmFwcGVyRWxlbWVudC5zdHlsZS5wb3NpdGlvbiA9IFwiZml4ZWRcIlxuXHRhbGVydHNXcmFwcGVyRWxlbWVudC5zdHlsZS50b3AgPSBcIjIwcHhcIlxuXHRhbGVydHNXcmFwcGVyRWxlbWVudC5zdHlsZS5yaWdodCA9IFwiMjBweFwiXG5cdGFsZXJ0c1dyYXBwZXJFbGVtZW50LnN0eWxlLmRpc3BsYXkgPSBcImdyaWRcIlxuXHRyZXR1cm4gYWxlcnRzV3JhcHBlckVsZW1lbnRcbn1cblxuLyoqXG4gKlxuICogQHBhcmFtIHtEb2N1bWVudH0gZG9jdW1lbnRcbiAqIEBwYXJhbSB7c3RyaW5nfSAgIHRleHRcbiAqIEByZXR1cm5zIHtIVE1MQnV0dG9uRWxlbWVudH1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUFsZXJ0RWxlbWVudChkb2N1bWVudCwgdGV4dCkge1xuXHRjb25zdCBhbGVydEVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpXG5cdGFsZXJ0RWxlbWVudC50ZXh0Q29udGVudCA9IHRleHRcblx0cmV0dXJuIGFsZXJ0RWxlbWVudFxufVxuIiwiLyoqXG4gKiBAcGFyYW0ge0RvY3VtZW50fSBkb2N1bWVudFxuICogQHJldHVybnMge0hUTUxEaXZFbGVtZW50fVxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlT3ZlcmxheUVsZW1lbnQoZG9jdW1lbnQpIHtcblx0Y29uc3Qgb3ZlcmxheUVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpXG5cdG92ZXJsYXlFbGVtZW50LmlkID0gXCJpZG11LW92ZXJsYXlcIlxuXHRvdmVybGF5RWxlbWVudC50YWJJbmRleCA9IDBcblx0b3ZlcmxheUVsZW1lbnQuc3R5bGUudG9wID0gXCIwXCJcblx0b3ZlcmxheUVsZW1lbnQuc3R5bGUucmlnaHQgPSBcIjBcIlxuXHRvdmVybGF5RWxlbWVudC5zdHlsZS5wb3NpdGlvbiA9IFwiZml4ZWRcIlxuXHRvdmVybGF5RWxlbWVudC5zdHlsZS53aWR0aCA9IFwiMTAwdndcIlxuXHRvdmVybGF5RWxlbWVudC5zdHlsZS5oZWlnaHQgPSBcIjEwMHZoXCJcblx0b3ZlcmxheUVsZW1lbnQuc3R5bGUuekluZGV4ID0gXCI5OThcIlxuXHRvdmVybGF5RWxlbWVudC5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSBcIiMwMDAwMDBkNlwiXG5cdG92ZXJsYXlFbGVtZW50LnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIlxuXHRyZXR1cm4gb3ZlcmxheUVsZW1lbnRcbn1cbiIsImltcG9ydCB7IGNyZWF0ZU1lbnVCdXR0b25FbGVtZW50IH0gZnJvbSBcIi4vbWVudS1idXR0b24uanNcIlxuaW1wb3J0IHsgY3JlYXRlTWVudUVsZW1lbnQgfSBmcm9tIFwiLi9tZW51LmpzXCJcbmltcG9ydCBJRE1VIGZyb20gXCIuLi8uLi8uLi9pZG11L2lkbXUuanNcIlxuaW1wb3J0IHsgVW5zZW5kVGhyZWFkTWVzc2FnZXNCYXRjaFN0cmF0ZWd5IH0gZnJvbSBcIi4uL3N0cmF0ZWd5LmpzXCJcbmltcG9ydCB7IGNyZWF0ZUFsZXJ0c1dyYXBwZXJFbGVtZW50IH0gZnJvbSBcIi4vYWxlcnQuanNcIlxuaW1wb3J0IHsgY3JlYXRlT3ZlcmxheUVsZW1lbnQgfSBmcm9tIFwiLi9vdmVybGF5LmpzXCJcblxuLyoqXG4gKlxuICogQHBhcmFtIHt3aW5kb3d9IHdpbmRvd1xuICogQHJldHVybnMge0hUTUxEaXZFbGVtZW50fSAgICBvYmplY3QudWlFbGVtZW50XG4gKiBAcmV0dXJucyB7SFRNTEJ1dHRvbkVsZW1lbnR9IG9iamVjdC51bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvblxuICogQHJldHVybnMge0hUTUxCdXR0b25FbGVtZW50fSBvYmplY3QubG9hZFRocmVhZE1lc3NhZ2VzQnV0dG9uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZW5kZXIod2luZG93KSB7XG5cdGNvbnNvbGUuZGVidWcoXCJyZW5kZXJcIilcblx0Y29uc3QgaWRtdSA9IG5ldyBJRE1VKHdpbmRvdylcblx0Y29uc3Qgc3RyYXRlZ3kgPSBuZXcgVW5zZW5kVGhyZWFkTWVzc2FnZXNCYXRjaFN0cmF0ZWd5KGlkbXUsICh1bnN1Y2Nlc3NmdWxXb3JrZmxvd3MpID0+IHtcblx0XHRjb25zb2xlLmxvZyh1bnN1Y2Nlc3NmdWxXb3JrZmxvd3MpXG5cdH0pXG5cdGNvbnN0IHsgb3ZlcmxheUVsZW1lbnQsIHVpRWxlbWVudCwgbWVudUVsZW1lbnQsIHVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uLCBsb2FkVGhyZWFkTWVzc2FnZXNCdXR0b24gfSA9IGNyZWF0ZVVJRWxlbWVudCh3aW5kb3cuZG9jdW1lbnQpXG5cdGZ1bmN0aW9uIG9uVW5zZW5kaW5nRmluaXNoZWQoKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcInJlbmRlciBvblVuc2VuZGluZ0ZpbmlzaGVkXCIpXG5cdFx0O1suLi5tZW51RWxlbWVudC5xdWVyeVNlbGVjdG9yQWxsKFwiYnV0dG9uXCIpXS5maWx0ZXIoYnV0dG9uID0+IGJ1dHRvbiAhPT0gdW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24pLmZvckVhY2goYnV0dG9uID0+IHtcblx0XHRcdGJ1dHRvbi5zdHlsZS52aXNpYmlsaXR5ID0gXCJcIlxuXHRcdFx0YnV0dG9uLmRpc2FibGVkID0gZmFsc2Vcblx0XHR9KVxuXHRcdHVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uLnRleHRDb250ZW50ID0gdW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24uZGF0YVRleHRDb250ZW50XG5cdFx0dW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24uc3R5bGUuYmFja2dyb3VuZENvbG9yID0gdW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24uZGF0YUJhY2tncm91bmRDb2xvclxuXHRcdG92ZXJsYXlFbGVtZW50LnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIlxuXHRcdGlmKCFzdHJhdGVneS5fc3RvcHBlZCkge1xuXHRcdFx0d2luZG93LmFsZXJ0KFwiSURNVTogRmluaXNoZWRcIilcblx0XHR9XG5cdH1cblx0YXN5bmMgZnVuY3Rpb24gc3RhcnRVbnNlbmRpbmcoKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIlVzZXIgYXNrZWQgZm9yIG1lc3NhZ2VzIHVuc2VuZGluZyB0byBzdGFydDsgVUkgaW50ZXJhY3Rpb24gd2lsbCBiZSBkaXNhYmxlZCBpbiB0aGUgbWVhbnRpbWVcIilcblx0XHQ7Wy4uLm1lbnVFbGVtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoXCJidXR0b25cIildLmZpbHRlcihidXR0b24gPT4gYnV0dG9uICE9PSB1bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbikuZm9yRWFjaChidXR0b24gPT4ge1xuXHRcdFx0YnV0dG9uLnN0eWxlLnZpc2liaWxpdHkgPSBcImhpZGRlblwiXG5cdFx0XHRidXR0b24uZGlzYWJsZWQgPSB0cnVlXG5cdFx0fSlcblx0XHRvdmVybGF5RWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gXCJcIlxuXHRcdG92ZXJsYXlFbGVtZW50LmZvY3VzKClcblx0XHR1bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbi50ZXh0Q29udGVudCA9IFwiU3RvcCBwcm9jZXNzaW5nXCJcblx0XHR1bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbi5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSBcIiNGQTM4M0VcIlxuXHRcdGNvbnN0IGJhdGNoU2l6ZSA9IHdpbmRvdy5sb2NhbFN0b3JhZ2UuZ2V0SXRlbShcIklETVVfQkFUQ0hfU0laRVwiKSB8fCBVbnNlbmRUaHJlYWRNZXNzYWdlc0JhdGNoU3RyYXRlZ3kuREVGQVVMVF9CQVRDSF9TSVpFXG5cdFx0YXdhaXQgc3RyYXRlZ3kucnVuKGJhdGNoU2l6ZSlcblx0XHRvblVuc2VuZGluZ0ZpbmlzaGVkKClcblx0fVxuXHRmdW5jdGlvbiBoYW5kbGVFdmVudHMoZXZlbnQpIHtcblx0XHRpZihzdHJhdGVneS5pc1J1bm5pbmcoKSkge1xuXHRcdFx0Y29uc29sZS5pbmZvKFwiVXNlciBpbnRlcmFjdGlvbiBpcyBkaXNhYmxlZCBhcyB0aGUgdW5zZW5kaW5nIGlzIHN0aWxsIHJ1bm5pbmc7IFBsZWFzZSBzdG9wIHRoZSBleGVjdXRpb24gZmlyc3QuXCIpXG5cdFx0XHRldmVudC5zdG9wSW1tZWRpYXRlUHJvcGFnYXRpb24oKVxuXHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKVxuXHRcdFx0ZXZlbnQuc3RvcFByb3BhZ2F0aW9uKClcblx0XHRcdG92ZXJsYXlFbGVtZW50LmZvY3VzKClcblx0XHRcdHJldHVybiBmYWxzZVxuXHRcdH1cblx0fVxuXHRmdW5jdGlvbiBvbk11dGF0aW9ucygpIHtcblx0XHRpZih3aW5kb3cubG9jYXRpb24ucGF0aG5hbWUuc3RhcnRzV2l0aChcIi9kaXJlY3QvdC9cIikpIHtcblx0XHRcdHVpRWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gXCJcIlxuXHRcdH0gZWxzZSB7XG5cdFx0XHR1aUVsZW1lbnQuc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiXG5cdFx0XHRzdHJhdGVneS5zdG9wKClcblx0XHR9XG5cdH1cblx0d2luZG93LmRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJrZXlkb3duXCIsIGhhbmRsZUV2ZW50cylcblx0d2luZG93LmRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJrZXl1cFwiLCBoYW5kbGVFdmVudHMpXG5cdG5ldyBNdXRhdGlvbk9ic2VydmVyKG9uTXV0YXRpb25zKS5vYnNlcnZlKHdpbmRvdy5kb2N1bWVudC5ib2R5LCB7IGNoaWxkTGlzdDogdHJ1ZSB9KVxuXHRuZXcgTXV0YXRpb25PYnNlcnZlcihvbk11dGF0aW9ucykub2JzZXJ2ZSh3aW5kb3cuZG9jdW1lbnQucXVlcnlTZWxlY3RvcihcIltpZF49bW91bnRdID4gZGl2ID4gZGl2ID4gZGl2XCIpLCB7IGNoaWxkTGlzdDogdHJ1ZSwgYXR0cmlidXRlczogdHJ1ZSB9KVxuXHR1bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbi5kYXRhVGV4dENvbnRlbnQgPSB1bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbi50ZXh0Q29udGVudFxuXHR1bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbi5kYXRhQmFja2dyb3VuZENvbG9yID0gdW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24uc3R5bGUuYmFja2dyb3VuZENvbG9yXG5cdHVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XG5cdFx0aWYoc3RyYXRlZ3kuaXNSdW5uaW5nKCkpIHtcblx0XHRcdGNvbnNvbGUuZGVidWcoXCJVc2VyIGFza2VkIGZvciBtZXNzYWdlcyB1bnNlbmRpbmcgdG8gc3RvcFwiKVxuXHRcdFx0c3RyYXRlZ3kuc3RvcCgpXG5cdFx0XHRvblVuc2VuZGluZ0ZpbmlzaGVkKClcblx0XHR9IGVsc2Uge1xuXHRcdFx0c3RhcnRVbnNlbmRpbmcoKVxuXHRcdH1cblx0fSlcblx0bG9hZFRocmVhZE1lc3NhZ2VzQnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcImxvYWRUaHJlYWRNZXNzYWdlc0J1dHRvbiBjbGlja1wiKVxuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBiYXRjaFNpemUgPSBwYXJzZUludCh3aW5kb3cucHJvbXB0KFwiSG93IG1hbnkgcGFnZXMgc2hvdWxkIHdlIGxvYWQgYmVmb3JlIGVhY2ggdW5zZW5kaW5nPyBcIiwgd2luZG93LmxvY2FsU3RvcmFnZS5nZXRJdGVtKFwiSURNVV9CQVRDSF9TSVpFXCIpIHx8IFVuc2VuZFRocmVhZE1lc3NhZ2VzQmF0Y2hTdHJhdGVneS5ERUZBVUxUX0JBVENIX1NJWkUgKSlcblx0XHRcdGlmKHBhcnNlSW50KGJhdGNoU2l6ZSkpIHtcblx0XHRcdFx0d2luZG93LmxvY2FsU3RvcmFnZS5zZXRJdGVtKFwiSURNVV9CQVRDSF9TSVpFXCIsIHBhcnNlSW50KGJhdGNoU2l6ZSkpXG5cdFx0XHR9XG5cdFx0XHRjb25zb2xlLmRlYnVnKGBTZXR0aW5nIElETVVfQkFUQ0hfU0laRSB0byAke2JhdGNoU2l6ZX1gKVxuXHRcdH0gY2F0Y2goZXgpIHtcblx0XHRcdGNvbnNvbGUuZXJyb3IoZXgpXG5cdFx0fVxuXHR9KVxuXHR3aW5kb3cuZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCh1aUVsZW1lbnQpXG5cdHJldHVybiB7IHVpRWxlbWVudCwgdW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24sIGxvYWRUaHJlYWRNZXNzYWdlc0J1dHRvbiB9XG59XG5cbi8qKlxuICpcbiAqIEBwYXJhbSAgIHtEb2N1bWVudH0gICAgICAgICAgZG9jdW1lbnRcbiAqIEByZXR1cm5zIHtvYmplY3R9XG4gKiBAcmV0dXJucyB7SFRNTERpdkVsZW1lbnR9ICAgIG9iamVjdC51aUVsZW1lbnRcbiAqIEByZXR1cm5zIHtIVE1MRGl2RWxlbWVudH0gICAgb2JqZWN0Lm92ZXJsYXlFbGVtZW50XG4gKiBAcmV0dXJucyB7SFRNTERpdkVsZW1lbnR9ICAgIG9iamVjdC5tZW51RWxlbWVudFxuICogQHJldHVybnMge0hUTUxCdXR0b25FbGVtZW50fSBvYmplY3QudW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b25cbiAqIEByZXR1cm5zIHtIVE1MQnV0dG9uRWxlbWVudH0gb2JqZWN0LmxvYWRUaHJlYWRNZXNzYWdlc0J1dHRvblxuICovXG5mdW5jdGlvbiBjcmVhdGVVSUVsZW1lbnQoZG9jdW1lbnQpIHtcblx0Y29uc3QgdWlFbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKVxuXHRjb25zdCBtZW51RWxlbWVudCA9IGNyZWF0ZU1lbnVFbGVtZW50KGRvY3VtZW50KVxuXHRjb25zdCBvdmVybGF5RWxlbWVudCA9IGNyZWF0ZU92ZXJsYXlFbGVtZW50KGRvY3VtZW50KVxuXHRjb25zdCBhbGVydHNXcmFwcGVyRWxlbWVudCA9IGNyZWF0ZUFsZXJ0c1dyYXBwZXJFbGVtZW50KGRvY3VtZW50KVxuXHRjb25zdCB1bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbiA9IGNyZWF0ZU1lbnVCdXR0b25FbGVtZW50KGRvY3VtZW50LCBcIlVuc2VuZCBhbGwgRE1zXCIpXG5cdGNvbnN0IGxvYWRUaHJlYWRNZXNzYWdlc0J1dHRvbiA9IGNyZWF0ZU1lbnVCdXR0b25FbGVtZW50KGRvY3VtZW50LCBcIkJhdGNoIHNpemVcIiwgXCJzZWNvbmRhcnlcIilcblx0ZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChvdmVybGF5RWxlbWVudClcblx0ZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChhbGVydHNXcmFwcGVyRWxlbWVudClcblx0bWVudUVsZW1lbnQuYXBwZW5kQ2hpbGQodW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24pXG5cdG1lbnVFbGVtZW50LmFwcGVuZENoaWxkKGxvYWRUaHJlYWRNZXNzYWdlc0J1dHRvbilcblx0dWlFbGVtZW50LmFwcGVuZENoaWxkKG1lbnVFbGVtZW50KVxuXHRyZXR1cm4geyB1aUVsZW1lbnQsIG92ZXJsYXlFbGVtZW50LCBtZW51RWxlbWVudCwgdW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24sIGxvYWRUaHJlYWRNZXNzYWdlc0J1dHRvbiB9XG59XG4iLCJpbXBvcnQgeyByZW5kZXIgfSBmcm9tIFwiLi91aS91aS5qc1wiXG5cbmlmKCF3aW5kb3cuSURNVV9ERUJVRykge1xuXHRjb25zb2xlLmRlYnVnID0gKCkgPT4ge31cbn1cblxucmVuZGVyKHdpbmRvdylcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Q0FBQSxNQUFNLFlBQVksR0FBRztDQUNyQixDQUFDLFNBQVMsRUFBRSxTQUFTO0NBQ3JCLENBQUMsV0FBVyxFQUFFLFdBQVc7Q0FDekIsRUFBQztBQUNEO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNPLFNBQVMsZ0JBQWdCLENBQUMsYUFBYSxFQUFFLFNBQVMsQ0FBQyxZQUFZLENBQUMsT0FBTyxFQUFFO0NBQ2hGLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxRQUFRLEdBQUcsNkJBQTRCO0NBQzVELENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxLQUFLLEdBQUcsUUFBTztDQUNwQyxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLE1BQUs7Q0FDbkMsQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLFlBQVksR0FBRyxNQUFLO0NBQ3pDLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxPQUFPLEdBQUcsTUFBSztDQUNwQyxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsVUFBVSxHQUFHLE9BQU07Q0FDeEMsQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxVQUFTO0NBQ3ZDLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxVQUFVLEdBQUcsK0JBQThCO0NBQ2hFLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxlQUFlLEdBQUcsQ0FBQyxhQUFhLEVBQUUsU0FBUyxDQUFDLFNBQVMsRUFBQztDQUMzRTs7Q0NsQkE7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDTyxTQUFTLHVCQUF1QixDQUFDLFFBQVEsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFF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
