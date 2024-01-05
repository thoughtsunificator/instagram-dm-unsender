
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
// @version				0.5.15
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
	window["IDMU_DRY_RUN"] = false
	window["IDMU_MESSAGE_DETECTION_ACTION_MENU_TIMEOUT"] = 20
})();
(function (exports) {
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

	let UI$1 = class UI extends UIComponent {

		/**
		 *
		 * @abstract
		 * @returns {UI}
		 */
		static create() {
		}

		/**
		 *
		 * @abstract
		 * @returns {Promise}
		 */
		async fetchAndRenderThreadNextMessagePage() {
		}

		/**
		 *
		 * @abstract
		 * @returns {Promise<UIPIMessage[]>}
		 */
		async createUIPIMessages() {
		}

	};

	class UIMessage extends UIComponent {

		/**
		 *
		 * @param {HTMLDivElement} element
		 * @returns {Promise<boolean>}
		 */
		static async isMyOwnMessage(element) {
			console.debug("isMyOwnMessage", element);
			// close menu in case it was left open
			element.querySelector("[aria-label=More]")?.parentNode?.click();
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
				console.debug("actionButton found looking for unsend action in actionsMenu");
				const actionsMenuElement = await uiMessage.openActionsMenu(actionButton);
				await uiMessage.closeActionsMenu(actionButton, actionsMenuElement);
				await uiMessage.hideActionMenuButton();
				console.debug(actionsMenuElement, actionsMenuElement.textContent);
				return actionsMenuElement && actionsMenuElement.textContent.toLocaleLowerCase() === "unsend"
			} else {
				console.debug("Did not find actionButton");
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
			// Some rows are empty and we do want the entire run to fail
			return this.waitForElement(this.root, () => this.root.querySelector("[aria-label=More]")?.parentNode) // TODO i18n
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
					console.debug(menuElements.find(node => node.textContent.trim().toLocaleLowerCase() === "unsend"));
					return menuElements.find(node => node.textContent.trim().toLocaleLowerCase() === "unsend") || menuElements.shift()
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
			if(!dialogButton.ownerDocument.defaultView.IDMU_DRY_RUN) {
				// wait until confirm button is removed
				await this.clickElementAndWaitFor(
					dialogButton,
					this.root.ownerDocument.body,
					() => this.root.ownerDocument.querySelector("[role=dialog] button") === null
				);
			}
		}

	}

	/**
	 *
	 * @param {Element} root
	 * @returns {Promise<Element[]>}
	 */
	async function findMessages(root) {
		const elements = [...root.querySelectorAll("div[role=row]:not([data-idmu-ignore])")];
		console.debug("findMessages elements ", elements);
		const messageElements = [];
		for(const element of elements) {
			const isMyOwnMessage = await UIMessage.isMyOwnMessage(element);
			if(isMyOwnMessage) {
				console.debug("findMessages adding ", element);
				messageElements.push(element);
			} else {
				console.debug("findMessages ignoring ", element);
				element.setAttribute("data-idmu-ignore", "");
			}
		}
		console.debug("findMessages hits", messageElements);
		return messageElements
	}

	/**
	 *
	 * @param {Window} window
	 * @returns {HTMLDivElement}
	 */
	function findMessagesWrapper(window) {
		return window.document.querySelector("div[role=grid] > div > div > div > div")
	}

	/**
	 *
	 * @param {Element} root
	 * @returns {Promise<boolean>}
	 */
	async function loadMoreMessages(root) {
		console.debug("loadMoreMessages");
		root.scrollTop = 0;
		let findLoaderTimeout;
		console.debug("loadMoreMessages looking for loader... ", root.ownerDocument.defaultView.IDMU_SCROLL_DETECTION_TIMEOUT);
		const loadingElement = await Promise.race([
			waitForElement(root, () => {
				if(root.querySelector(`[role=progressbar]`) === null) {
					root.scrollTop = 0;
				}
				return root.querySelector(`[role=progressbar]`)
			}),
			new Promise(resolve => {
				findLoaderTimeout = setTimeout(resolve, root.ownerDocument.defaultView.IDMU_SCROLL_DETECTION_TIMEOUT);
			})
		]);
		clearTimeout(findLoaderTimeout);
		if(loadingElement) {
			console.debug("loadMoreMessages: Found loader; Stand-by until it is removed");
			console.debug("loadMoreMessages: scrollTop", root.scrollTop);
			await waitForElement(root, () => root.querySelector(`[role=progressbar]`) === null);
			console.debug("loadMoreMessages: Loader was removed, older messages loading completed");
			console.debug(`loadMoreMessages: scrollTop is ${root.scrollTop} we ${root.scrollTop === 0 ? "reached last page" : " did not reach last page and will begin loading older messages shortly"}`, );
			return root.scrollTop === 0
		} else {
			console.debug("loadMoreMessages: Could not find loader");
			return true
		}
	}

	class FailedWorkflowException extends Error {}

	class UIPIMessage {

		/**
		 *
		 * @param {UIMessage} uiMessage
		 */
		constructor(uiMessage) {
			this._uiMessage = uiMessage;
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
				await this.uiMessage.scrollIntoView();
				actionButton = await this.uiMessage.showActionsMenuButton();
				actionsMenuElement = await this.uiMessage.openActionsMenu(actionButton);
				console.debug("actionsMenuElement", actionsMenuElement);
				const dialogButton = await this.uiMessage.openConfirmUnsendModal();
				await this.uiMessage.confirmUnsend(dialogButton);
				this.uiMessage.root.setAttribute("data-idmu-unsent", "");
				return true
			} catch(ex) {
				console.error(ex);
				if(actionButton && actionsMenuElement) {
					await this.uiMessage.closeActionsMenu(actionButton, actionsMenuElement);
				}
				await this.uiMessage.hideActionMenuButton();
				throw new FailedWorkflowException("Failed to execute workflow for this message")
			}
		}

		/**
		 * @type {UIMessage}
		 */
		get uiMessage() {
			return this._uiMessage
		}

	}

	class UIMessagesWrapper extends UIComponent {

		/**
		 *
		 * @returns {Promise>}
		 */
		fetchAndRenderThreadNextMessagePage() {
			return loadMoreMessages(this.root)
		}

	}

	class DefaultUI extends UI$1 {

		/**
		 *
		 * @returns {DefaultUI}
		 */
		static create(window) {
			console.debug("UI create");
			const messagesWrapperElement = findMessagesWrapper(window);
			if(messagesWrapperElement !== null) {
				console.debug("Found messagesWrapperElement", messagesWrapperElement);
				const uiMessagesWrapper = new UIMessagesWrapper(messagesWrapperElement);
				return new DefaultUI(window, { uiMessagesWrapper })
			} else {
				throw new Error("Unable to find messagesWrapperElement")
			}
		}

		/**
		*
		* @returns {Promise>}
		*/
		async fetchAndRenderThreadNextMessagePage() {
			console.debug("UI fetchAndRenderThreadNextMessagePage");
			return await this.identifier.uiMessagesWrapper.fetchAndRenderThreadNextMessagePage(this.domMapper)
		}

		/**
		 *
		 * @returns {Promise<UIPIMessage[]>}
		 */
		async createUIPIMessages() {
			console.debug("UI createUIPIMessages");
			const uipiMessages = [];
			const messageElements = await findMessages(this.identifier.uiMessagesWrapper.root);
			for(const messageElement of messageElements) {
				const uiMessage = new UIMessage(messageElement);
				uipiMessages.push(new UIPIMessage(uiMessage));
			}
			return uipiMessages
		}

	}

	function getUI() {
		return DefaultUI
	}

	class UIPI {

		/**
		 *
		 * @param {UI} ui
		 */
		constructor(ui) {
			this._ui = ui;
		}

		/**
		 *
		 * @param {Window} window
		 * @returns {UIPI}
		 */
		static create(window) {
			console.debug("UIPI.create");
			const UI = getUI();
			const ui = UI.create(window);
			return new UIPI(ui)
		}

		/**
		 *
		 * @returns {Promise}
		 */
		fetchAndRenderThreadNextMessagePage() {
			console.debug("UIPI fetchAndRenderThreadNextMessagePage");
			return this.ui.fetchAndRenderThreadNextMessagePage()
		}

		/**
		 *
		 * @returns {Promise<UIPIMessage[]>}
		 */
		createUIPIMessages() {
			console.debug("UIPI createUIPIMessages");
			return this.ui.createUIPIMessages()
		}

		/**
		 * @type {UI}
		 */
		get ui() {
			return this._ui
		}

	}

	class IDMU {

		/**
		 *
		 * @param {Window} window
		 * @param {UI.constructor} UI
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
				this.uipi = UIPI.create(this.window, this.UI);
			}
			return this.uipi
		}

	}

	class UnsendStrategy {

		/**
		 *
		 * @param {IDMU} idmu
		 */
		constructor(idmu) {
			this._idmu = idmu;
		}

		/**
		 *
		 * @abstract
		 * @returns {boolean}
		 */
		isRunning() {
		}

		/**
		 *
		 * @abstract
		 */
		stop() {
		}

		/**
		 *
		 * @abstract
		 * @param {number} batchSize
		 */
		run() {
		}

		/**
		 * @readonly
		 * @type {IDMU}
		 */
		get idmu() {
			return this._idmu
		}

	}


	class BatchUnsendStrategy extends UnsendStrategy {

		static DEFAULT_BATCH_SIZE = 5

		#onUnsuccessfulWorkflows
		#finished_workflows


		/**
		 * @callback onUnsuccessfulWorkflows
		 * @param {IDMU} idmu
		 * @param {onUnsuccessfulWorkflows} onUnsuccessfulWorkflows
		 */
		constructor(idmu, onUnsuccessfulWorkflows=null) {
			super(idmu);
			this._running = false;
			this._stopped = false;
			this.#finished_workflows = [];
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
			console.debug("BatchUnsendStrategy stop");
			this._stopped = true;
		}

		/**
		 *
		 * @param {number} batchSize
		 * @returns {Promise}
		 */
		run(batchSize) {
			console.debug("BatchUnsendStrategy.run()", batchSize);
			this._running = true;
			this._stopped = false;
			return this.#processBatches(batchSize)
		}

		#done() {
			this._running = false;
			console.debug("BatchUnsendStrategy done");
		}

		#unsuccessfulWorkflowAlert() {
			console.debug("BatchUnsendStrategy unsuccessfulWorkflowAlert");
			if(!this._running) {
				clearInterval(this.interval);
			}
			console.debug("BatchUnsendStrategy finished_workflows", this.#finished_workflows);
			const unsuccessfulWorkflows = this.#finished_workflows.filter(uipiMessage => this.idmu.window.document.contains(uipiMessage.uiMessage.root));
			console.debug("BatchUnsendStrategy unsuccessfulWorkflows", unsuccessfulWorkflows);
			if(unsuccessfulWorkflows.length >= 1) {
				unsuccessfulWorkflows.forEach(failedWorkflow => this.#finished_workflows.splice(this.#finished_workflows.indexOf(failedWorkflow), 1));
				this.#onUnsuccessfulWorkflows(unsuccessfulWorkflows);
			}
		}

		async #processBatches(batchSize) {
			console.debug("BatchUnsendStrategy processBatches");
			let done = false;
			for(let i = 0; i < batchSize;i++) {
				if(this._stopped) {
					break
				}
				done = await this.idmu.fetchAndRenderThreadNextMessagePage();
				if(done) {
					break
				} else {
					await new Promise(resolve => setTimeout(resolve, this.idmu.window.IDMU_NEXT_MESSAGE_PAGE_DELAY));
				}
			}
			try {
				for(const uipiMessage of await this.idmu.createUIPIMessages()) {
					if(this._stopped) {
						break
					}
					try {
						await uipiMessage.unsend();
						this.#finished_workflows.push(uipiMessage);
						await new Promise(resolve => setTimeout(resolve, this.idmu.window.IDMU_MESSAGE_QUEUE_DELAY));
					} catch(result) {
						console.error(result);
					}
				}
			} catch(ex) {
				console.error(ex);
			}
			if(!this.interval && this.#onUnsuccessfulWorkflows) {
				this.interval = setInterval(() => this.#unsuccessfulWorkflowAlert(), this.idmu.window.IDMU_UNSUCESSFUL_WORKFLOW_ALERT_INTERVAL);
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

	class UI {
		/**
		 *
		 * @param {Document} document
		 * @param {HTMLDivElement} root
		 * @param {HTMLDivElement} overlayElement
		 * @param {HTMLDivElement} menuElement
		 * @param {HTMLButtonElement} unsendThreadMessagesButton
		 * @param {HTMLButtonElement} loadThreadMessagesButton
		 */
		constructor(document, root, overlayElement, menuElement, unsendThreadMessagesButton, loadThreadMessagesButton) {
			this._document = document;
			this._root = root;
			this._overlayElement = overlayElement;
			this._menuElement = menuElement;
			this._unsendThreadMessagesButton = unsendThreadMessagesButton;
			this._loadThreadMessagesButton = loadThreadMessagesButton;
			this._idmu = new IDMU(this.window);
			this._strategy = new BatchUnsendStrategy(this._idmu, () => this.#onUnsuccessfulWorkflows());
		}

		/**
		 *
		 * @param {window} window
		 * @returns {UI}
		 */
		static render(window) {
			console.debug("render");
			const ui = UI.create(window.document);
			window.document.body.appendChild(ui.root);
			return ui
		}

		/**
		 *
		 * @param   {Document} document
		 * @returns {UI}
		 */
		static create(document) {
			const root = document.createElement("div");
			const menuElement = createMenuElement(document);
			const overlayElement = createOverlayElement(document);
			const alertsWrapperElement = createAlertsWrapperElement(document);
			const unsendThreadMessagesButton = createMenuButtonElement(document, "Unsend all DMs");
			const loadThreadMessagesButton = createMenuButtonElement(document, "Batch size", "secondary");
			const loadAllMessagesButton = createMenuButtonElement(document, "Load all DMs");
			document.body.appendChild(overlayElement);
			document.body.appendChild(alertsWrapperElement);
			menuElement.appendChild(unsendThreadMessagesButton);
			menuElement.appendChild(loadThreadMessagesButton);
			menuElement.appendChild(loadAllMessagesButton);
			root.appendChild(menuElement);
			const ui = new UI(document, root, overlayElement, menuElement, unsendThreadMessagesButton, loadThreadMessagesButton);
			document.addEventListener("keydown", (event) => ui.#onWindowKeyEvent(event)); // TODO test
			document.addEventListener("keyup", (event) => ui.#onWindowKeyEvent(event)); // TODO test
			unsendThreadMessagesButton.addEventListener("click", (event) => ui.#onUnsendThreadMessagesButtonClick(event));
			loadThreadMessagesButton.addEventListener("click", (event) => ui.#onLoadThreadMessagesButtonClick(event)); // TODO test
			loadAllMessagesButton.addEventListener("click", (event) => ui.#onLoadAllMessagesButtonClick(event));
			new MutationObserver((mutations) => ui.#onMutations(mutations, ui)).observe(document.body, { childList: true }); // TODO test
			unsendThreadMessagesButton.dataTextContent = unsendThreadMessagesButton.textContent;
			unsendThreadMessagesButton.dataBackgroundColor = unsendThreadMessagesButton.style.backgroundColor;
			return ui
		}

		async #startUnsending() {
			console.debug("User asked for messages unsending to start; UI interaction will be disabled in the meantime")
			;[...this.menuElement.querySelectorAll("button")].filter(button => button !== this.unsendThreadMessagesButton).forEach(button => {
				button.style.visibility = "hidden";
				button.disabled = true;
			});
			this.overlayElement.style.display = "";
			this.overlayElement.focus();
			this.unsendThreadMessagesButton.textContent = "Stop processing";
			this.unsendThreadMessagesButton.style.backgroundColor = "#FA383E";
			const batchSize = this.window.localStorage.getItem("IDMU_BATCH_SIZE") || BatchUnsendStrategy.DEFAULT_BATCH_SIZE;
			await this.strategy.run(batchSize);
			this.#onUnsendingFinished();
		}

		#setBatchSize(batchSize) {
			console.debug(`setBatchSize ${batchSize}`);
			this.window.localStorage.setItem("IDMU_BATCH_SIZE", parseInt(batchSize));
		}

		#onUnsuccessfulWorkflows(unsuccessfulWorkflows) {
			console.log(unsuccessfulWorkflows);
		}

		/**
		 *
		 * @param {Mutation[]} mutations
		 */
		#onMutations(mutations, ui) {
			if(ui.root.ownerDocument.querySelector("[id^=mount] > div > div > div") !== null && ui) {
				new MutationObserver(ui.#onMutations.bind(this)).observe(ui.root.ownerDocument.querySelector("[id^=mount] > div > div > div"), { childList: true, attributes: true });
			}
			if(this.window.location.pathname.startsWith("/direct/t/")) {
				this.root.style.display = "";
			} else {
				this.root.style.display = "none";
				this.strategy.stop();
			}
		}

		/**
		 *
		 * @param {UI} ui
		 * @param {Event} event
		 */
		#onLoadThreadMessagesButtonClick() {
			console.debug("loadThreadMessagesButton click");
			try {
				const batchSize = parseInt(
					this.window.prompt("How many pages should we load before each unsending? ",
						this.window.localStorage.getItem("IDMU_BATCH_SIZE")
					|| BatchUnsendStrategy.DEFAULT_BATCH_SIZE )
				);
				if(parseInt(batchSize)) {
					this.#setBatchSize(batchSize);
				}
			} catch(ex) {
				console.error(ex);
			}
		}

		/**
		 *
		 * @param {UI} ui
		 * @param {Event} event
		 */
		async #onLoadAllMessagesButtonClick() {
			console.debug("loadThreadMessagesButton click");
			try {
				let done = false;
				while(!done) {
					done = await this.idmu.fetchAndRenderThreadNextMessagePage();
				}
			} catch(ex) {
				console.error(ex);
			}
		}

		/**
		 *
		 * @param {UI} ui
		 * @param {Event} event
		 */
		#onUnsendThreadMessagesButtonClick() {
			if(this.strategy.isRunning()) {
				console.debug("User asked for messages unsending to stop");
				this.strategy.stop();
				this.#onUnsendingFinished();
			} else {
				this.#startUnsending();
			}
		}

		/**
		 *
		 * @param {Event} event
		 */
		#onWindowKeyEvent(event) {
			if(this.strategy.isRunning()) {
				console.info("User interaction is disabled as the unsending is still running; Please stop the execution first.");
				event.stopImmediatePropagation();
				event.preventDefault();
				event.stopPropagation();
				this.overlayElement.focus();
				return false
			}
		}

		#onUnsendingFinished() {
			console.debug("render onUnsendingFinished")
			;[...this.menuElement.querySelectorAll("button")].filter(button => button !== this.unsendThreadMessagesButton).forEach(button => {
				button.style.visibility = "";
				button.disabled = false;
			});
			this.unsendThreadMessagesButton.textContent = this.unsendThreadMessagesButton.dataTextContent;
			this.unsendThreadMessagesButton.style.backgroundColor = this.unsendThreadMessagesButton.dataBackgroundColor;
			this.overlayElement.style.display = "none";
			if(!this.strategy._stopped) {
				this.window.alert("IDMU: Finished");
			}
		}


		/**
		 * @readonly
		 * @type {Document}
		 */
		get document() {
			return this._document
		}

		/**
		 * @readonly
		 * @type {Window}
		 */
		get window() {
			return this._document.defaultView
		}

		/**
		 * @readonly
		 * @type {HTMLDivElement}
		 */
		get root() {
			return this._root
		}

		/**
		 * @readonly
		 * @type {HTMLDivElement}
		 */
		get overlayElement() {
			return this._overlayElement
		}

		/**
		 * @readonly
		 * @type {HTMLDivElement}
		 */
		get menuElement() {
			return this._menuElement
		}

		/**
		 * @readonly
		 * @type {HTMLButtonElement}
		 */
		get unsendThreadMessagesButton() {
			return this._unsendThreadMessagesButton
		}

		/**
		 * @readonly
		 * @type {HTMLButtonElement}
		 */
		get loadThreadMessagesButton() {
			return this._loadThreadMessagesButton
		}

		/**
		 * @readonly
		 * @type {UnsendStrategy}
		 */
		get strategy() {
			return this._strategy
		}

		/**
		 * @readonly
		 * @type {IDMU}
		 */
		get idmu() {
			return this._idmu
		}

	}

	function main(window) {
		if(!window.IDMU_DEBUG) {
			console.debug = () => {};
		}

		UI.render(window);
	}

	if(typeof window !== "undefined") {
		main(window);
	}

	exports.main = main;

	return exports;

})({});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaWRtdS51c2VyLmpzIiwic291cmNlcyI6WyIuLi9zcmMvcnVudGltZS91c2Vyc2NyaXB0L3VpL3N0eWxlL2luc3RhZ3JhbS5qcyIsIi4uL3NyYy9ydW50aW1lL3VzZXJzY3JpcHQvdWkvbWVudS1idXR0b24uanMiLCIuLi9zcmMvcnVudGltZS91c2Vyc2NyaXB0L3VpL21lbnUuanMiLCIuLi9zcmMvZG9tL2FzeW5jLWV2ZW50cy5qcyIsIi4uL3NyYy91aS91aS1jb21wb25lbnQuanMiLCIuLi9zcmMvdWkvdWkuanMiLCIuLi9zcmMvdWkvZGVmYXVsdC91aS1tZXNzYWdlLmpzIiwiLi4vc3JjL3VpL2RlZmF1bHQvZG9tLWxvb2t1cC5qcyIsIi4uL3NyYy91aXBpL3VpcGktbWVzc2FnZS5qcyIsIi4uL3NyYy91aS9kZWZhdWx0L3VpLW1lc3NhZ2VzLXdyYXBwZXIuanMiLCIuLi9zcmMvdWkvZGVmYXVsdC9kZWZhdWx0LXVpLmpzIiwiLi4vc3JjL3VpL2dldC11aS5qcyIsIi4uL3NyYy91aXBpL3VpcGkuanMiLCIuLi9zcmMvaWRtdS9pZG11LmpzIiwiLi4vc3JjL3J1bnRpbWUvdXNlcnNjcmlwdC91bnNlbmQtc3RyYXRlZ3kuanMiLCIuLi9zcmMvcnVudGltZS91c2Vyc2NyaXB0L3VpL2FsZXJ0LmpzIiwiLi4vc3JjL3J1bnRpbWUvdXNlcnNjcmlwdC91aS9vdmVybGF5LmpzIiwiLi4vc3JjL3J1bnRpbWUvdXNlcnNjcmlwdC91aS91aS5qcyIsIi4uL3NyYy9ydW50aW1lL3VzZXJzY3JpcHQvbWFpbi5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJjb25zdCBCVVRUT05fU1RZTEUgPSB7XG5cdFwiUFJJTUFSWVwiOiBcInByaW1hcnlcIixcblx0XCJTRUNPTkRBUllcIjogXCJzZWNvbmRhcnlcIixcbn1cblxuLyoqXG4gKlxuICogQHBhcmFtIHtIVE1MQnV0dG9uRWxlbWVudH0gYnV0dG9uRWxlbWVudFxuICogQHBhcmFtIHtzdHJpbmd9ICAgICAgICAgICAgc3R5bGVOYW1lXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBhcHBseUJ1dHRvblN0eWxlKGJ1dHRvbkVsZW1lbnQsIHN0eWxlTmFtZT1CVVRUT05fU1RZTEUuUFJJTUFSWSkge1xuXHRidXR0b25FbGVtZW50LnN0eWxlLmZvbnRTaXplID0gXCJ2YXIoLS1zeXN0ZW0tMTQtZm9udC1zaXplKVwiXG5cdGJ1dHRvbkVsZW1lbnQuc3R5bGUuY29sb3IgPSBcIndoaXRlXCJcblx0YnV0dG9uRWxlbWVudC5zdHlsZS5ib3JkZXIgPSBcIjBweFwiXG5cdGJ1dHRvbkVsZW1lbnQuc3R5bGUuYm9yZGVyUmFkaXVzID0gXCI4cHhcIlxuXHRidXR0b25FbGVtZW50LnN0eWxlLnBhZGRpbmcgPSBcIjhweFwiXG5cdGJ1dHRvbkVsZW1lbnQuc3R5bGUuZm9udFdlaWdodCA9IFwiYm9sZFwiXG5cdGJ1dHRvbkVsZW1lbnQuc3R5bGUuY3Vyc29yID0gXCJwb2ludGVyXCJcblx0YnV0dG9uRWxlbWVudC5zdHlsZS5saW5lSGVpZ2h0ID0gXCJ2YXIoLS1zeXN0ZW0tMTQtbGluZS1oZWlnaHQpXCJcblx0YnV0dG9uRWxlbWVudC5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSBgcmdiKHZhcigtLWlnLSR7c3R5bGVOYW1lfS1idXR0b24pKWBcbn1cbiIsImltcG9ydCB7IGFwcGx5QnV0dG9uU3R5bGUgfSBmcm9tIFwiLi9zdHlsZS9pbnN0YWdyYW0uanNcIlxuXG4vKipcbiAqXG4gKiBAcGFyYW0ge0RvY3VtZW50fSBkb2N1bWVudFxuICogQHBhcmFtIHtzdHJpbmd9ICAgdGV4dFxuICogQHBhcmFtIHtzdHJpbmd9ICAgc3R5bGVOYW1lXG4gKiBAcmV0dXJucyB7SFRNTEJ1dHRvbkVsZW1lbnR9XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVNZW51QnV0dG9uRWxlbWVudChkb2N1bWVudCwgdGV4dCwgc3R5bGVOYW1lKSB7XG5cdGNvbnN0IGJ1dHRvbkVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiYnV0dG9uXCIpXG5cdGJ1dHRvbkVsZW1lbnQudGV4dENvbnRlbnQgPSB0ZXh0XG5cdGFwcGx5QnV0dG9uU3R5bGUoYnV0dG9uRWxlbWVudCwgc3R5bGVOYW1lKVxuXHRidXR0b25FbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJtb3VzZW92ZXJcIiwgKCkgPT4ge1xuXHRcdGJ1dHRvbkVsZW1lbnQuc3R5bGUuZmlsdGVyID0gYGJyaWdodG5lc3MoMS4xNSlgXG5cdH0pXG5cdGJ1dHRvbkVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNlb3V0XCIsICgpID0+IHtcblx0XHRidXR0b25FbGVtZW50LnN0eWxlLmZpbHRlciA9IGBgXG5cdH0pXG5cdHJldHVybiBidXR0b25FbGVtZW50XG59XG4iLCIvKipcbiAqIEBwYXJhbSB7RG9jdW1lbnR9IGRvY3VtZW50XG4gKiBAcmV0dXJucyB7SFRNTEJ1dHRvbkVsZW1lbnR9XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVNZW51RWxlbWVudChkb2N1bWVudCkge1xuXHRjb25zdCBtZW51RWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIilcblx0bWVudUVsZW1lbnQuc3R5bGUudG9wID0gXCIyMHB4XCJcblx0bWVudUVsZW1lbnQuc3R5bGUucmlnaHQgPSBcIjQzMHB4XCJcblx0bWVudUVsZW1lbnQuc3R5bGUucG9zaXRpb24gPSBcImZpeGVkXCJcblx0bWVudUVsZW1lbnQuc3R5bGUuekluZGV4ID0gOTk5XG5cdG1lbnVFbGVtZW50LnN0eWxlLmRpc3BsYXkgPSBcImZsZXhcIlxuXHRtZW51RWxlbWVudC5zdHlsZS5nYXAgPSBcIjEwcHhcIlxuXHRyZXR1cm4gbWVudUVsZW1lbnRcbn1cbiIsIi8qKlxuICpcbiAqIEBjYWxsYmFjayBnZXRFbGVtZW50XG4gKiBAcmV0dXJucyB7RWxlbWVudH1cbiAqL1xuXG4vKipcbiAqXG4gKiBAcGFyYW0ge0VsZW1lbnR9IHRhcmdldFxuICogQHBhcmFtIHtnZXRFbGVtZW50fSBnZXRFbGVtZW50XG4gKiBAcmV0dXJucyB7UHJvbWlzZTxFbGVtZW50Pn1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHdhaXRGb3JFbGVtZW50KHRhcmdldCwgZ2V0RWxlbWVudCkge1xuXHRyZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcblx0XHRsZXQgZWxlbWVudCA9IGdldEVsZW1lbnQoKVxuXHRcdGlmKGVsZW1lbnQpIHtcblx0XHRcdHJlc29sdmUoZWxlbWVudClcblx0XHR9IGVsc2Uge1xuXHRcdFx0bmV3IE11dGF0aW9uT2JzZXJ2ZXIoKG11dGF0aW9ucywgb2JzZXJ2ZXIpID0+IHtcblx0XHRcdFx0ZWxlbWVudCA9IGdldEVsZW1lbnQoKVxuXHRcdFx0XHRpZihlbGVtZW50KSB7XG5cdFx0XHRcdFx0b2JzZXJ2ZXIuZGlzY29ubmVjdCgpXG5cdFx0XHRcdFx0cmVzb2x2ZShlbGVtZW50KVxuXHRcdFx0XHR9XG5cdFx0XHR9KS5vYnNlcnZlKHRhcmdldCwgeyBzdWJ0cmVlOiB0cnVlLCBjaGlsZExpc3Q6dHJ1ZSB9KVxuXHRcdH1cblx0fSlcbn1cblxuLyoqXG4gKlxuICogQHBhcmFtIHtFbGVtZW50fSBjbGlja1RhcmdldFxuICogQHBhcmFtIHtFbGVtZW50fSB0YXJnZXRcbiAqIEBwYXJhbSB7Z2V0RWxlbWVudH0gZ2V0RWxlbWVudFxuICogQHJldHVybnMge0VsZW1lbnR8UHJvbWlzZTxFbGVtZW50Pn1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNsaWNrRWxlbWVudEFuZFdhaXRGb3IoY2xpY2tUYXJnZXQsIHRhcmdldCwgZ2V0RWxlbWVudCkge1xuXHRjb25zdCBwcm9taXNlID0gd2FpdEZvckVsZW1lbnQodGFyZ2V0LCBnZXRFbGVtZW50KVxuXHRjbGlja1RhcmdldC5jbGljaygpXG5cdHJldHVybiBnZXRFbGVtZW50KCkgfHwgcHJvbWlzZVxufVxuIiwiaW1wb3J0IHsgd2FpdEZvckVsZW1lbnQsIGNsaWNrRWxlbWVudEFuZFdhaXRGb3IgfSBmcm9tIFwiLi4vZG9tL2FzeW5jLWV2ZW50cy5qc1wiXG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFVJQ29tcG9uZW50IHtcblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7RWxlbWVudH0gcm9vdFxuXHQgKiBAcGFyYW0ge29iamVjdH0gaWRlbnRpZmllclxuXHQgKi9cblx0Y29uc3RydWN0b3Iocm9vdCwgaWRlbnRpZmllcj17fSkge1xuXHRcdHRoaXMucm9vdCA9IHJvb3Rcblx0XHR0aGlzLmlkZW50aWZpZXIgPSBpZGVudGlmaWVyXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHtFbGVtZW50fSB0YXJnZXRcblx0ICogQHBhcmFtIHtmdW5jdGlvbn0gZ2V0RWxlbWVudFxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZTxFbGVtZW50Pn1cblx0ICovXG5cdHdhaXRGb3JFbGVtZW50KHRhcmdldCwgZ2V0RWxlbWVudCkge1xuXHRcdHJldHVybiBnZXRFbGVtZW50KCkgfHwgd2FpdEZvckVsZW1lbnQodGFyZ2V0LCBnZXRFbGVtZW50KVxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7RWxlbWVudH0gY2xpY2tUYXJnZXRcblx0ICogQHBhcmFtIHtFbGVtZW50fSB0YXJnZXRcblx0ICogQHBhcmFtIHtmdW5jdGlvbn0gZ2V0RWxlbWVudFxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZTxFbGVtZW50Pn1cblx0ICovXG5cdGNsaWNrRWxlbWVudEFuZFdhaXRGb3IoY2xpY2tUYXJnZXQsIHRhcmdldCwgZ2V0RWxlbWVudCkge1xuXHRcdHJldHVybiBjbGlja0VsZW1lbnRBbmRXYWl0Rm9yKGNsaWNrVGFyZ2V0LCB0YXJnZXQsIGdldEVsZW1lbnQpXG5cdH1cblxufVxuIiwiaW1wb3J0IFVJQ29tcG9uZW50IGZyb20gXCIuL3VpLWNvbXBvbmVudC5qc1wiXG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFVJIGV4dGVuZHMgVUlDb21wb25lbnQge1xuXG5cdC8qKlxuXHQgKlxuXHQgKiBAYWJzdHJhY3Rcblx0ICogQHJldHVybnMge1VJfVxuXHQgKi9cblx0c3RhdGljIGNyZWF0ZSgpIHtcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAYWJzdHJhY3Rcblx0ICogQHJldHVybnMge1Byb21pc2V9XG5cdCAqL1xuXHRhc3luYyBmZXRjaEFuZFJlbmRlclRocmVhZE5leHRNZXNzYWdlUGFnZSgpIHtcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAYWJzdHJhY3Rcblx0ICogQHJldHVybnMge1Byb21pc2U8VUlQSU1lc3NhZ2VbXT59XG5cdCAqL1xuXHRhc3luYyBjcmVhdGVVSVBJTWVzc2FnZXMoKSB7XG5cdH1cblxufVxuIiwiaW1wb3J0IFVJQ29tcG9uZW50IGZyb20gXCIuLi91aS1jb21wb25lbnQuanNcIlxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBVSU1lc3NhZ2UgZXh0ZW5kcyBVSUNvbXBvbmVudCB7XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7SFRNTERpdkVsZW1lbnR9IGVsZW1lbnRcblx0ICogQHJldHVybnMge1Byb21pc2U8Ym9vbGVhbj59XG5cdCAqL1xuXHRzdGF0aWMgYXN5bmMgaXNNeU93bk1lc3NhZ2UoZWxlbWVudCkge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJpc015T3duTWVzc2FnZVwiLCBlbGVtZW50KVxuXHRcdC8vIGNsb3NlIG1lbnUgaW4gY2FzZSBpdCB3YXMgbGVmdCBvcGVuXG5cdFx0ZWxlbWVudC5xdWVyeVNlbGVjdG9yKFwiW2FyaWEtbGFiZWw9TW9yZV1cIik/LnBhcmVudE5vZGU/LmNsaWNrKClcblx0XHRlbGVtZW50LnF1ZXJ5U2VsZWN0b3IoYFthcmlhLWxhYmVsPVwiQ2xvc2UgZGV0YWlscyBhbmQgYWN0aW9uc1wiXWApPy5jbGljaygpXG5cdFx0ZWxlbWVudC5kaXNwYXRjaEV2ZW50KG5ldyBNb3VzZUV2ZW50KFwibW91c2VvdXRcIiwgeyBidWJibGVzOiB0cnVlIH0pKVxuXHRcdGNvbnN0IHVpTWVzc2FnZSA9IG5ldyBVSU1lc3NhZ2UoZWxlbWVudClcblx0XHRsZXQgdGltZW91dFxuXHRcdGNvbnN0IGFjdGlvbkJ1dHRvbiA9IGF3YWl0IFByb21pc2UucmFjZShbXG5cdFx0XHR1aU1lc3NhZ2Uuc2hvd0FjdGlvbnNNZW51QnV0dG9uKCksXG5cdFx0XHRuZXcgUHJvbWlzZShyZXNvbHZlID0+IHtcblx0XHRcdFx0dGltZW91dCA9IHNldFRpbWVvdXQocmVzb2x2ZSwgZWxlbWVudC5vd25lckRvY3VtZW50LmRlZmF1bHRWaWV3LklETVVfTUVTU0FHRV9ERVRFQ1RJT05fQUNUSU9OX01FTlVfVElNRU9VVClcblx0XHRcdH0pXG5cdFx0XSlcblx0XHRjbGVhclRpbWVvdXQodGltZW91dClcblx0XHRpZihhY3Rpb25CdXR0b24pIHtcblx0XHRcdGNvbnNvbGUuZGVidWcoXCJhY3Rpb25CdXR0b24gZm91bmQgbG9va2luZyBmb3IgdW5zZW5kIGFjdGlvbiBpbiBhY3Rpb25zTWVudVwiKVxuXHRcdFx0Y29uc3QgYWN0aW9uc01lbnVFbGVtZW50ID0gYXdhaXQgdWlNZXNzYWdlLm9wZW5BY3Rpb25zTWVudShhY3Rpb25CdXR0b24pXG5cdFx0XHRhd2FpdCB1aU1lc3NhZ2UuY2xvc2VBY3Rpb25zTWVudShhY3Rpb25CdXR0b24sIGFjdGlvbnNNZW51RWxlbWVudClcblx0XHRcdGF3YWl0IHVpTWVzc2FnZS5oaWRlQWN0aW9uTWVudUJ1dHRvbigpXG5cdFx0XHRjb25zb2xlLmRlYnVnKGFjdGlvbnNNZW51RWxlbWVudCwgYWN0aW9uc01lbnVFbGVtZW50LnRleHRDb250ZW50KVxuXHRcdFx0cmV0dXJuIGFjdGlvbnNNZW51RWxlbWVudCAmJiBhY3Rpb25zTWVudUVsZW1lbnQudGV4dENvbnRlbnQudG9Mb2NhbGVMb3dlckNhc2UoKSA9PT0gXCJ1bnNlbmRcIlxuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zb2xlLmRlYnVnKFwiRGlkIG5vdCBmaW5kIGFjdGlvbkJ1dHRvblwiKVxuXHRcdH1cblx0XHRyZXR1cm4gZmFsc2Vcblx0fVxuXG5cdHNjcm9sbEludG9WaWV3KCkge1xuXHRcdHRoaXMucm9vdC5zY3JvbGxJbnRvVmlldygpXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHJldHVybnMge1Byb21pc2U8SFRNTEJ1dHRvbkVsZW1lbnQ+fVxuXHQgKi9cblx0c2hvd0FjdGlvbnNNZW51QnV0dG9uKCkge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJXb3JrZmxvdyBzdGVwIDEgOiBzaG93QWN0aW9uc01lbnVCdXR0b25cIilcblx0XHR0aGlzLnJvb3QuZGlzcGF0Y2hFdmVudChuZXcgTW91c2VFdmVudChcIm1vdXNlbW92ZVwiLCB7IGJ1YmJsZXM6IHRydWUgfSkpXG5cdFx0dGhpcy5yb290LmRpc3BhdGNoRXZlbnQobmV3IE1vdXNlRXZlbnQoXCJtb3VzZW92ZXJcIiwgeyBidWJibGVzOiB0cnVlIH0pKVxuXHRcdHRoaXMucm9vdC5kaXNwYXRjaEV2ZW50KG5ldyBNb3VzZUV2ZW50KFwibW91c2VudGVyXCIsIHsgYnViYmxlczogdHJ1ZSB9KSlcblx0XHQvLyBTb21lIHJvd3MgYXJlIGVtcHR5IGFuZCB3ZSBkbyB3YW50IHRoZSBlbnRpcmUgcnVuIHRvIGZhaWxcblx0XHRyZXR1cm4gdGhpcy53YWl0Rm9yRWxlbWVudCh0aGlzLnJvb3QsICgpID0+IHRoaXMucm9vdC5xdWVyeVNlbGVjdG9yKFwiW2FyaWEtbGFiZWw9TW9yZV1cIik/LnBhcmVudE5vZGUpIC8vIFRPRE8gaTE4blxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlPGJvb2xlYW4+fVxuXHQgKi9cblx0aGlkZUFjdGlvbk1lbnVCdXR0b24oKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIldvcmtmbG93IHJvbGxpbmcgYmFjayBoaWRlQWN0aW9uTWVudUJ1dHRvblwiKVxuXHRcdHRoaXMucm9vdC5kaXNwYXRjaEV2ZW50KG5ldyBNb3VzZUV2ZW50KFwibW91c2Vtb3ZlXCIsIHsgYnViYmxlczogdHJ1ZSB9KSlcblx0XHR0aGlzLnJvb3QuZGlzcGF0Y2hFdmVudChuZXcgTW91c2VFdmVudChcIm1vdXNlb3V0XCIsIHsgYnViYmxlczogdHJ1ZSB9KSlcblx0XHR0aGlzLnJvb3QuZGlzcGF0Y2hFdmVudChuZXcgTW91c2VFdmVudChcIm1vdXNlbGVhdmVcIiwgeyBidWJibGVzOiB0cnVlIH0pKVxuXHRcdHJldHVybiB0aGlzLndhaXRGb3JFbGVtZW50KHRoaXMucm9vdCwgKCkgPT4gdGhpcy5yb290LnF1ZXJ5U2VsZWN0b3IoXCJbYXJpYS1sYWJlbD1Nb3JlXVwiKSA9PT0gbnVsbCkgLy8gVE9ETyBpMThuXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHtIVE1MQnV0dG9uRWxlbWVudH0gYWN0aW9uQnV0dG9uXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlfVxuXHQgKi9cblx0YXN5bmMgb3BlbkFjdGlvbnNNZW51KGFjdGlvbkJ1dHRvbikge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJXb3JrZmxvdyBzdGVwIDIgOiBvcGVuQWN0aW9uc01lbnVcIiwgYWN0aW9uQnV0dG9uKVxuXHRcdGNvbnN0IGFjdGlvbk1lbnVFbGVtZW50ID0gYXdhaXQgdGhpcy5jbGlja0VsZW1lbnRBbmRXYWl0Rm9yKFxuXHRcdFx0YWN0aW9uQnV0dG9uLFxuXHRcdFx0dGhpcy5yb290Lm93bmVyRG9jdW1lbnQuYm9keSxcblx0XHRcdCgpID0+IHtcblx0XHRcdFx0Y29uc3QgbWVudUVsZW1lbnRzID0gWy4uLnRoaXMucm9vdC5vd25lckRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoXCJbcm9sZT1tZW51XSBbcm9sZT1tZW51aXRlbV1cIildXG5cdFx0XHRcdGNvbnNvbGUuZGVidWcoXCJXb3JrZmxvdyBzdGVwIDIgbWVudUVsZW1lbnRzXCIsIG1lbnVFbGVtZW50cy5tYXAobWVudUVsZW1lbnQgPT4gbWVudUVsZW1lbnQudGV4dENvbnRlbnQpKVxuXHRcdFx0XHRjb25zb2xlLmRlYnVnKG1lbnVFbGVtZW50cy5maW5kKG5vZGUgPT4gbm9kZS50ZXh0Q29udGVudC50cmltKCkudG9Mb2NhbGVMb3dlckNhc2UoKSA9PT0gXCJ1bnNlbmRcIikpXG5cdFx0XHRcdHJldHVybiBtZW51RWxlbWVudHMuZmluZChub2RlID0+IG5vZGUudGV4dENvbnRlbnQudHJpbSgpLnRvTG9jYWxlTG93ZXJDYXNlKCkgPT09IFwidW5zZW5kXCIpIHx8IG1lbnVFbGVtZW50cy5zaGlmdCgpXG5cdFx0XHR9LFxuXHRcdClcblx0XHRcdDtbLi4uYWN0aW9uTWVudUVsZW1lbnQucGFyZW50Tm9kZS5wYXJlbnROb2RlLnF1ZXJ5U2VsZWN0b3JBbGwoXCJbcm9sZT1tZW51aXRlbV1cIildLmZvckVhY2goZWxlbWVudCA9PiB7XG5cdFx0XHRpZihlbGVtZW50ICE9PSBhY3Rpb25NZW51RWxlbWVudCkge1xuXHRcdFx0XHRlbGVtZW50LnJlbW92ZSgpXG5cdFx0XHR9XG5cdFx0fSlcblx0XHRyZXR1cm4gYWN0aW9uTWVudUVsZW1lbnRcblxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7SFRNTEJ1dHRvbkVsZW1lbnR9IGFjdGlvbkJ1dHRvblxuXHQgKiBAcGFyYW0ge0hUTUxEaXZFbGVtZW50fSBhY3Rpb25zTWVudUVsZW1lbnRcblx0ICogQHJldHVybnMge1Byb21pc2U8Ym9vbGVhbj59XG5cdCAqL1xuXHRjbG9zZUFjdGlvbnNNZW51KGFjdGlvbkJ1dHRvbiwgYWN0aW9uc01lbnVFbGVtZW50KSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIldvcmtmbG93IHJvbGxpbmcgYmFjayAgY2xvc2VBY3Rpb25zTWVudVwiKVxuXHRcdHJldHVybiB0aGlzLmNsaWNrRWxlbWVudEFuZFdhaXRGb3IoXG5cdFx0XHRhY3Rpb25CdXR0b24sXG5cdFx0XHR0aGlzLnJvb3Qub3duZXJEb2N1bWVudC5ib2R5LFxuXHRcdFx0KCkgPT4gdGhpcy5yb290Lm93bmVyRG9jdW1lbnQuYm9keS5jb250YWlucyhhY3Rpb25zTWVudUVsZW1lbnQpID09PSBmYWxzZSxcblx0XHQpXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHJldHVybnMge1Byb21pc2U8SFRNTEJ1dHRvbkVsZW1lbnQ+fFByb21pc2U8RXJyb3I+fVxuXHQgKi9cblx0YXN5bmMgb3BlbkNvbmZpcm1VbnNlbmRNb2RhbCgpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwiV29ya2Zsb3cgc3RlcCAzIDogb3BlbkNvbmZpcm1VbnNlbmRNb2RhbFwiKVxuXHRcdGNvbnN0IHVuU2VuZEJ1dHRvbiA9IGF3YWl0IHRoaXMud2FpdEZvckVsZW1lbnQoXG5cdFx0XHR0aGlzLnJvb3Qub3duZXJEb2N1bWVudC5ib2R5LFxuXHRcdFx0KCkgPT4gWy4uLnRoaXMucm9vdC5vd25lckRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoXCJbcm9sZT1kaWFsb2ddIFtyb2xlPW1lbnVdIFtyb2xlPW1lbnVpdGVtXVwiKV0uZmlsdGVyKG5vZGUgPT4gbm9kZS50ZXh0Q29udGVudC50b0xvY2FsZUxvd2VyQ2FzZSgpID09PSBcInVuc2VuZFwiKS5wb3AoKSwgLy8gVE9ETyBpMThuXG5cdFx0KVxuXHRcdHJldHVybiB0aGlzLmNsaWNrRWxlbWVudEFuZFdhaXRGb3IoXG5cdFx0XHR1blNlbmRCdXR0b24sXG5cdFx0XHR0aGlzLnJvb3Qub3duZXJEb2N1bWVudC5ib2R5LFxuXHRcdFx0KCkgPT4gdGhpcy5yb290Lm93bmVyRG9jdW1lbnQucXVlcnlTZWxlY3RvcihcIltyb2xlPWRpYWxvZ10gYnV0dG9uXCIpLFxuXHRcdClcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge0hUTUxCdXR0b25FbGVtZW50fSBkaWFsb2dCdXR0b25cblx0ICogQHJldHVybnMge1Byb21pc2V9XG5cdCAqL1xuXHRhc3luYyBjb25maXJtVW5zZW5kKGRpYWxvZ0J1dHRvbikge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJXb3JrZmxvdyBmaW5hbCBzdGVwIDogY29uZmlybVVuc2VuZFwiLCBkaWFsb2dCdXR0b24pXG5cdFx0aWYoIWRpYWxvZ0J1dHRvbi5vd25lckRvY3VtZW50LmRlZmF1bHRWaWV3LklETVVfRFJZX1JVTikge1xuXHRcdFx0Ly8gd2FpdCB1bnRpbCBjb25maXJtIGJ1dHRvbiBpcyByZW1vdmVkXG5cdFx0XHRhd2FpdCB0aGlzLmNsaWNrRWxlbWVudEFuZFdhaXRGb3IoXG5cdFx0XHRcdGRpYWxvZ0J1dHRvbixcblx0XHRcdFx0dGhpcy5yb290Lm93bmVyRG9jdW1lbnQuYm9keSxcblx0XHRcdFx0KCkgPT4gdGhpcy5yb290Lm93bmVyRG9jdW1lbnQucXVlcnlTZWxlY3RvcihcIltyb2xlPWRpYWxvZ10gYnV0dG9uXCIpID09PSBudWxsXG5cdFx0XHQpXG5cdFx0fVxuXHR9XG5cbn1cbiIsImltcG9ydCBVSU1lc3NhZ2UgZnJvbSBcIi4vdWktbWVzc2FnZS5qc1wiXG5pbXBvcnQgeyB3YWl0Rm9yRWxlbWVudCB9IGZyb20gXCIuLi8uLi9kb20vYXN5bmMtZXZlbnRzLmpzXCJcblxuLyoqXG4gKlxuICogQHBhcmFtIHtFbGVtZW50fSByb290XG4gKiBAcmV0dXJucyB7UHJvbWlzZTxFbGVtZW50W10+fVxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZmluZE1lc3NhZ2VzKHJvb3QpIHtcblx0Y29uc3QgZWxlbWVudHMgPSBbLi4ucm9vdC5xdWVyeVNlbGVjdG9yQWxsKFwiZGl2W3JvbGU9cm93XTpub3QoW2RhdGEtaWRtdS1pZ25vcmVdKVwiKV1cblx0Y29uc29sZS5kZWJ1ZyhcImZpbmRNZXNzYWdlcyBlbGVtZW50cyBcIiwgZWxlbWVudHMpXG5cdGNvbnN0IG1lc3NhZ2VFbGVtZW50cyA9IFtdXG5cdGZvcihjb25zdCBlbGVtZW50IG9mIGVsZW1lbnRzKSB7XG5cdFx0Y29uc3QgaXNNeU93bk1lc3NhZ2UgPSBhd2FpdCBVSU1lc3NhZ2UuaXNNeU93bk1lc3NhZ2UoZWxlbWVudClcblx0XHRpZihpc015T3duTWVzc2FnZSkge1xuXHRcdFx0Y29uc29sZS5kZWJ1ZyhcImZpbmRNZXNzYWdlcyBhZGRpbmcgXCIsIGVsZW1lbnQpXG5cdFx0XHRtZXNzYWdlRWxlbWVudHMucHVzaChlbGVtZW50KVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zb2xlLmRlYnVnKFwiZmluZE1lc3NhZ2VzIGlnbm9yaW5nIFwiLCBlbGVtZW50KVxuXHRcdFx0ZWxlbWVudC5zZXRBdHRyaWJ1dGUoXCJkYXRhLWlkbXUtaWdub3JlXCIsIFwiXCIpXG5cdFx0fVxuXHR9XG5cdGNvbnNvbGUuZGVidWcoXCJmaW5kTWVzc2FnZXMgaGl0c1wiLCBtZXNzYWdlRWxlbWVudHMpXG5cdHJldHVybiBtZXNzYWdlRWxlbWVudHNcbn1cblxuLyoqXG4gKlxuICogQHBhcmFtIHtXaW5kb3d9IHdpbmRvd1xuICogQHJldHVybnMge0hUTUxEaXZFbGVtZW50fVxuICovXG5leHBvcnQgZnVuY3Rpb24gZmluZE1lc3NhZ2VzV3JhcHBlcih3aW5kb3cpIHtcblx0cmV0dXJuIHdpbmRvdy5kb2N1bWVudC5xdWVyeVNlbGVjdG9yKFwiZGl2W3JvbGU9Z3JpZF0gPiBkaXYgPiBkaXYgPiBkaXYgPiBkaXZcIilcbn1cblxuLyoqXG4gKlxuICogQHBhcmFtIHtFbGVtZW50fSByb290XG4gKiBAcmV0dXJucyB7UHJvbWlzZTxib29sZWFuPn1cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGxvYWRNb3JlTWVzc2FnZXMocm9vdCkge1xuXHRjb25zb2xlLmRlYnVnKFwibG9hZE1vcmVNZXNzYWdlc1wiKVxuXHRyb290LnNjcm9sbFRvcCA9IDBcblx0bGV0IGZpbmRMb2FkZXJUaW1lb3V0XG5cdGNvbnNvbGUuZGVidWcoXCJsb2FkTW9yZU1lc3NhZ2VzIGxvb2tpbmcgZm9yIGxvYWRlci4uLiBcIiwgcm9vdC5vd25lckRvY3VtZW50LmRlZmF1bHRWaWV3LklETVVfU0NST0xMX0RFVEVDVElPTl9USU1FT1VUKVxuXHRjb25zdCBsb2FkaW5nRWxlbWVudCA9IGF3YWl0IFByb21pc2UucmFjZShbXG5cdFx0d2FpdEZvckVsZW1lbnQocm9vdCwgKCkgPT4ge1xuXHRcdFx0aWYocm9vdC5xdWVyeVNlbGVjdG9yKGBbcm9sZT1wcm9ncmVzc2Jhcl1gKSA9PT0gbnVsbCkge1xuXHRcdFx0XHRyb290LnNjcm9sbFRvcCA9IDBcblx0XHRcdH1cblx0XHRcdHJldHVybiByb290LnF1ZXJ5U2VsZWN0b3IoYFtyb2xlPXByb2dyZXNzYmFyXWApXG5cdFx0fSksXG5cdFx0bmV3IFByb21pc2UocmVzb2x2ZSA9PiB7XG5cdFx0XHRmaW5kTG9hZGVyVGltZW91dCA9IHNldFRpbWVvdXQocmVzb2x2ZSwgcm9vdC5vd25lckRvY3VtZW50LmRlZmF1bHRWaWV3LklETVVfU0NST0xMX0RFVEVDVElPTl9USU1FT1VUKVxuXHRcdH0pXG5cdF0pXG5cdGNsZWFyVGltZW91dChmaW5kTG9hZGVyVGltZW91dClcblx0aWYobG9hZGluZ0VsZW1lbnQpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwibG9hZE1vcmVNZXNzYWdlczogRm91bmQgbG9hZGVyOyBTdGFuZC1ieSB1bnRpbCBpdCBpcyByZW1vdmVkXCIpXG5cdFx0Y29uc29sZS5kZWJ1ZyhcImxvYWRNb3JlTWVzc2FnZXM6IHNjcm9sbFRvcFwiLCByb290LnNjcm9sbFRvcClcblx0XHRhd2FpdCB3YWl0Rm9yRWxlbWVudChyb290LCAoKSA9PiByb290LnF1ZXJ5U2VsZWN0b3IoYFtyb2xlPXByb2dyZXNzYmFyXWApID09PSBudWxsKVxuXHRcdGNvbnNvbGUuZGVidWcoXCJsb2FkTW9yZU1lc3NhZ2VzOiBMb2FkZXIgd2FzIHJlbW92ZWQsIG9sZGVyIG1lc3NhZ2VzIGxvYWRpbmcgY29tcGxldGVkXCIpXG5cdFx0Y29uc29sZS5kZWJ1ZyhgbG9hZE1vcmVNZXNzYWdlczogc2Nyb2xsVG9wIGlzICR7cm9vdC5zY3JvbGxUb3B9IHdlICR7cm9vdC5zY3JvbGxUb3AgPT09IDAgPyBcInJlYWNoZWQgbGFzdCBwYWdlXCIgOiBcIiBkaWQgbm90IHJlYWNoIGxhc3QgcGFnZSBhbmQgd2lsbCBiZWdpbiBsb2FkaW5nIG9sZGVyIG1lc3NhZ2VzIHNob3J0bHlcIn1gLCApXG5cdFx0cmV0dXJuIHJvb3Quc2Nyb2xsVG9wID09PSAwXG5cdH0gZWxzZSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcImxvYWRNb3JlTWVzc2FnZXM6IENvdWxkIG5vdCBmaW5kIGxvYWRlclwiKVxuXHRcdHJldHVybiB0cnVlXG5cdH1cbn1cbiIsImNsYXNzIEZhaWxlZFdvcmtmbG93RXhjZXB0aW9uIGV4dGVuZHMgRXJyb3Ige31cblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgVUlQSU1lc3NhZ2Uge1xuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge1VJTWVzc2FnZX0gdWlNZXNzYWdlXG5cdCAqL1xuXHRjb25zdHJ1Y3Rvcih1aU1lc3NhZ2UpIHtcblx0XHR0aGlzLl91aU1lc3NhZ2UgPSB1aU1lc3NhZ2Vcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZTxib29sZWFuPn1cblx0ICovXG5cdGFzeW5jIHVuc2VuZCgpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwiVUlQSU1lc3NhZ2UgdW5zZW5kXCIpXG5cdFx0bGV0IGFjdGlvbkJ1dHRvblxuXHRcdGxldCBhY3Rpb25zTWVudUVsZW1lbnRcblx0XHR0cnkge1xuXHRcdFx0YXdhaXQgdGhpcy51aU1lc3NhZ2Uuc2Nyb2xsSW50b1ZpZXcoKVxuXHRcdFx0YWN0aW9uQnV0dG9uID0gYXdhaXQgdGhpcy51aU1lc3NhZ2Uuc2hvd0FjdGlvbnNNZW51QnV0dG9uKClcblx0XHRcdGFjdGlvbnNNZW51RWxlbWVudCA9IGF3YWl0IHRoaXMudWlNZXNzYWdlLm9wZW5BY3Rpb25zTWVudShhY3Rpb25CdXR0b24pXG5cdFx0XHRjb25zb2xlLmRlYnVnKFwiYWN0aW9uc01lbnVFbGVtZW50XCIsIGFjdGlvbnNNZW51RWxlbWVudClcblx0XHRcdGNvbnN0IGRpYWxvZ0J1dHRvbiA9IGF3YWl0IHRoaXMudWlNZXNzYWdlLm9wZW5Db25maXJtVW5zZW5kTW9kYWwoKVxuXHRcdFx0YXdhaXQgdGhpcy51aU1lc3NhZ2UuY29uZmlybVVuc2VuZChkaWFsb2dCdXR0b24pXG5cdFx0XHR0aGlzLnVpTWVzc2FnZS5yb290LnNldEF0dHJpYnV0ZShcImRhdGEtaWRtdS11bnNlbnRcIiwgXCJcIilcblx0XHRcdHJldHVybiB0cnVlXG5cdFx0fSBjYXRjaChleCkge1xuXHRcdFx0Y29uc29sZS5lcnJvcihleClcblx0XHRcdGlmKGFjdGlvbkJ1dHRvbiAmJiBhY3Rpb25zTWVudUVsZW1lbnQpIHtcblx0XHRcdFx0YXdhaXQgdGhpcy51aU1lc3NhZ2UuY2xvc2VBY3Rpb25zTWVudShhY3Rpb25CdXR0b24sIGFjdGlvbnNNZW51RWxlbWVudClcblx0XHRcdH1cblx0XHRcdGF3YWl0IHRoaXMudWlNZXNzYWdlLmhpZGVBY3Rpb25NZW51QnV0dG9uKClcblx0XHRcdHRocm93IG5ldyBGYWlsZWRXb3JrZmxvd0V4Y2VwdGlvbihcIkZhaWxlZCB0byBleGVjdXRlIHdvcmtmbG93IGZvciB0aGlzIG1lc3NhZ2VcIilcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogQHR5cGUge1VJTWVzc2FnZX1cblx0ICovXG5cdGdldCB1aU1lc3NhZ2UoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX3VpTWVzc2FnZVxuXHR9XG5cbn1cbiIsImltcG9ydCB7IGxvYWRNb3JlTWVzc2FnZXMgfSBmcm9tIFwiLi9kb20tbG9va3VwLmpzXCJcbmltcG9ydCBVSUNvbXBvbmVudCBmcm9tIFwiLi4vdWktY29tcG9uZW50LmpzXCJcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgVUlNZXNzYWdlc1dyYXBwZXIgZXh0ZW5kcyBVSUNvbXBvbmVudCB7XG5cblx0LyoqXG5cdCAqXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlPn1cblx0ICovXG5cdGZldGNoQW5kUmVuZGVyVGhyZWFkTmV4dE1lc3NhZ2VQYWdlKCkge1xuXHRcdHJldHVybiBsb2FkTW9yZU1lc3NhZ2VzKHRoaXMucm9vdClcblx0fVxuXG59XG4iLCJpbXBvcnQgVUkgZnJvbSBcIi4uL3VpLmpzXCJcbmltcG9ydCB7IGZpbmRNZXNzYWdlc1dyYXBwZXIsIGZpbmRNZXNzYWdlcyB9IGZyb20gXCIuL2RvbS1sb29rdXAuanNcIlxuaW1wb3J0IFVJUElNZXNzYWdlIGZyb20gXCIuLi8uLi91aXBpL3VpcGktbWVzc2FnZS5qc1wiXG5pbXBvcnQgVUlNZXNzYWdlIGZyb20gXCIuL3VpLW1lc3NhZ2UuanNcIlxuaW1wb3J0IFVJTWVzc2FnZXNXcmFwcGVyIGZyb20gXCIuL3VpLW1lc3NhZ2VzLXdyYXBwZXIuanNcIlxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBEZWZhdWx0VUkgZXh0ZW5kcyBVSSB7XG5cblx0LyoqXG5cdCAqXG5cdCAqIEByZXR1cm5zIHtEZWZhdWx0VUl9XG5cdCAqL1xuXHRzdGF0aWMgY3JlYXRlKHdpbmRvdykge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJVSSBjcmVhdGVcIilcblx0XHRjb25zdCBtZXNzYWdlc1dyYXBwZXJFbGVtZW50ID0gZmluZE1lc3NhZ2VzV3JhcHBlcih3aW5kb3cpXG5cdFx0aWYobWVzc2FnZXNXcmFwcGVyRWxlbWVudCAhPT0gbnVsbCkge1xuXHRcdFx0Y29uc29sZS5kZWJ1ZyhcIkZvdW5kIG1lc3NhZ2VzV3JhcHBlckVsZW1lbnRcIiwgbWVzc2FnZXNXcmFwcGVyRWxlbWVudClcblx0XHRcdGNvbnN0IHVpTWVzc2FnZXNXcmFwcGVyID0gbmV3IFVJTWVzc2FnZXNXcmFwcGVyKG1lc3NhZ2VzV3JhcHBlckVsZW1lbnQpXG5cdFx0XHRyZXR1cm4gbmV3IERlZmF1bHRVSSh3aW5kb3csIHsgdWlNZXNzYWdlc1dyYXBwZXIgfSlcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiVW5hYmxlIHRvIGZpbmQgbWVzc2FnZXNXcmFwcGVyRWxlbWVudFwiKVxuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQqXG5cdCogQHJldHVybnMge1Byb21pc2U+fVxuXHQqL1xuXHRhc3luYyBmZXRjaEFuZFJlbmRlclRocmVhZE5leHRNZXNzYWdlUGFnZSgpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwiVUkgZmV0Y2hBbmRSZW5kZXJUaHJlYWROZXh0TWVzc2FnZVBhZ2VcIilcblx0XHRyZXR1cm4gYXdhaXQgdGhpcy5pZGVudGlmaWVyLnVpTWVzc2FnZXNXcmFwcGVyLmZldGNoQW5kUmVuZGVyVGhyZWFkTmV4dE1lc3NhZ2VQYWdlKHRoaXMuZG9tTWFwcGVyKVxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlPFVJUElNZXNzYWdlW10+fVxuXHQgKi9cblx0YXN5bmMgY3JlYXRlVUlQSU1lc3NhZ2VzKCkge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJVSSBjcmVhdGVVSVBJTWVzc2FnZXNcIilcblx0XHRjb25zdCB1aXBpTWVzc2FnZXMgPSBbXVxuXHRcdGNvbnN0IG1lc3NhZ2VFbGVtZW50cyA9IGF3YWl0IGZpbmRNZXNzYWdlcyh0aGlzLmlkZW50aWZpZXIudWlNZXNzYWdlc1dyYXBwZXIucm9vdClcblx0XHRmb3IoY29uc3QgbWVzc2FnZUVsZW1lbnQgb2YgbWVzc2FnZUVsZW1lbnRzKSB7XG5cdFx0XHRjb25zdCB1aU1lc3NhZ2UgPSBuZXcgVUlNZXNzYWdlKG1lc3NhZ2VFbGVtZW50KVxuXHRcdFx0dWlwaU1lc3NhZ2VzLnB1c2gobmV3IFVJUElNZXNzYWdlKHVpTWVzc2FnZSkpXG5cdFx0fVxuXHRcdHJldHVybiB1aXBpTWVzc2FnZXNcblx0fVxuXG59XG4iLCJpbXBvcnQgRGVmYXVsdFVJIGZyb20gXCIuL2RlZmF1bHQvZGVmYXVsdC11aS5qc1wiXG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIGdldFVJKCkge1xuXHRyZXR1cm4gRGVmYXVsdFVJXG59XG4iLCJpbXBvcnQgZ2V0VUkgZnJvbSBcIi4uL3VpL2dldC11aS5qc1wiXG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFVJUEkge1xuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge1VJfSB1aVxuXHQgKi9cblx0Y29uc3RydWN0b3IodWkpIHtcblx0XHR0aGlzLl91aSA9IHVpXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHtXaW5kb3d9IHdpbmRvd1xuXHQgKiBAcmV0dXJucyB7VUlQSX1cblx0ICovXG5cdHN0YXRpYyBjcmVhdGUod2luZG93KSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIlVJUEkuY3JlYXRlXCIpXG5cdFx0Y29uc3QgVUkgPSBnZXRVSSgpXG5cdFx0Y29uc3QgdWkgPSBVSS5jcmVhdGUod2luZG93KVxuXHRcdHJldHVybiBuZXcgVUlQSSh1aSlcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZX1cblx0ICovXG5cdGZldGNoQW5kUmVuZGVyVGhyZWFkTmV4dE1lc3NhZ2VQYWdlKCkge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJVSVBJIGZldGNoQW5kUmVuZGVyVGhyZWFkTmV4dE1lc3NhZ2VQYWdlXCIpXG5cdFx0cmV0dXJuIHRoaXMudWkuZmV0Y2hBbmRSZW5kZXJUaHJlYWROZXh0TWVzc2FnZVBhZ2UoKVxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlPFVJUElNZXNzYWdlW10+fVxuXHQgKi9cblx0Y3JlYXRlVUlQSU1lc3NhZ2VzKCkge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJVSVBJIGNyZWF0ZVVJUElNZXNzYWdlc1wiKVxuXHRcdHJldHVybiB0aGlzLnVpLmNyZWF0ZVVJUElNZXNzYWdlcygpXG5cdH1cblxuXHQvKipcblx0ICogQHR5cGUge1VJfVxuXHQgKi9cblx0Z2V0IHVpKCkge1xuXHRcdHJldHVybiB0aGlzLl91aVxuXHR9XG5cbn1cbiIsImltcG9ydCBVSVBJIGZyb20gXCIuLi91aXBpL3VpcGkuanNcIlxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBJRE1VIHtcblxuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHtXaW5kb3d9IHdpbmRvd1xuXHQgKiBAcGFyYW0ge1VJLmNvbnN0cnVjdG9yfSBVSVxuXHQgKi9cblx0Y29uc3RydWN0b3Iod2luZG93KSB7XG5cdFx0dGhpcy53aW5kb3cgPSB3aW5kb3dcblx0XHR0aGlzLnVpcGkgPSBudWxsXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHJldHVybnMge1Byb21pc2U8VUlQSU1lc3NhZ2VbXT59XG5cdCAqL1xuXHRjcmVhdGVVSVBJTWVzc2FnZXMoKSB7XG5cdFx0cmV0dXJuIHRoaXMuI2dldFVJUEkoKS5jcmVhdGVVSVBJTWVzc2FnZXMoKVxuXHR9XG5cblxuXHQvKipcblx0ICpcblx0ICogQHJldHVybnMge1Byb21pc2V9XG5cdCAqL1xuXHRmZXRjaEFuZFJlbmRlclRocmVhZE5leHRNZXNzYWdlUGFnZSgpIHtcblx0XHRyZXR1cm4gdGhpcy4jZ2V0VUlQSSgpLmZldGNoQW5kUmVuZGVyVGhyZWFkTmV4dE1lc3NhZ2VQYWdlKClcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcmV0dXJucyB7VUlQSX1cblx0ICovXG5cdCNnZXRVSVBJKCkge1xuXHRcdGlmKHRoaXMudWlwaSA9PT0gbnVsbCkge1xuXHRcdFx0dGhpcy51aXBpID0gVUlQSS5jcmVhdGUodGhpcy53aW5kb3csIHRoaXMuVUkpXG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLnVpcGlcblx0fVxuXG59XG4iLCJjbGFzcyBVbnNlbmRTdHJhdGVneSB7XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7SURNVX0gaWRtdVxuXHQgKi9cblx0Y29uc3RydWN0b3IoaWRtdSkge1xuXHRcdHRoaXMuX2lkbXUgPSBpZG11XG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQGFic3RyYWN0XG5cdCAqIEByZXR1cm5zIHtib29sZWFufVxuXHQgKi9cblx0aXNSdW5uaW5nKCkge1xuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBhYnN0cmFjdFxuXHQgKi9cblx0c3RvcCgpIHtcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAYWJzdHJhY3Rcblx0ICogQHBhcmFtIHtudW1iZXJ9IGJhdGNoU2l6ZVxuXHQgKi9cblx0cnVuKCkge1xuXHR9XG5cblx0LyoqXG5cdCAqIEByZWFkb25seVxuXHQgKiBAdHlwZSB7SURNVX1cblx0ICovXG5cdGdldCBpZG11KCkge1xuXHRcdHJldHVybiB0aGlzLl9pZG11XG5cdH1cblxufVxuXG5cbmV4cG9ydCBjbGFzcyBCYXRjaFVuc2VuZFN0cmF0ZWd5IGV4dGVuZHMgVW5zZW5kU3RyYXRlZ3kge1xuXG5cdHN0YXRpYyBERUZBVUxUX0JBVENIX1NJWkUgPSA1XG5cblx0I29uVW5zdWNjZXNzZnVsV29ya2Zsb3dzXG5cdCNmaW5pc2hlZF93b3JrZmxvd3NcblxuXG5cdC8qKlxuXHQgKiBAY2FsbGJhY2sgb25VbnN1Y2Nlc3NmdWxXb3JrZmxvd3Ncblx0ICogQHBhcmFtIHtJRE1VfSBpZG11XG5cdCAqIEBwYXJhbSB7b25VbnN1Y2Nlc3NmdWxXb3JrZmxvd3N9IG9uVW5zdWNjZXNzZnVsV29ya2Zsb3dzXG5cdCAqL1xuXHRjb25zdHJ1Y3RvcihpZG11LCBvblVuc3VjY2Vzc2Z1bFdvcmtmbG93cz1udWxsKSB7XG5cdFx0c3VwZXIoaWRtdSlcblx0XHR0aGlzLl9ydW5uaW5nID0gZmFsc2Vcblx0XHR0aGlzLl9zdG9wcGVkID0gZmFsc2Vcblx0XHR0aGlzLiNmaW5pc2hlZF93b3JrZmxvd3MgPSBbXVxuXHRcdHRoaXMuI29uVW5zdWNjZXNzZnVsV29ya2Zsb3dzID0gb25VbnN1Y2Nlc3NmdWxXb3JrZmxvd3Ncblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcmV0dXJucyB7Ym9vbGVhbn1cblx0ICovXG5cdGlzUnVubmluZygpIHtcblx0XHRyZXR1cm4gdGhpcy5fcnVubmluZyAmJiAhdGhpcy5fc3RvcHBlZFxuXHR9XG5cblx0c3RvcCgpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwiQmF0Y2hVbnNlbmRTdHJhdGVneSBzdG9wXCIpXG5cdFx0dGhpcy5fc3RvcHBlZCA9IHRydWVcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge251bWJlcn0gYmF0Y2hTaXplXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlfVxuXHQgKi9cblx0cnVuKGJhdGNoU2l6ZSkge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJCYXRjaFVuc2VuZFN0cmF0ZWd5LnJ1bigpXCIsIGJhdGNoU2l6ZSlcblx0XHR0aGlzLl9ydW5uaW5nID0gdHJ1ZVxuXHRcdHRoaXMuX3N0b3BwZWQgPSBmYWxzZVxuXHRcdHJldHVybiB0aGlzLiNwcm9jZXNzQmF0Y2hlcyhiYXRjaFNpemUpXG5cdH1cblxuXHQjZG9uZSgpIHtcblx0XHR0aGlzLl9ydW5uaW5nID0gZmFsc2Vcblx0XHRjb25zb2xlLmRlYnVnKFwiQmF0Y2hVbnNlbmRTdHJhdGVneSBkb25lXCIpXG5cdH1cblxuXHQjdW5zdWNjZXNzZnVsV29ya2Zsb3dBbGVydCgpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwiQmF0Y2hVbnNlbmRTdHJhdGVneSB1bnN1Y2Nlc3NmdWxXb3JrZmxvd0FsZXJ0XCIpXG5cdFx0aWYoIXRoaXMuX3J1bm5pbmcpIHtcblx0XHRcdGNsZWFySW50ZXJ2YWwodGhpcy5pbnRlcnZhbClcblx0XHR9XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIkJhdGNoVW5zZW5kU3RyYXRlZ3kgZmluaXNoZWRfd29ya2Zsb3dzXCIsIHRoaXMuI2ZpbmlzaGVkX3dvcmtmbG93cylcblx0XHRjb25zdCB1bnN1Y2Nlc3NmdWxXb3JrZmxvd3MgPSB0aGlzLiNmaW5pc2hlZF93b3JrZmxvd3MuZmlsdGVyKHVpcGlNZXNzYWdlID0+IHRoaXMuaWRtdS53aW5kb3cuZG9jdW1lbnQuY29udGFpbnModWlwaU1lc3NhZ2UudWlNZXNzYWdlLnJvb3QpKVxuXHRcdGNvbnNvbGUuZGVidWcoXCJCYXRjaFVuc2VuZFN0cmF0ZWd5IHVuc3VjY2Vzc2Z1bFdvcmtmbG93c1wiLCB1bnN1Y2Nlc3NmdWxXb3JrZmxvd3MpXG5cdFx0aWYodW5zdWNjZXNzZnVsV29ya2Zsb3dzLmxlbmd0aCA+PSAxKSB7XG5cdFx0XHR1bnN1Y2Nlc3NmdWxXb3JrZmxvd3MuZm9yRWFjaChmYWlsZWRXb3JrZmxvdyA9PiB0aGlzLiNmaW5pc2hlZF93b3JrZmxvd3Muc3BsaWNlKHRoaXMuI2ZpbmlzaGVkX3dvcmtmbG93cy5pbmRleE9mKGZhaWxlZFdvcmtmbG93KSwgMSkpXG5cdFx0XHR0aGlzLiNvblVuc3VjY2Vzc2Z1bFdvcmtmbG93cyh1bnN1Y2Nlc3NmdWxXb3JrZmxvd3MpXG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgI3Byb2Nlc3NCYXRjaGVzKGJhdGNoU2l6ZSkge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJCYXRjaFVuc2VuZFN0cmF0ZWd5IHByb2Nlc3NCYXRjaGVzXCIpXG5cdFx0bGV0IGRvbmUgPSBmYWxzZVxuXHRcdGZvcihsZXQgaSA9IDA7IGkgPCBiYXRjaFNpemU7aSsrKSB7XG5cdFx0XHRpZih0aGlzLl9zdG9wcGVkKSB7XG5cdFx0XHRcdGJyZWFrXG5cdFx0XHR9XG5cdFx0XHRkb25lID0gYXdhaXQgdGhpcy5pZG11LmZldGNoQW5kUmVuZGVyVGhyZWFkTmV4dE1lc3NhZ2VQYWdlKClcblx0XHRcdGlmKGRvbmUpIHtcblx0XHRcdFx0YnJlYWtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGF3YWl0IG5ldyBQcm9taXNlKHJlc29sdmUgPT4gc2V0VGltZW91dChyZXNvbHZlLCB0aGlzLmlkbXUud2luZG93LklETVVfTkVYVF9NRVNTQUdFX1BBR0VfREVMQVkpKVxuXHRcdFx0fVxuXHRcdH1cblx0XHR0cnkge1xuXHRcdFx0Zm9yKGNvbnN0IHVpcGlNZXNzYWdlIG9mIGF3YWl0IHRoaXMuaWRtdS5jcmVhdGVVSVBJTWVzc2FnZXMoKSkge1xuXHRcdFx0XHRpZih0aGlzLl9zdG9wcGVkKSB7XG5cdFx0XHRcdFx0YnJlYWtcblx0XHRcdFx0fVxuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdGF3YWl0IHVpcGlNZXNzYWdlLnVuc2VuZCgpXG5cdFx0XHRcdFx0dGhpcy4jZmluaXNoZWRfd29ya2Zsb3dzLnB1c2godWlwaU1lc3NhZ2UpXG5cdFx0XHRcdFx0YXdhaXQgbmV3IFByb21pc2UocmVzb2x2ZSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIHRoaXMuaWRtdS53aW5kb3cuSURNVV9NRVNTQUdFX1FVRVVFX0RFTEFZKSlcblx0XHRcdFx0fSBjYXRjaChyZXN1bHQpIHtcblx0XHRcdFx0XHRjb25zb2xlLmVycm9yKHJlc3VsdClcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0gY2F0Y2goZXgpIHtcblx0XHRcdGNvbnNvbGUuZXJyb3IoZXgpXG5cdFx0fVxuXHRcdGlmKCF0aGlzLmludGVydmFsICYmIHRoaXMuI29uVW5zdWNjZXNzZnVsV29ya2Zsb3dzKSB7XG5cdFx0XHR0aGlzLmludGVydmFsID0gc2V0SW50ZXJ2YWwoKCkgPT4gdGhpcy4jdW5zdWNjZXNzZnVsV29ya2Zsb3dBbGVydCgpLCB0aGlzLmlkbXUud2luZG93LklETVVfVU5TVUNFU1NGVUxfV09SS0ZMT1dfQUxFUlRfSU5URVJWQUwpXG5cdFx0fVxuXHRcdGlmKGRvbmUpIHtcblx0XHRcdHRoaXMuI2RvbmUoKVxuXHRcdH0gZWxzZSBpZighdGhpcy5fc3RvcHBlZCkge1xuXHRcdFx0cmV0dXJuIHRoaXMuI3Byb2Nlc3NCYXRjaGVzKGJhdGNoU2l6ZSlcblx0XHR9XG5cdH1cblxufVxuIiwiLyoqXG4gKlxuICogQHBhcmFtIHtEb2N1bWVudH0gZG9jdW1lbnRcbiAqIEByZXR1cm5zIHtIVE1MQnV0dG9uRWxlbWVudH1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUFsZXJ0c1dyYXBwZXJFbGVtZW50KGRvY3VtZW50KSB7XG5cdGNvbnN0IGFsZXJ0c1dyYXBwZXJFbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKVxuXHRhbGVydHNXcmFwcGVyRWxlbWVudC5pZCA9IFwiaWRtdS1hbGVydHNcIlxuXHRhbGVydHNXcmFwcGVyRWxlbWVudC5zdHlsZS5wb3NpdGlvbiA9IFwiZml4ZWRcIlxuXHRhbGVydHNXcmFwcGVyRWxlbWVudC5zdHlsZS50b3AgPSBcIjIwcHhcIlxuXHRhbGVydHNXcmFwcGVyRWxlbWVudC5zdHlsZS5yaWdodCA9IFwiMjBweFwiXG5cdGFsZXJ0c1dyYXBwZXJFbGVtZW50LnN0eWxlLmRpc3BsYXkgPSBcImdyaWRcIlxuXHRyZXR1cm4gYWxlcnRzV3JhcHBlckVsZW1lbnRcbn1cblxuLyoqXG4gKlxuICogQHBhcmFtIHtEb2N1bWVudH0gZG9jdW1lbnRcbiAqIEBwYXJhbSB7c3RyaW5nfSAgIHRleHRcbiAqIEByZXR1cm5zIHtIVE1MQnV0dG9uRWxlbWVudH1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUFsZXJ0RWxlbWVudChkb2N1bWVudCwgdGV4dCkge1xuXHRjb25zdCBhbGVydEVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpXG5cdGFsZXJ0RWxlbWVudC50ZXh0Q29udGVudCA9IHRleHRcblx0cmV0dXJuIGFsZXJ0RWxlbWVudFxufVxuIiwiLyoqXG4gKiBAcGFyYW0ge0RvY3VtZW50fSBkb2N1bWVudFxuICogQHJldHVybnMge0hUTUxEaXZFbGVtZW50fVxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlT3ZlcmxheUVsZW1lbnQoZG9jdW1lbnQpIHtcblx0Y29uc3Qgb3ZlcmxheUVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpXG5cdG92ZXJsYXlFbGVtZW50LmlkID0gXCJpZG11LW92ZXJsYXlcIlxuXHRvdmVybGF5RWxlbWVudC50YWJJbmRleCA9IDBcblx0b3ZlcmxheUVsZW1lbnQuc3R5bGUudG9wID0gXCIwXCJcblx0b3ZlcmxheUVsZW1lbnQuc3R5bGUucmlnaHQgPSBcIjBcIlxuXHRvdmVybGF5RWxlbWVudC5zdHlsZS5wb3NpdGlvbiA9IFwiZml4ZWRcIlxuXHRvdmVybGF5RWxlbWVudC5zdHlsZS53aWR0aCA9IFwiMTAwdndcIlxuXHRvdmVybGF5RWxlbWVudC5zdHlsZS5oZWlnaHQgPSBcIjEwMHZoXCJcblx0b3ZlcmxheUVsZW1lbnQuc3R5bGUuekluZGV4ID0gXCI5OThcIlxuXHRvdmVybGF5RWxlbWVudC5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSBcIiMwMDAwMDBkNlwiXG5cdG92ZXJsYXlFbGVtZW50LnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIlxuXHRyZXR1cm4gb3ZlcmxheUVsZW1lbnRcbn1cbiIsImltcG9ydCB7IGNyZWF0ZU1lbnVCdXR0b25FbGVtZW50IH0gZnJvbSBcIi4vbWVudS1idXR0b24uanNcIlxuaW1wb3J0IHsgY3JlYXRlTWVudUVsZW1lbnQgfSBmcm9tIFwiLi9tZW51LmpzXCJcbmltcG9ydCBJRE1VIGZyb20gXCIuLi8uLi8uLi9pZG11L2lkbXUuanNcIlxuaW1wb3J0IHsgQmF0Y2hVbnNlbmRTdHJhdGVneSB9IGZyb20gXCIuLi91bnNlbmQtc3RyYXRlZ3kuanNcIlxuaW1wb3J0IHsgY3JlYXRlQWxlcnRzV3JhcHBlckVsZW1lbnQgfSBmcm9tIFwiLi9hbGVydC5qc1wiXG5pbXBvcnQgeyBjcmVhdGVPdmVybGF5RWxlbWVudCB9IGZyb20gXCIuL292ZXJsYXkuanNcIlxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBVSSB7XG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge0RvY3VtZW50fSBkb2N1bWVudFxuXHQgKiBAcGFyYW0ge0hUTUxEaXZFbGVtZW50fSByb290XG5cdCAqIEBwYXJhbSB7SFRNTERpdkVsZW1lbnR9IG92ZXJsYXlFbGVtZW50XG5cdCAqIEBwYXJhbSB7SFRNTERpdkVsZW1lbnR9IG1lbnVFbGVtZW50XG5cdCAqIEBwYXJhbSB7SFRNTEJ1dHRvbkVsZW1lbnR9IHVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uXG5cdCAqIEBwYXJhbSB7SFRNTEJ1dHRvbkVsZW1lbnR9IGxvYWRUaHJlYWRNZXNzYWdlc0J1dHRvblxuXHQgKi9cblx0Y29uc3RydWN0b3IoZG9jdW1lbnQsIHJvb3QsIG92ZXJsYXlFbGVtZW50LCBtZW51RWxlbWVudCwgdW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24sIGxvYWRUaHJlYWRNZXNzYWdlc0J1dHRvbikge1xuXHRcdHRoaXMuX2RvY3VtZW50ID0gZG9jdW1lbnRcblx0XHR0aGlzLl9yb290ID0gcm9vdFxuXHRcdHRoaXMuX292ZXJsYXlFbGVtZW50ID0gb3ZlcmxheUVsZW1lbnRcblx0XHR0aGlzLl9tZW51RWxlbWVudCA9IG1lbnVFbGVtZW50XG5cdFx0dGhpcy5fdW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24gPSB1bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvblxuXHRcdHRoaXMuX2xvYWRUaHJlYWRNZXNzYWdlc0J1dHRvbiA9IGxvYWRUaHJlYWRNZXNzYWdlc0J1dHRvblxuXHRcdHRoaXMuX2lkbXUgPSBuZXcgSURNVSh0aGlzLndpbmRvdylcblx0XHR0aGlzLl9zdHJhdGVneSA9IG5ldyBCYXRjaFVuc2VuZFN0cmF0ZWd5KHRoaXMuX2lkbXUsICgpID0+IHRoaXMuI29uVW5zdWNjZXNzZnVsV29ya2Zsb3dzKCkpXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHt3aW5kb3d9IHdpbmRvd1xuXHQgKiBAcmV0dXJucyB7VUl9XG5cdCAqL1xuXHRzdGF0aWMgcmVuZGVyKHdpbmRvdykge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJyZW5kZXJcIilcblx0XHRjb25zdCB1aSA9IFVJLmNyZWF0ZSh3aW5kb3cuZG9jdW1lbnQpXG5cdFx0d2luZG93LmRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQodWkucm9vdClcblx0XHRyZXR1cm4gdWlcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0gICB7RG9jdW1lbnR9IGRvY3VtZW50XG5cdCAqIEByZXR1cm5zIHtVSX1cblx0ICovXG5cdHN0YXRpYyBjcmVhdGUoZG9jdW1lbnQpIHtcblx0XHRjb25zdCByb290ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKVxuXHRcdGNvbnN0IG1lbnVFbGVtZW50ID0gY3JlYXRlTWVudUVsZW1lbnQoZG9jdW1lbnQpXG5cdFx0Y29uc3Qgb3ZlcmxheUVsZW1lbnQgPSBjcmVhdGVPdmVybGF5RWxlbWVudChkb2N1bWVudClcblx0XHRjb25zdCBhbGVydHNXcmFwcGVyRWxlbWVudCA9IGNyZWF0ZUFsZXJ0c1dyYXBwZXJFbGVtZW50KGRvY3VtZW50KVxuXHRcdGNvbnN0IHVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uID0gY3JlYXRlTWVudUJ1dHRvbkVsZW1lbnQoZG9jdW1lbnQsIFwiVW5zZW5kIGFsbCBETXNcIilcblx0XHRjb25zdCBsb2FkVGhyZWFkTWVzc2FnZXNCdXR0b24gPSBjcmVhdGVNZW51QnV0dG9uRWxlbWVudChkb2N1bWVudCwgXCJCYXRjaCBzaXplXCIsIFwic2Vjb25kYXJ5XCIpXG5cdFx0Y29uc3QgbG9hZEFsbE1lc3NhZ2VzQnV0dG9uID0gY3JlYXRlTWVudUJ1dHRvbkVsZW1lbnQoZG9jdW1lbnQsIFwiTG9hZCBhbGwgRE1zXCIpXG5cdFx0ZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChvdmVybGF5RWxlbWVudClcblx0XHRkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGFsZXJ0c1dyYXBwZXJFbGVtZW50KVxuXHRcdG1lbnVFbGVtZW50LmFwcGVuZENoaWxkKHVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uKVxuXHRcdG1lbnVFbGVtZW50LmFwcGVuZENoaWxkKGxvYWRUaHJlYWRNZXNzYWdlc0J1dHRvbilcblx0XHRtZW51RWxlbWVudC5hcHBlbmRDaGlsZChsb2FkQWxsTWVzc2FnZXNCdXR0b24pXG5cdFx0cm9vdC5hcHBlbmRDaGlsZChtZW51RWxlbWVudClcblx0XHRjb25zdCB1aSA9IG5ldyBVSShkb2N1bWVudCwgcm9vdCwgb3ZlcmxheUVsZW1lbnQsIG1lbnVFbGVtZW50LCB1bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbiwgbG9hZFRocmVhZE1lc3NhZ2VzQnV0dG9uKVxuXHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJrZXlkb3duXCIsIChldmVudCkgPT4gdWkuI29uV2luZG93S2V5RXZlbnQoZXZlbnQpKSAvLyBUT0RPIHRlc3Rcblx0XHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKFwia2V5dXBcIiwgKGV2ZW50KSA9PiB1aS4jb25XaW5kb3dLZXlFdmVudChldmVudCkpIC8vIFRPRE8gdGVzdFxuXHRcdHVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoZXZlbnQpID0+IHVpLiNvblVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uQ2xpY2soZXZlbnQpKVxuXHRcdGxvYWRUaHJlYWRNZXNzYWdlc0J1dHRvbi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKGV2ZW50KSA9PiB1aS4jb25Mb2FkVGhyZWFkTWVzc2FnZXNCdXR0b25DbGljayhldmVudCkpIC8vIFRPRE8gdGVzdFxuXHRcdGxvYWRBbGxNZXNzYWdlc0J1dHRvbi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKGV2ZW50KSA9PiB1aS4jb25Mb2FkQWxsTWVzc2FnZXNCdXR0b25DbGljayhldmVudCkpXG5cdFx0bmV3IE11dGF0aW9uT2JzZXJ2ZXIoKG11dGF0aW9ucykgPT4gdWkuI29uTXV0YXRpb25zKG11dGF0aW9ucywgdWkpKS5vYnNlcnZlKGRvY3VtZW50LmJvZHksIHsgY2hpbGRMaXN0OiB0cnVlIH0pIC8vIFRPRE8gdGVzdFxuXHRcdHVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uLmRhdGFUZXh0Q29udGVudCA9IHVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uLnRleHRDb250ZW50XG5cdFx0dW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24uZGF0YUJhY2tncm91bmRDb2xvciA9IHVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uLnN0eWxlLmJhY2tncm91bmRDb2xvclxuXHRcdHJldHVybiB1aVxuXHR9XG5cblx0YXN5bmMgI3N0YXJ0VW5zZW5kaW5nKCkge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJVc2VyIGFza2VkIGZvciBtZXNzYWdlcyB1bnNlbmRpbmcgdG8gc3RhcnQ7IFVJIGludGVyYWN0aW9uIHdpbGwgYmUgZGlzYWJsZWQgaW4gdGhlIG1lYW50aW1lXCIpXG5cdFx0O1suLi50aGlzLm1lbnVFbGVtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoXCJidXR0b25cIildLmZpbHRlcihidXR0b24gPT4gYnV0dG9uICE9PSB0aGlzLnVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uKS5mb3JFYWNoKGJ1dHRvbiA9PiB7XG5cdFx0XHRidXR0b24uc3R5bGUudmlzaWJpbGl0eSA9IFwiaGlkZGVuXCJcblx0XHRcdGJ1dHRvbi5kaXNhYmxlZCA9IHRydWVcblx0XHR9KVxuXHRcdHRoaXMub3ZlcmxheUVsZW1lbnQuc3R5bGUuZGlzcGxheSA9IFwiXCJcblx0XHR0aGlzLm92ZXJsYXlFbGVtZW50LmZvY3VzKClcblx0XHR0aGlzLnVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uLnRleHRDb250ZW50ID0gXCJTdG9wIHByb2Nlc3NpbmdcIlxuXHRcdHRoaXMudW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24uc3R5bGUuYmFja2dyb3VuZENvbG9yID0gXCIjRkEzODNFXCJcblx0XHRjb25zdCBiYXRjaFNpemUgPSB0aGlzLndpbmRvdy5sb2NhbFN0b3JhZ2UuZ2V0SXRlbShcIklETVVfQkFUQ0hfU0laRVwiKSB8fCBCYXRjaFVuc2VuZFN0cmF0ZWd5LkRFRkFVTFRfQkFUQ0hfU0laRVxuXHRcdGF3YWl0IHRoaXMuc3RyYXRlZ3kucnVuKGJhdGNoU2l6ZSlcblx0XHR0aGlzLiNvblVuc2VuZGluZ0ZpbmlzaGVkKClcblx0fVxuXG5cdCNzZXRCYXRjaFNpemUoYmF0Y2hTaXplKSB7XG5cdFx0Y29uc29sZS5kZWJ1Zyhgc2V0QmF0Y2hTaXplICR7YmF0Y2hTaXplfWApXG5cdFx0dGhpcy53aW5kb3cubG9jYWxTdG9yYWdlLnNldEl0ZW0oXCJJRE1VX0JBVENIX1NJWkVcIiwgcGFyc2VJbnQoYmF0Y2hTaXplKSlcblx0fVxuXG5cdCNvblVuc3VjY2Vzc2Z1bFdvcmtmbG93cyh1bnN1Y2Nlc3NmdWxXb3JrZmxvd3MpIHtcblx0XHRjb25zb2xlLmxvZyh1bnN1Y2Nlc3NmdWxXb3JrZmxvd3MpXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHtNdXRhdGlvbltdfSBtdXRhdGlvbnNcblx0ICovXG5cdCNvbk11dGF0aW9ucyhtdXRhdGlvbnMsIHVpKSB7XG5cdFx0aWYodWkucm9vdC5vd25lckRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCJbaWRePW1vdW50XSA+IGRpdiA+IGRpdiA+IGRpdlwiKSAhPT0gbnVsbCAmJiB1aSkge1xuXHRcdFx0bmV3IE11dGF0aW9uT2JzZXJ2ZXIodWkuI29uTXV0YXRpb25zLmJpbmQodGhpcykpLm9ic2VydmUodWkucm9vdC5vd25lckRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCJbaWRePW1vdW50XSA+IGRpdiA+IGRpdiA+IGRpdlwiKSwgeyBjaGlsZExpc3Q6IHRydWUsIGF0dHJpYnV0ZXM6IHRydWUgfSlcblx0XHR9XG5cdFx0aWYodGhpcy53aW5kb3cubG9jYXRpb24ucGF0aG5hbWUuc3RhcnRzV2l0aChcIi9kaXJlY3QvdC9cIikpIHtcblx0XHRcdHRoaXMucm9vdC5zdHlsZS5kaXNwbGF5ID0gXCJcIlxuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLnJvb3Quc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiXG5cdFx0XHR0aGlzLnN0cmF0ZWd5LnN0b3AoKVxuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge1VJfSB1aVxuXHQgKiBAcGFyYW0ge0V2ZW50fSBldmVudFxuXHQgKi9cblx0I29uTG9hZFRocmVhZE1lc3NhZ2VzQnV0dG9uQ2xpY2soKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcImxvYWRUaHJlYWRNZXNzYWdlc0J1dHRvbiBjbGlja1wiKVxuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBiYXRjaFNpemUgPSBwYXJzZUludChcblx0XHRcdFx0dGhpcy53aW5kb3cucHJvbXB0KFwiSG93IG1hbnkgcGFnZXMgc2hvdWxkIHdlIGxvYWQgYmVmb3JlIGVhY2ggdW5zZW5kaW5nPyBcIixcblx0XHRcdFx0XHR0aGlzLndpbmRvdy5sb2NhbFN0b3JhZ2UuZ2V0SXRlbShcIklETVVfQkFUQ0hfU0laRVwiKVxuXHRcdFx0XHR8fCBCYXRjaFVuc2VuZFN0cmF0ZWd5LkRFRkFVTFRfQkFUQ0hfU0laRSApXG5cdFx0XHQpXG5cdFx0XHRpZihwYXJzZUludChiYXRjaFNpemUpKSB7XG5cdFx0XHRcdHRoaXMuI3NldEJhdGNoU2l6ZShiYXRjaFNpemUpXG5cdFx0XHR9XG5cdFx0fSBjYXRjaChleCkge1xuXHRcdFx0Y29uc29sZS5lcnJvcihleClcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHtVSX0gdWlcblx0ICogQHBhcmFtIHtFdmVudH0gZXZlbnRcblx0ICovXG5cdGFzeW5jICNvbkxvYWRBbGxNZXNzYWdlc0J1dHRvbkNsaWNrKCkge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJsb2FkVGhyZWFkTWVzc2FnZXNCdXR0b24gY2xpY2tcIilcblx0XHR0cnkge1xuXHRcdFx0bGV0IGRvbmUgPSBmYWxzZVxuXHRcdFx0d2hpbGUoIWRvbmUpIHtcblx0XHRcdFx0ZG9uZSA9IGF3YWl0IHRoaXMuaWRtdS5mZXRjaEFuZFJlbmRlclRocmVhZE5leHRNZXNzYWdlUGFnZSgpXG5cdFx0XHR9XG5cdFx0fSBjYXRjaChleCkge1xuXHRcdFx0Y29uc29sZS5lcnJvcihleClcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHtVSX0gdWlcblx0ICogQHBhcmFtIHtFdmVudH0gZXZlbnRcblx0ICovXG5cdCNvblVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uQ2xpY2soKSB7XG5cdFx0aWYodGhpcy5zdHJhdGVneS5pc1J1bm5pbmcoKSkge1xuXHRcdFx0Y29uc29sZS5kZWJ1ZyhcIlVzZXIgYXNrZWQgZm9yIG1lc3NhZ2VzIHVuc2VuZGluZyB0byBzdG9wXCIpXG5cdFx0XHR0aGlzLnN0cmF0ZWd5LnN0b3AoKVxuXHRcdFx0dGhpcy4jb25VbnNlbmRpbmdGaW5pc2hlZCgpXG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuI3N0YXJ0VW5zZW5kaW5nKClcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHtFdmVudH0gZXZlbnRcblx0ICovXG5cdCNvbldpbmRvd0tleUV2ZW50KGV2ZW50KSB7XG5cdFx0aWYodGhpcy5zdHJhdGVneS5pc1J1bm5pbmcoKSkge1xuXHRcdFx0Y29uc29sZS5pbmZvKFwiVXNlciBpbnRlcmFjdGlvbiBpcyBkaXNhYmxlZCBhcyB0aGUgdW5zZW5kaW5nIGlzIHN0aWxsIHJ1bm5pbmc7IFBsZWFzZSBzdG9wIHRoZSBleGVjdXRpb24gZmlyc3QuXCIpXG5cdFx0XHRldmVudC5zdG9wSW1tZWRpYXRlUHJvcGFnYXRpb24oKVxuXHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKVxuXHRcdFx0ZXZlbnQuc3RvcFByb3BhZ2F0aW9uKClcblx0XHRcdHRoaXMub3ZlcmxheUVsZW1lbnQuZm9jdXMoKVxuXHRcdFx0cmV0dXJuIGZhbHNlXG5cdFx0fVxuXHR9XG5cblx0I29uVW5zZW5kaW5nRmluaXNoZWQoKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcInJlbmRlciBvblVuc2VuZGluZ0ZpbmlzaGVkXCIpXG5cdFx0O1suLi50aGlzLm1lbnVFbGVtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoXCJidXR0b25cIildLmZpbHRlcihidXR0b24gPT4gYnV0dG9uICE9PSB0aGlzLnVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uKS5mb3JFYWNoKGJ1dHRvbiA9PiB7XG5cdFx0XHRidXR0b24uc3R5bGUudmlzaWJpbGl0eSA9IFwiXCJcblx0XHRcdGJ1dHRvbi5kaXNhYmxlZCA9IGZhbHNlXG5cdFx0fSlcblx0XHR0aGlzLnVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uLnRleHRDb250ZW50ID0gdGhpcy51bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbi5kYXRhVGV4dENvbnRlbnRcblx0XHR0aGlzLnVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uLnN0eWxlLmJhY2tncm91bmRDb2xvciA9IHRoaXMudW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24uZGF0YUJhY2tncm91bmRDb2xvclxuXHRcdHRoaXMub3ZlcmxheUVsZW1lbnQuc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiXG5cdFx0aWYoIXRoaXMuc3RyYXRlZ3kuX3N0b3BwZWQpIHtcblx0XHRcdHRoaXMud2luZG93LmFsZXJ0KFwiSURNVTogRmluaXNoZWRcIilcblx0XHR9XG5cdH1cblxuXG5cdC8qKlxuXHQgKiBAcmVhZG9ubHlcblx0ICogQHR5cGUge0RvY3VtZW50fVxuXHQgKi9cblx0Z2V0IGRvY3VtZW50KCkge1xuXHRcdHJldHVybiB0aGlzLl9kb2N1bWVudFxuXHR9XG5cblx0LyoqXG5cdCAqIEByZWFkb25seVxuXHQgKiBAdHlwZSB7V2luZG93fVxuXHQgKi9cblx0Z2V0IHdpbmRvdygpIHtcblx0XHRyZXR1cm4gdGhpcy5fZG9jdW1lbnQuZGVmYXVsdFZpZXdcblx0fVxuXG5cdC8qKlxuXHQgKiBAcmVhZG9ubHlcblx0ICogQHR5cGUge0hUTUxEaXZFbGVtZW50fVxuXHQgKi9cblx0Z2V0IHJvb3QoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX3Jvb3Rcblx0fVxuXG5cdC8qKlxuXHQgKiBAcmVhZG9ubHlcblx0ICogQHR5cGUge0hUTUxEaXZFbGVtZW50fVxuXHQgKi9cblx0Z2V0IG92ZXJsYXlFbGVtZW50KCkge1xuXHRcdHJldHVybiB0aGlzLl9vdmVybGF5RWxlbWVudFxuXHR9XG5cblx0LyoqXG5cdCAqIEByZWFkb25seVxuXHQgKiBAdHlwZSB7SFRNTERpdkVsZW1lbnR9XG5cdCAqL1xuXHRnZXQgbWVudUVsZW1lbnQoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX21lbnVFbGVtZW50XG5cdH1cblxuXHQvKipcblx0ICogQHJlYWRvbmx5XG5cdCAqIEB0eXBlIHtIVE1MQnV0dG9uRWxlbWVudH1cblx0ICovXG5cdGdldCB1bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbigpIHtcblx0XHRyZXR1cm4gdGhpcy5fdW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b25cblx0fVxuXG5cdC8qKlxuXHQgKiBAcmVhZG9ubHlcblx0ICogQHR5cGUge0hUTUxCdXR0b25FbGVtZW50fVxuXHQgKi9cblx0Z2V0IGxvYWRUaHJlYWRNZXNzYWdlc0J1dHRvbigpIHtcblx0XHRyZXR1cm4gdGhpcy5fbG9hZFRocmVhZE1lc3NhZ2VzQnV0dG9uXG5cdH1cblxuXHQvKipcblx0ICogQHJlYWRvbmx5XG5cdCAqIEB0eXBlIHtVbnNlbmRTdHJhdGVneX1cblx0ICovXG5cdGdldCBzdHJhdGVneSgpIHtcblx0XHRyZXR1cm4gdGhpcy5fc3RyYXRlZ3lcblx0fVxuXG5cdC8qKlxuXHQgKiBAcmVhZG9ubHlcblx0ICogQHR5cGUge0lETVV9XG5cdCAqL1xuXHRnZXQgaWRtdSgpIHtcblx0XHRyZXR1cm4gdGhpcy5faWRtdVxuXHR9XG5cbn1cbiIsImltcG9ydCBVSSBmcm9tIFwiLi91aS91aS5qc1wiXG5cbmV4cG9ydCBmdW5jdGlvbiBtYWluKHdpbmRvdykge1xuXHRpZighd2luZG93LklETVVfREVCVUcpIHtcblx0XHRjb25zb2xlLmRlYnVnID0gKCkgPT4ge31cblx0fVxuXG5cdFVJLnJlbmRlcih3aW5kb3cpXG59XG5cbmlmKHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIpIHtcblx0bWFpbih3aW5kb3cpXG59XG4iXSwibmFtZXMiOlsiVUkiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Q0FBQSxNQUFNLFlBQVksR0FBRztDQUNyQixDQUFDLFNBQVMsRUFBRSxTQUFTO0NBQ3JCLENBQUMsV0FBVyxFQUFFLFdBQVc7Q0FDekIsRUFBQztBQUNEO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNPLFNBQVMsZ0JBQWdCLENBQUMsYUFBYSxFQUFFLFNBQVMsQ0FBQyxZQUFZLENBQUMsT0FBTyxFQUFFO0NBQ2hGLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxRQUFRLEdBQUcsNkJBQTRCO0NBQzVELENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxLQUFLLEdBQUcsUUFBTztDQUNwQyxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLE1BQUs7Q0FDbkMsQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLFlBQVksR0FBRyxNQUFLO0NBQ3pDLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxPQUFPLEdB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
