
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
// @version				0.5.16
// @updateURL				https://raw.githubusercontent.com/thoughtsunificator/instagram-dm-unsender/userscript/idmu.user.js
// @downloadURL				https://raw.githubusercontent.com/thoughtsunificator/instagram-dm-unsender/userscript/idmu.user.js
// @description				Simple script to unsend all DMs in a thread on instagram.com
// @run-at				document-end
// @include				/^https://(www\.)?instagram\.com/direct*/

// ==/UserScript==


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
					timeout = setTimeout(resolve, 200); // IDMU_MESSAGE_DETECTION_ACTION_MENU_TIMEOUT
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
			// wait until confirm button is removed
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
		console.debug("loadMoreMessages looking for loader... ", 10000); // IDMU_SCROLL_DETECTION_TIMEOUT
		const loadingElement = await Promise.race([
			waitForElement(root, () => {
				if(root.querySelector(`[role=progressbar]`) === null) {
					root.scrollTop = 0;
				}
				return root.querySelector(`[role=progressbar]`)
			}),
			new Promise(resolve => {
				findLoaderTimeout = setTimeout(resolve, 10000); // IDMU_SCROLL_DETECTION_TIMEOUT
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
					await new Promise(resolve => setTimeout(resolve, 1000)); // IDMU_NEXT_MESSAGE_PAGE_DELAY
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
						await new Promise(resolve => setTimeout(resolve, 1000)); // IDMU_MESSAGE_QUEUE_DELAY
					} catch(result) {
						console.error(result);
					}
				}
			} catch(ex) {
				console.error(ex);
			}
			if(!this.interval && this.#onUnsuccessfulWorkflows) {
				this.interval = setInterval(() => this.#unsuccessfulWorkflowAlert(), 5000); // IDMU_UNSUCESSFUL_WORKFLOW_ALERT_INTERVAL
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
		UI.render(window);
	}

	if(typeof window !== "undefined") {
		main(window);
	}

	exports.main = main;

	return exports;

})({});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaWRtdS51c2VyLmpzIiwic291cmNlcyI6WyIuLi9zcmMvcnVudGltZS91c2Vyc2NyaXB0L3VpL3N0eWxlL2luc3RhZ3JhbS5qcyIsIi4uL3NyYy9ydW50aW1lL3VzZXJzY3JpcHQvdWkvbWVudS1idXR0b24uanMiLCIuLi9zcmMvcnVudGltZS91c2Vyc2NyaXB0L3VpL21lbnUuanMiLCIuLi9zcmMvZG9tL2FzeW5jLWV2ZW50cy5qcyIsIi4uL3NyYy91aS91aS1jb21wb25lbnQuanMiLCIuLi9zcmMvdWkvdWkuanMiLCIuLi9zcmMvdWkvZGVmYXVsdC91aS1tZXNzYWdlLmpzIiwiLi4vc3JjL3VpL2RlZmF1bHQvZG9tLWxvb2t1cC5qcyIsIi4uL3NyYy91aXBpL3VpcGktbWVzc2FnZS5qcyIsIi4uL3NyYy91aS9kZWZhdWx0L3VpLW1lc3NhZ2VzLXdyYXBwZXIuanMiLCIuLi9zcmMvdWkvZGVmYXVsdC9kZWZhdWx0LXVpLmpzIiwiLi4vc3JjL3VpL2dldC11aS5qcyIsIi4uL3NyYy91aXBpL3VpcGkuanMiLCIuLi9zcmMvaWRtdS9pZG11LmpzIiwiLi4vc3JjL3J1bnRpbWUvdXNlcnNjcmlwdC91bnNlbmQtc3RyYXRlZ3kuanMiLCIuLi9zcmMvcnVudGltZS91c2Vyc2NyaXB0L3VpL2FsZXJ0LmpzIiwiLi4vc3JjL3J1bnRpbWUvdXNlcnNjcmlwdC91aS9vdmVybGF5LmpzIiwiLi4vc3JjL3J1bnRpbWUvdXNlcnNjcmlwdC91aS91aS5qcyIsIi4uL3NyYy9ydW50aW1lL3VzZXJzY3JpcHQvbWFpbi5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJjb25zdCBCVVRUT05fU1RZTEUgPSB7XG5cdFwiUFJJTUFSWVwiOiBcInByaW1hcnlcIixcblx0XCJTRUNPTkRBUllcIjogXCJzZWNvbmRhcnlcIixcbn1cblxuLyoqXG4gKlxuICogQHBhcmFtIHtIVE1MQnV0dG9uRWxlbWVudH0gYnV0dG9uRWxlbWVudFxuICogQHBhcmFtIHtzdHJpbmd9ICAgICAgICAgICAgc3R5bGVOYW1lXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBhcHBseUJ1dHRvblN0eWxlKGJ1dHRvbkVsZW1lbnQsIHN0eWxlTmFtZT1CVVRUT05fU1RZTEUuUFJJTUFSWSkge1xuXHRidXR0b25FbGVtZW50LnN0eWxlLmZvbnRTaXplID0gXCJ2YXIoLS1zeXN0ZW0tMTQtZm9udC1zaXplKVwiXG5cdGJ1dHRvbkVsZW1lbnQuc3R5bGUuY29sb3IgPSBcIndoaXRlXCJcblx0YnV0dG9uRWxlbWVudC5zdHlsZS5ib3JkZXIgPSBcIjBweFwiXG5cdGJ1dHRvbkVsZW1lbnQuc3R5bGUuYm9yZGVyUmFkaXVzID0gXCI4cHhcIlxuXHRidXR0b25FbGVtZW50LnN0eWxlLnBhZGRpbmcgPSBcIjhweFwiXG5cdGJ1dHRvbkVsZW1lbnQuc3R5bGUuZm9udFdlaWdodCA9IFwiYm9sZFwiXG5cdGJ1dHRvbkVsZW1lbnQuc3R5bGUuY3Vyc29yID0gXCJwb2ludGVyXCJcblx0YnV0dG9uRWxlbWVudC5zdHlsZS5saW5lSGVpZ2h0ID0gXCJ2YXIoLS1zeXN0ZW0tMTQtbGluZS1oZWlnaHQpXCJcblx0YnV0dG9uRWxlbWVudC5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSBgcmdiKHZhcigtLWlnLSR7c3R5bGVOYW1lfS1idXR0b24pKWBcbn1cbiIsImltcG9ydCB7IGFwcGx5QnV0dG9uU3R5bGUgfSBmcm9tIFwiLi9zdHlsZS9pbnN0YWdyYW0uanNcIlxuXG4vKipcbiAqXG4gKiBAcGFyYW0ge0RvY3VtZW50fSBkb2N1bWVudFxuICogQHBhcmFtIHtzdHJpbmd9ICAgdGV4dFxuICogQHBhcmFtIHtzdHJpbmd9ICAgc3R5bGVOYW1lXG4gKiBAcmV0dXJucyB7SFRNTEJ1dHRvbkVsZW1lbnR9XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVNZW51QnV0dG9uRWxlbWVudChkb2N1bWVudCwgdGV4dCwgc3R5bGVOYW1lKSB7XG5cdGNvbnN0IGJ1dHRvbkVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiYnV0dG9uXCIpXG5cdGJ1dHRvbkVsZW1lbnQudGV4dENvbnRlbnQgPSB0ZXh0XG5cdGFwcGx5QnV0dG9uU3R5bGUoYnV0dG9uRWxlbWVudCwgc3R5bGVOYW1lKVxuXHRidXR0b25FbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJtb3VzZW92ZXJcIiwgKCkgPT4ge1xuXHRcdGJ1dHRvbkVsZW1lbnQuc3R5bGUuZmlsdGVyID0gYGJyaWdodG5lc3MoMS4xNSlgXG5cdH0pXG5cdGJ1dHRvbkVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNlb3V0XCIsICgpID0+IHtcblx0XHRidXR0b25FbGVtZW50LnN0eWxlLmZpbHRlciA9IGBgXG5cdH0pXG5cdHJldHVybiBidXR0b25FbGVtZW50XG59XG4iLCIvKipcbiAqIEBwYXJhbSB7RG9jdW1lbnR9IGRvY3VtZW50XG4gKiBAcmV0dXJucyB7SFRNTEJ1dHRvbkVsZW1lbnR9XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVNZW51RWxlbWVudChkb2N1bWVudCkge1xuXHRjb25zdCBtZW51RWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIilcblx0bWVudUVsZW1lbnQuc3R5bGUudG9wID0gXCIyMHB4XCJcblx0bWVudUVsZW1lbnQuc3R5bGUucmlnaHQgPSBcIjQzMHB4XCJcblx0bWVudUVsZW1lbnQuc3R5bGUucG9zaXRpb24gPSBcImZpeGVkXCJcblx0bWVudUVsZW1lbnQuc3R5bGUuekluZGV4ID0gOTk5XG5cdG1lbnVFbGVtZW50LnN0eWxlLmRpc3BsYXkgPSBcImZsZXhcIlxuXHRtZW51RWxlbWVudC5zdHlsZS5nYXAgPSBcIjEwcHhcIlxuXHRyZXR1cm4gbWVudUVsZW1lbnRcbn1cbiIsIi8qKlxuICpcbiAqIEBjYWxsYmFjayBnZXRFbGVtZW50XG4gKiBAcmV0dXJucyB7RWxlbWVudH1cbiAqL1xuXG4vKipcbiAqXG4gKiBAcGFyYW0ge0VsZW1lbnR9IHRhcmdldFxuICogQHBhcmFtIHtnZXRFbGVtZW50fSBnZXRFbGVtZW50XG4gKiBAcmV0dXJucyB7UHJvbWlzZTxFbGVtZW50Pn1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHdhaXRGb3JFbGVtZW50KHRhcmdldCwgZ2V0RWxlbWVudCkge1xuXHRyZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcblx0XHRsZXQgZWxlbWVudCA9IGdldEVsZW1lbnQoKVxuXHRcdGlmKGVsZW1lbnQpIHtcblx0XHRcdHJlc29sdmUoZWxlbWVudClcblx0XHR9IGVsc2Uge1xuXHRcdFx0bmV3IE11dGF0aW9uT2JzZXJ2ZXIoKG11dGF0aW9ucywgb2JzZXJ2ZXIpID0+IHtcblx0XHRcdFx0ZWxlbWVudCA9IGdldEVsZW1lbnQoKVxuXHRcdFx0XHRpZihlbGVtZW50KSB7XG5cdFx0XHRcdFx0b2JzZXJ2ZXIuZGlzY29ubmVjdCgpXG5cdFx0XHRcdFx0cmVzb2x2ZShlbGVtZW50KVxuXHRcdFx0XHR9XG5cdFx0XHR9KS5vYnNlcnZlKHRhcmdldCwgeyBzdWJ0cmVlOiB0cnVlLCBjaGlsZExpc3Q6dHJ1ZSB9KVxuXHRcdH1cblx0fSlcbn1cblxuLyoqXG4gKlxuICogQHBhcmFtIHtFbGVtZW50fSBjbGlja1RhcmdldFxuICogQHBhcmFtIHtFbGVtZW50fSB0YXJnZXRcbiAqIEBwYXJhbSB7Z2V0RWxlbWVudH0gZ2V0RWxlbWVudFxuICogQHJldHVybnMge0VsZW1lbnR8UHJvbWlzZTxFbGVtZW50Pn1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNsaWNrRWxlbWVudEFuZFdhaXRGb3IoY2xpY2tUYXJnZXQsIHRhcmdldCwgZ2V0RWxlbWVudCkge1xuXHRjb25zdCBwcm9taXNlID0gd2FpdEZvckVsZW1lbnQodGFyZ2V0LCBnZXRFbGVtZW50KVxuXHRjbGlja1RhcmdldC5jbGljaygpXG5cdHJldHVybiBnZXRFbGVtZW50KCkgfHwgcHJvbWlzZVxufVxuIiwiaW1wb3J0IHsgd2FpdEZvckVsZW1lbnQsIGNsaWNrRWxlbWVudEFuZFdhaXRGb3IgfSBmcm9tIFwiLi4vZG9tL2FzeW5jLWV2ZW50cy5qc1wiXG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFVJQ29tcG9uZW50IHtcblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7RWxlbWVudH0gcm9vdFxuXHQgKiBAcGFyYW0ge29iamVjdH0gaWRlbnRpZmllclxuXHQgKi9cblx0Y29uc3RydWN0b3Iocm9vdCwgaWRlbnRpZmllcj17fSkge1xuXHRcdHRoaXMucm9vdCA9IHJvb3Rcblx0XHR0aGlzLmlkZW50aWZpZXIgPSBpZGVudGlmaWVyXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHtFbGVtZW50fSB0YXJnZXRcblx0ICogQHBhcmFtIHtmdW5jdGlvbn0gZ2V0RWxlbWVudFxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZTxFbGVtZW50Pn1cblx0ICovXG5cdHdhaXRGb3JFbGVtZW50KHRhcmdldCwgZ2V0RWxlbWVudCkge1xuXHRcdHJldHVybiBnZXRFbGVtZW50KCkgfHwgd2FpdEZvckVsZW1lbnQodGFyZ2V0LCBnZXRFbGVtZW50KVxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7RWxlbWVudH0gY2xpY2tUYXJnZXRcblx0ICogQHBhcmFtIHtFbGVtZW50fSB0YXJnZXRcblx0ICogQHBhcmFtIHtmdW5jdGlvbn0gZ2V0RWxlbWVudFxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZTxFbGVtZW50Pn1cblx0ICovXG5cdGNsaWNrRWxlbWVudEFuZFdhaXRGb3IoY2xpY2tUYXJnZXQsIHRhcmdldCwgZ2V0RWxlbWVudCkge1xuXHRcdHJldHVybiBjbGlja0VsZW1lbnRBbmRXYWl0Rm9yKGNsaWNrVGFyZ2V0LCB0YXJnZXQsIGdldEVsZW1lbnQpXG5cdH1cblxufVxuIiwiaW1wb3J0IFVJQ29tcG9uZW50IGZyb20gXCIuL3VpLWNvbXBvbmVudC5qc1wiXG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFVJIGV4dGVuZHMgVUlDb21wb25lbnQge1xuXG5cdC8qKlxuXHQgKlxuXHQgKiBAYWJzdHJhY3Rcblx0ICogQHJldHVybnMge1VJfVxuXHQgKi9cblx0c3RhdGljIGNyZWF0ZSgpIHtcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAYWJzdHJhY3Rcblx0ICogQHJldHVybnMge1Byb21pc2V9XG5cdCAqL1xuXHRhc3luYyBmZXRjaEFuZFJlbmRlclRocmVhZE5leHRNZXNzYWdlUGFnZSgpIHtcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAYWJzdHJhY3Rcblx0ICogQHJldHVybnMge1Byb21pc2U8VUlQSU1lc3NhZ2VbXT59XG5cdCAqL1xuXHRhc3luYyBjcmVhdGVVSVBJTWVzc2FnZXMoKSB7XG5cdH1cblxufVxuIiwiaW1wb3J0IFVJQ29tcG9uZW50IGZyb20gXCIuLi91aS1jb21wb25lbnQuanNcIlxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBVSU1lc3NhZ2UgZXh0ZW5kcyBVSUNvbXBvbmVudCB7XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7SFRNTERpdkVsZW1lbnR9IGVsZW1lbnRcblx0ICogQHJldHVybnMge1Byb21pc2U8Ym9vbGVhbj59XG5cdCAqL1xuXHRzdGF0aWMgYXN5bmMgaXNNeU93bk1lc3NhZ2UoZWxlbWVudCkge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJpc015T3duTWVzc2FnZVwiLCBlbGVtZW50KVxuXHRcdC8vIGNsb3NlIG1lbnUgaW4gY2FzZSBpdCB3YXMgbGVmdCBvcGVuXG5cdFx0ZWxlbWVudC5xdWVyeVNlbGVjdG9yKFwiW2FyaWEtbGFiZWw9TW9yZV1cIik/LnBhcmVudE5vZGU/LmNsaWNrKClcblx0XHRlbGVtZW50LnF1ZXJ5U2VsZWN0b3IoYFthcmlhLWxhYmVsPVwiQ2xvc2UgZGV0YWlscyBhbmQgYWN0aW9uc1wiXWApPy5jbGljaygpXG5cdFx0ZWxlbWVudC5kaXNwYXRjaEV2ZW50KG5ldyBNb3VzZUV2ZW50KFwibW91c2VvdXRcIiwgeyBidWJibGVzOiB0cnVlIH0pKVxuXHRcdGNvbnN0IHVpTWVzc2FnZSA9IG5ldyBVSU1lc3NhZ2UoZWxlbWVudClcblx0XHRsZXQgdGltZW91dFxuXHRcdGNvbnN0IGFjdGlvbkJ1dHRvbiA9IGF3YWl0IFByb21pc2UucmFjZShbXG5cdFx0XHR1aU1lc3NhZ2Uuc2hvd0FjdGlvbnNNZW51QnV0dG9uKCksXG5cdFx0XHRuZXcgUHJvbWlzZShyZXNvbHZlID0+IHtcblx0XHRcdFx0dGltZW91dCA9IHNldFRpbWVvdXQocmVzb2x2ZSwgMjAwKSAvLyBJRE1VX01FU1NBR0VfREVURUNUSU9OX0FDVElPTl9NRU5VX1RJTUVPVVRcblx0XHRcdH0pXG5cdFx0XSlcblx0XHRjbGVhclRpbWVvdXQodGltZW91dClcblx0XHRpZihhY3Rpb25CdXR0b24pIHtcblx0XHRcdGNvbnNvbGUuZGVidWcoXCJhY3Rpb25CdXR0b24gZm91bmQgbG9va2luZyBmb3IgdW5zZW5kIGFjdGlvbiBpbiBhY3Rpb25zTWVudVwiKVxuXHRcdFx0Y29uc3QgYWN0aW9uc01lbnVFbGVtZW50ID0gYXdhaXQgdWlNZXNzYWdlLm9wZW5BY3Rpb25zTWVudShhY3Rpb25CdXR0b24pXG5cdFx0XHRhd2FpdCB1aU1lc3NhZ2UuY2xvc2VBY3Rpb25zTWVudShhY3Rpb25CdXR0b24sIGFjdGlvbnNNZW51RWxlbWVudClcblx0XHRcdGF3YWl0IHVpTWVzc2FnZS5oaWRlQWN0aW9uTWVudUJ1dHRvbigpXG5cdFx0XHRjb25zb2xlLmRlYnVnKGFjdGlvbnNNZW51RWxlbWVudCwgYWN0aW9uc01lbnVFbGVtZW50LnRleHRDb250ZW50KVxuXHRcdFx0cmV0dXJuIGFjdGlvbnNNZW51RWxlbWVudCAmJiBhY3Rpb25zTWVudUVsZW1lbnQudGV4dENvbnRlbnQudG9Mb2NhbGVMb3dlckNhc2UoKSA9PT0gXCJ1bnNlbmRcIlxuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zb2xlLmRlYnVnKFwiRGlkIG5vdCBmaW5kIGFjdGlvbkJ1dHRvblwiKVxuXHRcdH1cblx0XHRyZXR1cm4gZmFsc2Vcblx0fVxuXG5cdHNjcm9sbEludG9WaWV3KCkge1xuXHRcdHRoaXMucm9vdC5zY3JvbGxJbnRvVmlldygpXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHJldHVybnMge1Byb21pc2U8SFRNTEJ1dHRvbkVsZW1lbnQ+fVxuXHQgKi9cblx0c2hvd0FjdGlvbnNNZW51QnV0dG9uKCkge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJXb3JrZmxvdyBzdGVwIDEgOiBzaG93QWN0aW9uc01lbnVCdXR0b25cIilcblx0XHR0aGlzLnJvb3QuZGlzcGF0Y2hFdmVudChuZXcgTW91c2VFdmVudChcIm1vdXNlbW92ZVwiLCB7IGJ1YmJsZXM6IHRydWUgfSkpXG5cdFx0dGhpcy5yb290LmRpc3BhdGNoRXZlbnQobmV3IE1vdXNlRXZlbnQoXCJtb3VzZW92ZXJcIiwgeyBidWJibGVzOiB0cnVlIH0pKVxuXHRcdHRoaXMucm9vdC5kaXNwYXRjaEV2ZW50KG5ldyBNb3VzZUV2ZW50KFwibW91c2VudGVyXCIsIHsgYnViYmxlczogdHJ1ZSB9KSlcblx0XHQvLyBTb21lIHJvd3MgYXJlIGVtcHR5IGFuZCB3ZSBkbyB3YW50IHRoZSBlbnRpcmUgcnVuIHRvIGZhaWxcblx0XHRyZXR1cm4gdGhpcy53YWl0Rm9yRWxlbWVudCh0aGlzLnJvb3QsICgpID0+IHRoaXMucm9vdC5xdWVyeVNlbGVjdG9yKFwiW2FyaWEtbGFiZWw9TW9yZV1cIik/LnBhcmVudE5vZGUpIC8vIFRPRE8gaTE4blxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlPGJvb2xlYW4+fVxuXHQgKi9cblx0aGlkZUFjdGlvbk1lbnVCdXR0b24oKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIldvcmtmbG93IHJvbGxpbmcgYmFjayBoaWRlQWN0aW9uTWVudUJ1dHRvblwiKVxuXHRcdHRoaXMucm9vdC5kaXNwYXRjaEV2ZW50KG5ldyBNb3VzZUV2ZW50KFwibW91c2Vtb3ZlXCIsIHsgYnViYmxlczogdHJ1ZSB9KSlcblx0XHR0aGlzLnJvb3QuZGlzcGF0Y2hFdmVudChuZXcgTW91c2VFdmVudChcIm1vdXNlb3V0XCIsIHsgYnViYmxlczogdHJ1ZSB9KSlcblx0XHR0aGlzLnJvb3QuZGlzcGF0Y2hFdmVudChuZXcgTW91c2VFdmVudChcIm1vdXNlbGVhdmVcIiwgeyBidWJibGVzOiB0cnVlIH0pKVxuXHRcdHJldHVybiB0aGlzLndhaXRGb3JFbGVtZW50KHRoaXMucm9vdCwgKCkgPT4gdGhpcy5yb290LnF1ZXJ5U2VsZWN0b3IoXCJbYXJpYS1sYWJlbD1Nb3JlXVwiKSA9PT0gbnVsbCkgLy8gVE9ETyBpMThuXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHtIVE1MQnV0dG9uRWxlbWVudH0gYWN0aW9uQnV0dG9uXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlfVxuXHQgKi9cblx0YXN5bmMgb3BlbkFjdGlvbnNNZW51KGFjdGlvbkJ1dHRvbikge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJXb3JrZmxvdyBzdGVwIDIgOiBvcGVuQWN0aW9uc01lbnVcIiwgYWN0aW9uQnV0dG9uKVxuXHRcdGNvbnN0IGFjdGlvbk1lbnVFbGVtZW50ID0gYXdhaXQgdGhpcy5jbGlja0VsZW1lbnRBbmRXYWl0Rm9yKFxuXHRcdFx0YWN0aW9uQnV0dG9uLFxuXHRcdFx0dGhpcy5yb290Lm93bmVyRG9jdW1lbnQuYm9keSxcblx0XHRcdCgpID0+IHtcblx0XHRcdFx0Y29uc3QgbWVudUVsZW1lbnRzID0gWy4uLnRoaXMucm9vdC5vd25lckRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoXCJbcm9sZT1tZW51XSBbcm9sZT1tZW51aXRlbV1cIildXG5cdFx0XHRcdGNvbnNvbGUuZGVidWcoXCJXb3JrZmxvdyBzdGVwIDIgbWVudUVsZW1lbnRzXCIsIG1lbnVFbGVtZW50cy5tYXAobWVudUVsZW1lbnQgPT4gbWVudUVsZW1lbnQudGV4dENvbnRlbnQpKVxuXHRcdFx0XHRjb25zb2xlLmRlYnVnKG1lbnVFbGVtZW50cy5maW5kKG5vZGUgPT4gbm9kZS50ZXh0Q29udGVudC50cmltKCkudG9Mb2NhbGVMb3dlckNhc2UoKSA9PT0gXCJ1bnNlbmRcIikpXG5cdFx0XHRcdHJldHVybiBtZW51RWxlbWVudHMuZmluZChub2RlID0+IG5vZGUudGV4dENvbnRlbnQudHJpbSgpLnRvTG9jYWxlTG93ZXJDYXNlKCkgPT09IFwidW5zZW5kXCIpIHx8IG1lbnVFbGVtZW50cy5zaGlmdCgpXG5cdFx0XHR9LFxuXHRcdClcblx0XHRcdDtbLi4uYWN0aW9uTWVudUVsZW1lbnQucGFyZW50Tm9kZS5wYXJlbnROb2RlLnF1ZXJ5U2VsZWN0b3JBbGwoXCJbcm9sZT1tZW51aXRlbV1cIildLmZvckVhY2goZWxlbWVudCA9PiB7XG5cdFx0XHRpZihlbGVtZW50ICE9PSBhY3Rpb25NZW51RWxlbWVudCkge1xuXHRcdFx0XHRlbGVtZW50LnJlbW92ZSgpXG5cdFx0XHR9XG5cdFx0fSlcblx0XHRyZXR1cm4gYWN0aW9uTWVudUVsZW1lbnRcblxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7SFRNTEJ1dHRvbkVsZW1lbnR9IGFjdGlvbkJ1dHRvblxuXHQgKiBAcGFyYW0ge0hUTUxEaXZFbGVtZW50fSBhY3Rpb25zTWVudUVsZW1lbnRcblx0ICogQHJldHVybnMge1Byb21pc2U8Ym9vbGVhbj59XG5cdCAqL1xuXHRjbG9zZUFjdGlvbnNNZW51KGFjdGlvbkJ1dHRvbiwgYWN0aW9uc01lbnVFbGVtZW50KSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIldvcmtmbG93IHJvbGxpbmcgYmFjayAgY2xvc2VBY3Rpb25zTWVudVwiKVxuXHRcdHJldHVybiB0aGlzLmNsaWNrRWxlbWVudEFuZFdhaXRGb3IoXG5cdFx0XHRhY3Rpb25CdXR0b24sXG5cdFx0XHR0aGlzLnJvb3Qub3duZXJEb2N1bWVudC5ib2R5LFxuXHRcdFx0KCkgPT4gdGhpcy5yb290Lm93bmVyRG9jdW1lbnQuYm9keS5jb250YWlucyhhY3Rpb25zTWVudUVsZW1lbnQpID09PSBmYWxzZSxcblx0XHQpXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHJldHVybnMge1Byb21pc2U8SFRNTEJ1dHRvbkVsZW1lbnQ+fFByb21pc2U8RXJyb3I+fVxuXHQgKi9cblx0YXN5bmMgb3BlbkNvbmZpcm1VbnNlbmRNb2RhbCgpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwiV29ya2Zsb3cgc3RlcCAzIDogb3BlbkNvbmZpcm1VbnNlbmRNb2RhbFwiKVxuXHRcdGNvbnN0IHVuU2VuZEJ1dHRvbiA9IGF3YWl0IHRoaXMud2FpdEZvckVsZW1lbnQoXG5cdFx0XHR0aGlzLnJvb3Qub3duZXJEb2N1bWVudC5ib2R5LFxuXHRcdFx0KCkgPT4gWy4uLnRoaXMucm9vdC5vd25lckRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoXCJbcm9sZT1kaWFsb2ddIFtyb2xlPW1lbnVdIFtyb2xlPW1lbnVpdGVtXVwiKV0uZmlsdGVyKG5vZGUgPT4gbm9kZS50ZXh0Q29udGVudC50b0xvY2FsZUxvd2VyQ2FzZSgpID09PSBcInVuc2VuZFwiKS5wb3AoKSwgLy8gVE9ETyBpMThuXG5cdFx0KVxuXHRcdHJldHVybiB0aGlzLmNsaWNrRWxlbWVudEFuZFdhaXRGb3IoXG5cdFx0XHR1blNlbmRCdXR0b24sXG5cdFx0XHR0aGlzLnJvb3Qub3duZXJEb2N1bWVudC5ib2R5LFxuXHRcdFx0KCkgPT4gdGhpcy5yb290Lm93bmVyRG9jdW1lbnQucXVlcnlTZWxlY3RvcihcIltyb2xlPWRpYWxvZ10gYnV0dG9uXCIpLFxuXHRcdClcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge0hUTUxCdXR0b25FbGVtZW50fSBkaWFsb2dCdXR0b25cblx0ICogQHJldHVybnMge1Byb21pc2V9XG5cdCAqL1xuXHRhc3luYyBjb25maXJtVW5zZW5kKGRpYWxvZ0J1dHRvbikge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJXb3JrZmxvdyBmaW5hbCBzdGVwIDogY29uZmlybVVuc2VuZFwiLCBkaWFsb2dCdXR0b24pXG5cdFx0Ly8gd2FpdCB1bnRpbCBjb25maXJtIGJ1dHRvbiBpcyByZW1vdmVkXG5cdFx0YXdhaXQgdGhpcy5jbGlja0VsZW1lbnRBbmRXYWl0Rm9yKFxuXHRcdFx0ZGlhbG9nQnV0dG9uLFxuXHRcdFx0dGhpcy5yb290Lm93bmVyRG9jdW1lbnQuYm9keSxcblx0XHRcdCgpID0+IHRoaXMucm9vdC5vd25lckRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCJbcm9sZT1kaWFsb2ddIGJ1dHRvblwiKSA9PT0gbnVsbFxuXHRcdClcblx0fVxuXG59XG4iLCJpbXBvcnQgVUlNZXNzYWdlIGZyb20gXCIuL3VpLW1lc3NhZ2UuanNcIlxuaW1wb3J0IHsgd2FpdEZvckVsZW1lbnQgfSBmcm9tIFwiLi4vLi4vZG9tL2FzeW5jLWV2ZW50cy5qc1wiXG5cbi8qKlxuICpcbiAqIEBwYXJhbSB7RWxlbWVudH0gcm9vdFxuICogQHJldHVybnMge1Byb21pc2U8RWxlbWVudFtdPn1cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGZpbmRNZXNzYWdlcyhyb290KSB7XG5cdGNvbnN0IGVsZW1lbnRzID0gWy4uLnJvb3QucXVlcnlTZWxlY3RvckFsbChcImRpdltyb2xlPXJvd106bm90KFtkYXRhLWlkbXUtaWdub3JlXSlcIildXG5cdGNvbnNvbGUuZGVidWcoXCJmaW5kTWVzc2FnZXMgZWxlbWVudHMgXCIsIGVsZW1lbnRzKVxuXHRjb25zdCBtZXNzYWdlRWxlbWVudHMgPSBbXVxuXHRmb3IoY29uc3QgZWxlbWVudCBvZiBlbGVtZW50cykge1xuXHRcdGNvbnN0IGlzTXlPd25NZXNzYWdlID0gYXdhaXQgVUlNZXNzYWdlLmlzTXlPd25NZXNzYWdlKGVsZW1lbnQpXG5cdFx0aWYoaXNNeU93bk1lc3NhZ2UpIHtcblx0XHRcdGNvbnNvbGUuZGVidWcoXCJmaW5kTWVzc2FnZXMgYWRkaW5nIFwiLCBlbGVtZW50KVxuXHRcdFx0bWVzc2FnZUVsZW1lbnRzLnB1c2goZWxlbWVudClcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc29sZS5kZWJ1ZyhcImZpbmRNZXNzYWdlcyBpZ25vcmluZyBcIiwgZWxlbWVudClcblx0XHRcdGVsZW1lbnQuc2V0QXR0cmlidXRlKFwiZGF0YS1pZG11LWlnbm9yZVwiLCBcIlwiKVxuXHRcdH1cblx0fVxuXHRjb25zb2xlLmRlYnVnKFwiZmluZE1lc3NhZ2VzIGhpdHNcIiwgbWVzc2FnZUVsZW1lbnRzKVxuXHRyZXR1cm4gbWVzc2FnZUVsZW1lbnRzXG59XG5cbi8qKlxuICpcbiAqIEBwYXJhbSB7V2luZG93fSB3aW5kb3dcbiAqIEByZXR1cm5zIHtIVE1MRGl2RWxlbWVudH1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGZpbmRNZXNzYWdlc1dyYXBwZXIod2luZG93KSB7XG5cdHJldHVybiB3aW5kb3cuZG9jdW1lbnQucXVlcnlTZWxlY3RvcihcImRpdltyb2xlPWdyaWRdID4gZGl2ID4gZGl2ID4gZGl2ID4gZGl2XCIpXG59XG5cbi8qKlxuICpcbiAqIEBwYXJhbSB7RWxlbWVudH0gcm9vdFxuICogQHJldHVybnMge1Byb21pc2U8Ym9vbGVhbj59XG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBsb2FkTW9yZU1lc3NhZ2VzKHJvb3QpIHtcblx0Y29uc29sZS5kZWJ1ZyhcImxvYWRNb3JlTWVzc2FnZXNcIilcblx0cm9vdC5zY3JvbGxUb3AgPSAwXG5cdGxldCBmaW5kTG9hZGVyVGltZW91dFxuXHRjb25zb2xlLmRlYnVnKFwibG9hZE1vcmVNZXNzYWdlcyBsb29raW5nIGZvciBsb2FkZXIuLi4gXCIsIDEwMDAwKSAvLyBJRE1VX1NDUk9MTF9ERVRFQ1RJT05fVElNRU9VVFxuXHRjb25zdCBsb2FkaW5nRWxlbWVudCA9IGF3YWl0IFByb21pc2UucmFjZShbXG5cdFx0d2FpdEZvckVsZW1lbnQocm9vdCwgKCkgPT4ge1xuXHRcdFx0aWYocm9vdC5xdWVyeVNlbGVjdG9yKGBbcm9sZT1wcm9ncmVzc2Jhcl1gKSA9PT0gbnVsbCkge1xuXHRcdFx0XHRyb290LnNjcm9sbFRvcCA9IDBcblx0XHRcdH1cblx0XHRcdHJldHVybiByb290LnF1ZXJ5U2VsZWN0b3IoYFtyb2xlPXByb2dyZXNzYmFyXWApXG5cdFx0fSksXG5cdFx0bmV3IFByb21pc2UocmVzb2x2ZSA9PiB7XG5cdFx0XHRmaW5kTG9hZGVyVGltZW91dCA9IHNldFRpbWVvdXQocmVzb2x2ZSwgMTAwMDApIC8vIElETVVfU0NST0xMX0RFVEVDVElPTl9USU1FT1VUXG5cdFx0fSlcblx0XSlcblx0Y2xlYXJUaW1lb3V0KGZpbmRMb2FkZXJUaW1lb3V0KVxuXHRpZihsb2FkaW5nRWxlbWVudCkge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJsb2FkTW9yZU1lc3NhZ2VzOiBGb3VuZCBsb2FkZXI7IFN0YW5kLWJ5IHVudGlsIGl0IGlzIHJlbW92ZWRcIilcblx0XHRjb25zb2xlLmRlYnVnKFwibG9hZE1vcmVNZXNzYWdlczogc2Nyb2xsVG9wXCIsIHJvb3Quc2Nyb2xsVG9wKVxuXHRcdGF3YWl0IHdhaXRGb3JFbGVtZW50KHJvb3QsICgpID0+IHJvb3QucXVlcnlTZWxlY3RvcihgW3JvbGU9cHJvZ3Jlc3NiYXJdYCkgPT09IG51bGwpXG5cdFx0Y29uc29sZS5kZWJ1ZyhcImxvYWRNb3JlTWVzc2FnZXM6IExvYWRlciB3YXMgcmVtb3ZlZCwgb2xkZXIgbWVzc2FnZXMgbG9hZGluZyBjb21wbGV0ZWRcIilcblx0XHRjb25zb2xlLmRlYnVnKGBsb2FkTW9yZU1lc3NhZ2VzOiBzY3JvbGxUb3AgaXMgJHtyb290LnNjcm9sbFRvcH0gd2UgJHtyb290LnNjcm9sbFRvcCA9PT0gMCA/IFwicmVhY2hlZCBsYXN0IHBhZ2VcIiA6IFwiIGRpZCBub3QgcmVhY2ggbGFzdCBwYWdlIGFuZCB3aWxsIGJlZ2luIGxvYWRpbmcgb2xkZXIgbWVzc2FnZXMgc2hvcnRseVwifWAsIClcblx0XHRyZXR1cm4gcm9vdC5zY3JvbGxUb3AgPT09IDBcblx0fSBlbHNlIHtcblx0XHRjb25zb2xlLmRlYnVnKFwibG9hZE1vcmVNZXNzYWdlczogQ291bGQgbm90IGZpbmQgbG9hZGVyXCIpXG5cdFx0cmV0dXJuIHRydWVcblx0fVxufVxuIiwiY2xhc3MgRmFpbGVkV29ya2Zsb3dFeGNlcHRpb24gZXh0ZW5kcyBFcnJvciB7fVxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBVSVBJTWVzc2FnZSB7XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7VUlNZXNzYWdlfSB1aU1lc3NhZ2Vcblx0ICovXG5cdGNvbnN0cnVjdG9yKHVpTWVzc2FnZSkge1xuXHRcdHRoaXMuX3VpTWVzc2FnZSA9IHVpTWVzc2FnZVxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlPGJvb2xlYW4+fVxuXHQgKi9cblx0YXN5bmMgdW5zZW5kKCkge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJVSVBJTWVzc2FnZSB1bnNlbmRcIilcblx0XHRsZXQgYWN0aW9uQnV0dG9uXG5cdFx0bGV0IGFjdGlvbnNNZW51RWxlbWVudFxuXHRcdHRyeSB7XG5cdFx0XHRhd2FpdCB0aGlzLnVpTWVzc2FnZS5zY3JvbGxJbnRvVmlldygpXG5cdFx0XHRhY3Rpb25CdXR0b24gPSBhd2FpdCB0aGlzLnVpTWVzc2FnZS5zaG93QWN0aW9uc01lbnVCdXR0b24oKVxuXHRcdFx0YWN0aW9uc01lbnVFbGVtZW50ID0gYXdhaXQgdGhpcy51aU1lc3NhZ2Uub3BlbkFjdGlvbnNNZW51KGFjdGlvbkJ1dHRvbilcblx0XHRcdGNvbnNvbGUuZGVidWcoXCJhY3Rpb25zTWVudUVsZW1lbnRcIiwgYWN0aW9uc01lbnVFbGVtZW50KVxuXHRcdFx0Y29uc3QgZGlhbG9nQnV0dG9uID0gYXdhaXQgdGhpcy51aU1lc3NhZ2Uub3BlbkNvbmZpcm1VbnNlbmRNb2RhbCgpXG5cdFx0XHRhd2FpdCB0aGlzLnVpTWVzc2FnZS5jb25maXJtVW5zZW5kKGRpYWxvZ0J1dHRvbilcblx0XHRcdHRoaXMudWlNZXNzYWdlLnJvb3Quc2V0QXR0cmlidXRlKFwiZGF0YS1pZG11LXVuc2VudFwiLCBcIlwiKVxuXHRcdFx0cmV0dXJuIHRydWVcblx0XHR9IGNhdGNoKGV4KSB7XG5cdFx0XHRjb25zb2xlLmVycm9yKGV4KVxuXHRcdFx0aWYoYWN0aW9uQnV0dG9uICYmIGFjdGlvbnNNZW51RWxlbWVudCkge1xuXHRcdFx0XHRhd2FpdCB0aGlzLnVpTWVzc2FnZS5jbG9zZUFjdGlvbnNNZW51KGFjdGlvbkJ1dHRvbiwgYWN0aW9uc01lbnVFbGVtZW50KVxuXHRcdFx0fVxuXHRcdFx0YXdhaXQgdGhpcy51aU1lc3NhZ2UuaGlkZUFjdGlvbk1lbnVCdXR0b24oKVxuXHRcdFx0dGhyb3cgbmV3IEZhaWxlZFdvcmtmbG93RXhjZXB0aW9uKFwiRmFpbGVkIHRvIGV4ZWN1dGUgd29ya2Zsb3cgZm9yIHRoaXMgbWVzc2FnZVwiKVxuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBAdHlwZSB7VUlNZXNzYWdlfVxuXHQgKi9cblx0Z2V0IHVpTWVzc2FnZSgpIHtcblx0XHRyZXR1cm4gdGhpcy5fdWlNZXNzYWdlXG5cdH1cblxufVxuIiwiaW1wb3J0IHsgbG9hZE1vcmVNZXNzYWdlcyB9IGZyb20gXCIuL2RvbS1sb29rdXAuanNcIlxuaW1wb3J0IFVJQ29tcG9uZW50IGZyb20gXCIuLi91aS1jb21wb25lbnQuanNcIlxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBVSU1lc3NhZ2VzV3JhcHBlciBleHRlbmRzIFVJQ29tcG9uZW50IHtcblxuXHQvKipcblx0ICpcblx0ICogQHJldHVybnMge1Byb21pc2U+fVxuXHQgKi9cblx0ZmV0Y2hBbmRSZW5kZXJUaHJlYWROZXh0TWVzc2FnZVBhZ2UoKSB7XG5cdFx0cmV0dXJuIGxvYWRNb3JlTWVzc2FnZXModGhpcy5yb290KVxuXHR9XG5cbn1cbiIsImltcG9ydCBVSSBmcm9tIFwiLi4vdWkuanNcIlxuaW1wb3J0IHsgZmluZE1lc3NhZ2VzV3JhcHBlciwgZmluZE1lc3NhZ2VzIH0gZnJvbSBcIi4vZG9tLWxvb2t1cC5qc1wiXG5pbXBvcnQgVUlQSU1lc3NhZ2UgZnJvbSBcIi4uLy4uL3VpcGkvdWlwaS1tZXNzYWdlLmpzXCJcbmltcG9ydCBVSU1lc3NhZ2UgZnJvbSBcIi4vdWktbWVzc2FnZS5qc1wiXG5pbXBvcnQgVUlNZXNzYWdlc1dyYXBwZXIgZnJvbSBcIi4vdWktbWVzc2FnZXMtd3JhcHBlci5qc1wiXG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIERlZmF1bHRVSSBleHRlbmRzIFVJIHtcblxuXHQvKipcblx0ICpcblx0ICogQHJldHVybnMge0RlZmF1bHRVSX1cblx0ICovXG5cdHN0YXRpYyBjcmVhdGUod2luZG93KSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIlVJIGNyZWF0ZVwiKVxuXHRcdGNvbnN0IG1lc3NhZ2VzV3JhcHBlckVsZW1lbnQgPSBmaW5kTWVzc2FnZXNXcmFwcGVyKHdpbmRvdylcblx0XHRpZihtZXNzYWdlc1dyYXBwZXJFbGVtZW50ICE9PSBudWxsKSB7XG5cdFx0XHRjb25zb2xlLmRlYnVnKFwiRm91bmQgbWVzc2FnZXNXcmFwcGVyRWxlbWVudFwiLCBtZXNzYWdlc1dyYXBwZXJFbGVtZW50KVxuXHRcdFx0Y29uc3QgdWlNZXNzYWdlc1dyYXBwZXIgPSBuZXcgVUlNZXNzYWdlc1dyYXBwZXIobWVzc2FnZXNXcmFwcGVyRWxlbWVudClcblx0XHRcdHJldHVybiBuZXcgRGVmYXVsdFVJKHdpbmRvdywgeyB1aU1lc3NhZ2VzV3JhcHBlciB9KVxuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCJVbmFibGUgdG8gZmluZCBtZXNzYWdlc1dyYXBwZXJFbGVtZW50XCIpXG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCpcblx0KiBAcmV0dXJucyB7UHJvbWlzZT59XG5cdCovXG5cdGFzeW5jIGZldGNoQW5kUmVuZGVyVGhyZWFkTmV4dE1lc3NhZ2VQYWdlKCkge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJVSSBmZXRjaEFuZFJlbmRlclRocmVhZE5leHRNZXNzYWdlUGFnZVwiKVxuXHRcdHJldHVybiBhd2FpdCB0aGlzLmlkZW50aWZpZXIudWlNZXNzYWdlc1dyYXBwZXIuZmV0Y2hBbmRSZW5kZXJUaHJlYWROZXh0TWVzc2FnZVBhZ2UodGhpcy5kb21NYXBwZXIpXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHJldHVybnMge1Byb21pc2U8VUlQSU1lc3NhZ2VbXT59XG5cdCAqL1xuXHRhc3luYyBjcmVhdGVVSVBJTWVzc2FnZXMoKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIlVJIGNyZWF0ZVVJUElNZXNzYWdlc1wiKVxuXHRcdGNvbnN0IHVpcGlNZXNzYWdlcyA9IFtdXG5cdFx0Y29uc3QgbWVzc2FnZUVsZW1lbnRzID0gYXdhaXQgZmluZE1lc3NhZ2VzKHRoaXMuaWRlbnRpZmllci51aU1lc3NhZ2VzV3JhcHBlci5yb290KVxuXHRcdGZvcihjb25zdCBtZXNzYWdlRWxlbWVudCBvZiBtZXNzYWdlRWxlbWVudHMpIHtcblx0XHRcdGNvbnN0IHVpTWVzc2FnZSA9IG5ldyBVSU1lc3NhZ2UobWVzc2FnZUVsZW1lbnQpXG5cdFx0XHR1aXBpTWVzc2FnZXMucHVzaChuZXcgVUlQSU1lc3NhZ2UodWlNZXNzYWdlKSlcblx0XHR9XG5cdFx0cmV0dXJuIHVpcGlNZXNzYWdlc1xuXHR9XG5cbn1cbiIsImltcG9ydCBEZWZhdWx0VUkgZnJvbSBcIi4vZGVmYXVsdC9kZWZhdWx0LXVpLmpzXCJcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gZ2V0VUkoKSB7XG5cdHJldHVybiBEZWZhdWx0VUlcbn1cbiIsImltcG9ydCBnZXRVSSBmcm9tIFwiLi4vdWkvZ2V0LXVpLmpzXCJcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgVUlQSSB7XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7VUl9IHVpXG5cdCAqL1xuXHRjb25zdHJ1Y3Rvcih1aSkge1xuXHRcdHRoaXMuX3VpID0gdWlcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge1dpbmRvd30gd2luZG93XG5cdCAqIEByZXR1cm5zIHtVSVBJfVxuXHQgKi9cblx0c3RhdGljIGNyZWF0ZSh3aW5kb3cpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwiVUlQSS5jcmVhdGVcIilcblx0XHRjb25zdCBVSSA9IGdldFVJKClcblx0XHRjb25zdCB1aSA9IFVJLmNyZWF0ZSh3aW5kb3cpXG5cdFx0cmV0dXJuIG5ldyBVSVBJKHVpKVxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlfVxuXHQgKi9cblx0ZmV0Y2hBbmRSZW5kZXJUaHJlYWROZXh0TWVzc2FnZVBhZ2UoKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIlVJUEkgZmV0Y2hBbmRSZW5kZXJUaHJlYWROZXh0TWVzc2FnZVBhZ2VcIilcblx0XHRyZXR1cm4gdGhpcy51aS5mZXRjaEFuZFJlbmRlclRocmVhZE5leHRNZXNzYWdlUGFnZSgpXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHJldHVybnMge1Byb21pc2U8VUlQSU1lc3NhZ2VbXT59XG5cdCAqL1xuXHRjcmVhdGVVSVBJTWVzc2FnZXMoKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIlVJUEkgY3JlYXRlVUlQSU1lc3NhZ2VzXCIpXG5cdFx0cmV0dXJuIHRoaXMudWkuY3JlYXRlVUlQSU1lc3NhZ2VzKClcblx0fVxuXG5cdC8qKlxuXHQgKiBAdHlwZSB7VUl9XG5cdCAqL1xuXHRnZXQgdWkoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX3VpXG5cdH1cblxufVxuIiwiaW1wb3J0IFVJUEkgZnJvbSBcIi4uL3VpcGkvdWlwaS5qc1wiXG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIElETVUge1xuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge1dpbmRvd30gd2luZG93XG5cdCAqIEBwYXJhbSB7VUkuY29uc3RydWN0b3J9IFVJXG5cdCAqL1xuXHRjb25zdHJ1Y3Rvcih3aW5kb3cpIHtcblx0XHR0aGlzLndpbmRvdyA9IHdpbmRvd1xuXHRcdHRoaXMudWlwaSA9IG51bGxcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZTxVSVBJTWVzc2FnZVtdPn1cblx0ICovXG5cdGNyZWF0ZVVJUElNZXNzYWdlcygpIHtcblx0XHRyZXR1cm4gdGhpcy4jZ2V0VUlQSSgpLmNyZWF0ZVVJUElNZXNzYWdlcygpXG5cdH1cblxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZX1cblx0ICovXG5cdGZldGNoQW5kUmVuZGVyVGhyZWFkTmV4dE1lc3NhZ2VQYWdlKCkge1xuXHRcdHJldHVybiB0aGlzLiNnZXRVSVBJKCkuZmV0Y2hBbmRSZW5kZXJUaHJlYWROZXh0TWVzc2FnZVBhZ2UoKVxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEByZXR1cm5zIHtVSVBJfVxuXHQgKi9cblx0I2dldFVJUEkoKSB7XG5cdFx0aWYodGhpcy51aXBpID09PSBudWxsKSB7XG5cdFx0XHR0aGlzLnVpcGkgPSBVSVBJLmNyZWF0ZSh0aGlzLndpbmRvdywgdGhpcy5VSSlcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMudWlwaVxuXHR9XG5cbn1cbiIsImNsYXNzIFVuc2VuZFN0cmF0ZWd5IHtcblxuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHtJRE1VfSBpZG11XG5cdCAqL1xuXHRjb25zdHJ1Y3RvcihpZG11KSB7XG5cdFx0dGhpcy5faWRtdSA9IGlkbXVcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAYWJzdHJhY3Rcblx0ICogQHJldHVybnMge2Jvb2xlYW59XG5cdCAqL1xuXHRpc1J1bm5pbmcoKSB7XG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQGFic3RyYWN0XG5cdCAqL1xuXHRzdG9wKCkge1xuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBhYnN0cmFjdFxuXHQgKiBAcGFyYW0ge251bWJlcn0gYmF0Y2hTaXplXG5cdCAqL1xuXHRydW4oKSB7XG5cdH1cblxuXHQvKipcblx0ICogQHJlYWRvbmx5XG5cdCAqIEB0eXBlIHtJRE1VfVxuXHQgKi9cblx0Z2V0IGlkbXUoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX2lkbXVcblx0fVxuXG59XG5cblxuZXhwb3J0IGNsYXNzIEJhdGNoVW5zZW5kU3RyYXRlZ3kgZXh0ZW5kcyBVbnNlbmRTdHJhdGVneSB7XG5cblx0c3RhdGljIERFRkFVTFRfQkFUQ0hfU0laRSA9IDVcblxuXHQjb25VbnN1Y2Nlc3NmdWxXb3JrZmxvd3Ncblx0I2ZpbmlzaGVkX3dvcmtmbG93c1xuXG5cblx0LyoqXG5cdCAqIEBjYWxsYmFjayBvblVuc3VjY2Vzc2Z1bFdvcmtmbG93c1xuXHQgKiBAcGFyYW0ge0lETVV9IGlkbXVcblx0ICogQHBhcmFtIHtvblVuc3VjY2Vzc2Z1bFdvcmtmbG93c30gb25VbnN1Y2Nlc3NmdWxXb3JrZmxvd3Ncblx0ICovXG5cdGNvbnN0cnVjdG9yKGlkbXUsIG9uVW5zdWNjZXNzZnVsV29ya2Zsb3dzPW51bGwpIHtcblx0XHRzdXBlcihpZG11KVxuXHRcdHRoaXMuX3J1bm5pbmcgPSBmYWxzZVxuXHRcdHRoaXMuX3N0b3BwZWQgPSBmYWxzZVxuXHRcdHRoaXMuI2ZpbmlzaGVkX3dvcmtmbG93cyA9IFtdXG5cdFx0dGhpcy4jb25VbnN1Y2Nlc3NmdWxXb3JrZmxvd3MgPSBvblVuc3VjY2Vzc2Z1bFdvcmtmbG93c1xuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEByZXR1cm5zIHtib29sZWFufVxuXHQgKi9cblx0aXNSdW5uaW5nKCkge1xuXHRcdHJldHVybiB0aGlzLl9ydW5uaW5nICYmICF0aGlzLl9zdG9wcGVkXG5cdH1cblxuXHRzdG9wKCkge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJCYXRjaFVuc2VuZFN0cmF0ZWd5IHN0b3BcIilcblx0XHR0aGlzLl9zdG9wcGVkID0gdHJ1ZVxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7bnVtYmVyfSBiYXRjaFNpemVcblx0ICogQHJldHVybnMge1Byb21pc2V9XG5cdCAqL1xuXHRydW4oYmF0Y2hTaXplKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIkJhdGNoVW5zZW5kU3RyYXRlZ3kucnVuKClcIiwgYmF0Y2hTaXplKVxuXHRcdHRoaXMuX3J1bm5pbmcgPSB0cnVlXG5cdFx0dGhpcy5fc3RvcHBlZCA9IGZhbHNlXG5cdFx0cmV0dXJuIHRoaXMuI3Byb2Nlc3NCYXRjaGVzKGJhdGNoU2l6ZSlcblx0fVxuXG5cdCNkb25lKCkge1xuXHRcdHRoaXMuX3J1bm5pbmcgPSBmYWxzZVxuXHRcdGNvbnNvbGUuZGVidWcoXCJCYXRjaFVuc2VuZFN0cmF0ZWd5IGRvbmVcIilcblx0fVxuXG5cdCN1bnN1Y2Nlc3NmdWxXb3JrZmxvd0FsZXJ0KCkge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJCYXRjaFVuc2VuZFN0cmF0ZWd5IHVuc3VjY2Vzc2Z1bFdvcmtmbG93QWxlcnRcIilcblx0XHRpZighdGhpcy5fcnVubmluZykge1xuXHRcdFx0Y2xlYXJJbnRlcnZhbCh0aGlzLmludGVydmFsKVxuXHRcdH1cblx0XHRjb25zb2xlLmRlYnVnKFwiQmF0Y2hVbnNlbmRTdHJhdGVneSBmaW5pc2hlZF93b3JrZmxvd3NcIiwgdGhpcy4jZmluaXNoZWRfd29ya2Zsb3dzKVxuXHRcdGNvbnN0IHVuc3VjY2Vzc2Z1bFdvcmtmbG93cyA9IHRoaXMuI2ZpbmlzaGVkX3dvcmtmbG93cy5maWx0ZXIodWlwaU1lc3NhZ2UgPT4gdGhpcy5pZG11LndpbmRvdy5kb2N1bWVudC5jb250YWlucyh1aXBpTWVzc2FnZS51aU1lc3NhZ2Uucm9vdCkpXG5cdFx0Y29uc29sZS5kZWJ1ZyhcIkJhdGNoVW5zZW5kU3RyYXRlZ3kgdW5zdWNjZXNzZnVsV29ya2Zsb3dzXCIsIHVuc3VjY2Vzc2Z1bFdvcmtmbG93cylcblx0XHRpZih1bnN1Y2Nlc3NmdWxXb3JrZmxvd3MubGVuZ3RoID49IDEpIHtcblx0XHRcdHVuc3VjY2Vzc2Z1bFdvcmtmbG93cy5mb3JFYWNoKGZhaWxlZFdvcmtmbG93ID0+IHRoaXMuI2ZpbmlzaGVkX3dvcmtmbG93cy5zcGxpY2UodGhpcy4jZmluaXNoZWRfd29ya2Zsb3dzLmluZGV4T2YoZmFpbGVkV29ya2Zsb3cpLCAxKSlcblx0XHRcdHRoaXMuI29uVW5zdWNjZXNzZnVsV29ya2Zsb3dzKHVuc3VjY2Vzc2Z1bFdvcmtmbG93cylcblx0XHR9XG5cdH1cblxuXHRhc3luYyAjcHJvY2Vzc0JhdGNoZXMoYmF0Y2hTaXplKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIkJhdGNoVW5zZW5kU3RyYXRlZ3kgcHJvY2Vzc0JhdGNoZXNcIilcblx0XHRsZXQgZG9uZSA9IGZhbHNlXG5cdFx0Zm9yKGxldCBpID0gMDsgaSA8IGJhdGNoU2l6ZTtpKyspIHtcblx0XHRcdGlmKHRoaXMuX3N0b3BwZWQpIHtcblx0XHRcdFx0YnJlYWtcblx0XHRcdH1cblx0XHRcdGRvbmUgPSBhd2FpdCB0aGlzLmlkbXUuZmV0Y2hBbmRSZW5kZXJUaHJlYWROZXh0TWVzc2FnZVBhZ2UoKVxuXHRcdFx0aWYoZG9uZSkge1xuXHRcdFx0XHRicmVha1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0YXdhaXQgbmV3IFByb21pc2UocmVzb2x2ZSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIDEwMDApKSAvLyBJRE1VX05FWFRfTUVTU0FHRV9QQUdFX0RFTEFZXG5cdFx0XHR9XG5cdFx0fVxuXHRcdHRyeSB7XG5cdFx0XHRmb3IoY29uc3QgdWlwaU1lc3NhZ2Ugb2YgYXdhaXQgdGhpcy5pZG11LmNyZWF0ZVVJUElNZXNzYWdlcygpKSB7XG5cdFx0XHRcdGlmKHRoaXMuX3N0b3BwZWQpIHtcblx0XHRcdFx0XHRicmVha1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0YXdhaXQgdWlwaU1lc3NhZ2UudW5zZW5kKClcblx0XHRcdFx0XHR0aGlzLiNmaW5pc2hlZF93b3JrZmxvd3MucHVzaCh1aXBpTWVzc2FnZSlcblx0XHRcdFx0XHRhd2FpdCBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgMTAwMCkpIC8vIElETVVfTUVTU0FHRV9RVUVVRV9ERUxBWVxuXHRcdFx0XHR9IGNhdGNoKHJlc3VsdCkge1xuXHRcdFx0XHRcdGNvbnNvbGUuZXJyb3IocmVzdWx0KVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSBjYXRjaChleCkge1xuXHRcdFx0Y29uc29sZS5lcnJvcihleClcblx0XHR9XG5cdFx0aWYoIXRoaXMuaW50ZXJ2YWwgJiYgdGhpcy4jb25VbnN1Y2Nlc3NmdWxXb3JrZmxvd3MpIHtcblx0XHRcdHRoaXMuaW50ZXJ2YWwgPSBzZXRJbnRlcnZhbCgoKSA9PiB0aGlzLiN1bnN1Y2Nlc3NmdWxXb3JrZmxvd0FsZXJ0KCksIDUwMDApIC8vIElETVVfVU5TVUNFU1NGVUxfV09SS0ZMT1dfQUxFUlRfSU5URVJWQUxcblx0XHR9XG5cdFx0aWYoZG9uZSkge1xuXHRcdFx0dGhpcy4jZG9uZSgpXG5cdFx0fSBlbHNlIGlmKCF0aGlzLl9zdG9wcGVkKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy4jcHJvY2Vzc0JhdGNoZXMoYmF0Y2hTaXplKVxuXHRcdH1cblx0fVxuXG59XG4iLCIvKipcbiAqXG4gKiBAcGFyYW0ge0RvY3VtZW50fSBkb2N1bWVudFxuICogQHJldHVybnMge0hUTUxCdXR0b25FbGVtZW50fVxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQWxlcnRzV3JhcHBlckVsZW1lbnQoZG9jdW1lbnQpIHtcblx0Y29uc3QgYWxlcnRzV3JhcHBlckVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpXG5cdGFsZXJ0c1dyYXBwZXJFbGVtZW50LmlkID0gXCJpZG11LWFsZXJ0c1wiXG5cdGFsZXJ0c1dyYXBwZXJFbGVtZW50LnN0eWxlLnBvc2l0aW9uID0gXCJmaXhlZFwiXG5cdGFsZXJ0c1dyYXBwZXJFbGVtZW50LnN0eWxlLnRvcCA9IFwiMjBweFwiXG5cdGFsZXJ0c1dyYXBwZXJFbGVtZW50LnN0eWxlLnJpZ2h0ID0gXCIyMHB4XCJcblx0YWxlcnRzV3JhcHBlckVsZW1lbnQuc3R5bGUuZGlzcGxheSA9IFwiZ3JpZFwiXG5cdHJldHVybiBhbGVydHNXcmFwcGVyRWxlbWVudFxufVxuXG4vKipcbiAqXG4gKiBAcGFyYW0ge0RvY3VtZW50fSBkb2N1bWVudFxuICogQHBhcmFtIHtzdHJpbmd9ICAgdGV4dFxuICogQHJldHVybnMge0hUTUxCdXR0b25FbGVtZW50fVxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQWxlcnRFbGVtZW50KGRvY3VtZW50LCB0ZXh0KSB7XG5cdGNvbnN0IGFsZXJ0RWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIilcblx0YWxlcnRFbGVtZW50LnRleHRDb250ZW50ID0gdGV4dFxuXHRyZXR1cm4gYWxlcnRFbGVtZW50XG59XG4iLCIvKipcbiAqIEBwYXJhbSB7RG9jdW1lbnR9IGRvY3VtZW50XG4gKiBAcmV0dXJucyB7SFRNTERpdkVsZW1lbnR9XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVPdmVybGF5RWxlbWVudChkb2N1bWVudCkge1xuXHRjb25zdCBvdmVybGF5RWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIilcblx0b3ZlcmxheUVsZW1lbnQuaWQgPSBcImlkbXUtb3ZlcmxheVwiXG5cdG92ZXJsYXlFbGVtZW50LnRhYkluZGV4ID0gMFxuXHRvdmVybGF5RWxlbWVudC5zdHlsZS50b3AgPSBcIjBcIlxuXHRvdmVybGF5RWxlbWVudC5zdHlsZS5yaWdodCA9IFwiMFwiXG5cdG92ZXJsYXlFbGVtZW50LnN0eWxlLnBvc2l0aW9uID0gXCJmaXhlZFwiXG5cdG92ZXJsYXlFbGVtZW50LnN0eWxlLndpZHRoID0gXCIxMDB2d1wiXG5cdG92ZXJsYXlFbGVtZW50LnN0eWxlLmhlaWdodCA9IFwiMTAwdmhcIlxuXHRvdmVybGF5RWxlbWVudC5zdHlsZS56SW5kZXggPSBcIjk5OFwiXG5cdG92ZXJsYXlFbGVtZW50LnN0eWxlLmJhY2tncm91bmRDb2xvciA9IFwiIzAwMDAwMGQ2XCJcblx0b3ZlcmxheUVsZW1lbnQuc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiXG5cdHJldHVybiBvdmVybGF5RWxlbWVudFxufVxuIiwiaW1wb3J0IHsgY3JlYXRlTWVudUJ1dHRvbkVsZW1lbnQgfSBmcm9tIFwiLi9tZW51LWJ1dHRvbi5qc1wiXG5pbXBvcnQgeyBjcmVhdGVNZW51RWxlbWVudCB9IGZyb20gXCIuL21lbnUuanNcIlxuaW1wb3J0IElETVUgZnJvbSBcIi4uLy4uLy4uL2lkbXUvaWRtdS5qc1wiXG5pbXBvcnQgeyBCYXRjaFVuc2VuZFN0cmF0ZWd5IH0gZnJvbSBcIi4uL3Vuc2VuZC1zdHJhdGVneS5qc1wiXG5pbXBvcnQgeyBjcmVhdGVBbGVydHNXcmFwcGVyRWxlbWVudCB9IGZyb20gXCIuL2FsZXJ0LmpzXCJcbmltcG9ydCB7IGNyZWF0ZU92ZXJsYXlFbGVtZW50IH0gZnJvbSBcIi4vb3ZlcmxheS5qc1wiXG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFVJIHtcblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7RG9jdW1lbnR9IGRvY3VtZW50XG5cdCAqIEBwYXJhbSB7SFRNTERpdkVsZW1lbnR9IHJvb3Rcblx0ICogQHBhcmFtIHtIVE1MRGl2RWxlbWVudH0gb3ZlcmxheUVsZW1lbnRcblx0ICogQHBhcmFtIHtIVE1MRGl2RWxlbWVudH0gbWVudUVsZW1lbnRcblx0ICogQHBhcmFtIHtIVE1MQnV0dG9uRWxlbWVudH0gdW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b25cblx0ICogQHBhcmFtIHtIVE1MQnV0dG9uRWxlbWVudH0gbG9hZFRocmVhZE1lc3NhZ2VzQnV0dG9uXG5cdCAqL1xuXHRjb25zdHJ1Y3Rvcihkb2N1bWVudCwgcm9vdCwgb3ZlcmxheUVsZW1lbnQsIG1lbnVFbGVtZW50LCB1bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbiwgbG9hZFRocmVhZE1lc3NhZ2VzQnV0dG9uKSB7XG5cdFx0dGhpcy5fZG9jdW1lbnQgPSBkb2N1bWVudFxuXHRcdHRoaXMuX3Jvb3QgPSByb290XG5cdFx0dGhpcy5fb3ZlcmxheUVsZW1lbnQgPSBvdmVybGF5RWxlbWVudFxuXHRcdHRoaXMuX21lbnVFbGVtZW50ID0gbWVudUVsZW1lbnRcblx0XHR0aGlzLl91bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbiA9IHVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uXG5cdFx0dGhpcy5fbG9hZFRocmVhZE1lc3NhZ2VzQnV0dG9uID0gbG9hZFRocmVhZE1lc3NhZ2VzQnV0dG9uXG5cdFx0dGhpcy5faWRtdSA9IG5ldyBJRE1VKHRoaXMud2luZG93KVxuXHRcdHRoaXMuX3N0cmF0ZWd5ID0gbmV3IEJhdGNoVW5zZW5kU3RyYXRlZ3kodGhpcy5faWRtdSwgKCkgPT4gdGhpcy4jb25VbnN1Y2Nlc3NmdWxXb3JrZmxvd3MoKSlcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge3dpbmRvd30gd2luZG93XG5cdCAqIEByZXR1cm5zIHtVSX1cblx0ICovXG5cdHN0YXRpYyByZW5kZXIod2luZG93KSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcInJlbmRlclwiKVxuXHRcdGNvbnN0IHVpID0gVUkuY3JlYXRlKHdpbmRvdy5kb2N1bWVudClcblx0XHR3aW5kb3cuZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCh1aS5yb290KVxuXHRcdHJldHVybiB1aVxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSAgIHtEb2N1bWVudH0gZG9jdW1lbnRcblx0ICogQHJldHVybnMge1VJfVxuXHQgKi9cblx0c3RhdGljIGNyZWF0ZShkb2N1bWVudCkge1xuXHRcdGNvbnN0IHJvb3QgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpXG5cdFx0Y29uc3QgbWVudUVsZW1lbnQgPSBjcmVhdGVNZW51RWxlbWVudChkb2N1bWVudClcblx0XHRjb25zdCBvdmVybGF5RWxlbWVudCA9IGNyZWF0ZU92ZXJsYXlFbGVtZW50KGRvY3VtZW50KVxuXHRcdGNvbnN0IGFsZXJ0c1dyYXBwZXJFbGVtZW50ID0gY3JlYXRlQWxlcnRzV3JhcHBlckVsZW1lbnQoZG9jdW1lbnQpXG5cdFx0Y29uc3QgdW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24gPSBjcmVhdGVNZW51QnV0dG9uRWxlbWVudChkb2N1bWVudCwgXCJVbnNlbmQgYWxsIERNc1wiKVxuXHRcdGNvbnN0IGxvYWRUaHJlYWRNZXNzYWdlc0J1dHRvbiA9IGNyZWF0ZU1lbnVCdXR0b25FbGVtZW50KGRvY3VtZW50LCBcIkJhdGNoIHNpemVcIiwgXCJzZWNvbmRhcnlcIilcblx0XHRjb25zdCBsb2FkQWxsTWVzc2FnZXNCdXR0b24gPSBjcmVhdGVNZW51QnV0dG9uRWxlbWVudChkb2N1bWVudCwgXCJMb2FkIGFsbCBETXNcIilcblx0XHRkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKG92ZXJsYXlFbGVtZW50KVxuXHRcdGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoYWxlcnRzV3JhcHBlckVsZW1lbnQpXG5cdFx0bWVudUVsZW1lbnQuYXBwZW5kQ2hpbGQodW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24pXG5cdFx0bWVudUVsZW1lbnQuYXBwZW5kQ2hpbGQobG9hZFRocmVhZE1lc3NhZ2VzQnV0dG9uKVxuXHRcdG1lbnVFbGVtZW50LmFwcGVuZENoaWxkKGxvYWRBbGxNZXNzYWdlc0J1dHRvbilcblx0XHRyb290LmFwcGVuZENoaWxkKG1lbnVFbGVtZW50KVxuXHRcdGNvbnN0IHVpID0gbmV3IFVJKGRvY3VtZW50LCByb290LCBvdmVybGF5RWxlbWVudCwgbWVudUVsZW1lbnQsIHVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uLCBsb2FkVGhyZWFkTWVzc2FnZXNCdXR0b24pXG5cdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcImtleWRvd25cIiwgKGV2ZW50KSA9PiB1aS4jb25XaW5kb3dLZXlFdmVudChldmVudCkpIC8vIFRPRE8gdGVzdFxuXHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJrZXl1cFwiLCAoZXZlbnQpID0+IHVpLiNvbldpbmRvd0tleUV2ZW50KGV2ZW50KSkgLy8gVE9ETyB0ZXN0XG5cdFx0dW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIChldmVudCkgPT4gdWkuI29uVW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b25DbGljayhldmVudCkpXG5cdFx0bG9hZFRocmVhZE1lc3NhZ2VzQnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoZXZlbnQpID0+IHVpLiNvbkxvYWRUaHJlYWRNZXNzYWdlc0J1dHRvbkNsaWNrKGV2ZW50KSkgLy8gVE9ETyB0ZXN0XG5cdFx0bG9hZEFsbE1lc3NhZ2VzQnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoZXZlbnQpID0+IHVpLiNvbkxvYWRBbGxNZXNzYWdlc0J1dHRvbkNsaWNrKGV2ZW50KSlcblx0XHRuZXcgTXV0YXRpb25PYnNlcnZlcigobXV0YXRpb25zKSA9PiB1aS4jb25NdXRhdGlvbnMobXV0YXRpb25zLCB1aSkpLm9ic2VydmUoZG9jdW1lbnQuYm9keSwgeyBjaGlsZExpc3Q6IHRydWUgfSkgLy8gVE9ETyB0ZXN0XG5cdFx0dW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24uZGF0YVRleHRDb250ZW50ID0gdW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24udGV4dENvbnRlbnRcblx0XHR1bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbi5kYXRhQmFja2dyb3VuZENvbG9yID0gdW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24uc3R5bGUuYmFja2dyb3VuZENvbG9yXG5cdFx0cmV0dXJuIHVpXG5cdH1cblxuXHRhc3luYyAjc3RhcnRVbnNlbmRpbmcoKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIlVzZXIgYXNrZWQgZm9yIG1lc3NhZ2VzIHVuc2VuZGluZyB0byBzdGFydDsgVUkgaW50ZXJhY3Rpb24gd2lsbCBiZSBkaXNhYmxlZCBpbiB0aGUgbWVhbnRpbWVcIilcblx0XHQ7Wy4uLnRoaXMubWVudUVsZW1lbnQucXVlcnlTZWxlY3RvckFsbChcImJ1dHRvblwiKV0uZmlsdGVyKGJ1dHRvbiA9PiBidXR0b24gIT09IHRoaXMudW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24pLmZvckVhY2goYnV0dG9uID0+IHtcblx0XHRcdGJ1dHRvbi5zdHlsZS52aXNpYmlsaXR5ID0gXCJoaWRkZW5cIlxuXHRcdFx0YnV0dG9uLmRpc2FibGVkID0gdHJ1ZVxuXHRcdH0pXG5cdFx0dGhpcy5vdmVybGF5RWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gXCJcIlxuXHRcdHRoaXMub3ZlcmxheUVsZW1lbnQuZm9jdXMoKVxuXHRcdHRoaXMudW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24udGV4dENvbnRlbnQgPSBcIlN0b3AgcHJvY2Vzc2luZ1wiXG5cdFx0dGhpcy51bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbi5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSBcIiNGQTM4M0VcIlxuXHRcdGNvbnN0IGJhdGNoU2l6ZSA9IHRoaXMud2luZG93LmxvY2FsU3RvcmFnZS5nZXRJdGVtKFwiSURNVV9CQVRDSF9TSVpFXCIpIHx8IEJhdGNoVW5zZW5kU3RyYXRlZ3kuREVGQVVMVF9CQVRDSF9TSVpFXG5cdFx0YXdhaXQgdGhpcy5zdHJhdGVneS5ydW4oYmF0Y2hTaXplKVxuXHRcdHRoaXMuI29uVW5zZW5kaW5nRmluaXNoZWQoKVxuXHR9XG5cblx0I3NldEJhdGNoU2l6ZShiYXRjaFNpemUpIHtcblx0XHRjb25zb2xlLmRlYnVnKGBzZXRCYXRjaFNpemUgJHtiYXRjaFNpemV9YClcblx0XHR0aGlzLndpbmRvdy5sb2NhbFN0b3JhZ2Uuc2V0SXRlbShcIklETVVfQkFUQ0hfU0laRVwiLCBwYXJzZUludChiYXRjaFNpemUpKVxuXHR9XG5cblx0I29uVW5zdWNjZXNzZnVsV29ya2Zsb3dzKHVuc3VjY2Vzc2Z1bFdvcmtmbG93cykge1xuXHRcdGNvbnNvbGUubG9nKHVuc3VjY2Vzc2Z1bFdvcmtmbG93cylcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge011dGF0aW9uW119IG11dGF0aW9uc1xuXHQgKi9cblx0I29uTXV0YXRpb25zKG11dGF0aW9ucywgdWkpIHtcblx0XHRpZih1aS5yb290Lm93bmVyRG9jdW1lbnQucXVlcnlTZWxlY3RvcihcIltpZF49bW91bnRdID4gZGl2ID4gZGl2ID4gZGl2XCIpICE9PSBudWxsICYmIHVpKSB7XG5cdFx0XHRuZXcgTXV0YXRpb25PYnNlcnZlcih1aS4jb25NdXRhdGlvbnMuYmluZCh0aGlzKSkub2JzZXJ2ZSh1aS5yb290Lm93bmVyRG9jdW1lbnQucXVlcnlTZWxlY3RvcihcIltpZF49bW91bnRdID4gZGl2ID4gZGl2ID4gZGl2XCIpLCB7IGNoaWxkTGlzdDogdHJ1ZSwgYXR0cmlidXRlczogdHJ1ZSB9KVxuXHRcdH1cblx0XHRpZih0aGlzLndpbmRvdy5sb2NhdGlvbi5wYXRobmFtZS5zdGFydHNXaXRoKFwiL2RpcmVjdC90L1wiKSkge1xuXHRcdFx0dGhpcy5yb290LnN0eWxlLmRpc3BsYXkgPSBcIlwiXG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMucm9vdC5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCJcblx0XHRcdHRoaXMuc3RyYXRlZ3kuc3RvcCgpXG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7VUl9IHVpXG5cdCAqIEBwYXJhbSB7RXZlbnR9IGV2ZW50XG5cdCAqL1xuXHQjb25Mb2FkVGhyZWFkTWVzc2FnZXNCdXR0b25DbGljaygpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwibG9hZFRocmVhZE1lc3NhZ2VzQnV0dG9uIGNsaWNrXCIpXG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IGJhdGNoU2l6ZSA9IHBhcnNlSW50KFxuXHRcdFx0XHR0aGlzLndpbmRvdy5wcm9tcHQoXCJIb3cgbWFueSBwYWdlcyBzaG91bGQgd2UgbG9hZCBiZWZvcmUgZWFjaCB1bnNlbmRpbmc/IFwiLFxuXHRcdFx0XHRcdHRoaXMud2luZG93LmxvY2FsU3RvcmFnZS5nZXRJdGVtKFwiSURNVV9CQVRDSF9TSVpFXCIpXG5cdFx0XHRcdHx8IEJhdGNoVW5zZW5kU3RyYXRlZ3kuREVGQVVMVF9CQVRDSF9TSVpFIClcblx0XHRcdClcblx0XHRcdGlmKHBhcnNlSW50KGJhdGNoU2l6ZSkpIHtcblx0XHRcdFx0dGhpcy4jc2V0QmF0Y2hTaXplKGJhdGNoU2l6ZSlcblx0XHRcdH1cblx0XHR9IGNhdGNoKGV4KSB7XG5cdFx0XHRjb25zb2xlLmVycm9yKGV4KVxuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge1VJfSB1aVxuXHQgKiBAcGFyYW0ge0V2ZW50fSBldmVudFxuXHQgKi9cblx0YXN5bmMgI29uTG9hZEFsbE1lc3NhZ2VzQnV0dG9uQ2xpY2soKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcImxvYWRUaHJlYWRNZXNzYWdlc0J1dHRvbiBjbGlja1wiKVxuXHRcdHRyeSB7XG5cdFx0XHRsZXQgZG9uZSA9IGZhbHNlXG5cdFx0XHR3aGlsZSghZG9uZSkge1xuXHRcdFx0XHRkb25lID0gYXdhaXQgdGhpcy5pZG11LmZldGNoQW5kUmVuZGVyVGhyZWFkTmV4dE1lc3NhZ2VQYWdlKClcblx0XHRcdH1cblx0XHR9IGNhdGNoKGV4KSB7XG5cdFx0XHRjb25zb2xlLmVycm9yKGV4KVxuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge1VJfSB1aVxuXHQgKiBAcGFyYW0ge0V2ZW50fSBldmVudFxuXHQgKi9cblx0I29uVW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b25DbGljaygpIHtcblx0XHRpZih0aGlzLnN0cmF0ZWd5LmlzUnVubmluZygpKSB7XG5cdFx0XHRjb25zb2xlLmRlYnVnKFwiVXNlciBhc2tlZCBmb3IgbWVzc2FnZXMgdW5zZW5kaW5nIHRvIHN0b3BcIilcblx0XHRcdHRoaXMuc3RyYXRlZ3kuc3RvcCgpXG5cdFx0XHR0aGlzLiNvblVuc2VuZGluZ0ZpbmlzaGVkKClcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy4jc3RhcnRVbnNlbmRpbmcoKVxuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge0V2ZW50fSBldmVudFxuXHQgKi9cblx0I29uV2luZG93S2V5RXZlbnQoZXZlbnQpIHtcblx0XHRpZih0aGlzLnN0cmF0ZWd5LmlzUnVubmluZygpKSB7XG5cdFx0XHRjb25zb2xlLmluZm8oXCJVc2VyIGludGVyYWN0aW9uIGlzIGRpc2FibGVkIGFzIHRoZSB1bnNlbmRpbmcgaXMgc3RpbGwgcnVubmluZzsgUGxlYXNlIHN0b3AgdGhlIGV4ZWN1dGlvbiBmaXJzdC5cIilcblx0XHRcdGV2ZW50LnN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbigpXG5cdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpXG5cdFx0XHRldmVudC5zdG9wUHJvcGFnYXRpb24oKVxuXHRcdFx0dGhpcy5vdmVybGF5RWxlbWVudC5mb2N1cygpXG5cdFx0XHRyZXR1cm4gZmFsc2Vcblx0XHR9XG5cdH1cblxuXHQjb25VbnNlbmRpbmdGaW5pc2hlZCgpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwicmVuZGVyIG9uVW5zZW5kaW5nRmluaXNoZWRcIilcblx0XHQ7Wy4uLnRoaXMubWVudUVsZW1lbnQucXVlcnlTZWxlY3RvckFsbChcImJ1dHRvblwiKV0uZmlsdGVyKGJ1dHRvbiA9PiBidXR0b24gIT09IHRoaXMudW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24pLmZvckVhY2goYnV0dG9uID0+IHtcblx0XHRcdGJ1dHRvbi5zdHlsZS52aXNpYmlsaXR5ID0gXCJcIlxuXHRcdFx0YnV0dG9uLmRpc2FibGVkID0gZmFsc2Vcblx0XHR9KVxuXHRcdHRoaXMudW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24udGV4dENvbnRlbnQgPSB0aGlzLnVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uLmRhdGFUZXh0Q29udGVudFxuXHRcdHRoaXMudW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24uc3R5bGUuYmFja2dyb3VuZENvbG9yID0gdGhpcy51bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbi5kYXRhQmFja2dyb3VuZENvbG9yXG5cdFx0dGhpcy5vdmVybGF5RWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCJcblx0XHRpZighdGhpcy5zdHJhdGVneS5fc3RvcHBlZCkge1xuXHRcdFx0dGhpcy53aW5kb3cuYWxlcnQoXCJJRE1VOiBGaW5pc2hlZFwiKVxuXHRcdH1cblx0fVxuXG5cblx0LyoqXG5cdCAqIEByZWFkb25seVxuXHQgKiBAdHlwZSB7RG9jdW1lbnR9XG5cdCAqL1xuXHRnZXQgZG9jdW1lbnQoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX2RvY3VtZW50XG5cdH1cblxuXHQvKipcblx0ICogQHJlYWRvbmx5XG5cdCAqIEB0eXBlIHtXaW5kb3d9XG5cdCAqL1xuXHRnZXQgd2luZG93KCkge1xuXHRcdHJldHVybiB0aGlzLl9kb2N1bWVudC5kZWZhdWx0Vmlld1xuXHR9XG5cblx0LyoqXG5cdCAqIEByZWFkb25seVxuXHQgKiBAdHlwZSB7SFRNTERpdkVsZW1lbnR9XG5cdCAqL1xuXHRnZXQgcm9vdCgpIHtcblx0XHRyZXR1cm4gdGhpcy5fcm9vdFxuXHR9XG5cblx0LyoqXG5cdCAqIEByZWFkb25seVxuXHQgKiBAdHlwZSB7SFRNTERpdkVsZW1lbnR9XG5cdCAqL1xuXHRnZXQgb3ZlcmxheUVsZW1lbnQoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX292ZXJsYXlFbGVtZW50XG5cdH1cblxuXHQvKipcblx0ICogQHJlYWRvbmx5XG5cdCAqIEB0eXBlIHtIVE1MRGl2RWxlbWVudH1cblx0ICovXG5cdGdldCBtZW51RWxlbWVudCgpIHtcblx0XHRyZXR1cm4gdGhpcy5fbWVudUVsZW1lbnRcblx0fVxuXG5cdC8qKlxuXHQgKiBAcmVhZG9ubHlcblx0ICogQHR5cGUge0hUTUxCdXR0b25FbGVtZW50fVxuXHQgKi9cblx0Z2V0IHVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uKCkge1xuXHRcdHJldHVybiB0aGlzLl91bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvblxuXHR9XG5cblx0LyoqXG5cdCAqIEByZWFkb25seVxuXHQgKiBAdHlwZSB7SFRNTEJ1dHRvbkVsZW1lbnR9XG5cdCAqL1xuXHRnZXQgbG9hZFRocmVhZE1lc3NhZ2VzQnV0dG9uKCkge1xuXHRcdHJldHVybiB0aGlzLl9sb2FkVGhyZWFkTWVzc2FnZXNCdXR0b25cblx0fVxuXG5cdC8qKlxuXHQgKiBAcmVhZG9ubHlcblx0ICogQHR5cGUge1Vuc2VuZFN0cmF0ZWd5fVxuXHQgKi9cblx0Z2V0IHN0cmF0ZWd5KCkge1xuXHRcdHJldHVybiB0aGlzLl9zdHJhdGVneVxuXHR9XG5cblx0LyoqXG5cdCAqIEByZWFkb25seVxuXHQgKiBAdHlwZSB7SURNVX1cblx0ICovXG5cdGdldCBpZG11KCkge1xuXHRcdHJldHVybiB0aGlzLl9pZG11XG5cdH1cblxufVxuIiwiaW1wb3J0IFVJIGZyb20gXCIuL3VpL3VpLmpzXCJcblxuZXhwb3J0IGZ1bmN0aW9uIG1haW4od2luZG93KSB7XG5cdFVJLnJlbmRlcih3aW5kb3cpXG59XG5cbmlmKHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIpIHtcblx0bWFpbih3aW5kb3cpXG59XG4iXSwibmFtZXMiOlsiVUkiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Q0FBQSxNQUFNLFlBQVksR0FBRztDQUNyQixDQUFDLFNBQVMsRUFBRSxTQUFTO0NBQ3JCLENBQUMsV0FBVyxFQUFFLFdBQVc7Q0FDekIsRUFBQztBQUNEO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNPLFNBQVMsZ0JBQWdCLENBQUMsYUFBYSxFQUFFLFNBQVMsQ0FBQyxZQUFZLENBQUMsT0FBTyxFQUFFO0NBQ2hGLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxRQUFRLEdBQUcsNkJBQTRCO0NBQzVELENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxLQUFLLEdBQUcsUUFBTztDQUNwQyxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLE1BQUs7Q0FDbkMsQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLFlBQVksR0FBRyxNQUFLO0NBQ3pDLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxPQUFPLEdBQUcsTUFBSztDQUNwQyxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsVUFBVSxHQUFHLE9BQU07Q0FDeEMsQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxVQUFTO0NBQ3ZDLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxVQUFVLEdBQUcsK0JBQThCO0NBQ2hFLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxlQUFlLEdBQUcsQ0FBQyxhQUFhLEVBQUUsU0FBUyxDQUFDLFNBQVMsRUFBQztDQUMzRTs7Q0NsQkE7Q0FDQTtDQUNBO0NBQ0E7Q0FD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
