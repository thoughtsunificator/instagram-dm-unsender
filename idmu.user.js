
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
// @version				0.5.17
// @updateURL				https://raw.githubusercontent.com/thoughtsunificator/instagram-dm-unsender/userscript/idmu.user.js
// @downloadURL				https://raw.githubusercontent.com/thoughtsunificator/instagram-dm-unsender/userscript/idmu.user.js
// @description				Simple script to unsend all DMs in a thread on instagram.com
// @run-at				document-end
// @include				/^https://(www\.)?instagram\.com/direct*/

// ==/UserScript==


(function (exports) {
	'use strict';

	/** @module instagram Helpers to mimick Instagram's look and feel */

	const BUTTON_STYLE = {
		"PRIMARY": "primary",
		"SECONDARY": "secondary",
	};

	/**
	 *
	 * @param {HTMLButtonElement} buttonElement
	 * @param {string}            styleName
	 */
	function applyButtonStyle(buttonElement, styleName) {
		buttonElement.style.fontSize = "var(--system-14-font-size)";
		buttonElement.style.color = "white";
		buttonElement.style.border = "0px";
		buttonElement.style.borderRadius = "8px";
		buttonElement.style.padding = "8px";
		buttonElement.style.fontWeight = "bold";
		buttonElement.style.cursor = "pointer";
		buttonElement.style.lineHeight = "var(--system-14-line-height)";
		if(styleName) {
			buttonElement.style.backgroundColor = `rgb(var(--ig-${styleName}-button))`;
		}
	}

	/** @module menu-button Helpers to create buttons that can be used in IDMU's menu */


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

	/** @module menu IDMU's main menu */

	/**
	 * @param {Document} document
	 * @returns {HTMLButtonElement}
	 */
	function createMenuElement(document) {
		const menuElement = document.createElement("div");
		menuElement.id = "idmu-menu";
		menuElement.style.top = "20px";
		menuElement.style.right = "430px";
		menuElement.style.position = "fixed";
		menuElement.style.zIndex = 999;
		menuElement.style.display = "flex";
		menuElement.style.gap = "10px";
		menuElement.style.placeItems = "center";
		return menuElement
	}

	/** @module async-events Utils module for finding elements asynchronously in the DOM */

	/**
	 *
	 * @callback getElement
	 * @returns {Element}
	 */

	/**
	 *
	 * @param {Element} target
	 * @param {getElement} getElement
	 * @param {AbortController} controller
	 * @returns {Promise<Element>}
	 */
	function waitForElement(target, getElement, controller=new AbortController()) {
		if (controller.signal?.aborted){
			return Promise.reject(new DOMException("Aborted", "AbortError"))
		}
		return new Promise((resolve, reject) => {
			let mutationObserver;
			const abortHandler = () => {
				console.debug("abortController");
				reject(new DOMException("Aborted", "AbortError"));
				if(mutationObserver) {
					mutationObserver.disconnect();
				}
			};
			controller.signal?.addEventListener("abort", abortHandler);
			let element = getElement();
			if(element) {
				resolve(element);
				controller.signal?.removeEventListener("abort", abortHandler);
			} else {
				mutationObserver = new MutationObserver((mutations, observer) => {
					element = getElement();
					if(element) {
						observer.disconnect();
						resolve(element);
						controller.signal?.removeEventListener("abort", abortHandler);
					}
				});
				mutationObserver.observe(target, { subtree: true, childList:true });
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

	/** @module ui-component Base class for any element that is a part of the UI. */


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

	/** @module ui-message UI element representing a message */


	class UIMessage extends UIComponent {

		/**
		 * Run a partial workflow on a message in addition to the early filtering process in order to filter out any element that was wrongly picked up early on.
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
			console.debug("Workflow step 1 : showActionsMenuButton", this.root);
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
			console.debug("Workflow rolling back hideActionMenuButton (something went wrong)", this.root);
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
			console.debug("Workflow step 2 : Clicking actionButton and waiting for unsend menu item to appear", actionButton);
			const actionMenuElement = await this.clickElementAndWaitFor(
				actionButton,
				this.root.ownerDocument.body,
				() => {
					const menuElements = [...this.root.ownerDocument.querySelectorAll("[role=menu] [role=menuitem]")];
					console.debug("Workflow step 2 : ", menuElements.map(menuElement => menuElement.textContent));
					console.debug("Workflow step 2 : ", menuElements.find(node => node.textContent.trim().toLocaleLowerCase() === "unsend"));
					return menuElements.find(node => node.textContent.trim().toLocaleLowerCase() === "unsend") || menuElements.shift() // TODO i18n
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
		 * Click unsend button
		 * @returns {Promise<HTMLButtonElement>|Promise<Error>}
		 */
		async openConfirmUnsendModal() {
			console.debug("Workflow step 3 : openConfirmUnsendModal");
			const unSendButton = await this.waitForElement(
				this.root.ownerDocument.body,
				() => [...this.root.ownerDocument.querySelectorAll("[role=dialog] [role=menu] [role=menuitem]")].filter(node => node.textContent.toLocaleLowerCase() === "unsend").pop(), // TODO i18n
			);
			console.debug("Workflow step 3.5 : Found unsendButton; Clicking unsendButton and waiting for dialog to appear...");
			return this.clickElementAndWaitFor(
				unSendButton,
				this.root.ownerDocument.body,
				() => this.root.ownerDocument.querySelector("[role=dialog] button"),
			)
		}

		/**
		 * Click unsend confirm button
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

	/** @module uipi-message API for UIMessage */


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
				this.uiMessage.scrollIntoView();
				actionButton = await this.uiMessage.showActionsMenuButton();
				actionsMenuElement = await this.uiMessage.openActionsMenu(actionButton);
				console.debug("actionsMenuElement", actionsMenuElement);
				const dialogButton = await this.uiMessage.openConfirmUnsendModal();
				if(this.uiMessage.root.oldRemove) {
					this.uiMessage.root.remove = this.uiMessage.root.oldRemove;
				}
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

	/** @module dom-lookup Utils module for looking up elements on the default UI */


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
		console.debug("loadMoreMessages looking for loader... ");
		const controller = new AbortController();
		let loadingElement;
		try {
			loadingElement = await Promise.race([
				waitForElement(root, () => {
					if(root.querySelector(`[role=progressbar]`) === null) {
						root.scrollTop = 0;
					}
					return root.querySelector(`[role=progressbar]`)
				}, controller),
				new Promise(resolve => {
					findLoaderTimeout = setTimeout(() => { // TODO Replace with fetch override
						controller.abort();
						resolve();
					}, 10000); // IDMU_SCROLL_DETECTION_TIMEOUT
				})
			]);
		} catch(ex) {
			console.error(ex);
		}
		clearTimeout(findLoaderTimeout);
		if(loadingElement) {
			console.debug("loadMoreMessages: Found loader; Stand-by until it is removed");
			console.debug("loadMoreMessages: scrollTop", root.scrollTop);
			await waitForElement(root, () => root.querySelector(`[role=progressbar]`) === null);
			console.debug("loadMoreMessages: Loader was removed, older messages loading completed");
			console.debug(`loadMoreMessages: scrollTop is ${root.scrollTop} we ${root.scrollTop === 0 ? "reached last page" : "did not reach last page and will begin loading older messages shortly"}`, );
			const done = root.scrollTop === 0;
			if(done) {
				root.scrollTop = root.scrollHeight - root.clientHeight;
			}
			return done
		} else {
			console.debug("loadMoreMessages: Could not find loader");
			return true
		}
	}

	/** @module ui-messages-wrapper UI element representing the messages wrapper */


	class UIMessagesWrapper extends UIComponent {

		/**
		 *
		 * @returns {Promise}
		 */
		fetchAndRenderThreadNextMessagePage() {
			return loadMoreMessages(this.root)
		}

	}

	/** @module default-ui Default UI / English UI */


	class DefaultUI extends UI$1 {

		/**
		 * @param {Window} window
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
		* @returns {Promise}
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
				// FIX Instagram removing messages from the DOM after scrolling
				messageElement.oldRemove = messageElement.remove;
				messageElement.remove = () => {};
				const uiMessage = new UIMessage(messageElement);
				uipiMessages.push(new UIPIMessage(uiMessage));
			}
			return uipiMessages
		}

	}

	/** @module get-ui UI loader module. Allow loading of a certain UI based on a given strategy (locale etc..)
	 * There might be need for multiple UI as Instagram might serve different apps based on location for example.
	 * There is also a need to internationalize each ui so that it doesn't fail if we change the language.
	 */


	/**
	 *
	 * @returns {DefaultUI}
	 */
	function getUI() {
		return DefaultUI
	}

	/** @module uipi API for UI */


	/**
	 * UI Interface API
	 */
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
			const ui = getUI().create(window);
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
		 *
		 * @type {UI}
		 */
		get ui() {
			return this._ui
		}

	}

	/** @module idmu Global/Main API for interacting with the UI */


	class IDMU {

		/**
		 *
		 * @param {Window} window
		 * @param {callback} onStatusText
		 */
		constructor(window, onStatusText) {
			this.window = window;
			this.uipi = null;
			this.onStatusText = onStatusText;
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
		 * @param {string} text
		 */
		setStatusText(text) {
			this.onStatusText(text);
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

	/** @module unsend-strategy Various strategies for unsending messages */


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
		 */
		async run() {
		}

		/**
		 * @readonly
		 * @type {IDMU}
		 */
		get idmu() {
			return this._idmu
		}

	}


	/**
	 * Loads multiple pages before unsending message
	 */
	class DefaultStrategy extends UnsendStrategy {



		/**
		 * @param {IDMU} idmu
		 */
		constructor(idmu) {
			super(idmu);
			this._running = false;
			this._stopped = false;
			this._unsentCounter = 0;
		}

		/**
		 *
		 * @returns {boolean}
		 */
		isRunning() {
			return this._running && !this._stopped
		}

		stop() {
			console.debug("DefaultStrategy stop");
			this._stopped = true;
		}

		/**
		 *
		 * @returns {Promise}
		 */
		run() {
			console.debug("DefaultStrategy.run()");
			this._running = true;
			this._stopped = false;
			this._unsentCounter = 0;
			return this.#next()
		}

		async #next() {
			let done = false;
			// Find out if we can load another page of messages
			try {
				this.idmu.setStatusText("Searching for messages...");
				const uipiMessages = await this.idmu.createUIPIMessages();
				uipiMessages.reverse();
				if(uipiMessages.length >= 1) {
					for(const uipiMessage of uipiMessages) {
						this.idmu.setStatusText(`Found ${uipiMessages.length} messages, unsending...`);
						if(this._stopped) {
							break
						}
						try {
							await uipiMessage.unsend();
							this._unsentCounter++;
							this.idmu.setStatusText("Waiting 1 second before unsending next message...");
							await new Promise(resolve => setTimeout(resolve, 1000)); // IDMU_MESSAGE_QUEUE_DELAY
						} catch(result) {
							console.error(result);
						}
					}
				} else {
					this.idmu.setStatusText("No more messages; Searching for additional pages...");
					console.debug("No more messages; fetchAndRenderThreadNextMessagePage", done);
					const hasMoreMessages = (await this.idmu.createUIPIMessages()).length >= 1;
					done = hasMoreMessages === false && (await this.idmu.fetchAndRenderThreadNextMessagePage());
				}
			} catch(ex) {
				console.error(ex);
			}
			if(done) {
				this.idmu.setStatusText(`Done. ${this._unsentCounter} messages unsent.`);
				clearInterval(this.interval);
				this._running = false;
				console.debug("DefaultStrategy done");
			} else if(!this._stopped) { // Try to load the next page if there is any
				this.idmu.setStatusText("Waiting 1 second before next iteration...");
				await new Promise(resolve => setTimeout(resolve, 1000)); // IDMU_NEXT_MESSAGE_PAGE_DELAY
				return this.#next()
			}
		}

	}

	/** @module alert Alert UI */

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

	/** @module overlay IDMU's overlay */

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

	/** @module ui IDMU's own ui/overlay
	 * Provide a button to unsend messages
	*/


	class UI {
		/**
		 *
		 * @param {Document} document
		 * @param {HTMLDivElement} root
		 * @param {HTMLDivElement} overlayElement
		 * @param {HTMLDivElement} menuElement
		 * @param {HTMLButtonElement} unsendThreadMessagesButton
		 * @param {HTMLDivElement} statusElement
		 */
		constructor(document, root, overlayElement, menuElement, unsendThreadMessagesButton, statusElement) {
			this._document = document;
			this._root = root;
			this._overlayElement = overlayElement;
			this._menuElement = menuElement;
			this._statusElement = statusElement;
			this._unsendThreadMessagesButton = unsendThreadMessagesButton;
			this._idmu = new IDMU(this.window, this.onStatusText.bind(this));
			this._strategy = new DefaultStrategy(this._idmu);
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
			root.id = "idmu-root";
			const menuElement = createMenuElement(document);
			const overlayElement = createOverlayElement(document);
			const alertsWrapperElement = createAlertsWrapperElement(document);
			const unsendThreadMessagesButton = createMenuButtonElement(document, "Unsend all DMs", BUTTON_STYLE.PRIMARY);
			const statusElement = document.createElement("div");
			statusElement.textContent = "Ready";
			statusElement.id = "idmu-status";
			statusElement.style = "width: 200px";
			document.body.appendChild(overlayElement);
			document.body.appendChild(alertsWrapperElement);
			menuElement.appendChild(unsendThreadMessagesButton);
			menuElement.appendChild(statusElement);
			root.appendChild(menuElement);
			const ui = new UI(document, root, overlayElement, menuElement, unsendThreadMessagesButton, statusElement);
			document.addEventListener("keydown", (event) => ui.#onWindowKeyEvent(event)); // TODO test
			document.addEventListener("keyup", (event) => ui.#onWindowKeyEvent(event)); // TODO test
			unsendThreadMessagesButton.addEventListener("click", (event) => ui.#onUnsendThreadMessagesButtonClick(event));
			this._mutationObserver = new MutationObserver((mutations) => ui.#onMutations(ui, mutations));
			this._mutationObserver.observe(document.body, { childList: true }); // TODO test
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
			await this.strategy.run();
			this.#onUnsendingFinished();
		}

		/**
		 *
		 * @param {UI} ui
		 */
		#onMutations(ui) {
			if(ui.root.ownerDocument.querySelector("[id^=mount] > div > div > div") !== null && ui) {
				if(this._mutationObserver) {
					this._mutationObserver.disconnect();
				}
				this._mutationObserver = new MutationObserver(ui.#onMutations.bind(this, ui));
				this._mutationObserver.observe(ui.root.ownerDocument.querySelector("[id^=mount] > div > div > div"), { childList: true, attributes: true });
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
		 * @returns {boolean}
		 */
		#onWindowKeyEvent(event) {
			if(this.strategy.isRunning()) {
				this.window.alert("User interaction is disabled as the unsending is still running; Please stop the execution first.");
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
		 *
		 * @param {string} text
		 */
		onStatusText(text) {
			this.statusElement.textContent = text;
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
		 * @type {HTMLDivElement}
		 */
		get statusElement() {
			return this._statusElement
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

	/** @module main Main module */


	/**
	 * @param {Window} window
	 */
	function main(window) {
		UI.render(window);
	}

	if(typeof window !== "undefined") {
		main(window);
	}

	exports.main = main;

	return exports;

})({});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaWRtdS51c2VyLmpzIiwic291cmNlcyI6WyIuLi9zcmMvcnVudGltZS91c2Vyc2NyaXB0L3VpL3N0eWxlL2luc3RhZ3JhbS5qcyIsIi4uL3NyYy9ydW50aW1lL3VzZXJzY3JpcHQvdWkvbWVudS1idXR0b24uanMiLCIuLi9zcmMvcnVudGltZS91c2Vyc2NyaXB0L3VpL21lbnUuanMiLCIuLi9zcmMvZG9tL2FzeW5jLWV2ZW50cy5qcyIsIi4uL3NyYy91aS91aS1jb21wb25lbnQuanMiLCIuLi9zcmMvdWkvZGVmYXVsdC91aS1tZXNzYWdlLmpzIiwiLi4vc3JjL3VpcGkvdWlwaS1tZXNzYWdlLmpzIiwiLi4vc3JjL3VpL3VpLmpzIiwiLi4vc3JjL3VpL2RlZmF1bHQvZG9tLWxvb2t1cC5qcyIsIi4uL3NyYy91aS9kZWZhdWx0L3VpLW1lc3NhZ2VzLXdyYXBwZXIuanMiLCIuLi9zcmMvdWkvZGVmYXVsdC9kZWZhdWx0LXVpLmpzIiwiLi4vc3JjL3VpL2dldC11aS5qcyIsIi4uL3NyYy91aXBpL3VpcGkuanMiLCIuLi9zcmMvaWRtdS9pZG11LmpzIiwiLi4vc3JjL3J1bnRpbWUvdXNlcnNjcmlwdC91bnNlbmQtc3RyYXRlZ3kuanMiLCIuLi9zcmMvcnVudGltZS91c2Vyc2NyaXB0L3VpL2FsZXJ0LmpzIiwiLi4vc3JjL3J1bnRpbWUvdXNlcnNjcmlwdC91aS9vdmVybGF5LmpzIiwiLi4vc3JjL3J1bnRpbWUvdXNlcnNjcmlwdC91aS91aS5qcyIsIi4uL3NyYy9ydW50aW1lL3VzZXJzY3JpcHQvbWFpbi5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKiogQG1vZHVsZSBpbnN0YWdyYW0gSGVscGVycyB0byBtaW1pY2sgSW5zdGFncmFtJ3MgbG9vayBhbmQgZmVlbCAqL1xuXG5leHBvcnQgY29uc3QgQlVUVE9OX1NUWUxFID0ge1xuXHRcIlBSSU1BUllcIjogXCJwcmltYXJ5XCIsXG5cdFwiU0VDT05EQVJZXCI6IFwic2Vjb25kYXJ5XCIsXG59XG5cbi8qKlxuICpcbiAqIEBwYXJhbSB7SFRNTEJ1dHRvbkVsZW1lbnR9IGJ1dHRvbkVsZW1lbnRcbiAqIEBwYXJhbSB7c3RyaW5nfSAgICAgICAgICAgIHN0eWxlTmFtZVxuICovXG5leHBvcnQgZnVuY3Rpb24gYXBwbHlCdXR0b25TdHlsZShidXR0b25FbGVtZW50LCBzdHlsZU5hbWUpIHtcblx0YnV0dG9uRWxlbWVudC5zdHlsZS5mb250U2l6ZSA9IFwidmFyKC0tc3lzdGVtLTE0LWZvbnQtc2l6ZSlcIlxuXHRidXR0b25FbGVtZW50LnN0eWxlLmNvbG9yID0gXCJ3aGl0ZVwiXG5cdGJ1dHRvbkVsZW1lbnQuc3R5bGUuYm9yZGVyID0gXCIwcHhcIlxuXHRidXR0b25FbGVtZW50LnN0eWxlLmJvcmRlclJhZGl1cyA9IFwiOHB4XCJcblx0YnV0dG9uRWxlbWVudC5zdHlsZS5wYWRkaW5nID0gXCI4cHhcIlxuXHRidXR0b25FbGVtZW50LnN0eWxlLmZvbnRXZWlnaHQgPSBcImJvbGRcIlxuXHRidXR0b25FbGVtZW50LnN0eWxlLmN1cnNvciA9IFwicG9pbnRlclwiXG5cdGJ1dHRvbkVsZW1lbnQuc3R5bGUubGluZUhlaWdodCA9IFwidmFyKC0tc3lzdGVtLTE0LWxpbmUtaGVpZ2h0KVwiXG5cdGlmKHN0eWxlTmFtZSkge1xuXHRcdGJ1dHRvbkVsZW1lbnQuc3R5bGUuYmFja2dyb3VuZENvbG9yID0gYHJnYih2YXIoLS1pZy0ke3N0eWxlTmFtZX0tYnV0dG9uKSlgXG5cdH1cbn1cbiIsIi8qKiBAbW9kdWxlIG1lbnUtYnV0dG9uIEhlbHBlcnMgdG8gY3JlYXRlIGJ1dHRvbnMgdGhhdCBjYW4gYmUgdXNlZCBpbiBJRE1VJ3MgbWVudSAqL1xuXG5pbXBvcnQgeyBhcHBseUJ1dHRvblN0eWxlIH0gZnJvbSBcIi4vc3R5bGUvaW5zdGFncmFtLmpzXCJcblxuLyoqXG4gKlxuICogQHBhcmFtIHtEb2N1bWVudH0gZG9jdW1lbnRcbiAqIEBwYXJhbSB7c3RyaW5nfSAgIHRleHRcbiAqIEBwYXJhbSB7c3RyaW5nfSAgIHN0eWxlTmFtZVxuICogQHJldHVybnMge0hUTUxCdXR0b25FbGVtZW50fVxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlTWVudUJ1dHRvbkVsZW1lbnQoZG9jdW1lbnQsIHRleHQsIHN0eWxlTmFtZSkge1xuXHRjb25zdCBidXR0b25FbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImJ1dHRvblwiKVxuXHRidXR0b25FbGVtZW50LnRleHRDb250ZW50ID0gdGV4dFxuXHRhcHBseUJ1dHRvblN0eWxlKGJ1dHRvbkVsZW1lbnQsIHN0eWxlTmFtZSlcblx0YnV0dG9uRWxlbWVudC5hZGRFdmVudExpc3RlbmVyKFwibW91c2VvdmVyXCIsICgpID0+IHtcblx0XHRidXR0b25FbGVtZW50LnN0eWxlLmZpbHRlciA9IGBicmlnaHRuZXNzKDEuMTUpYFxuXHR9KVxuXHRidXR0b25FbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJtb3VzZW91dFwiLCAoKSA9PiB7XG5cdFx0YnV0dG9uRWxlbWVudC5zdHlsZS5maWx0ZXIgPSBgYFxuXHR9KVxuXHRyZXR1cm4gYnV0dG9uRWxlbWVudFxufVxuIiwiLyoqIEBtb2R1bGUgbWVudSBJRE1VJ3MgbWFpbiBtZW51ICovXG5cbi8qKlxuICogQHBhcmFtIHtEb2N1bWVudH0gZG9jdW1lbnRcbiAqIEByZXR1cm5zIHtIVE1MQnV0dG9uRWxlbWVudH1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZU1lbnVFbGVtZW50KGRvY3VtZW50KSB7XG5cdGNvbnN0IG1lbnVFbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKVxuXHRtZW51RWxlbWVudC5pZCA9IFwiaWRtdS1tZW51XCJcblx0bWVudUVsZW1lbnQuc3R5bGUudG9wID0gXCIyMHB4XCJcblx0bWVudUVsZW1lbnQuc3R5bGUucmlnaHQgPSBcIjQzMHB4XCJcblx0bWVudUVsZW1lbnQuc3R5bGUucG9zaXRpb24gPSBcImZpeGVkXCJcblx0bWVudUVsZW1lbnQuc3R5bGUuekluZGV4ID0gOTk5XG5cdG1lbnVFbGVtZW50LnN0eWxlLmRpc3BsYXkgPSBcImZsZXhcIlxuXHRtZW51RWxlbWVudC5zdHlsZS5nYXAgPSBcIjEwcHhcIlxuXHRtZW51RWxlbWVudC5zdHlsZS5wbGFjZUl0ZW1zID0gXCJjZW50ZXJcIlxuXHRyZXR1cm4gbWVudUVsZW1lbnRcbn1cbiIsIi8qKiBAbW9kdWxlIGFzeW5jLWV2ZW50cyBVdGlscyBtb2R1bGUgZm9yIGZpbmRpbmcgZWxlbWVudHMgYXN5bmNocm9ub3VzbHkgaW4gdGhlIERPTSAqL1xuXG4vKipcbiAqXG4gKiBAY2FsbGJhY2sgZ2V0RWxlbWVudFxuICogQHJldHVybnMge0VsZW1lbnR9XG4gKi9cblxuLyoqXG4gKlxuICogQHBhcmFtIHtFbGVtZW50fSB0YXJnZXRcbiAqIEBwYXJhbSB7Z2V0RWxlbWVudH0gZ2V0RWxlbWVudFxuICogQHBhcmFtIHtBYm9ydENvbnRyb2xsZXJ9IGNvbnRyb2xsZXJcbiAqIEByZXR1cm5zIHtQcm9taXNlPEVsZW1lbnQ+fVxuICovXG5leHBvcnQgZnVuY3Rpb24gd2FpdEZvckVsZW1lbnQodGFyZ2V0LCBnZXRFbGVtZW50LCBjb250cm9sbGVyPW5ldyBBYm9ydENvbnRyb2xsZXIoKSkge1xuXHRpZiAoY29udHJvbGxlci5zaWduYWw/LmFib3J0ZWQpe1xuXHRcdHJldHVybiBQcm9taXNlLnJlamVjdChuZXcgRE9NRXhjZXB0aW9uKFwiQWJvcnRlZFwiLCBcIkFib3J0RXJyb3JcIikpXG5cdH1cblx0cmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcblx0XHRsZXQgbXV0YXRpb25PYnNlcnZlclxuXHRcdGNvbnN0IGFib3J0SGFuZGxlciA9ICgpID0+IHtcblx0XHRcdGNvbnNvbGUuZGVidWcoXCJhYm9ydENvbnRyb2xsZXJcIilcblx0XHRcdHJlamVjdChuZXcgRE9NRXhjZXB0aW9uKFwiQWJvcnRlZFwiLCBcIkFib3J0RXJyb3JcIikpXG5cdFx0XHRpZihtdXRhdGlvbk9ic2VydmVyKSB7XG5cdFx0XHRcdG11dGF0aW9uT2JzZXJ2ZXIuZGlzY29ubmVjdCgpXG5cdFx0XHR9XG5cdFx0fVxuXHRcdGNvbnRyb2xsZXIuc2lnbmFsPy5hZGRFdmVudExpc3RlbmVyKFwiYWJvcnRcIiwgYWJvcnRIYW5kbGVyKVxuXHRcdGxldCBlbGVtZW50ID0gZ2V0RWxlbWVudCgpXG5cdFx0aWYoZWxlbWVudCkge1xuXHRcdFx0cmVzb2x2ZShlbGVtZW50KVxuXHRcdFx0Y29udHJvbGxlci5zaWduYWw/LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJhYm9ydFwiLCBhYm9ydEhhbmRsZXIpXG5cdFx0fSBlbHNlIHtcblx0XHRcdG11dGF0aW9uT2JzZXJ2ZXIgPSBuZXcgTXV0YXRpb25PYnNlcnZlcigobXV0YXRpb25zLCBvYnNlcnZlcikgPT4ge1xuXHRcdFx0XHRlbGVtZW50ID0gZ2V0RWxlbWVudCgpXG5cdFx0XHRcdGlmKGVsZW1lbnQpIHtcblx0XHRcdFx0XHRvYnNlcnZlci5kaXNjb25uZWN0KClcblx0XHRcdFx0XHRyZXNvbHZlKGVsZW1lbnQpXG5cdFx0XHRcdFx0Y29udHJvbGxlci5zaWduYWw/LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJhYm9ydFwiLCBhYm9ydEhhbmRsZXIpXG5cdFx0XHRcdH1cblx0XHRcdH0pXG5cdFx0XHRtdXRhdGlvbk9ic2VydmVyLm9ic2VydmUodGFyZ2V0LCB7IHN1YnRyZWU6IHRydWUsIGNoaWxkTGlzdDp0cnVlIH0pXG5cdFx0fVxuXHR9KVxufVxuXG4vKipcbiAqXG4gKiBAcGFyYW0ge0VsZW1lbnR9IGNsaWNrVGFyZ2V0XG4gKiBAcGFyYW0ge0VsZW1lbnR9IHRhcmdldFxuICogQHBhcmFtIHtnZXRFbGVtZW50fSBnZXRFbGVtZW50XG4gKiBAcmV0dXJucyB7RWxlbWVudHxQcm9taXNlPEVsZW1lbnQ+fVxuICovXG5leHBvcnQgZnVuY3Rpb24gY2xpY2tFbGVtZW50QW5kV2FpdEZvcihjbGlja1RhcmdldCwgdGFyZ2V0LCBnZXRFbGVtZW50KSB7XG5cdGNvbnN0IHByb21pc2UgPSB3YWl0Rm9yRWxlbWVudCh0YXJnZXQsIGdldEVsZW1lbnQpXG5cdGNsaWNrVGFyZ2V0LmNsaWNrKClcblx0cmV0dXJuIGdldEVsZW1lbnQoKSB8fCBwcm9taXNlXG59XG4iLCIvKiogQG1vZHVsZSB1aS1jb21wb25lbnQgQmFzZSBjbGFzcyBmb3IgYW55IGVsZW1lbnQgdGhhdCBpcyBhIHBhcnQgb2YgdGhlIFVJLiAqL1xuXG5pbXBvcnQgeyB3YWl0Rm9yRWxlbWVudCwgY2xpY2tFbGVtZW50QW5kV2FpdEZvciB9IGZyb20gXCIuLi9kb20vYXN5bmMtZXZlbnRzLmpzXCJcblxuZXhwb3J0IGNsYXNzIFVJQ29tcG9uZW50IHtcblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7RWxlbWVudH0gcm9vdFxuXHQgKiBAcGFyYW0ge29iamVjdH0gaWRlbnRpZmllclxuXHQgKi9cblx0Y29uc3RydWN0b3Iocm9vdCwgaWRlbnRpZmllcj17fSkge1xuXHRcdHRoaXMucm9vdCA9IHJvb3Rcblx0XHR0aGlzLmlkZW50aWZpZXIgPSBpZGVudGlmaWVyXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHtFbGVtZW50fSB0YXJnZXRcblx0ICogQHBhcmFtIHtmdW5jdGlvbn0gZ2V0RWxlbWVudFxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZTxFbGVtZW50Pn1cblx0ICovXG5cdHdhaXRGb3JFbGVtZW50KHRhcmdldCwgZ2V0RWxlbWVudCkge1xuXHRcdHJldHVybiBnZXRFbGVtZW50KCkgfHwgd2FpdEZvckVsZW1lbnQodGFyZ2V0LCBnZXRFbGVtZW50KVxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7RWxlbWVudH0gY2xpY2tUYXJnZXRcblx0ICogQHBhcmFtIHtFbGVtZW50fSB0YXJnZXRcblx0ICogQHBhcmFtIHtmdW5jdGlvbn0gZ2V0RWxlbWVudFxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZTxFbGVtZW50Pn1cblx0ICovXG5cdGNsaWNrRWxlbWVudEFuZFdhaXRGb3IoY2xpY2tUYXJnZXQsIHRhcmdldCwgZ2V0RWxlbWVudCkge1xuXHRcdHJldHVybiBjbGlja0VsZW1lbnRBbmRXYWl0Rm9yKGNsaWNrVGFyZ2V0LCB0YXJnZXQsIGdldEVsZW1lbnQpXG5cdH1cblxufVxuXG5leHBvcnQgZGVmYXVsdCBVSUNvbXBvbmVudFxuIiwiLyoqIEBtb2R1bGUgdWktbWVzc2FnZSBVSSBlbGVtZW50IHJlcHJlc2VudGluZyBhIG1lc3NhZ2UgKi9cblxuaW1wb3J0IFVJQ29tcG9uZW50IGZyb20gXCIuLi91aS1jb21wb25lbnQuanNcIlxuXG5jbGFzcyBVSU1lc3NhZ2UgZXh0ZW5kcyBVSUNvbXBvbmVudCB7XG5cblx0LyoqXG5cdCAqIFJ1biBhIHBhcnRpYWwgd29ya2Zsb3cgb24gYSBtZXNzYWdlIGluIGFkZGl0aW9uIHRvIHRoZSBlYXJseSBmaWx0ZXJpbmcgcHJvY2VzcyBpbiBvcmRlciB0byBmaWx0ZXIgb3V0IGFueSBlbGVtZW50IHRoYXQgd2FzIHdyb25nbHkgcGlja2VkIHVwIGVhcmx5IG9uLlxuXHQgKiBAcGFyYW0ge0hUTUxEaXZFbGVtZW50fSBlbGVtZW50XG5cdCAqIEByZXR1cm5zIHtQcm9taXNlPGJvb2xlYW4+fVxuXHQgKi9cblx0c3RhdGljIGFzeW5jIGlzTXlPd25NZXNzYWdlKGVsZW1lbnQpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwiaXNNeU93bk1lc3NhZ2VcIiwgZWxlbWVudClcblx0XHQvLyBjbG9zZSBtZW51IGluIGNhc2UgaXQgd2FzIGxlZnQgb3BlblxuXHRcdGVsZW1lbnQucXVlcnlTZWxlY3RvcihcIlthcmlhLWxhYmVsPU1vcmVdXCIpPy5wYXJlbnROb2RlPy5jbGljaygpXG5cdFx0ZWxlbWVudC5xdWVyeVNlbGVjdG9yKGBbYXJpYS1sYWJlbD1cIkNsb3NlIGRldGFpbHMgYW5kIGFjdGlvbnNcIl1gKT8uY2xpY2soKVxuXHRcdGVsZW1lbnQuZGlzcGF0Y2hFdmVudChuZXcgTW91c2VFdmVudChcIm1vdXNlb3V0XCIsIHsgYnViYmxlczogdHJ1ZSB9KSlcblx0XHRjb25zdCB1aU1lc3NhZ2UgPSBuZXcgVUlNZXNzYWdlKGVsZW1lbnQpXG5cdFx0bGV0IHRpbWVvdXRcblx0XHRjb25zdCBhY3Rpb25CdXR0b24gPSBhd2FpdCBQcm9taXNlLnJhY2UoW1xuXHRcdFx0dWlNZXNzYWdlLnNob3dBY3Rpb25zTWVudUJ1dHRvbigpLFxuXHRcdFx0bmV3IFByb21pc2UocmVzb2x2ZSA9PiB7XG5cdFx0XHRcdHRpbWVvdXQgPSBzZXRUaW1lb3V0KHJlc29sdmUsIDIwMCkgLy8gSURNVV9NRVNTQUdFX0RFVEVDVElPTl9BQ1RJT05fTUVOVV9USU1FT1VUXG5cdFx0XHR9KVxuXHRcdF0pXG5cdFx0Y2xlYXJUaW1lb3V0KHRpbWVvdXQpXG5cdFx0aWYoYWN0aW9uQnV0dG9uKSB7XG5cdFx0XHRjb25zb2xlLmRlYnVnKFwiYWN0aW9uQnV0dG9uIGZvdW5kIGxvb2tpbmcgZm9yIHVuc2VuZCBhY3Rpb24gaW4gYWN0aW9uc01lbnVcIilcblx0XHRcdGNvbnN0IGFjdGlvbnNNZW51RWxlbWVudCA9IGF3YWl0IHVpTWVzc2FnZS5vcGVuQWN0aW9uc01lbnUoYWN0aW9uQnV0dG9uKVxuXHRcdFx0YXdhaXQgdWlNZXNzYWdlLmNsb3NlQWN0aW9uc01lbnUoYWN0aW9uQnV0dG9uLCBhY3Rpb25zTWVudUVsZW1lbnQpXG5cdFx0XHRhd2FpdCB1aU1lc3NhZ2UuaGlkZUFjdGlvbk1lbnVCdXR0b24oKVxuXHRcdFx0Y29uc29sZS5kZWJ1ZyhhY3Rpb25zTWVudUVsZW1lbnQsIGFjdGlvbnNNZW51RWxlbWVudC50ZXh0Q29udGVudClcblx0XHRcdHJldHVybiBhY3Rpb25zTWVudUVsZW1lbnQgJiYgYWN0aW9uc01lbnVFbGVtZW50LnRleHRDb250ZW50LnRvTG9jYWxlTG93ZXJDYXNlKCkgPT09IFwidW5zZW5kXCJcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc29sZS5kZWJ1ZyhcIkRpZCBub3QgZmluZCBhY3Rpb25CdXR0b25cIilcblx0XHR9XG5cdFx0cmV0dXJuIGZhbHNlXG5cdH1cblxuXHRzY3JvbGxJbnRvVmlldygpIHtcblx0XHR0aGlzLnJvb3Quc2Nyb2xsSW50b1ZpZXcoKVxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlPEhUTUxCdXR0b25FbGVtZW50Pn1cblx0ICovXG5cdHNob3dBY3Rpb25zTWVudUJ1dHRvbigpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwiV29ya2Zsb3cgc3RlcCAxIDogc2hvd0FjdGlvbnNNZW51QnV0dG9uXCIsIHRoaXMucm9vdClcblx0XHR0aGlzLnJvb3QuZGlzcGF0Y2hFdmVudChuZXcgTW91c2VFdmVudChcIm1vdXNlbW92ZVwiLCB7IGJ1YmJsZXM6IHRydWUgfSkpXG5cdFx0dGhpcy5yb290LmRpc3BhdGNoRXZlbnQobmV3IE1vdXNlRXZlbnQoXCJtb3VzZW92ZXJcIiwgeyBidWJibGVzOiB0cnVlIH0pKVxuXHRcdHRoaXMucm9vdC5kaXNwYXRjaEV2ZW50KG5ldyBNb3VzZUV2ZW50KFwibW91c2VudGVyXCIsIHsgYnViYmxlczogdHJ1ZSB9KSlcblx0XHQvLyBTb21lIHJvd3MgYXJlIGVtcHR5IGFuZCB3ZSBkbyB3YW50IHRoZSBlbnRpcmUgcnVuIHRvIGZhaWxcblx0XHRyZXR1cm4gdGhpcy53YWl0Rm9yRWxlbWVudCh0aGlzLnJvb3QsICgpID0+IHRoaXMucm9vdC5xdWVyeVNlbGVjdG9yKFwiW2FyaWEtbGFiZWw9TW9yZV1cIik/LnBhcmVudE5vZGUpIC8vIFRPRE8gaTE4blxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlPGJvb2xlYW4+fVxuXHQgKi9cblx0aGlkZUFjdGlvbk1lbnVCdXR0b24oKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIldvcmtmbG93IHJvbGxpbmcgYmFjayBoaWRlQWN0aW9uTWVudUJ1dHRvbiAoc29tZXRoaW5nIHdlbnQgd3JvbmcpXCIsIHRoaXMucm9vdClcblx0XHR0aGlzLnJvb3QuZGlzcGF0Y2hFdmVudChuZXcgTW91c2VFdmVudChcIm1vdXNlbW92ZVwiLCB7IGJ1YmJsZXM6IHRydWUgfSkpXG5cdFx0dGhpcy5yb290LmRpc3BhdGNoRXZlbnQobmV3IE1vdXNlRXZlbnQoXCJtb3VzZW91dFwiLCB7IGJ1YmJsZXM6IHRydWUgfSkpXG5cdFx0dGhpcy5yb290LmRpc3BhdGNoRXZlbnQobmV3IE1vdXNlRXZlbnQoXCJtb3VzZWxlYXZlXCIsIHsgYnViYmxlczogdHJ1ZSB9KSlcblx0XHRyZXR1cm4gdGhpcy53YWl0Rm9yRWxlbWVudCh0aGlzLnJvb3QsICgpID0+IHRoaXMucm9vdC5xdWVyeVNlbGVjdG9yKFwiW2FyaWEtbGFiZWw9TW9yZV1cIikgPT09IG51bGwpIC8vIFRPRE8gaTE4blxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7SFRNTEJ1dHRvbkVsZW1lbnR9IGFjdGlvbkJ1dHRvblxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZX1cblx0ICovXG5cdGFzeW5jIG9wZW5BY3Rpb25zTWVudShhY3Rpb25CdXR0b24pIHtcblx0XHRjb25zb2xlLmRlYnVnKFwiV29ya2Zsb3cgc3RlcCAyIDogQ2xpY2tpbmcgYWN0aW9uQnV0dG9uIGFuZCB3YWl0aW5nIGZvciB1bnNlbmQgbWVudSBpdGVtIHRvIGFwcGVhclwiLCBhY3Rpb25CdXR0b24pXG5cdFx0Y29uc3QgYWN0aW9uTWVudUVsZW1lbnQgPSBhd2FpdCB0aGlzLmNsaWNrRWxlbWVudEFuZFdhaXRGb3IoXG5cdFx0XHRhY3Rpb25CdXR0b24sXG5cdFx0XHR0aGlzLnJvb3Qub3duZXJEb2N1bWVudC5ib2R5LFxuXHRcdFx0KCkgPT4ge1xuXHRcdFx0XHRjb25zdCBtZW51RWxlbWVudHMgPSBbLi4udGhpcy5yb290Lm93bmVyRG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChcIltyb2xlPW1lbnVdIFtyb2xlPW1lbnVpdGVtXVwiKV1cblx0XHRcdFx0Y29uc29sZS5kZWJ1ZyhcIldvcmtmbG93IHN0ZXAgMiA6IFwiLCBtZW51RWxlbWVudHMubWFwKG1lbnVFbGVtZW50ID0+IG1lbnVFbGVtZW50LnRleHRDb250ZW50KSlcblx0XHRcdFx0Y29uc29sZS5kZWJ1ZyhcIldvcmtmbG93IHN0ZXAgMiA6IFwiLCBtZW51RWxlbWVudHMuZmluZChub2RlID0+IG5vZGUudGV4dENvbnRlbnQudHJpbSgpLnRvTG9jYWxlTG93ZXJDYXNlKCkgPT09IFwidW5zZW5kXCIpKVxuXHRcdFx0XHRyZXR1cm4gbWVudUVsZW1lbnRzLmZpbmQobm9kZSA9PiBub2RlLnRleHRDb250ZW50LnRyaW0oKS50b0xvY2FsZUxvd2VyQ2FzZSgpID09PSBcInVuc2VuZFwiKSB8fCBtZW51RWxlbWVudHMuc2hpZnQoKSAvLyBUT0RPIGkxOG5cblx0XHRcdH0sXG5cdFx0KVxuXHRcdFx0O1suLi5hY3Rpb25NZW51RWxlbWVudC5wYXJlbnROb2RlLnBhcmVudE5vZGUucXVlcnlTZWxlY3RvckFsbChcIltyb2xlPW1lbnVpdGVtXVwiKV0uZm9yRWFjaChlbGVtZW50ID0+IHtcblx0XHRcdGlmKGVsZW1lbnQgIT09IGFjdGlvbk1lbnVFbGVtZW50KSB7XG5cdFx0XHRcdGVsZW1lbnQucmVtb3ZlKClcblx0XHRcdH1cblx0XHR9KVxuXHRcdHJldHVybiBhY3Rpb25NZW51RWxlbWVudFxuXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHtIVE1MQnV0dG9uRWxlbWVudH0gYWN0aW9uQnV0dG9uXG5cdCAqIEBwYXJhbSB7SFRNTERpdkVsZW1lbnR9IGFjdGlvbnNNZW51RWxlbWVudFxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZTxib29sZWFuPn1cblx0ICovXG5cdGNsb3NlQWN0aW9uc01lbnUoYWN0aW9uQnV0dG9uLCBhY3Rpb25zTWVudUVsZW1lbnQpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwiY2xvc2VBY3Rpb25zTWVudVwiKVxuXHRcdHJldHVybiB0aGlzLmNsaWNrRWxlbWVudEFuZFdhaXRGb3IoXG5cdFx0XHRhY3Rpb25CdXR0b24sXG5cdFx0XHR0aGlzLnJvb3Qub3duZXJEb2N1bWVudC5ib2R5LFxuXHRcdFx0KCkgPT4gdGhpcy5yb290Lm93bmVyRG9jdW1lbnQuYm9keS5jb250YWlucyhhY3Rpb25zTWVudUVsZW1lbnQpID09PSBmYWxzZSxcblx0XHQpXG5cdH1cblxuXHQvKipcblx0ICogQ2xpY2sgdW5zZW5kIGJ1dHRvblxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZTxIVE1MQnV0dG9uRWxlbWVudD58UHJvbWlzZTxFcnJvcj59XG5cdCAqL1xuXHRhc3luYyBvcGVuQ29uZmlybVVuc2VuZE1vZGFsKCkge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJXb3JrZmxvdyBzdGVwIDMgOiBvcGVuQ29uZmlybVVuc2VuZE1vZGFsXCIpXG5cdFx0Y29uc3QgdW5TZW5kQnV0dG9uID0gYXdhaXQgdGhpcy53YWl0Rm9yRWxlbWVudChcblx0XHRcdHRoaXMucm9vdC5vd25lckRvY3VtZW50LmJvZHksXG5cdFx0XHQoKSA9PiBbLi4udGhpcy5yb290Lm93bmVyRG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChcIltyb2xlPWRpYWxvZ10gW3JvbGU9bWVudV0gW3JvbGU9bWVudWl0ZW1dXCIpXS5maWx0ZXIobm9kZSA9PiBub2RlLnRleHRDb250ZW50LnRvTG9jYWxlTG93ZXJDYXNlKCkgPT09IFwidW5zZW5kXCIpLnBvcCgpLCAvLyBUT0RPIGkxOG5cblx0XHQpXG5cdFx0Y29uc29sZS5kZWJ1ZyhcIldvcmtmbG93IHN0ZXAgMy41IDogRm91bmQgdW5zZW5kQnV0dG9uOyBDbGlja2luZyB1bnNlbmRCdXR0b24gYW5kIHdhaXRpbmcgZm9yIGRpYWxvZyB0byBhcHBlYXIuLi5cIilcblx0XHRyZXR1cm4gdGhpcy5jbGlja0VsZW1lbnRBbmRXYWl0Rm9yKFxuXHRcdFx0dW5TZW5kQnV0dG9uLFxuXHRcdFx0dGhpcy5yb290Lm93bmVyRG9jdW1lbnQuYm9keSxcblx0XHRcdCgpID0+IHRoaXMucm9vdC5vd25lckRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCJbcm9sZT1kaWFsb2ddIGJ1dHRvblwiKSxcblx0XHQpXG5cdH1cblxuXHQvKipcblx0ICogQ2xpY2sgdW5zZW5kIGNvbmZpcm0gYnV0dG9uXG5cdCAqIEBwYXJhbSB7SFRNTEJ1dHRvbkVsZW1lbnR9IGRpYWxvZ0J1dHRvblxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZX1cblx0ICovXG5cdGFzeW5jIGNvbmZpcm1VbnNlbmQoZGlhbG9nQnV0dG9uKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIldvcmtmbG93IGZpbmFsIHN0ZXAgOiBjb25maXJtVW5zZW5kXCIsIGRpYWxvZ0J1dHRvbilcblx0XHQvLyB3YWl0IHVudGlsIGNvbmZpcm0gYnV0dG9uIGlzIHJlbW92ZWRcblx0XHRhd2FpdCB0aGlzLmNsaWNrRWxlbWVudEFuZFdhaXRGb3IoXG5cdFx0XHRkaWFsb2dCdXR0b24sXG5cdFx0XHR0aGlzLnJvb3Qub3duZXJEb2N1bWVudC5ib2R5LFxuXHRcdFx0KCkgPT4gdGhpcy5yb290Lm93bmVyRG9jdW1lbnQucXVlcnlTZWxlY3RvcihcIltyb2xlPWRpYWxvZ10gYnV0dG9uXCIpID09PSBudWxsXG5cdFx0KVxuXHR9XG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgVUlNZXNzYWdlXG4iLCIvKiogQG1vZHVsZSB1aXBpLW1lc3NhZ2UgQVBJIGZvciBVSU1lc3NhZ2UgKi9cblxuLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLXVudXNlZC12YXJzXG5pbXBvcnQgVUlNZXNzYWdlIGZyb20gXCIuLi91aS9kZWZhdWx0L3VpLW1lc3NhZ2UuanNcIlxuXG5jbGFzcyBGYWlsZWRXb3JrZmxvd0V4Y2VwdGlvbiBleHRlbmRzIEVycm9yIHt9XG5cbmNsYXNzIFVJUElNZXNzYWdlIHtcblxuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHtVSU1lc3NhZ2V9IHVpTWVzc2FnZVxuXHQgKi9cblx0Y29uc3RydWN0b3IodWlNZXNzYWdlKSB7XG5cdFx0dGhpcy5fdWlNZXNzYWdlID0gdWlNZXNzYWdlXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHJldHVybnMge1Byb21pc2U8Ym9vbGVhbj59XG5cdCAqL1xuXHRhc3luYyB1bnNlbmQoKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIlVJUElNZXNzYWdlIHVuc2VuZFwiKVxuXHRcdGxldCBhY3Rpb25CdXR0b25cblx0XHRsZXQgYWN0aW9uc01lbnVFbGVtZW50XG5cdFx0dHJ5IHtcblx0XHRcdHRoaXMudWlNZXNzYWdlLnNjcm9sbEludG9WaWV3KClcblx0XHRcdGFjdGlvbkJ1dHRvbiA9IGF3YWl0IHRoaXMudWlNZXNzYWdlLnNob3dBY3Rpb25zTWVudUJ1dHRvbigpXG5cdFx0XHRhY3Rpb25zTWVudUVsZW1lbnQgPSBhd2FpdCB0aGlzLnVpTWVzc2FnZS5vcGVuQWN0aW9uc01lbnUoYWN0aW9uQnV0dG9uKVxuXHRcdFx0Y29uc29sZS5kZWJ1ZyhcImFjdGlvbnNNZW51RWxlbWVudFwiLCBhY3Rpb25zTWVudUVsZW1lbnQpXG5cdFx0XHRjb25zdCBkaWFsb2dCdXR0b24gPSBhd2FpdCB0aGlzLnVpTWVzc2FnZS5vcGVuQ29uZmlybVVuc2VuZE1vZGFsKClcblx0XHRcdGlmKHRoaXMudWlNZXNzYWdlLnJvb3Qub2xkUmVtb3ZlKSB7XG5cdFx0XHRcdHRoaXMudWlNZXNzYWdlLnJvb3QucmVtb3ZlID0gdGhpcy51aU1lc3NhZ2Uucm9vdC5vbGRSZW1vdmVcblx0XHRcdH1cblx0XHRcdGF3YWl0IHRoaXMudWlNZXNzYWdlLmNvbmZpcm1VbnNlbmQoZGlhbG9nQnV0dG9uKVxuXHRcdFx0dGhpcy51aU1lc3NhZ2Uucm9vdC5zZXRBdHRyaWJ1dGUoXCJkYXRhLWlkbXUtdW5zZW50XCIsIFwiXCIpXG5cdFx0XHRyZXR1cm4gdHJ1ZVxuXHRcdH0gY2F0Y2goZXgpIHtcblx0XHRcdGNvbnNvbGUuZXJyb3IoZXgpXG5cdFx0XHRpZihhY3Rpb25CdXR0b24gJiYgYWN0aW9uc01lbnVFbGVtZW50KSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMudWlNZXNzYWdlLmNsb3NlQWN0aW9uc01lbnUoYWN0aW9uQnV0dG9uLCBhY3Rpb25zTWVudUVsZW1lbnQpXG5cdFx0XHR9XG5cdFx0XHRhd2FpdCB0aGlzLnVpTWVzc2FnZS5oaWRlQWN0aW9uTWVudUJ1dHRvbigpXG5cdFx0XHR0aHJvdyBuZXcgRmFpbGVkV29ya2Zsb3dFeGNlcHRpb24oXCJGYWlsZWQgdG8gZXhlY3V0ZSB3b3JrZmxvdyBmb3IgdGhpcyBtZXNzYWdlXCIpXG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIEB0eXBlIHtVSU1lc3NhZ2V9XG5cdCAqL1xuXHRnZXQgdWlNZXNzYWdlKCkge1xuXHRcdHJldHVybiB0aGlzLl91aU1lc3NhZ2Vcblx0fVxuXG59XG5cbmV4cG9ydCBkZWZhdWx0IFVJUElNZXNzYWdlXG4iLCJpbXBvcnQgVUlDb21wb25lbnQgZnJvbSBcIi4vdWktY29tcG9uZW50LmpzXCJcblxuLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLXVudXNlZC12YXJzXG5pbXBvcnQgVUlQSU1lc3NhZ2UgZnJvbSBcIi4uL3VpcGkvdWlwaS1tZXNzYWdlLmpzXCJcblxuY2xhc3MgVUkgZXh0ZW5kcyBVSUNvbXBvbmVudCB7XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBhYnN0cmFjdFxuXHQgKiBAcmV0dXJucyB7VUl9XG5cdCAqL1xuXHRzdGF0aWMgY3JlYXRlKCkge1xuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBhYnN0cmFjdFxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZX1cblx0ICovXG5cdGFzeW5jIGZldGNoQW5kUmVuZGVyVGhyZWFkTmV4dE1lc3NhZ2VQYWdlKCkge1xuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBhYnN0cmFjdFxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZTxVSVBJTWVzc2FnZVtdPn1cblx0ICovXG5cdGFzeW5jIGNyZWF0ZVVJUElNZXNzYWdlcygpIHtcblx0fVxuXG59XG5cbmV4cG9ydCBkZWZhdWx0IFVJXG4iLCIvKiogQG1vZHVsZSBkb20tbG9va3VwIFV0aWxzIG1vZHVsZSBmb3IgbG9va2luZyB1cCBlbGVtZW50cyBvbiB0aGUgZGVmYXVsdCBVSSAqL1xuXG5pbXBvcnQgVUlNZXNzYWdlIGZyb20gXCIuL3VpLW1lc3NhZ2UuanNcIlxuaW1wb3J0IHsgd2FpdEZvckVsZW1lbnQgfSBmcm9tIFwiLi4vLi4vZG9tL2FzeW5jLWV2ZW50cy5qc1wiXG5cbi8qKlxuICpcbiAqIEBwYXJhbSB7RWxlbWVudH0gcm9vdFxuICogQHJldHVybnMge1Byb21pc2U8RWxlbWVudFtdPn1cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGZpbmRNZXNzYWdlcyhyb290KSB7XG5cdGNvbnN0IGVsZW1lbnRzID0gWy4uLnJvb3QucXVlcnlTZWxlY3RvckFsbChcImRpdltyb2xlPXJvd106bm90KFtkYXRhLWlkbXUtaWdub3JlXSlcIildXG5cdGNvbnNvbGUuZGVidWcoXCJmaW5kTWVzc2FnZXMgZWxlbWVudHMgXCIsIGVsZW1lbnRzKVxuXHRjb25zdCBtZXNzYWdlRWxlbWVudHMgPSBbXVxuXHRmb3IoY29uc3QgZWxlbWVudCBvZiBlbGVtZW50cykge1xuXHRcdGNvbnN0IGlzTXlPd25NZXNzYWdlID0gYXdhaXQgVUlNZXNzYWdlLmlzTXlPd25NZXNzYWdlKGVsZW1lbnQpXG5cdFx0aWYoaXNNeU93bk1lc3NhZ2UpIHtcblx0XHRcdGNvbnNvbGUuZGVidWcoXCJmaW5kTWVzc2FnZXMgYWRkaW5nIFwiLCBlbGVtZW50KVxuXHRcdFx0bWVzc2FnZUVsZW1lbnRzLnB1c2goZWxlbWVudClcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc29sZS5kZWJ1ZyhcImZpbmRNZXNzYWdlcyBpZ25vcmluZyBcIiwgZWxlbWVudClcblx0XHRcdGVsZW1lbnQuc2V0QXR0cmlidXRlKFwiZGF0YS1pZG11LWlnbm9yZVwiLCBcIlwiKVxuXHRcdH1cblx0fVxuXHRjb25zb2xlLmRlYnVnKFwiZmluZE1lc3NhZ2VzIGhpdHNcIiwgbWVzc2FnZUVsZW1lbnRzKVxuXHRyZXR1cm4gbWVzc2FnZUVsZW1lbnRzXG59XG5cbi8qKlxuICpcbiAqIEBwYXJhbSB7V2luZG93fSB3aW5kb3dcbiAqIEByZXR1cm5zIHtIVE1MRGl2RWxlbWVudH1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGZpbmRNZXNzYWdlc1dyYXBwZXIod2luZG93KSB7XG5cdHJldHVybiB3aW5kb3cuZG9jdW1lbnQucXVlcnlTZWxlY3RvcihcImRpdltyb2xlPWdyaWRdID4gZGl2ID4gZGl2ID4gZGl2ID4gZGl2XCIpXG59XG5cbi8qKlxuICpcbiAqIEBwYXJhbSB7RWxlbWVudH0gcm9vdFxuICogQHJldHVybnMge1Byb21pc2U8Ym9vbGVhbj59XG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBsb2FkTW9yZU1lc3NhZ2VzKHJvb3QpIHtcblx0Y29uc29sZS5kZWJ1ZyhcImxvYWRNb3JlTWVzc2FnZXNcIilcblx0cm9vdC5zY3JvbGxUb3AgPSAwXG5cdGxldCBmaW5kTG9hZGVyVGltZW91dFxuXHRjb25zb2xlLmRlYnVnKFwibG9hZE1vcmVNZXNzYWdlcyBsb29raW5nIGZvciBsb2FkZXIuLi4gXCIpXG5cdGNvbnN0IGNvbnRyb2xsZXIgPSBuZXcgQWJvcnRDb250cm9sbGVyKClcblx0bGV0IGxvYWRpbmdFbGVtZW50XG5cdHRyeSB7XG5cdFx0bG9hZGluZ0VsZW1lbnQgPSBhd2FpdCBQcm9taXNlLnJhY2UoW1xuXHRcdFx0d2FpdEZvckVsZW1lbnQocm9vdCwgKCkgPT4ge1xuXHRcdFx0XHRpZihyb290LnF1ZXJ5U2VsZWN0b3IoYFtyb2xlPXByb2dyZXNzYmFyXWApID09PSBudWxsKSB7XG5cdFx0XHRcdFx0cm9vdC5zY3JvbGxUb3AgPSAwXG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHJvb3QucXVlcnlTZWxlY3RvcihgW3JvbGU9cHJvZ3Jlc3NiYXJdYClcblx0XHRcdH0sIGNvbnRyb2xsZXIpLFxuXHRcdFx0bmV3IFByb21pc2UocmVzb2x2ZSA9PiB7XG5cdFx0XHRcdGZpbmRMb2FkZXJUaW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiB7IC8vIFRPRE8gUmVwbGFjZSB3aXRoIGZldGNoIG92ZXJyaWRlXG5cdFx0XHRcdFx0Y29udHJvbGxlci5hYm9ydCgpXG5cdFx0XHRcdFx0cmVzb2x2ZSgpXG5cdFx0XHRcdH0sIDEwMDAwKSAvLyBJRE1VX1NDUk9MTF9ERVRFQ1RJT05fVElNRU9VVFxuXHRcdFx0fSlcblx0XHRdKVxuXHR9IGNhdGNoKGV4KSB7XG5cdFx0Y29uc29sZS5lcnJvcihleClcblx0fVxuXHRjbGVhclRpbWVvdXQoZmluZExvYWRlclRpbWVvdXQpXG5cdGlmKGxvYWRpbmdFbGVtZW50KSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcImxvYWRNb3JlTWVzc2FnZXM6IEZvdW5kIGxvYWRlcjsgU3RhbmQtYnkgdW50aWwgaXQgaXMgcmVtb3ZlZFwiKVxuXHRcdGNvbnNvbGUuZGVidWcoXCJsb2FkTW9yZU1lc3NhZ2VzOiBzY3JvbGxUb3BcIiwgcm9vdC5zY3JvbGxUb3ApXG5cdFx0YXdhaXQgd2FpdEZvckVsZW1lbnQocm9vdCwgKCkgPT4gcm9vdC5xdWVyeVNlbGVjdG9yKGBbcm9sZT1wcm9ncmVzc2Jhcl1gKSA9PT0gbnVsbClcblx0XHRjb25zb2xlLmRlYnVnKFwibG9hZE1vcmVNZXNzYWdlczogTG9hZGVyIHdhcyByZW1vdmVkLCBvbGRlciBtZXNzYWdlcyBsb2FkaW5nIGNvbXBsZXRlZFwiKVxuXHRcdGNvbnNvbGUuZGVidWcoYGxvYWRNb3JlTWVzc2FnZXM6IHNjcm9sbFRvcCBpcyAke3Jvb3Quc2Nyb2xsVG9wfSB3ZSAke3Jvb3Quc2Nyb2xsVG9wID09PSAwID8gXCJyZWFjaGVkIGxhc3QgcGFnZVwiIDogXCJkaWQgbm90IHJlYWNoIGxhc3QgcGFnZSBhbmQgd2lsbCBiZWdpbiBsb2FkaW5nIG9sZGVyIG1lc3NhZ2VzIHNob3J0bHlcIn1gLCApXG5cdFx0Y29uc3QgZG9uZSA9IHJvb3Quc2Nyb2xsVG9wID09PSAwXG5cdFx0aWYoZG9uZSkge1xuXHRcdFx0cm9vdC5zY3JvbGxUb3AgPSByb290LnNjcm9sbEhlaWdodCAtIHJvb3QuY2xpZW50SGVpZ2h0XG5cdFx0fVxuXHRcdHJldHVybiBkb25lXG5cdH0gZWxzZSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcImxvYWRNb3JlTWVzc2FnZXM6IENvdWxkIG5vdCBmaW5kIGxvYWRlclwiKVxuXHRcdHJldHVybiB0cnVlXG5cdH1cbn1cbiIsIi8qKiBAbW9kdWxlIHVpLW1lc3NhZ2VzLXdyYXBwZXIgVUkgZWxlbWVudCByZXByZXNlbnRpbmcgdGhlIG1lc3NhZ2VzIHdyYXBwZXIgKi9cblxuaW1wb3J0IHsgbG9hZE1vcmVNZXNzYWdlcyB9IGZyb20gXCIuL2RvbS1sb29rdXAuanNcIlxuaW1wb3J0IFVJQ29tcG9uZW50IGZyb20gXCIuLi91aS1jb21wb25lbnQuanNcIlxuXG5jbGFzcyBVSU1lc3NhZ2VzV3JhcHBlciBleHRlbmRzIFVJQ29tcG9uZW50IHtcblxuXHQvKipcblx0ICpcblx0ICogQHJldHVybnMge1Byb21pc2V9XG5cdCAqL1xuXHRmZXRjaEFuZFJlbmRlclRocmVhZE5leHRNZXNzYWdlUGFnZSgpIHtcblx0XHRyZXR1cm4gbG9hZE1vcmVNZXNzYWdlcyh0aGlzLnJvb3QpXG5cdH1cblxufVxuXG5leHBvcnQgZGVmYXVsdCBVSU1lc3NhZ2VzV3JhcHBlclxuIiwiLyoqIEBtb2R1bGUgZGVmYXVsdC11aSBEZWZhdWx0IFVJIC8gRW5nbGlzaCBVSSAqL1xuXG5pbXBvcnQgVUkgZnJvbSBcIi4uL3VpLmpzXCJcbmltcG9ydCB7IGZpbmRNZXNzYWdlc1dyYXBwZXIsIGZpbmRNZXNzYWdlcyB9IGZyb20gXCIuL2RvbS1sb29rdXAuanNcIlxuaW1wb3J0IFVJUElNZXNzYWdlIGZyb20gXCIuLi8uLi91aXBpL3VpcGktbWVzc2FnZS5qc1wiXG5pbXBvcnQgVUlNZXNzYWdlIGZyb20gXCIuL3VpLW1lc3NhZ2UuanNcIlxuaW1wb3J0IFVJTWVzc2FnZXNXcmFwcGVyIGZyb20gXCIuL3VpLW1lc3NhZ2VzLXdyYXBwZXIuanNcIlxuXG5jbGFzcyBEZWZhdWx0VUkgZXh0ZW5kcyBVSSB7XG5cblx0LyoqXG5cdCAqIEBwYXJhbSB7V2luZG93fSB3aW5kb3dcblx0ICogQHJldHVybnMge0RlZmF1bHRVSX1cblx0ICovXG5cdHN0YXRpYyBjcmVhdGUod2luZG93KSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIlVJIGNyZWF0ZVwiKVxuXHRcdGNvbnN0IG1lc3NhZ2VzV3JhcHBlckVsZW1lbnQgPSBmaW5kTWVzc2FnZXNXcmFwcGVyKHdpbmRvdylcblx0XHRpZihtZXNzYWdlc1dyYXBwZXJFbGVtZW50ICE9PSBudWxsKSB7XG5cdFx0XHRjb25zb2xlLmRlYnVnKFwiRm91bmQgbWVzc2FnZXNXcmFwcGVyRWxlbWVudFwiLCBtZXNzYWdlc1dyYXBwZXJFbGVtZW50KVxuXHRcdFx0Y29uc3QgdWlNZXNzYWdlc1dyYXBwZXIgPSBuZXcgVUlNZXNzYWdlc1dyYXBwZXIobWVzc2FnZXNXcmFwcGVyRWxlbWVudClcblx0XHRcdHJldHVybiBuZXcgRGVmYXVsdFVJKHdpbmRvdywgeyB1aU1lc3NhZ2VzV3JhcHBlciB9KVxuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCJVbmFibGUgdG8gZmluZCBtZXNzYWdlc1dyYXBwZXJFbGVtZW50XCIpXG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCpcblx0KiBAcmV0dXJucyB7UHJvbWlzZX1cblx0Ki9cblx0YXN5bmMgZmV0Y2hBbmRSZW5kZXJUaHJlYWROZXh0TWVzc2FnZVBhZ2UoKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIlVJIGZldGNoQW5kUmVuZGVyVGhyZWFkTmV4dE1lc3NhZ2VQYWdlXCIpXG5cdFx0cmV0dXJuIGF3YWl0IHRoaXMuaWRlbnRpZmllci51aU1lc3NhZ2VzV3JhcHBlci5mZXRjaEFuZFJlbmRlclRocmVhZE5leHRNZXNzYWdlUGFnZSh0aGlzLmRvbU1hcHBlcilcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZTxVSVBJTWVzc2FnZVtdPn1cblx0ICovXG5cdGFzeW5jIGNyZWF0ZVVJUElNZXNzYWdlcygpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwiVUkgY3JlYXRlVUlQSU1lc3NhZ2VzXCIpXG5cdFx0Y29uc3QgdWlwaU1lc3NhZ2VzID0gW11cblx0XHRjb25zdCBtZXNzYWdlRWxlbWVudHMgPSBhd2FpdCBmaW5kTWVzc2FnZXModGhpcy5pZGVudGlmaWVyLnVpTWVzc2FnZXNXcmFwcGVyLnJvb3QpXG5cdFx0Zm9yKGNvbnN0IG1lc3NhZ2VFbGVtZW50IG9mIG1lc3NhZ2VFbGVtZW50cykge1xuXHRcdFx0Ly8gRklYIEluc3RhZ3JhbSByZW1vdmluZyBtZXNzYWdlcyBmcm9tIHRoZSBET00gYWZ0ZXIgc2Nyb2xsaW5nXG5cdFx0XHRtZXNzYWdlRWxlbWVudC5vbGRSZW1vdmUgPSBtZXNzYWdlRWxlbWVudC5yZW1vdmVcblx0XHRcdG1lc3NhZ2VFbGVtZW50LnJlbW92ZSA9ICgpID0+IHt9XG5cdFx0XHRjb25zdCB1aU1lc3NhZ2UgPSBuZXcgVUlNZXNzYWdlKG1lc3NhZ2VFbGVtZW50KVxuXHRcdFx0dWlwaU1lc3NhZ2VzLnB1c2gobmV3IFVJUElNZXNzYWdlKHVpTWVzc2FnZSkpXG5cdFx0fVxuXHRcdHJldHVybiB1aXBpTWVzc2FnZXNcblx0fVxuXG59XG5cbmV4cG9ydCBkZWZhdWx0IERlZmF1bHRVSVxuIiwiLyoqIEBtb2R1bGUgZ2V0LXVpIFVJIGxvYWRlciBtb2R1bGUuIEFsbG93IGxvYWRpbmcgb2YgYSBjZXJ0YWluIFVJIGJhc2VkIG9uIGEgZ2l2ZW4gc3RyYXRlZ3kgKGxvY2FsZSBldGMuLilcbiAqIFRoZXJlIG1pZ2h0IGJlIG5lZWQgZm9yIG11bHRpcGxlIFVJIGFzIEluc3RhZ3JhbSBtaWdodCBzZXJ2ZSBkaWZmZXJlbnQgYXBwcyBiYXNlZCBvbiBsb2NhdGlvbiBmb3IgZXhhbXBsZS5cbiAqIFRoZXJlIGlzIGFsc28gYSBuZWVkIHRvIGludGVybmF0aW9uYWxpemUgZWFjaCB1aSBzbyB0aGF0IGl0IGRvZXNuJ3QgZmFpbCBpZiB3ZSBjaGFuZ2UgdGhlIGxhbmd1YWdlLlxuICovXG5cbmltcG9ydCBEZWZhdWx0VUkgZnJvbSBcIi4vZGVmYXVsdC9kZWZhdWx0LXVpLmpzXCJcblxuLyoqXG4gKlxuICogQHJldHVybnMge0RlZmF1bHRVSX1cbiAqL1xuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gZ2V0VUkoKSB7XG5cdHJldHVybiBEZWZhdWx0VUlcbn1cbiIsIi8qKiBAbW9kdWxlIHVpcGkgQVBJIGZvciBVSSAqL1xuXG5pbXBvcnQgZ2V0VUkgZnJvbSBcIi4uL3VpL2dldC11aS5qc1wiXG5cbi8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby11bnVzZWQtdmFyc1xuaW1wb3J0IFVJIGZyb20gXCIuLi91aS91aS5qc1wiXG4vLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tdW51c2VkLXZhcnNcbmltcG9ydCBVSVBJTWVzc2FnZSBmcm9tIFwiLi91aXBpLW1lc3NhZ2UuanNcIlxuXG4vKipcbiAqIFVJIEludGVyZmFjZSBBUElcbiAqL1xuY2xhc3MgVUlQSSB7XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7VUl9IHVpXG5cdCAqL1xuXHRjb25zdHJ1Y3Rvcih1aSkge1xuXHRcdHRoaXMuX3VpID0gdWlcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge1dpbmRvd30gd2luZG93XG5cdCAqIEByZXR1cm5zIHtVSVBJfVxuXHQgKi9cblx0c3RhdGljIGNyZWF0ZSh3aW5kb3cpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwiVUlQSS5jcmVhdGVcIilcblx0XHRjb25zdCB1aSA9IGdldFVJKCkuY3JlYXRlKHdpbmRvdylcblx0XHRyZXR1cm4gbmV3IFVJUEkodWkpXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHJldHVybnMge1Byb21pc2V9XG5cdCAqL1xuXHRmZXRjaEFuZFJlbmRlclRocmVhZE5leHRNZXNzYWdlUGFnZSgpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwiVUlQSSBmZXRjaEFuZFJlbmRlclRocmVhZE5leHRNZXNzYWdlUGFnZVwiKVxuXHRcdHJldHVybiB0aGlzLnVpLmZldGNoQW5kUmVuZGVyVGhyZWFkTmV4dE1lc3NhZ2VQYWdlKClcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZTxVSVBJTWVzc2FnZVtdPn1cblx0ICovXG5cdGNyZWF0ZVVJUElNZXNzYWdlcygpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwiVUlQSSBjcmVhdGVVSVBJTWVzc2FnZXNcIilcblx0XHRyZXR1cm4gdGhpcy51aS5jcmVhdGVVSVBJTWVzc2FnZXMoKVxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEB0eXBlIHtVSX1cblx0ICovXG5cdGdldCB1aSgpIHtcblx0XHRyZXR1cm4gdGhpcy5fdWlcblx0fVxuXG59XG5cbmV4cG9ydCBkZWZhdWx0IFVJUElcbiIsIi8qKiBAbW9kdWxlIGlkbXUgR2xvYmFsL01haW4gQVBJIGZvciBpbnRlcmFjdGluZyB3aXRoIHRoZSBVSSAqL1xuXG5pbXBvcnQgVUlQSSBmcm9tIFwiLi4vdWlwaS91aXBpLmpzXCJcblxuLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLXVudXNlZC12YXJzXG5pbXBvcnQgVUlQSU1lc3NhZ2UgZnJvbSBcIi4uL3VpcGkvdWlwaS1tZXNzYWdlLmpzXCJcblxuY2xhc3MgSURNVSB7XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7V2luZG93fSB3aW5kb3dcblx0ICogQHBhcmFtIHtjYWxsYmFja30gb25TdGF0dXNUZXh0XG5cdCAqL1xuXHRjb25zdHJ1Y3Rvcih3aW5kb3csIG9uU3RhdHVzVGV4dCkge1xuXHRcdHRoaXMud2luZG93ID0gd2luZG93XG5cdFx0dGhpcy51aXBpID0gbnVsbFxuXHRcdHRoaXMub25TdGF0dXNUZXh0ID0gb25TdGF0dXNUZXh0XG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHJldHVybnMge1Byb21pc2U8VUlQSU1lc3NhZ2VbXT59XG5cdCAqL1xuXHRjcmVhdGVVSVBJTWVzc2FnZXMoKSB7XG5cdFx0cmV0dXJuIHRoaXMuI2dldFVJUEkoKS5jcmVhdGVVSVBJTWVzc2FnZXMoKVxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0XG5cdCAqL1xuXHRzZXRTdGF0dXNUZXh0KHRleHQpIHtcblx0XHR0aGlzLm9uU3RhdHVzVGV4dCh0ZXh0KVxuXHR9XG5cblxuXHQvKipcblx0ICpcblx0ICogQHJldHVybnMge1Byb21pc2V9XG5cdCAqL1xuXHRmZXRjaEFuZFJlbmRlclRocmVhZE5leHRNZXNzYWdlUGFnZSgpIHtcblx0XHRyZXR1cm4gdGhpcy4jZ2V0VUlQSSgpLmZldGNoQW5kUmVuZGVyVGhyZWFkTmV4dE1lc3NhZ2VQYWdlKClcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcmV0dXJucyB7VUlQSX1cblx0ICovXG5cdCNnZXRVSVBJKCkge1xuXHRcdGlmKHRoaXMudWlwaSA9PT0gbnVsbCkge1xuXHRcdFx0dGhpcy51aXBpID0gVUlQSS5jcmVhdGUodGhpcy53aW5kb3cpXG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLnVpcGlcblx0fVxuXG5cbn1cbmV4cG9ydCBkZWZhdWx0IElETVVcbiIsIi8qKiBAbW9kdWxlIHVuc2VuZC1zdHJhdGVneSBWYXJpb3VzIHN0cmF0ZWdpZXMgZm9yIHVuc2VuZGluZyBtZXNzYWdlcyAqL1xuXG4vLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tdW51c2VkLXZhcnNcbmltcG9ydCBJRE1VIGZyb20gXCIuLi8uLi9pZG11L2lkbXUuanNcIlxuXG5jbGFzcyBVbnNlbmRTdHJhdGVneSB7XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7SURNVX0gaWRtdVxuXHQgKi9cblx0Y29uc3RydWN0b3IoaWRtdSkge1xuXHRcdHRoaXMuX2lkbXUgPSBpZG11XG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQGFic3RyYWN0XG5cdCAqIEByZXR1cm5zIHtib29sZWFufVxuXHQgKi9cblx0aXNSdW5uaW5nKCkge1xuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBhYnN0cmFjdFxuXHQgKi9cblx0c3RvcCgpIHtcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAYWJzdHJhY3Rcblx0ICovXG5cdGFzeW5jIHJ1bigpIHtcblx0fVxuXG5cdC8qKlxuXHQgKiBAcmVhZG9ubHlcblx0ICogQHR5cGUge0lETVV9XG5cdCAqL1xuXHRnZXQgaWRtdSgpIHtcblx0XHRyZXR1cm4gdGhpcy5faWRtdVxuXHR9XG5cbn1cblxuXG4vKipcbiAqIExvYWRzIG11bHRpcGxlIHBhZ2VzIGJlZm9yZSB1bnNlbmRpbmcgbWVzc2FnZVxuICovXG5jbGFzcyBEZWZhdWx0U3RyYXRlZ3kgZXh0ZW5kcyBVbnNlbmRTdHJhdGVneSB7XG5cblxuXG5cdC8qKlxuXHQgKiBAcGFyYW0ge0lETVV9IGlkbXVcblx0ICovXG5cdGNvbnN0cnVjdG9yKGlkbXUpIHtcblx0XHRzdXBlcihpZG11KVxuXHRcdHRoaXMuX3J1bm5pbmcgPSBmYWxzZVxuXHRcdHRoaXMuX3N0b3BwZWQgPSBmYWxzZVxuXHRcdHRoaXMuX3Vuc2VudENvdW50ZXIgPSAwXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHJldHVybnMge2Jvb2xlYW59XG5cdCAqL1xuXHRpc1J1bm5pbmcoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX3J1bm5pbmcgJiYgIXRoaXMuX3N0b3BwZWRcblx0fVxuXG5cdHN0b3AoKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIkRlZmF1bHRTdHJhdGVneSBzdG9wXCIpXG5cdFx0dGhpcy5fc3RvcHBlZCA9IHRydWVcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZX1cblx0ICovXG5cdHJ1bigpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwiRGVmYXVsdFN0cmF0ZWd5LnJ1bigpXCIpXG5cdFx0dGhpcy5fcnVubmluZyA9IHRydWVcblx0XHR0aGlzLl9zdG9wcGVkID0gZmFsc2Vcblx0XHR0aGlzLl91bnNlbnRDb3VudGVyID0gMFxuXHRcdHJldHVybiB0aGlzLiNuZXh0KClcblx0fVxuXG5cdGFzeW5jICNuZXh0KCkge1xuXHRcdGxldCBkb25lID0gZmFsc2Vcblx0XHQvLyBGaW5kIG91dCBpZiB3ZSBjYW4gbG9hZCBhbm90aGVyIHBhZ2Ugb2YgbWVzc2FnZXNcblx0XHR0cnkge1xuXHRcdFx0dGhpcy5pZG11LnNldFN0YXR1c1RleHQoXCJTZWFyY2hpbmcgZm9yIG1lc3NhZ2VzLi4uXCIpXG5cdFx0XHRjb25zdCB1aXBpTWVzc2FnZXMgPSBhd2FpdCB0aGlzLmlkbXUuY3JlYXRlVUlQSU1lc3NhZ2VzKClcblx0XHRcdHVpcGlNZXNzYWdlcy5yZXZlcnNlKClcblx0XHRcdGlmKHVpcGlNZXNzYWdlcy5sZW5ndGggPj0gMSkge1xuXHRcdFx0XHRmb3IoY29uc3QgdWlwaU1lc3NhZ2Ugb2YgdWlwaU1lc3NhZ2VzKSB7XG5cdFx0XHRcdFx0dGhpcy5pZG11LnNldFN0YXR1c1RleHQoYEZvdW5kICR7dWlwaU1lc3NhZ2VzLmxlbmd0aH0gbWVzc2FnZXMsIHVuc2VuZGluZy4uLmApXG5cdFx0XHRcdFx0aWYodGhpcy5fc3RvcHBlZCkge1xuXHRcdFx0XHRcdFx0YnJlYWtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRcdGF3YWl0IHVpcGlNZXNzYWdlLnVuc2VuZCgpXG5cdFx0XHRcdFx0XHR0aGlzLl91bnNlbnRDb3VudGVyKytcblx0XHRcdFx0XHRcdHRoaXMuaWRtdS5zZXRTdGF0dXNUZXh0KFwiV2FpdGluZyAxIHNlY29uZCBiZWZvcmUgdW5zZW5kaW5nIG5leHQgbWVzc2FnZS4uLlwiKVxuXHRcdFx0XHRcdFx0YXdhaXQgbmV3IFByb21pc2UocmVzb2x2ZSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIDEwMDApKSAvLyBJRE1VX01FU1NBR0VfUVVFVUVfREVMQVlcblx0XHRcdFx0XHR9IGNhdGNoKHJlc3VsdCkge1xuXHRcdFx0XHRcdFx0Y29uc29sZS5lcnJvcihyZXN1bHQpXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLmlkbXUuc2V0U3RhdHVzVGV4dChcIk5vIG1vcmUgbWVzc2FnZXM7IFNlYXJjaGluZyBmb3IgYWRkaXRpb25hbCBwYWdlcy4uLlwiKVxuXHRcdFx0XHRjb25zb2xlLmRlYnVnKFwiTm8gbW9yZSBtZXNzYWdlczsgZmV0Y2hBbmRSZW5kZXJUaHJlYWROZXh0TWVzc2FnZVBhZ2VcIiwgZG9uZSlcblx0XHRcdFx0Y29uc3QgaGFzTW9yZU1lc3NhZ2VzID0gKGF3YWl0IHRoaXMuaWRtdS5jcmVhdGVVSVBJTWVzc2FnZXMoKSkubGVuZ3RoID49IDFcblx0XHRcdFx0ZG9uZSA9IGhhc01vcmVNZXNzYWdlcyA9PT0gZmFsc2UgJiYgKGF3YWl0IHRoaXMuaWRtdS5mZXRjaEFuZFJlbmRlclRocmVhZE5leHRNZXNzYWdlUGFnZSgpKVxuXHRcdFx0fVxuXHRcdH0gY2F0Y2goZXgpIHtcblx0XHRcdGNvbnNvbGUuZXJyb3IoZXgpXG5cdFx0fVxuXHRcdGlmKGRvbmUpIHtcblx0XHRcdHRoaXMuaWRtdS5zZXRTdGF0dXNUZXh0KGBEb25lLiAke3RoaXMuX3Vuc2VudENvdW50ZXJ9IG1lc3NhZ2VzIHVuc2VudC5gKVxuXHRcdFx0Y2xlYXJJbnRlcnZhbCh0aGlzLmludGVydmFsKVxuXHRcdFx0dGhpcy5fcnVubmluZyA9IGZhbHNlXG5cdFx0XHRjb25zb2xlLmRlYnVnKFwiRGVmYXVsdFN0cmF0ZWd5IGRvbmVcIilcblx0XHR9IGVsc2UgaWYoIXRoaXMuX3N0b3BwZWQpIHsgLy8gVHJ5IHRvIGxvYWQgdGhlIG5leHQgcGFnZSBpZiB0aGVyZSBpcyBhbnlcblx0XHRcdHRoaXMuaWRtdS5zZXRTdGF0dXNUZXh0KFwiV2FpdGluZyAxIHNlY29uZCBiZWZvcmUgbmV4dCBpdGVyYXRpb24uLi5cIilcblx0XHRcdGF3YWl0IG5ldyBQcm9taXNlKHJlc29sdmUgPT4gc2V0VGltZW91dChyZXNvbHZlLCAxMDAwKSkgLy8gSURNVV9ORVhUX01FU1NBR0VfUEFHRV9ERUxBWVxuXHRcdFx0cmV0dXJuIHRoaXMuI25leHQoKVxuXHRcdH1cblx0fVxuXG59XG5cbmV4cG9ydCB7IFVuc2VuZFN0cmF0ZWd5LCBEZWZhdWx0U3RyYXRlZ3kgfVxuIiwiLyoqIEBtb2R1bGUgYWxlcnQgQWxlcnQgVUkgKi9cblxuLyoqXG4gKlxuICogQHBhcmFtIHtEb2N1bWVudH0gZG9jdW1lbnRcbiAqIEByZXR1cm5zIHtIVE1MQnV0dG9uRWxlbWVudH1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUFsZXJ0c1dyYXBwZXJFbGVtZW50KGRvY3VtZW50KSB7XG5cdGNvbnN0IGFsZXJ0c1dyYXBwZXJFbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKVxuXHRhbGVydHNXcmFwcGVyRWxlbWVudC5pZCA9IFwiaWRtdS1hbGVydHNcIlxuXHRhbGVydHNXcmFwcGVyRWxlbWVudC5zdHlsZS5wb3NpdGlvbiA9IFwiZml4ZWRcIlxuXHRhbGVydHNXcmFwcGVyRWxlbWVudC5zdHlsZS50b3AgPSBcIjIwcHhcIlxuXHRhbGVydHNXcmFwcGVyRWxlbWVudC5zdHlsZS5yaWdodCA9IFwiMjBweFwiXG5cdGFsZXJ0c1dyYXBwZXJFbGVtZW50LnN0eWxlLmRpc3BsYXkgPSBcImdyaWRcIlxuXHRyZXR1cm4gYWxlcnRzV3JhcHBlckVsZW1lbnRcbn1cblxuLyoqXG4gKlxuICogQHBhcmFtIHtEb2N1bWVudH0gZG9jdW1lbnRcbiAqIEBwYXJhbSB7c3RyaW5nfSAgIHRleHRcbiAqIEByZXR1cm5zIHtIVE1MQnV0dG9uRWxlbWVudH1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUFsZXJ0RWxlbWVudChkb2N1bWVudCwgdGV4dCkge1xuXHRjb25zdCBhbGVydEVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpXG5cdGFsZXJ0RWxlbWVudC50ZXh0Q29udGVudCA9IHRleHRcblx0cmV0dXJuIGFsZXJ0RWxlbWVudFxufVxuIiwiLyoqIEBtb2R1bGUgb3ZlcmxheSBJRE1VJ3Mgb3ZlcmxheSAqL1xuXG4vKipcbiAqIEBwYXJhbSB7RG9jdW1lbnR9IGRvY3VtZW50XG4gKiBAcmV0dXJucyB7SFRNTERpdkVsZW1lbnR9XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVPdmVybGF5RWxlbWVudChkb2N1bWVudCkge1xuXHRjb25zdCBvdmVybGF5RWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIilcblx0b3ZlcmxheUVsZW1lbnQuaWQgPSBcImlkbXUtb3ZlcmxheVwiXG5cdG92ZXJsYXlFbGVtZW50LnRhYkluZGV4ID0gMFxuXHRvdmVybGF5RWxlbWVudC5zdHlsZS50b3AgPSBcIjBcIlxuXHRvdmVybGF5RWxlbWVudC5zdHlsZS5yaWdodCA9IFwiMFwiXG5cdG92ZXJsYXlFbGVtZW50LnN0eWxlLnBvc2l0aW9uID0gXCJmaXhlZFwiXG5cdG92ZXJsYXlFbGVtZW50LnN0eWxlLndpZHRoID0gXCIxMDB2d1wiXG5cdG92ZXJsYXlFbGVtZW50LnN0eWxlLmhlaWdodCA9IFwiMTAwdmhcIlxuXHRvdmVybGF5RWxlbWVudC5zdHlsZS56SW5kZXggPSBcIjk5OFwiXG5cdG92ZXJsYXlFbGVtZW50LnN0eWxlLmJhY2tncm91bmRDb2xvciA9IFwiIzAwMDAwMGQ2XCJcblx0b3ZlcmxheUVsZW1lbnQuc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiXG5cdHJldHVybiBvdmVybGF5RWxlbWVudFxufVxuIiwiLyoqIEBtb2R1bGUgdWkgSURNVSdzIG93biB1aS9vdmVybGF5XG4gKiBQcm92aWRlIGEgYnV0dG9uIHRvIHVuc2VuZCBtZXNzYWdlc1xuKi9cblxuaW1wb3J0IHsgY3JlYXRlTWVudUJ1dHRvbkVsZW1lbnQgfSBmcm9tIFwiLi9tZW51LWJ1dHRvbi5qc1wiXG5pbXBvcnQgeyBjcmVhdGVNZW51RWxlbWVudCB9IGZyb20gXCIuL21lbnUuanNcIlxuaW1wb3J0IElETVUgZnJvbSBcIi4uLy4uLy4uL2lkbXUvaWRtdS5qc1wiXG5pbXBvcnQgeyBEZWZhdWx0U3RyYXRlZ3kgfSBmcm9tIFwiLi4vdW5zZW5kLXN0cmF0ZWd5LmpzXCJcbmltcG9ydCB7IGNyZWF0ZUFsZXJ0c1dyYXBwZXJFbGVtZW50IH0gZnJvbSBcIi4vYWxlcnQuanNcIlxuaW1wb3J0IHsgY3JlYXRlT3ZlcmxheUVsZW1lbnQgfSBmcm9tIFwiLi9vdmVybGF5LmpzXCJcbmltcG9ydCB7IEJVVFRPTl9TVFlMRSB9IGZyb20gXCIuL3N0eWxlL2luc3RhZ3JhbS5qc1wiXG5cbi8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby11bnVzZWQtdmFyc1xuaW1wb3J0IHsgVW5zZW5kU3RyYXRlZ3kgfSBmcm9tIFwiLi4vdW5zZW5kLXN0cmF0ZWd5LmpzXCJcblxuY2xhc3MgVUkge1xuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHtEb2N1bWVudH0gZG9jdW1lbnRcblx0ICogQHBhcmFtIHtIVE1MRGl2RWxlbWVudH0gcm9vdFxuXHQgKiBAcGFyYW0ge0hUTUxEaXZFbGVtZW50fSBvdmVybGF5RWxlbWVudFxuXHQgKiBAcGFyYW0ge0hUTUxEaXZFbGVtZW50fSBtZW51RWxlbWVudFxuXHQgKiBAcGFyYW0ge0hUTUxCdXR0b25FbGVtZW50fSB1bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvblxuXHQgKiBAcGFyYW0ge0hUTUxEaXZFbGVtZW50fSBzdGF0dXNFbGVtZW50XG5cdCAqL1xuXHRjb25zdHJ1Y3Rvcihkb2N1bWVudCwgcm9vdCwgb3ZlcmxheUVsZW1lbnQsIG1lbnVFbGVtZW50LCB1bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbiwgc3RhdHVzRWxlbWVudCkge1xuXHRcdHRoaXMuX2RvY3VtZW50ID0gZG9jdW1lbnRcblx0XHR0aGlzLl9yb290ID0gcm9vdFxuXHRcdHRoaXMuX292ZXJsYXlFbGVtZW50ID0gb3ZlcmxheUVsZW1lbnRcblx0XHR0aGlzLl9tZW51RWxlbWVudCA9IG1lbnVFbGVtZW50XG5cdFx0dGhpcy5fc3RhdHVzRWxlbWVudCA9IHN0YXR1c0VsZW1lbnRcblx0XHR0aGlzLl91bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbiA9IHVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uXG5cdFx0dGhpcy5faWRtdSA9IG5ldyBJRE1VKHRoaXMud2luZG93LCB0aGlzLm9uU3RhdHVzVGV4dC5iaW5kKHRoaXMpKVxuXHRcdHRoaXMuX3N0cmF0ZWd5ID0gbmV3IERlZmF1bHRTdHJhdGVneSh0aGlzLl9pZG11KVxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7d2luZG93fSB3aW5kb3dcblx0ICogQHJldHVybnMge1VJfVxuXHQgKi9cblx0c3RhdGljIHJlbmRlcih3aW5kb3cpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwicmVuZGVyXCIpXG5cdFx0Y29uc3QgdWkgPSBVSS5jcmVhdGUod2luZG93LmRvY3VtZW50KVxuXHRcdHdpbmRvdy5kb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHVpLnJvb3QpXG5cdFx0cmV0dXJuIHVpXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHBhcmFtICAge0RvY3VtZW50fSBkb2N1bWVudFxuXHQgKiBAcmV0dXJucyB7VUl9XG5cdCAqL1xuXHRzdGF0aWMgY3JlYXRlKGRvY3VtZW50KSB7XG5cdFx0Y29uc3Qgcm9vdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIilcblx0XHRyb290LmlkID0gXCJpZG11LXJvb3RcIlxuXHRcdGNvbnN0IG1lbnVFbGVtZW50ID0gY3JlYXRlTWVudUVsZW1lbnQoZG9jdW1lbnQpXG5cdFx0Y29uc3Qgb3ZlcmxheUVsZW1lbnQgPSBjcmVhdGVPdmVybGF5RWxlbWVudChkb2N1bWVudClcblx0XHRjb25zdCBhbGVydHNXcmFwcGVyRWxlbWVudCA9IGNyZWF0ZUFsZXJ0c1dyYXBwZXJFbGVtZW50KGRvY3VtZW50KVxuXHRcdGNvbnN0IHVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uID0gY3JlYXRlTWVudUJ1dHRvbkVsZW1lbnQoZG9jdW1lbnQsIFwiVW5zZW5kIGFsbCBETXNcIiwgQlVUVE9OX1NUWUxFLlBSSU1BUlkpXG5cdFx0Y29uc3Qgc3RhdHVzRWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIilcblx0XHRzdGF0dXNFbGVtZW50LnRleHRDb250ZW50ID0gXCJSZWFkeVwiXG5cdFx0c3RhdHVzRWxlbWVudC5pZCA9IFwiaWRtdS1zdGF0dXNcIlxuXHRcdHN0YXR1c0VsZW1lbnQuc3R5bGUgPSBcIndpZHRoOiAyMDBweFwiXG5cdFx0ZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChvdmVybGF5RWxlbWVudClcblx0XHRkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGFsZXJ0c1dyYXBwZXJFbGVtZW50KVxuXHRcdG1lbnVFbGVtZW50LmFwcGVuZENoaWxkKHVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uKVxuXHRcdG1lbnVFbGVtZW50LmFwcGVuZENoaWxkKHN0YXR1c0VsZW1lbnQpXG5cdFx0cm9vdC5hcHBlbmRDaGlsZChtZW51RWxlbWVudClcblx0XHRjb25zdCB1aSA9IG5ldyBVSShkb2N1bWVudCwgcm9vdCwgb3ZlcmxheUVsZW1lbnQsIG1lbnVFbGVtZW50LCB1bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbiwgc3RhdHVzRWxlbWVudClcblx0XHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKFwia2V5ZG93blwiLCAoZXZlbnQpID0+IHVpLiNvbldpbmRvd0tleUV2ZW50KGV2ZW50KSkgLy8gVE9ETyB0ZXN0XG5cdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcImtleXVwXCIsIChldmVudCkgPT4gdWkuI29uV2luZG93S2V5RXZlbnQoZXZlbnQpKSAvLyBUT0RPIHRlc3Rcblx0XHR1bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKGV2ZW50KSA9PiB1aS4jb25VbnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbkNsaWNrKGV2ZW50KSlcblx0XHR0aGlzLl9tdXRhdGlvbk9ic2VydmVyID0gbmV3IE11dGF0aW9uT2JzZXJ2ZXIoKG11dGF0aW9ucykgPT4gdWkuI29uTXV0YXRpb25zKHVpLCBtdXRhdGlvbnMpKVxuXHRcdHRoaXMuX211dGF0aW9uT2JzZXJ2ZXIub2JzZXJ2ZShkb2N1bWVudC5ib2R5LCB7IGNoaWxkTGlzdDogdHJ1ZSB9KSAvLyBUT0RPIHRlc3Rcblx0XHR1bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbi5kYXRhVGV4dENvbnRlbnQgPSB1bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbi50ZXh0Q29udGVudFxuXHRcdHVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uLmRhdGFCYWNrZ3JvdW5kQ29sb3IgPSB1bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbi5zdHlsZS5iYWNrZ3JvdW5kQ29sb3Jcblx0XHRyZXR1cm4gdWlcblx0fVxuXHRhc3luYyAjc3RhcnRVbnNlbmRpbmcoKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIlVzZXIgYXNrZWQgZm9yIG1lc3NhZ2VzIHVuc2VuZGluZyB0byBzdGFydDsgVUkgaW50ZXJhY3Rpb24gd2lsbCBiZSBkaXNhYmxlZCBpbiB0aGUgbWVhbnRpbWVcIilcblx0XHQ7Wy4uLnRoaXMubWVudUVsZW1lbnQucXVlcnlTZWxlY3RvckFsbChcImJ1dHRvblwiKV0uZmlsdGVyKGJ1dHRvbiA9PiBidXR0b24gIT09IHRoaXMudW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24pLmZvckVhY2goYnV0dG9uID0+IHtcblx0XHRcdGJ1dHRvbi5zdHlsZS52aXNpYmlsaXR5ID0gXCJoaWRkZW5cIlxuXHRcdFx0YnV0dG9uLmRpc2FibGVkID0gdHJ1ZVxuXHRcdH0pXG5cdFx0dGhpcy5vdmVybGF5RWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gXCJcIlxuXHRcdHRoaXMub3ZlcmxheUVsZW1lbnQuZm9jdXMoKVxuXHRcdHRoaXMudW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24udGV4dENvbnRlbnQgPSBcIlN0b3AgcHJvY2Vzc2luZ1wiXG5cdFx0dGhpcy51bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbi5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSBcIiNGQTM4M0VcIlxuXHRcdGF3YWl0IHRoaXMuc3RyYXRlZ3kucnVuKClcblx0XHR0aGlzLiNvblVuc2VuZGluZ0ZpbmlzaGVkKClcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge1VJfSB1aVxuXHQgKi9cblx0I29uTXV0YXRpb25zKHVpKSB7XG5cdFx0aWYodWkucm9vdC5vd25lckRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCJbaWRePW1vdW50XSA+IGRpdiA+IGRpdiA+IGRpdlwiKSAhPT0gbnVsbCAmJiB1aSkge1xuXHRcdFx0aWYodGhpcy5fbXV0YXRpb25PYnNlcnZlcikge1xuXHRcdFx0XHR0aGlzLl9tdXRhdGlvbk9ic2VydmVyLmRpc2Nvbm5lY3QoKVxuXHRcdFx0fVxuXHRcdFx0dGhpcy5fbXV0YXRpb25PYnNlcnZlciA9IG5ldyBNdXRhdGlvbk9ic2VydmVyKHVpLiNvbk11dGF0aW9ucy5iaW5kKHRoaXMsIHVpKSlcblx0XHRcdHRoaXMuX211dGF0aW9uT2JzZXJ2ZXIub2JzZXJ2ZSh1aS5yb290Lm93bmVyRG9jdW1lbnQucXVlcnlTZWxlY3RvcihcIltpZF49bW91bnRdID4gZGl2ID4gZGl2ID4gZGl2XCIpLCB7IGNoaWxkTGlzdDogdHJ1ZSwgYXR0cmlidXRlczogdHJ1ZSB9KVxuXHRcdH1cblx0XHRpZih0aGlzLndpbmRvdy5sb2NhdGlvbi5wYXRobmFtZS5zdGFydHNXaXRoKFwiL2RpcmVjdC90L1wiKSkge1xuXHRcdFx0dGhpcy5yb290LnN0eWxlLmRpc3BsYXkgPSBcIlwiXG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMucm9vdC5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCJcblx0XHRcdHRoaXMuc3RyYXRlZ3kuc3RvcCgpXG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7VUl9IHVpXG5cdCAqIEBwYXJhbSB7RXZlbnR9IGV2ZW50XG5cdCAqL1xuXHQjb25VbnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbkNsaWNrKCkge1xuXHRcdGlmKHRoaXMuc3RyYXRlZ3kuaXNSdW5uaW5nKCkpIHtcblx0XHRcdGNvbnNvbGUuZGVidWcoXCJVc2VyIGFza2VkIGZvciBtZXNzYWdlcyB1bnNlbmRpbmcgdG8gc3RvcFwiKVxuXHRcdFx0dGhpcy5zdHJhdGVneS5zdG9wKClcblx0XHRcdHRoaXMuI29uVW5zZW5kaW5nRmluaXNoZWQoKVxuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLiNzdGFydFVuc2VuZGluZygpXG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7RXZlbnR9IGV2ZW50XG5cdCAqIEByZXR1cm5zIHtib29sZWFufVxuXHQgKi9cblx0I29uV2luZG93S2V5RXZlbnQoZXZlbnQpIHtcblx0XHRpZih0aGlzLnN0cmF0ZWd5LmlzUnVubmluZygpKSB7XG5cdFx0XHR0aGlzLndpbmRvdy5hbGVydChcIlVzZXIgaW50ZXJhY3Rpb24gaXMgZGlzYWJsZWQgYXMgdGhlIHVuc2VuZGluZyBpcyBzdGlsbCBydW5uaW5nOyBQbGVhc2Ugc3RvcCB0aGUgZXhlY3V0aW9uIGZpcnN0LlwiKVxuXHRcdFx0ZXZlbnQuc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uKClcblx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KClcblx0XHRcdGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpXG5cdFx0XHR0aGlzLm92ZXJsYXlFbGVtZW50LmZvY3VzKClcblx0XHRcdHJldHVybiBmYWxzZVxuXHRcdH1cblx0fVxuXG5cdCNvblVuc2VuZGluZ0ZpbmlzaGVkKCkge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJyZW5kZXIgb25VbnNlbmRpbmdGaW5pc2hlZFwiKVxuXHRcdDtbLi4udGhpcy5tZW51RWxlbWVudC5xdWVyeVNlbGVjdG9yQWxsKFwiYnV0dG9uXCIpXS5maWx0ZXIoYnV0dG9uID0+IGJ1dHRvbiAhPT0gdGhpcy51bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbikuZm9yRWFjaChidXR0b24gPT4ge1xuXHRcdFx0YnV0dG9uLnN0eWxlLnZpc2liaWxpdHkgPSBcIlwiXG5cdFx0XHRidXR0b24uZGlzYWJsZWQgPSBmYWxzZVxuXHRcdH0pXG5cdFx0dGhpcy51bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbi50ZXh0Q29udGVudCA9IHRoaXMudW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24uZGF0YVRleHRDb250ZW50XG5cdFx0dGhpcy51bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbi5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSB0aGlzLnVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uLmRhdGFCYWNrZ3JvdW5kQ29sb3Jcblx0XHR0aGlzLm92ZXJsYXlFbGVtZW50LnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIlxuXHRcdGlmKCF0aGlzLnN0cmF0ZWd5Ll9zdG9wcGVkKSB7XG5cdFx0XHR0aGlzLndpbmRvdy5hbGVydChcIklETVU6IEZpbmlzaGVkXCIpXG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0XG5cdCAqL1xuXHRvblN0YXR1c1RleHQodGV4dCkge1xuXHRcdHRoaXMuc3RhdHVzRWxlbWVudC50ZXh0Q29udGVudCA9IHRleHRcblx0fVxuXG5cblxuXHQvKipcblx0ICogQHJlYWRvbmx5XG5cdCAqIEB0eXBlIHtEb2N1bWVudH1cblx0ICovXG5cdGdldCBkb2N1bWVudCgpIHtcblx0XHRyZXR1cm4gdGhpcy5fZG9jdW1lbnRcblx0fVxuXG5cdC8qKlxuXHQgKiBAcmVhZG9ubHlcblx0ICogQHR5cGUge1dpbmRvd31cblx0ICovXG5cdGdldCB3aW5kb3coKSB7XG5cdFx0cmV0dXJuIHRoaXMuX2RvY3VtZW50LmRlZmF1bHRWaWV3XG5cdH1cblxuXHQvKipcblx0ICogQHJlYWRvbmx5XG5cdCAqIEB0eXBlIHtIVE1MRGl2RWxlbWVudH1cblx0ICovXG5cdGdldCByb290KCkge1xuXHRcdHJldHVybiB0aGlzLl9yb290XG5cdH1cblxuXHQvKipcblx0ICogQHJlYWRvbmx5XG5cdCAqIEB0eXBlIHtIVE1MRGl2RWxlbWVudH1cblx0ICovXG5cdGdldCBvdmVybGF5RWxlbWVudCgpIHtcblx0XHRyZXR1cm4gdGhpcy5fb3ZlcmxheUVsZW1lbnRcblx0fVxuXG5cdC8qKlxuXHQgKiBAcmVhZG9ubHlcblx0ICogQHR5cGUge0hUTUxEaXZFbGVtZW50fVxuXHQgKi9cblx0Z2V0IG1lbnVFbGVtZW50KCkge1xuXHRcdHJldHVybiB0aGlzLl9tZW51RWxlbWVudFxuXHR9XG5cblx0LyoqXG5cdCAqIEByZWFkb25seVxuXHQgKiBAdHlwZSB7SFRNTEJ1dHRvbkVsZW1lbnR9XG5cdCAqL1xuXHRnZXQgdW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24oKSB7XG5cdFx0cmV0dXJuIHRoaXMuX3Vuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uXG5cdH1cblxuXHQvKipcblx0ICogQHJlYWRvbmx5XG5cdCAqIEB0eXBlIHtIVE1MRGl2RWxlbWVudH1cblx0ICovXG5cdGdldCBzdGF0dXNFbGVtZW50KCkge1xuXHRcdHJldHVybiB0aGlzLl9zdGF0dXNFbGVtZW50XG5cdH1cblxuXHQvKipcblx0ICogQHJlYWRvbmx5XG5cdCAqIEB0eXBlIHtIVE1MQnV0dG9uRWxlbWVudH1cblx0ICovXG5cdGdldCBsb2FkVGhyZWFkTWVzc2FnZXNCdXR0b24oKSB7XG5cdFx0cmV0dXJuIHRoaXMuX2xvYWRUaHJlYWRNZXNzYWdlc0J1dHRvblxuXHR9XG5cblx0LyoqXG5cdCAqIEByZWFkb25seVxuXHQgKiBAdHlwZSB7VW5zZW5kU3RyYXRlZ3l9XG5cdCAqL1xuXHRnZXQgc3RyYXRlZ3koKSB7XG5cdFx0cmV0dXJuIHRoaXMuX3N0cmF0ZWd5XG5cdH1cblxuXHQvKipcblx0ICogQHJlYWRvbmx5XG5cdCAqIEB0eXBlIHtJRE1VfVxuXHQgKi9cblx0Z2V0IGlkbXUoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX2lkbXVcblx0fVxuXG59XG5cbmV4cG9ydCBkZWZhdWx0IFVJXG4iLCIvKiogQG1vZHVsZSBtYWluIE1haW4gbW9kdWxlICovXG5cbmltcG9ydCBVSSBmcm9tIFwiLi91aS91aS5qc1wiXG5cbi8qKlxuICogQHBhcmFtIHtXaW5kb3d9IHdpbmRvd1xuICovXG5leHBvcnQgZnVuY3Rpb24gbWFpbih3aW5kb3cpIHtcblx0VUkucmVuZGVyKHdpbmRvdylcbn1cblxuaWYodHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIikge1xuXHRtYWluKHdpbmRvdylcbn1cbiJdLCJuYW1lcyI6WyJVSSJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQUFBO0FBQ0E7Q0FDTyxNQUFNLFlBQVksR0FBRztDQUM1QixDQUFDLFNBQVMsRUFBRSxTQUFTO0NBQ3JCLENBQUMsV0FBVyxFQUFFLFdBQVc7Q0FDekIsRUFBQztBQUNEO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNPLFNBQVMsZ0JBQWdCLENBQUMsYUFBYSxFQUFFLFNBQVMsRUFBRTtDQUMzRCxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsUUFBUSxHQUFHLDZCQUE0QjtDQUM1RCxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsS0FBSyxHQUFHLFFBQU87Q0FDcEMsQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxNQUFLO0NBQ25DLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxZQUFZLEdBQUcsTUFBSztDQUN6QyxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsT0FBTyxHQUFHLE1BQUs7Q0FDcEMsQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLFVBQVUsR0FBRyxPQUFNO0NBQ3hDLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxNQUFNLEdBQUcsVUFBUztDQUN2QyxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsVUFBVSxHQUFHLCtCQUE4QjtDQUNoRSxDQUFDLEdBQUcsU0FBUyxFQUFFO0NBQ2YsRUFBRSxhQUFhLENBQUMsS0FBSyxDQUFDLGVBQWUsR0FBRyxDQUFDLGFBQWEsRUFBRSxTQUFTLENBQUMsU0FBUyxFQUFDO0NBQzVFLEVBQUU7Q0FDRjs7Q0N4QkE7QUFDQTtBQUVBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDTyxTQUFTLHVCQUF1QixDQUFDLFFBQVEsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFO0NBQ25FLENBQUMsTUFBTSxh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
