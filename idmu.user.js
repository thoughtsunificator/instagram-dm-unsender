
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
// @version				0.6.1
// @updateURL				https://raw.githubusercontent.com/thoughtsunificator/instagram-dm-unsender/userscript/idmu.user.js
// @downloadURL				https://raw.githubusercontent.com/thoughtsunificator/instagram-dm-unsender/userscript/idmu.user.js
// @description				Simple script to unsend all DMs in a thread on instagram.com
// @run-at				document-end
// @include				/^https://(www\.)?instagram\.com/*/

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
	 * @param {AbortController} abortController
	 * @returns {Promise<Element>}
	 */
	function waitForElement(target, getElement, abortController) {
		return new Promise((resolve, reject) => {
			let mutationObserver;
			const abortHandler = () => {
				if(mutationObserver) {
					reject(new DOMException("Aborted: Disconnecting mutation observer...", "AbortError"));
					mutationObserver.disconnect();
				} else {
					reject(new DOMException("Aborted", "AbortError"));
				}
			};
			abortController.signal.addEventListener("abort", abortHandler);
			let element = getElement();
			if(element) {
				resolve(element);
				abortController.signal.removeEventListener("abort", abortHandler);
			} else {
				mutationObserver = new MutationObserver((mutations, observer) => {
					element = getElement(mutations);
					if(element) {
						observer.disconnect();
						resolve(element);
						abortController.signal.removeEventListener("abort", abortHandler);
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
	 * @param {AbortController} abortController
	 * @returns {Element|Promise<Element>}
	 */
	function clickElementAndWaitFor(clickTarget, target, getElement, abortController) {
		const promise = waitForElement(target, getElement, abortController);
		clickTarget.click();
		return getElement() || promise
	}

	/** @module ui-component Base class for any element that is a part of the UI. */


	/**
	 *
	 * @abstract
	 */
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
		 * @param {AbortController} abortController
		 * @returns {Promise<Element>}
		 */
		waitForElement(target, getElement, abortController) {
			return getElement() || waitForElement(target, getElement, abortController)
		}

		/**
		 *
		 * @param {Element} clickTarget
		 * @param {Element} target
		 * @param {function} getElement
		 * @param {AbortController} abortController
		 * @returns {Promise<Element>}
		 */
		clickElementAndWaitFor(clickTarget, target, getElement, abortController) {
			return clickElementAndWaitFor(clickTarget, target, getElement, abortController)
		}

	}

	/** @module ui-message UI element representing a message */


	class UIMessage extends UIComponent {

		/**
		 * @param {AbortController} abortController
		 * @returns {Promise<HTMLButtonElement>}
		 */
		async showActionsMenuButton(abortController) {
			console.debug("Workflow step 1 : showActionsMenuButton", this.root);
			this.root.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
			this.root.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
			this.root.dispatchEvent(new MouseEvent("mousenter", { bubbles: true }));
			const waitAbortController = new AbortController();
			let promiseTimeout;
			const abortHandler = () => {
				waitAbortController.abort();
				clearTimeout(promiseTimeout);
			};
			abortController.signal.addEventListener("abort", abortHandler);
			const actionButton = await Promise.race([
				this.waitForElement(this.root, () => this.root.querySelector("[aria-label^='See more options for message']")?.parentNode, waitAbortController),
				new Promise((resolve, reject) => {
					promiseTimeout = setTimeout(() => reject("Timeout showActionsMenuButton"), 200);
				})
			]);
			waitAbortController.abort();
			clearTimeout(promiseTimeout);
			return actionButton
		}

		/**
		 * @param {AbortController} abortController
		 * @returns {Promise<boolean>}
		 */
		async hideActionMenuButton(abortController) { // FIXME
			console.debug("hideActionMenuButton", this.root);
			this.root.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
			this.root.dispatchEvent(new MouseEvent("mouseout", { bubbles: true }));
			this.root.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true }));
			const waitAbortController = new AbortController();
			let promiseTimeout;
			let resolveTimeout;
			const abortHandler = () => {
				waitAbortController.abort();
				clearTimeout(promiseTimeout);
				if(resolveTimeout) {
					resolveTimeout();
				}
			};
			abortController.signal.addEventListener("abort", abortHandler);
			const result = await Promise.race([
				this.waitForElement(this.root, () => this.root.querySelector("[aria-label=More]") === null, waitAbortController),
				new Promise((resolve, reject) => {
					resolveTimeout = resolve;
					promiseTimeout = setTimeout(() => reject("Timeout hideActionMenuButton"), 200);
				})
			]);
			waitAbortController.abort();
			clearTimeout(promiseTimeout);
			return result
		}

		/**
		 *
		 * @param {HTMLButtonElement} actionButton
		 * @param {AbortController} abortController
		 * @returns {Promise}
		 */
		async openActionsMenu(actionButton, abortController) {
			console.debug("Workflow step 2 : Clicking actionButton and waiting for unsend menu item to appear", actionButton);
			const waitAbortController = new AbortController();
			let promiseTimeout;
			const abortHandler = () => {
				waitAbortController.abort();
				clearTimeout(promiseTimeout);
			};
			abortController.signal.addEventListener("abort", abortHandler);
			const unsendButton = await Promise.race([
				this.clickElementAndWaitFor(
					actionButton,
					this.root.ownerDocument.body,
					(mutations) => {
						if(mutations) {
							const addedNodes = [ ...mutations.map(mutation => [...mutation.addedNodes]) ].flat().filter(node => node.nodeType === 1);
							console.debug("Workflow step 2 : ", addedNodes, addedNodes.find(node => node.textContent.trim().toLocaleLowerCase() === "unsend"));
							for(const addedNode of addedNodes) {
								const node = [...addedNode.querySelectorAll("span,div")].find(node => node.textContent.trim().toLocaleLowerCase() === "unsend" && node.firstChild?.nodeType === 3);
								return node
							}
						}
					},
					waitAbortController
				),
				new Promise((resolve, reject) => {
					promiseTimeout = setTimeout(() => reject("Timeout openActionsMenu"), 200);
				})
			]);
			console.debug("Workflow step 2 : Found unsendButton", unsendButton);
			waitAbortController.abort();
			clearTimeout(promiseTimeout);
			return unsendButton
		}

		/**
		 *
		 * @param {HTMLButtonElement} actionButton
		 * @param {HTMLDivElement} actionsMenuElement
		 * @param {AbortController} abortController
		 * @returns {Promise<boolean>}
		 */
		async closeActionsMenu(actionButton, actionsMenuElement, abortController) {
			console.debug("closeActionsMenu");
			const waitAbortController = new AbortController();
			let promiseTimeout;
			const abortHandler = () => {
				waitAbortController.abort();
				clearTimeout(promiseTimeout);
			};
			abortController.signal.addEventListener("abort", abortHandler);
			const result = await Promise.race([
				this.clickElementAndWaitFor(
					actionButton,
					this.root.ownerDocument.body,
					() => this.root.ownerDocument.body.contains(actionsMenuElement) === false,
					abortController
				),
				new Promise((resolve, reject) => {
					promiseTimeout = setTimeout(() => reject("Timeout openActionsMenu"), 200);
				})
			]);
			waitAbortController.abort();
			clearTimeout(promiseTimeout);
			return result !== null
		}

		/**
		 * Click unsend button
		 * @param {HTMLSpanElement} unsendButton
		 * @param {AbortController} abortController
		 * @returns {Promise<HTMLButtonElement>|Promise<Error>}
		 */
		openConfirmUnsendModal(unsendButton, abortController) {
			console.debug("Workflow step 3 : Clicking unsendButton and waiting for dialog to appear...");
			return this.clickElementAndWaitFor(
				unsendButton,
				this.root.ownerDocument.body,
				() => this.root.ownerDocument.querySelector("[role=dialog] button"),
				abortController
			)
		}

		/**
		 * Click unsend confirm button
		 * @param {HTMLButtonElement} dialogButton
		 * @param {AbortController} abortController
		 * @returns {Promise}
		 */
		async confirmUnsend(dialogButton, abortController) {
			console.debug("Workflow final step : confirmUnsend", dialogButton);
			// wait until confirm button is removed
			await this.clickElementAndWaitFor(
				dialogButton,
				this.root.ownerDocument.body,
				() => this.root.ownerDocument.querySelector("[role=dialog] button") === null,
				abortController
			);
		}

	}

	/** @module uipi-message API for UIMessage */


	class FailedWorkflowException extends Error {}

	class UIPIMessage {

		/**
		 * @param {UIMessage} uiMessage
		 */
		constructor(uiMessage) {
			this._uiMessage = uiMessage;
		}

		/**
		 * @param {AbortController} abortController
		 * @returns {Promise<boolean>}
		 */
		async unsend(abortController) { // TODO abort UIPI / waitForElement etc..
			console.debug("UIPIMessage unsend");
			let actionButton;
			let unsendButton;
			try {
				actionButton = await this.uiMessage.showActionsMenuButton(abortController);
				unsendButton = await this.uiMessage.openActionsMenu(actionButton, abortController);
				console.debug("unsendButton", unsendButton);
				const dialogButton = await this.uiMessage.openConfirmUnsendModal(unsendButton, abortController);
				await this.uiMessage.confirmUnsend(dialogButton, abortController);
				this.uiMessage.root.setAttribute("data-idmu-unsent", "");
				return true
			} catch(ex) {
				console.error(ex);
				this.uiMessage.root.setAttribute("data-idmu-ignore", "");
				throw new FailedWorkflowException("Failed to execute workflow for this message", ex)
			}
		}

		/**
		 * @type {UIMessage}
		 */
		get uiMessage() {
			return this._uiMessage
		}

	}

	/**
	 *
	 * @abstract
	 */
	class UI extends UIComponent {

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
		 * @param {AbortController} abortController
		 * @returns {Promise}
		 */
		/* eslint-disable-next-line no-unused-vars */
		async fetchAndRenderThreadNextMessagePage(abortController) {
		}

		/**
		 *
		 * @abstract
		 * @returns {Promise<UIPIMessage>}
		 */
		async getNextUIPIMessage() {
		}

	}

	/** @module dom-lookup Utils module for looking up elements on the default UI */


	/**
	 *
	 * @param {Element} root
	 * @param {AbortController} abortController
	 * @returns {Promise<Element[]>}
	 */
	function getFirstVisibleMessage(root, abortController) {
		const elements = [...root.querySelectorAll("div[role=row]:not([data-idmu-ignore])")]
			.filter(d => d.textContent.length > 3 && d.textContent.substring(0, 3) === "You");
		elements.reverse();
		console.debug("getFirstVisibleMessage", elements.length, "elements");
		for(const element of elements) {
			if(abortController.signal.aborted) {
				break
			}
			const visibilityCheck = element.checkVisibility({
				visibilityProperty: true,
				contentVisibilityAuto: true,
				opacityProperty: true,
			});
			if(visibilityCheck === false) {
				console.debug("visibilityCheck", visibilityCheck);
				continue
			}
			const isInView = element.getBoundingClientRect().y > 100;
			if(isInView === false) {
				console.debug("isInView", isInView);
				continue
			}
			element.setAttribute("data-idmu-ignore", ""); // Next iteration should not include this message
			console.debug("Message in view, testing workflow...", element);
			return element
		}
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
	 * @param {AbortController} abortController
	 * @returns {Promise<boolean>}
	 */
	async function loadMoreMessages(root, abortController) {
		console.debug("loadMoreMessages looking for loader... ");
		let findLoaderTimeout;
		let loadingElement;
		let resolveTimeout;
		const scrollAbortController = new AbortController(); // Separate abortController to stop scrolling if we can't find the loader in 10s
		const abortHandler = () => {
			scrollAbortController.abort();
			clearTimeout(findLoaderTimeout);
			if(resolveTimeout) {
				resolveTimeout();
			}
		};
		abortController.signal.addEventListener("abort", abortHandler);
		root.scrollTop = 0;
		try {
			loadingElement = await Promise.race([
				waitForElement(root, () => {
					if(root.querySelector(`[role=progressbar]`) === null) {
						root.scrollTop = 0;
					}
					return root.querySelector(`[role=progressbar]`)
				}, scrollAbortController),
				new Promise(resolve => {
					resolveTimeout = resolve;
					findLoaderTimeout = setTimeout(() => { // TODO Replace with fetch override
						resolve();
					}, 10000); // IDMU_SCROLL_DETECTION_TIMEOUT
				})
			]);
		} catch(ex) {
			console.error(ex);
		}
		scrollAbortController.abort(); // If it took more than 10s stop scrolling
		abortController.signal.removeEventListener("abort", abortHandler);
		clearTimeout(findLoaderTimeout);
		if(loadingElement && loadingElement !== true) {
			console.debug("loadMoreMessages: Found loader; Stand-by until it is removed");
			console.debug("loadMoreMessages: scrollTop", root.scrollTop);
			await waitForElement(root, () => root.querySelector(`[role=progressbar]`) === null, abortController);
		}
		console.debug("loadMoreMessages: Loader was removed, older messages loading completed");
		console.debug(`loadMoreMessages: scrollTop is ${root.scrollTop} we ${root.scrollTop === 0 ? "reached last page" : "did not reach last page and will begin loading older messages shortly"}`, );
		return root.scrollTop === 0
	}

	/** @module ui-messages-wrapper UI element representing the messages wrapper */


	class UIMessagesWrapper extends UIComponent {

		/**
		 * @param {AbortController} abortController
		 * @returns {Promise}
		 */
		fetchAndRenderThreadNextMessagePage(abortController) {
			return loadMoreMessages(this.root, abortController)
		}

	}

	/** @module default-ui Default UI / English UI */


	class DefaultUI extends UI {

		constructor(root, identifier={}) {
			super(root, identifier);
			this.lastScrollTop = null;
		}

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
		* @param {AbortController} abortController
		* @returns {Promise}
		*/
		async fetchAndRenderThreadNextMessagePage(abortController) {
			console.debug("UI fetchAndRenderThreadNextMessagePage");
			return await this.identifier.uiMessagesWrapper.fetchAndRenderThreadNextMessagePage(abortController)
		}

		/**
		 * @param {AbortController} abortController
		 * @returns {Promise<UIPIMessage>}
		 */
		async getNextUIPIMessage(abortController) {
			console.debug("UI getNextUIPIMessage", this.lastScrollTop);
			const uiMessagesWrapperRoot = this.identifier.uiMessagesWrapper.root;
			const startScrollTop = this.lastScrollTop || uiMessagesWrapperRoot.scrollHeight - uiMessagesWrapperRoot.clientHeight;
			console.debug("startScrollTop", startScrollTop);
			for(let i = Math.max(1, startScrollTop);i > 0;i = i - 30 ) {
				if(abortController.signal.aborted) {
					break
				}
				this.lastScrollTop = i;
				uiMessagesWrapperRoot.scrollTop = i;
				uiMessagesWrapperRoot.dispatchEvent(new this.root.Event("scroll"));
				console.debug("scroll");
				await new Promise(resolve => setTimeout(resolve, 20));
				try {
					const messageElement = getFirstVisibleMessage(uiMessagesWrapperRoot, abortController);
					if(messageElement) {
						const uiMessage = new UIMessage(messageElement);
						return new UIPIMessage(uiMessage)
					}
				} catch(ex) {
					console.error(ex);
				}
			}
			// TODO throw endOfScrollException
			return false // end of scroll reached
		}

	}

	/** @module get-ui UI loader module. Allow loading of a certain UI based on a given strategy (locale etc..)
	 * There might be need for multiple UI as Instagram might serve different apps based on location for example.
	 * There is also a need to internationalize each ui so that it doesn't fail if we change the language.
	 */


	/**
	 *
	 * @returns {UI}
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
		 * @param {AbortController} abortController
		 * @returns {Promise}
		 */
		fetchAndRenderThreadNextMessagePage(abortController) {
			console.debug("UIPI fetchAndRenderThreadNextMessagePage");
			return this.ui.fetchAndRenderThreadNextMessagePage(abortController)
		}

		/**
		 * @param {AbortController} abortController
		 * @returns {Promise<UIPIMessage>}
		 */
		getNextUIPIMessage(abortController) {
			console.debug("UIPI getNextUIPIMessage");
			return this.ui.getNextUIPIMessage(abortController)
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
		 * @param {AbortController} abortController
		 * @returns {Promise<UIPIMessage>}
		 */
		getNextUIPIMessage(abortController) {
			return this.uipi.getNextUIPIMessage(abortController)
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
		 * @param {AbortController} abortController
		 * @returns {Promise}
		 */
		fetchAndRenderThreadNextMessagePage(abortController) {
			return this.uipi.fetchAndRenderThreadNextMessagePage(abortController)
		}

		/**
		 * Map Instagram UI
		 */
		loadUIPI() {
			console.debug("loadUIPI");
			this.uipi = UIPI.create(this.window);
		}


	}

	/** @module unsend-strategy Various strategies for unsending messages */


	/**
	 *
	 * @abstract
	 */
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
		reset() {
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

	/** @module unsend-strategy Various strategies for unsending messages */


	/**
	 * Loads multiple pages before unsending message
	 */
	class DefaultStrategy extends UnsendStrategy {

		/**
		 * @param {IDMU} idmu
		 */
		constructor(idmu) {
			super(idmu);
			this._allPagesLoaded = false;
			this._unsentCount = 0;
			this._pagesLoadedCount = 0;
			this._running = false;
			this._abortController = null;
			this._lastUnsendDate = null;
		}

		/**
		 *
		 * @returns {boolean}
		 */
		isRunning() {
			return this._running && this._abortController && this._abortController.signal.aborted === false
		}

		stop() {
			console.debug("DefaultStrategy stop");
			this.idmu.setStatusText("Stopping...");
			this._abortController.abort();
		}

		reset() {
			this._allPagesLoaded = false;
			this._unsentCount = 0;
			this._lastUnsendDate = null;
			this._pagesLoadedCount = 0;
			this.idmu.setStatusText("Ready");
		}

		/**
		 *
		 * @returns {Promise}
		 */
		async run() {
			console.debug("DefaultStrategy.run()");
			this._unsentCount = 0;
			this._pagesLoadedCount = 0;
			this._running = true;
			this._abortController = new AbortController();
			this.idmu.loadUIPI();
			try {
				if(this._allPagesLoaded) {
					await this.#unsendNextMessage();
				} else {
					await this.#loadNextPage();
				}
				if(this._abortController.signal.aborted) {
					this.idmu.setStatusText(`Aborted. ${this._unsentCount} message(s) unsent.`);
					console.debug("DefaultStrategy aborted");
				} else {
					this.idmu.setStatusText(`Done. ${this._unsentCount} message(s) unsent.`);
					console.debug("DefaultStrategy done");
				}
			} catch(ex) {
				console.error(ex);
				this.idmu.setStatusText(`Errored. ${this._unsentCount} message(s) unsent.`);
				console.debug("DefaultStrategy errored");
			}
			this._running = false;
		}

		/**
		 * Tries to load the thread next page
		 */
		async #loadNextPage() {
			if(this._abortController.signal.aborted) {
				return
			}
			this.idmu.setStatusText("Loading next page...");
			try {
				const done = await this.idmu.fetchAndRenderThreadNextMessagePage(this._abortController);
				if(this._abortController.signal.aborted === false) {
					if(done) {
						this.idmu.setStatusText(`All pages loaded (${this._pagesLoadedCount} in total)...`);
						this._allPagesLoaded = true;
						await this.#unsendNextMessage();
					} else {
						this._pagesLoadedCount++;
						await this.#loadNextPage();
					}
				}
			} catch(ex) {
				console.error(ex);
			}
		}

		/**
		 * Unsend first message in viewport
		 */
		async #unsendNextMessage() {
			if(this._abortController.signal.aborted) {
				return
			}
			let canScroll = true;
			try {
				this.idmu.setStatusText("Retrieving next message...");
				const uipiMessage = await this.idmu.getNextUIPIMessage(this._abortController);
				canScroll = uipiMessage !== false;
				if(uipiMessage) {
					this.idmu.setStatusText("Unsending message...");
					if (this._lastUnsendDate !== null) {
						const lastUnsendDateDiff = new Date().getTime() - this._lastUnsendDate.getTime();
						if(lastUnsendDateDiff < 1000) {
							this.idmu.setStatusText(`Waiting ${lastUnsendDateDiff}ms before unsending next message...`);
							await new Promise(resolve => setTimeout(resolve, lastUnsendDateDiff));
						}
					}
					const unsent = await uipiMessage.unsend(this._abortController);
					if(unsent) {
						this._lastUnsendDate = new Date();
						this._unsentCount++;
					}
				}
			} catch(ex) {
				console.error(ex);
			} finally {
				if(canScroll) {
					await this.#unsendNextMessage();
				}
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


	class OSD {
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
			this._strategy = new DefaultStrategy(this._idmu); // TODO move out
		}

		/**
		 *
		 * @param {window} window
		 * @returns {OSD}
		 */
		static render(window) {
			console.debug("render");
			const ui = OSD.create(window.document);
			window.document.body.appendChild(ui.root);
			return ui
		}

		/**
		 *
		 * @param   {Document} document
		 * @returns {OSD}
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
			const ui = new OSD(document, root, overlayElement, menuElement, unsendThreadMessagesButton, statusElement);
			document.addEventListener("keydown", (event) => ui.#onWindowKeyEvent(event)); // TODO test
			document.addEventListener("keyup", (event) => ui.#onWindowKeyEvent(event)); // TODO test
			unsendThreadMessagesButton.addEventListener("click", (event) => ui.#onUnsendThreadMessagesButtonClick(event));
			ui._mutationObserver = new MutationObserver((mutations) => ui.#onMutations(ui, mutations));
			ui._mutationObserver.observe(document.body, { childList: true }); // TODO test
			unsendThreadMessagesButton.dataTextContent = unsendThreadMessagesButton.textContent;
			unsendThreadMessagesButton.dataBackgroundColor = unsendThreadMessagesButton.style.backgroundColor;
			return ui
		}

		/**
		 *
		 * @param {string} text
		 */
		onStatusText(text) {
			this.statusElement.textContent = text;
		}

		async #startUnsending() {
	[...this.menuElement.querySelectorAll("button")].filter(button => button !== this.unsendThreadMessagesButton).forEach(button => {
				button.style.visibility = "hidden";
				button.disabled = true;
			});
			this.overlayElement.style.display = "";
			this.overlayElement.focus();
			this.unsendThreadMessagesButton.textContent = "Stop processing";
			this.unsendThreadMessagesButton.style.backgroundColor = "#FA383E";
			this.statusElement.style.color = "white";
			this._mutationObserver.disconnect();
			await this.strategy.run();
			this.#onUnsendingFinished();
		}

		/**
		 *
		 * @param {OSD} ui
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
				if(!this.strategy.isRunning()) {
					this.strategy.reset();
				}
				this.root.style.display = "";
			} else {
				this.root.style.display = "none";
				if(this.strategy.isRunning()) {
					this.strategy.stop();
				}
			}
		}

		/**
		 *
		 * @param {OSD} ui
		 * @param {Event} event
		 */
		#onUnsendThreadMessagesButtonClick() {
			if(this.strategy.isRunning()) {
				console.debug("User asked for messages unsending to stop");
				this.strategy.stop();
				this.#onUnsendingFinished();
			} else {
				console.debug("User asked for messages unsending to start; UI interaction will be disabled in the meantime");
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
				console.log("User interaction is disabled as the unsending is still running; Please stop the execution first.");
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
			this.statusElement.style.color = "";
			this._mutationObserver.observe(this._document.body, { childList: true }); // TODO test
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
		 * @type {UnsendStrategy}
		 */
		get strategy() { // TODO move out
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
		OSD.render(window);
	}

	if(typeof window !== "undefined") {
		main(window);
	}

	exports.main = main;

	return exports;

})({});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaWRtdS51c2VyLmpzIiwic291cmNlcyI6WyIuLi9zcmMvcnVudGltZS91c2Vyc2NyaXB0L29zZC9zdHlsZS9pbnN0YWdyYW0uanMiLCIuLi9zcmMvcnVudGltZS91c2Vyc2NyaXB0L29zZC9tZW51LWJ1dHRvbi5qcyIsIi4uL3NyYy9ydW50aW1lL3VzZXJzY3JpcHQvb3NkL21lbnUuanMiLCIuLi9zcmMvZG9tL2FzeW5jLWV2ZW50cy5qcyIsIi4uL3NyYy91aS91aS1jb21wb25lbnQuanMiLCIuLi9zcmMvdWkvZGVmYXVsdC91aS1tZXNzYWdlLmpzIiwiLi4vc3JjL3VpcGkvdWlwaS1tZXNzYWdlLmpzIiwiLi4vc3JjL3VpL3VpLmpzIiwiLi4vc3JjL3VpL2RlZmF1bHQvZG9tLWxvb2t1cC5qcyIsIi4uL3NyYy91aS9kZWZhdWx0L3VpLW1lc3NhZ2VzLXdyYXBwZXIuanMiLCIuLi9zcmMvdWkvZGVmYXVsdC9kZWZhdWx0LXVpLmpzIiwiLi4vc3JjL3VpL2dldC11aS5qcyIsIi4uL3NyYy91aXBpL3VpcGkuanMiLCIuLi9zcmMvaWRtdS9pZG11LmpzIiwiLi4vc3JjL3VpL3Vuc2VuZC1zdHJhdGVneS5qcyIsIi4uL3NyYy91aS9kZWZhdWx0L3Vuc2VuZC1zdHJhdGVneS5qcyIsIi4uL3NyYy9ydW50aW1lL3VzZXJzY3JpcHQvb3NkL2FsZXJ0LmpzIiwiLi4vc3JjL3J1bnRpbWUvdXNlcnNjcmlwdC9vc2Qvb3ZlcmxheS5qcyIsIi4uL3NyYy9ydW50aW1lL3VzZXJzY3JpcHQvb3NkL29zZC5qcyIsIi4uL3NyYy9ydW50aW1lL3VzZXJzY3JpcHQvbWFpbi5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKiogQG1vZHVsZSBpbnN0YWdyYW0gSGVscGVycyB0byBtaW1pY2sgSW5zdGFncmFtJ3MgbG9vayBhbmQgZmVlbCAqL1xuXG5leHBvcnQgY29uc3QgQlVUVE9OX1NUWUxFID0ge1xuXHRcIlBSSU1BUllcIjogXCJwcmltYXJ5XCIsXG5cdFwiU0VDT05EQVJZXCI6IFwic2Vjb25kYXJ5XCIsXG59XG5cbi8qKlxuICpcbiAqIEBwYXJhbSB7SFRNTEJ1dHRvbkVsZW1lbnR9IGJ1dHRvbkVsZW1lbnRcbiAqIEBwYXJhbSB7c3RyaW5nfSAgICAgICAgICAgIHN0eWxlTmFtZVxuICovXG5leHBvcnQgZnVuY3Rpb24gYXBwbHlCdXR0b25TdHlsZShidXR0b25FbGVtZW50LCBzdHlsZU5hbWUpIHtcblx0YnV0dG9uRWxlbWVudC5zdHlsZS5mb250U2l6ZSA9IFwidmFyKC0tc3lzdGVtLTE0LWZvbnQtc2l6ZSlcIlxuXHRidXR0b25FbGVtZW50LnN0eWxlLmNvbG9yID0gXCJ3aGl0ZVwiXG5cdGJ1dHRvbkVsZW1lbnQuc3R5bGUuYm9yZGVyID0gXCIwcHhcIlxuXHRidXR0b25FbGVtZW50LnN0eWxlLmJvcmRlclJhZGl1cyA9IFwiOHB4XCJcblx0YnV0dG9uRWxlbWVudC5zdHlsZS5wYWRkaW5nID0gXCI4cHhcIlxuXHRidXR0b25FbGVtZW50LnN0eWxlLmZvbnRXZWlnaHQgPSBcImJvbGRcIlxuXHRidXR0b25FbGVtZW50LnN0eWxlLmN1cnNvciA9IFwicG9pbnRlclwiXG5cdGJ1dHRvbkVsZW1lbnQuc3R5bGUubGluZUhlaWdodCA9IFwidmFyKC0tc3lzdGVtLTE0LWxpbmUtaGVpZ2h0KVwiXG5cdGlmKHN0eWxlTmFtZSkge1xuXHRcdGJ1dHRvbkVsZW1lbnQuc3R5bGUuYmFja2dyb3VuZENvbG9yID0gYHJnYih2YXIoLS1pZy0ke3N0eWxlTmFtZX0tYnV0dG9uKSlgXG5cdH1cbn1cbiIsIi8qKiBAbW9kdWxlIG1lbnUtYnV0dG9uIEhlbHBlcnMgdG8gY3JlYXRlIGJ1dHRvbnMgdGhhdCBjYW4gYmUgdXNlZCBpbiBJRE1VJ3MgbWVudSAqL1xuXG5pbXBvcnQgeyBhcHBseUJ1dHRvblN0eWxlIH0gZnJvbSBcIi4vc3R5bGUvaW5zdGFncmFtLmpzXCJcblxuLyoqXG4gKlxuICogQHBhcmFtIHtEb2N1bWVudH0gZG9jdW1lbnRcbiAqIEBwYXJhbSB7c3RyaW5nfSAgIHRleHRcbiAqIEBwYXJhbSB7c3RyaW5nfSAgIHN0eWxlTmFtZVxuICogQHJldHVybnMge0hUTUxCdXR0b25FbGVtZW50fVxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlTWVudUJ1dHRvbkVsZW1lbnQoZG9jdW1lbnQsIHRleHQsIHN0eWxlTmFtZSkge1xuXHRjb25zdCBidXR0b25FbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImJ1dHRvblwiKVxuXHRidXR0b25FbGVtZW50LnRleHRDb250ZW50ID0gdGV4dFxuXHRhcHBseUJ1dHRvblN0eWxlKGJ1dHRvbkVsZW1lbnQsIHN0eWxlTmFtZSlcblx0YnV0dG9uRWxlbWVudC5hZGRFdmVudExpc3RlbmVyKFwibW91c2VvdmVyXCIsICgpID0+IHtcblx0XHRidXR0b25FbGVtZW50LnN0eWxlLmZpbHRlciA9IGBicmlnaHRuZXNzKDEuMTUpYFxuXHR9KVxuXHRidXR0b25FbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJtb3VzZW91dFwiLCAoKSA9PiB7XG5cdFx0YnV0dG9uRWxlbWVudC5zdHlsZS5maWx0ZXIgPSBgYFxuXHR9KVxuXHRyZXR1cm4gYnV0dG9uRWxlbWVudFxufVxuIiwiLyoqIEBtb2R1bGUgbWVudSBJRE1VJ3MgbWFpbiBtZW51ICovXG5cbi8qKlxuICogQHBhcmFtIHtEb2N1bWVudH0gZG9jdW1lbnRcbiAqIEByZXR1cm5zIHtIVE1MQnV0dG9uRWxlbWVudH1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZU1lbnVFbGVtZW50KGRvY3VtZW50KSB7XG5cdGNvbnN0IG1lbnVFbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKVxuXHRtZW51RWxlbWVudC5pZCA9IFwiaWRtdS1tZW51XCJcblx0bWVudUVsZW1lbnQuc3R5bGUudG9wID0gXCIyMHB4XCJcblx0bWVudUVsZW1lbnQuc3R5bGUucmlnaHQgPSBcIjQzMHB4XCJcblx0bWVudUVsZW1lbnQuc3R5bGUucG9zaXRpb24gPSBcImZpeGVkXCJcblx0bWVudUVsZW1lbnQuc3R5bGUuekluZGV4ID0gOTk5XG5cdG1lbnVFbGVtZW50LnN0eWxlLmRpc3BsYXkgPSBcImZsZXhcIlxuXHRtZW51RWxlbWVudC5zdHlsZS5nYXAgPSBcIjEwcHhcIlxuXHRtZW51RWxlbWVudC5zdHlsZS5wbGFjZUl0ZW1zID0gXCJjZW50ZXJcIlxuXHRyZXR1cm4gbWVudUVsZW1lbnRcbn1cbiIsIi8qKiBAbW9kdWxlIGFzeW5jLWV2ZW50cyBVdGlscyBtb2R1bGUgZm9yIGZpbmRpbmcgZWxlbWVudHMgYXN5bmNocm9ub3VzbHkgaW4gdGhlIERPTSAqL1xuXG4vKipcbiAqXG4gKiBAY2FsbGJhY2sgZ2V0RWxlbWVudFxuICogQHJldHVybnMge0VsZW1lbnR9XG4gKi9cblxuLyoqXG4gKlxuICogQHBhcmFtIHtFbGVtZW50fSB0YXJnZXRcbiAqIEBwYXJhbSB7Z2V0RWxlbWVudH0gZ2V0RWxlbWVudFxuICogQHBhcmFtIHtBYm9ydENvbnRyb2xsZXJ9IGFib3J0Q29udHJvbGxlclxuICogQHJldHVybnMge1Byb21pc2U8RWxlbWVudD59XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB3YWl0Rm9yRWxlbWVudCh0YXJnZXQsIGdldEVsZW1lbnQsIGFib3J0Q29udHJvbGxlcikge1xuXHRyZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuXHRcdGxldCBtdXRhdGlvbk9ic2VydmVyXG5cdFx0Y29uc3QgYWJvcnRIYW5kbGVyID0gKCkgPT4ge1xuXHRcdFx0aWYobXV0YXRpb25PYnNlcnZlcikge1xuXHRcdFx0XHRyZWplY3QobmV3IERPTUV4Y2VwdGlvbihcIkFib3J0ZWQ6IERpc2Nvbm5lY3RpbmcgbXV0YXRpb24gb2JzZXJ2ZXIuLi5cIiwgXCJBYm9ydEVycm9yXCIpKVxuXHRcdFx0XHRtdXRhdGlvbk9ic2VydmVyLmRpc2Nvbm5lY3QoKVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmVqZWN0KG5ldyBET01FeGNlcHRpb24oXCJBYm9ydGVkXCIsIFwiQWJvcnRFcnJvclwiKSlcblx0XHRcdH1cblx0XHR9XG5cdFx0YWJvcnRDb250cm9sbGVyLnNpZ25hbC5hZGRFdmVudExpc3RlbmVyKFwiYWJvcnRcIiwgYWJvcnRIYW5kbGVyKVxuXHRcdGxldCBlbGVtZW50ID0gZ2V0RWxlbWVudCgpXG5cdFx0aWYoZWxlbWVudCkge1xuXHRcdFx0cmVzb2x2ZShlbGVtZW50KVxuXHRcdFx0YWJvcnRDb250cm9sbGVyLnNpZ25hbC5yZW1vdmVFdmVudExpc3RlbmVyKFwiYWJvcnRcIiwgYWJvcnRIYW5kbGVyKVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRtdXRhdGlvbk9ic2VydmVyID0gbmV3IE11dGF0aW9uT2JzZXJ2ZXIoKG11dGF0aW9ucywgb2JzZXJ2ZXIpID0+IHtcblx0XHRcdFx0ZWxlbWVudCA9IGdldEVsZW1lbnQobXV0YXRpb25zKVxuXHRcdFx0XHRpZihlbGVtZW50KSB7XG5cdFx0XHRcdFx0b2JzZXJ2ZXIuZGlzY29ubmVjdCgpXG5cdFx0XHRcdFx0cmVzb2x2ZShlbGVtZW50KVxuXHRcdFx0XHRcdGFib3J0Q29udHJvbGxlci5zaWduYWwucmVtb3ZlRXZlbnRMaXN0ZW5lcihcImFib3J0XCIsIGFib3J0SGFuZGxlcilcblx0XHRcdFx0fVxuXHRcdFx0fSlcblx0XHRcdG11dGF0aW9uT2JzZXJ2ZXIub2JzZXJ2ZSh0YXJnZXQsIHsgc3VidHJlZTogdHJ1ZSwgY2hpbGRMaXN0OnRydWUgfSlcblx0XHR9XG5cdH0pXG59XG5cbi8qKlxuICpcbiAqIEBwYXJhbSB7RWxlbWVudH0gY2xpY2tUYXJnZXRcbiAqIEBwYXJhbSB7RWxlbWVudH0gdGFyZ2V0XG4gKiBAcGFyYW0ge2dldEVsZW1lbnR9IGdldEVsZW1lbnRcbiAqIEBwYXJhbSB7QWJvcnRDb250cm9sbGVyfSBhYm9ydENvbnRyb2xsZXJcbiAqIEByZXR1cm5zIHtFbGVtZW50fFByb21pc2U8RWxlbWVudD59XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjbGlja0VsZW1lbnRBbmRXYWl0Rm9yKGNsaWNrVGFyZ2V0LCB0YXJnZXQsIGdldEVsZW1lbnQsIGFib3J0Q29udHJvbGxlcikge1xuXHRjb25zdCBwcm9taXNlID0gd2FpdEZvckVsZW1lbnQodGFyZ2V0LCBnZXRFbGVtZW50LCBhYm9ydENvbnRyb2xsZXIpXG5cdGNsaWNrVGFyZ2V0LmNsaWNrKClcblx0cmV0dXJuIGdldEVsZW1lbnQoKSB8fCBwcm9taXNlXG59XG4iLCIvKiogQG1vZHVsZSB1aS1jb21wb25lbnQgQmFzZSBjbGFzcyBmb3IgYW55IGVsZW1lbnQgdGhhdCBpcyBhIHBhcnQgb2YgdGhlIFVJLiAqL1xuXG5pbXBvcnQgeyB3YWl0Rm9yRWxlbWVudCwgY2xpY2tFbGVtZW50QW5kV2FpdEZvciB9IGZyb20gXCIuLi9kb20vYXN5bmMtZXZlbnRzLmpzXCJcblxuLyoqXG4gKlxuICogQGFic3RyYWN0XG4gKi9cbmNsYXNzIFVJQ29tcG9uZW50IHtcblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7RWxlbWVudH0gcm9vdFxuXHQgKiBAcGFyYW0ge29iamVjdH0gaWRlbnRpZmllclxuXHQgKi9cblx0Y29uc3RydWN0b3Iocm9vdCwgaWRlbnRpZmllcj17fSkge1xuXHRcdHRoaXMucm9vdCA9IHJvb3Rcblx0XHR0aGlzLmlkZW50aWZpZXIgPSBpZGVudGlmaWVyXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHtFbGVtZW50fSB0YXJnZXRcblx0ICogQHBhcmFtIHtmdW5jdGlvbn0gZ2V0RWxlbWVudFxuXHQgKiBAcGFyYW0ge0Fib3J0Q29udHJvbGxlcn0gYWJvcnRDb250cm9sbGVyXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlPEVsZW1lbnQ+fVxuXHQgKi9cblx0d2FpdEZvckVsZW1lbnQodGFyZ2V0LCBnZXRFbGVtZW50LCBhYm9ydENvbnRyb2xsZXIpIHtcblx0XHRyZXR1cm4gZ2V0RWxlbWVudCgpIHx8IHdhaXRGb3JFbGVtZW50KHRhcmdldCwgZ2V0RWxlbWVudCwgYWJvcnRDb250cm9sbGVyKVxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7RWxlbWVudH0gY2xpY2tUYXJnZXRcblx0ICogQHBhcmFtIHtFbGVtZW50fSB0YXJnZXRcblx0ICogQHBhcmFtIHtmdW5jdGlvbn0gZ2V0RWxlbWVudFxuXHQgKiBAcGFyYW0ge0Fib3J0Q29udHJvbGxlcn0gYWJvcnRDb250cm9sbGVyXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlPEVsZW1lbnQ+fVxuXHQgKi9cblx0Y2xpY2tFbGVtZW50QW5kV2FpdEZvcihjbGlja1RhcmdldCwgdGFyZ2V0LCBnZXRFbGVtZW50LCBhYm9ydENvbnRyb2xsZXIpIHtcblx0XHRyZXR1cm4gY2xpY2tFbGVtZW50QW5kV2FpdEZvcihjbGlja1RhcmdldCwgdGFyZ2V0LCBnZXRFbGVtZW50LCBhYm9ydENvbnRyb2xsZXIpXG5cdH1cblxufVxuXG5leHBvcnQgZGVmYXVsdCBVSUNvbXBvbmVudFxuIiwiLyoqIEBtb2R1bGUgdWktbWVzc2FnZSBVSSBlbGVtZW50IHJlcHJlc2VudGluZyBhIG1lc3NhZ2UgKi9cblxuaW1wb3J0IFVJQ29tcG9uZW50IGZyb20gXCIuLi91aS1jb21wb25lbnQuanNcIlxuXG5jbGFzcyBVSU1lc3NhZ2UgZXh0ZW5kcyBVSUNvbXBvbmVudCB7XG5cblx0LyoqXG5cdCAqIEBwYXJhbSB7QWJvcnRDb250cm9sbGVyfSBhYm9ydENvbnRyb2xsZXJcblx0ICogQHJldHVybnMge1Byb21pc2U8SFRNTEJ1dHRvbkVsZW1lbnQ+fVxuXHQgKi9cblx0YXN5bmMgc2hvd0FjdGlvbnNNZW51QnV0dG9uKGFib3J0Q29udHJvbGxlcikge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJXb3JrZmxvdyBzdGVwIDEgOiBzaG93QWN0aW9uc01lbnVCdXR0b25cIiwgdGhpcy5yb290KVxuXHRcdHRoaXMucm9vdC5kaXNwYXRjaEV2ZW50KG5ldyBNb3VzZUV2ZW50KFwibW91c2Vtb3ZlXCIsIHsgYnViYmxlczogdHJ1ZSB9KSlcblx0XHR0aGlzLnJvb3QuZGlzcGF0Y2hFdmVudChuZXcgTW91c2VFdmVudChcIm1vdXNlb3ZlclwiLCB7IGJ1YmJsZXM6IHRydWUgfSkpXG5cdFx0dGhpcy5yb290LmRpc3BhdGNoRXZlbnQobmV3IE1vdXNlRXZlbnQoXCJtb3VzZW50ZXJcIiwgeyBidWJibGVzOiB0cnVlIH0pKVxuXHRcdGNvbnN0IHdhaXRBYm9ydENvbnRyb2xsZXIgPSBuZXcgQWJvcnRDb250cm9sbGVyKClcblx0XHRsZXQgcHJvbWlzZVRpbWVvdXRcblx0XHRsZXQgcmVzb2x2ZVRpbWVvdXRcblx0XHRjb25zdCBhYm9ydEhhbmRsZXIgPSAoKSA9PiB7XG5cdFx0XHR3YWl0QWJvcnRDb250cm9sbGVyLmFib3J0KClcblx0XHRcdGNsZWFyVGltZW91dChwcm9taXNlVGltZW91dClcblx0XHRcdGlmKHJlc29sdmVUaW1lb3V0KSB7XG5cdFx0XHRcdHJlc29sdmVUaW1lb3V0KClcblx0XHRcdH1cblx0XHR9XG5cdFx0YWJvcnRDb250cm9sbGVyLnNpZ25hbC5hZGRFdmVudExpc3RlbmVyKFwiYWJvcnRcIiwgYWJvcnRIYW5kbGVyKVxuXHRcdGNvbnN0IGFjdGlvbkJ1dHRvbiA9IGF3YWl0IFByb21pc2UucmFjZShbXG5cdFx0XHR0aGlzLndhaXRGb3JFbGVtZW50KHRoaXMucm9vdCwgKCkgPT4gdGhpcy5yb290LnF1ZXJ5U2VsZWN0b3IoXCJbYXJpYS1sYWJlbF49J1NlZSBtb3JlIG9wdGlvbnMgZm9yIG1lc3NhZ2UnXVwiKT8ucGFyZW50Tm9kZSwgd2FpdEFib3J0Q29udHJvbGxlciksXG5cdFx0XHRuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cdFx0XHRcdHByb21pc2VUaW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiByZWplY3QoXCJUaW1lb3V0IHNob3dBY3Rpb25zTWVudUJ1dHRvblwiKSwgMjAwKVxuXHRcdFx0fSlcblx0XHRdKVxuXHRcdHdhaXRBYm9ydENvbnRyb2xsZXIuYWJvcnQoKVxuXHRcdGNsZWFyVGltZW91dChwcm9taXNlVGltZW91dClcblx0XHRyZXR1cm4gYWN0aW9uQnV0dG9uXG5cdH1cblxuXHQvKipcblx0ICogQHBhcmFtIHtBYm9ydENvbnRyb2xsZXJ9IGFib3J0Q29udHJvbGxlclxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZTxib29sZWFuPn1cblx0ICovXG5cdGFzeW5jIGhpZGVBY3Rpb25NZW51QnV0dG9uKGFib3J0Q29udHJvbGxlcikgeyAvLyBGSVhNRVxuXHRcdGNvbnNvbGUuZGVidWcoXCJoaWRlQWN0aW9uTWVudUJ1dHRvblwiLCB0aGlzLnJvb3QpXG5cdFx0dGhpcy5yb290LmRpc3BhdGNoRXZlbnQobmV3IE1vdXNlRXZlbnQoXCJtb3VzZW1vdmVcIiwgeyBidWJibGVzOiB0cnVlIH0pKVxuXHRcdHRoaXMucm9vdC5kaXNwYXRjaEV2ZW50KG5ldyBNb3VzZUV2ZW50KFwibW91c2VvdXRcIiwgeyBidWJibGVzOiB0cnVlIH0pKVxuXHRcdHRoaXMucm9vdC5kaXNwYXRjaEV2ZW50KG5ldyBNb3VzZUV2ZW50KFwibW91c2VsZWF2ZVwiLCB7IGJ1YmJsZXM6IHRydWUgfSkpXG5cdFx0Y29uc3Qgd2FpdEFib3J0Q29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKVxuXHRcdGxldCBwcm9taXNlVGltZW91dFxuXHRcdGxldCByZXNvbHZlVGltZW91dFxuXHRcdGNvbnN0IGFib3J0SGFuZGxlciA9ICgpID0+IHtcblx0XHRcdHdhaXRBYm9ydENvbnRyb2xsZXIuYWJvcnQoKVxuXHRcdFx0Y2xlYXJUaW1lb3V0KHByb21pc2VUaW1lb3V0KVxuXHRcdFx0aWYocmVzb2x2ZVRpbWVvdXQpIHtcblx0XHRcdFx0cmVzb2x2ZVRpbWVvdXQoKVxuXHRcdFx0fVxuXHRcdH1cblx0XHRhYm9ydENvbnRyb2xsZXIuc2lnbmFsLmFkZEV2ZW50TGlzdGVuZXIoXCJhYm9ydFwiLCBhYm9ydEhhbmRsZXIpXG5cdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgUHJvbWlzZS5yYWNlKFtcblx0XHRcdHRoaXMud2FpdEZvckVsZW1lbnQodGhpcy5yb290LCAoKSA9PiB0aGlzLnJvb3QucXVlcnlTZWxlY3RvcihcIlthcmlhLWxhYmVsPU1vcmVdXCIpID09PSBudWxsLCB3YWl0QWJvcnRDb250cm9sbGVyKSxcblx0XHRcdG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcblx0XHRcdFx0cmVzb2x2ZVRpbWVvdXQgPSByZXNvbHZlXG5cdFx0XHRcdHByb21pc2VUaW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiByZWplY3QoXCJUaW1lb3V0IGhpZGVBY3Rpb25NZW51QnV0dG9uXCIpLCAyMDApXG5cdFx0XHR9KVxuXHRcdF0pXG5cdFx0d2FpdEFib3J0Q29udHJvbGxlci5hYm9ydCgpXG5cdFx0Y2xlYXJUaW1lb3V0KHByb21pc2VUaW1lb3V0KVxuXHRcdHJldHVybiByZXN1bHRcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge0hUTUxCdXR0b25FbGVtZW50fSBhY3Rpb25CdXR0b25cblx0ICogQHBhcmFtIHtBYm9ydENvbnRyb2xsZXJ9IGFib3J0Q29udHJvbGxlclxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZX1cblx0ICovXG5cdGFzeW5jIG9wZW5BY3Rpb25zTWVudShhY3Rpb25CdXR0b24sIGFib3J0Q29udHJvbGxlcikge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJXb3JrZmxvdyBzdGVwIDIgOiBDbGlja2luZyBhY3Rpb25CdXR0b24gYW5kIHdhaXRpbmcgZm9yIHVuc2VuZCBtZW51IGl0ZW0gdG8gYXBwZWFyXCIsIGFjdGlvbkJ1dHRvbilcblx0XHRjb25zdCB3YWl0QWJvcnRDb250cm9sbGVyID0gbmV3IEFib3J0Q29udHJvbGxlcigpXG5cdFx0bGV0IHByb21pc2VUaW1lb3V0XG5cdFx0bGV0IHJlc29sdmVUaW1lb3V0XG5cdFx0Y29uc3QgYWJvcnRIYW5kbGVyID0gKCkgPT4ge1xuXHRcdFx0d2FpdEFib3J0Q29udHJvbGxlci5hYm9ydCgpXG5cdFx0XHRjbGVhclRpbWVvdXQocHJvbWlzZVRpbWVvdXQpXG5cdFx0XHRpZihyZXNvbHZlVGltZW91dCkge1xuXHRcdFx0XHRyZXNvbHZlVGltZW91dCgpXG5cdFx0XHR9XG5cdFx0fVxuXHRcdGFib3J0Q29udHJvbGxlci5zaWduYWwuYWRkRXZlbnRMaXN0ZW5lcihcImFib3J0XCIsIGFib3J0SGFuZGxlcilcblx0XHRjb25zdCB1bnNlbmRCdXR0b24gPSBhd2FpdCBQcm9taXNlLnJhY2UoW1xuXHRcdFx0dGhpcy5jbGlja0VsZW1lbnRBbmRXYWl0Rm9yKFxuXHRcdFx0XHRhY3Rpb25CdXR0b24sXG5cdFx0XHRcdHRoaXMucm9vdC5vd25lckRvY3VtZW50LmJvZHksXG5cdFx0XHRcdChtdXRhdGlvbnMpID0+IHtcblx0XHRcdFx0XHRpZihtdXRhdGlvbnMpIHtcblx0XHRcdFx0XHRcdGNvbnN0IGFkZGVkTm9kZXMgPSBbIC4uLm11dGF0aW9ucy5tYXAobXV0YXRpb24gPT4gWy4uLm11dGF0aW9uLmFkZGVkTm9kZXNdKSBdLmZsYXQoKS5maWx0ZXIobm9kZSA9PiBub2RlLm5vZGVUeXBlID09PSAxKVxuXHRcdFx0XHRcdFx0Y29uc29sZS5kZWJ1ZyhcIldvcmtmbG93IHN0ZXAgMiA6IFwiLCBhZGRlZE5vZGVzLCBhZGRlZE5vZGVzLmZpbmQobm9kZSA9PiBub2RlLnRleHRDb250ZW50LnRyaW0oKS50b0xvY2FsZUxvd2VyQ2FzZSgpID09PSBcInVuc2VuZFwiKSlcblx0XHRcdFx0XHRcdGZvcihjb25zdCBhZGRlZE5vZGUgb2YgYWRkZWROb2Rlcykge1xuXHRcdFx0XHRcdFx0XHRjb25zdCBub2RlID0gWy4uLmFkZGVkTm9kZS5xdWVyeVNlbGVjdG9yQWxsKFwic3BhbixkaXZcIildLmZpbmQobm9kZSA9PiBub2RlLnRleHRDb250ZW50LnRyaW0oKS50b0xvY2FsZUxvd2VyQ2FzZSgpID09PSBcInVuc2VuZFwiICYmIG5vZGUuZmlyc3RDaGlsZD8ubm9kZVR5cGUgPT09IDMpXG5cdFx0XHRcdFx0XHRcdHJldHVybiBub2RlXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LFxuXHRcdFx0XHR3YWl0QWJvcnRDb250cm9sbGVyXG5cdFx0XHQpLFxuXHRcdFx0bmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuXHRcdFx0XHRwcm9taXNlVGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4gcmVqZWN0KFwiVGltZW91dCBvcGVuQWN0aW9uc01lbnVcIiksIDIwMClcblx0XHRcdH0pXG5cdFx0XSlcblx0XHRjb25zb2xlLmRlYnVnKFwiV29ya2Zsb3cgc3RlcCAyIDogRm91bmQgdW5zZW5kQnV0dG9uXCIsIHVuc2VuZEJ1dHRvbilcblx0XHR3YWl0QWJvcnRDb250cm9sbGVyLmFib3J0KClcblx0XHRjbGVhclRpbWVvdXQocHJvbWlzZVRpbWVvdXQpXG5cdFx0cmV0dXJuIHVuc2VuZEJ1dHRvblxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7SFRNTEJ1dHRvbkVsZW1lbnR9IGFjdGlvbkJ1dHRvblxuXHQgKiBAcGFyYW0ge0hUTUxEaXZFbGVtZW50fSBhY3Rpb25zTWVudUVsZW1lbnRcblx0ICogQHBhcmFtIHtBYm9ydENvbnRyb2xsZXJ9IGFib3J0Q29udHJvbGxlclxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZTxib29sZWFuPn1cblx0ICovXG5cdGFzeW5jIGNsb3NlQWN0aW9uc01lbnUoYWN0aW9uQnV0dG9uLCBhY3Rpb25zTWVudUVsZW1lbnQsIGFib3J0Q29udHJvbGxlcikge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJjbG9zZUFjdGlvbnNNZW51XCIpXG5cdFx0Y29uc3Qgd2FpdEFib3J0Q29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKVxuXHRcdGxldCBwcm9taXNlVGltZW91dFxuXHRcdGxldCByZXNvbHZlVGltZW91dFxuXHRcdGNvbnN0IGFib3J0SGFuZGxlciA9ICgpID0+IHtcblx0XHRcdHdhaXRBYm9ydENvbnRyb2xsZXIuYWJvcnQoKVxuXHRcdFx0Y2xlYXJUaW1lb3V0KHByb21pc2VUaW1lb3V0KVxuXHRcdFx0aWYocmVzb2x2ZVRpbWVvdXQpIHtcblx0XHRcdFx0cmVzb2x2ZVRpbWVvdXQoKVxuXHRcdFx0fVxuXHRcdH1cblx0XHRhYm9ydENvbnRyb2xsZXIuc2lnbmFsLmFkZEV2ZW50TGlzdGVuZXIoXCJhYm9ydFwiLCBhYm9ydEhhbmRsZXIpXG5cdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgUHJvbWlzZS5yYWNlKFtcblx0XHRcdHRoaXMuY2xpY2tFbGVtZW50QW5kV2FpdEZvcihcblx0XHRcdFx0YWN0aW9uQnV0dG9uLFxuXHRcdFx0XHR0aGlzLnJvb3Qub3duZXJEb2N1bWVudC5ib2R5LFxuXHRcdFx0XHQoKSA9PiB0aGlzLnJvb3Qub3duZXJEb2N1bWVudC5ib2R5LmNvbnRhaW5zKGFjdGlvbnNNZW51RWxlbWVudCkgPT09IGZhbHNlLFxuXHRcdFx0XHRhYm9ydENvbnRyb2xsZXJcblx0XHRcdCksXG5cdFx0XHRuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cdFx0XHRcdHByb21pc2VUaW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiByZWplY3QoXCJUaW1lb3V0IG9wZW5BY3Rpb25zTWVudVwiKSwgMjAwKVxuXHRcdFx0fSlcblx0XHRdKVxuXHRcdHdhaXRBYm9ydENvbnRyb2xsZXIuYWJvcnQoKVxuXHRcdGNsZWFyVGltZW91dChwcm9taXNlVGltZW91dClcblx0XHRyZXR1cm4gcmVzdWx0ICE9PSBudWxsXG5cdH1cblxuXHQvKipcblx0ICogQ2xpY2sgdW5zZW5kIGJ1dHRvblxuXHQgKiBAcGFyYW0ge0hUTUxTcGFuRWxlbWVudH0gdW5zZW5kQnV0dG9uXG5cdCAqIEBwYXJhbSB7QWJvcnRDb250cm9sbGVyfSBhYm9ydENvbnRyb2xsZXJcblx0ICogQHJldHVybnMge1Byb21pc2U8SFRNTEJ1dHRvbkVsZW1lbnQ+fFByb21pc2U8RXJyb3I+fVxuXHQgKi9cblx0b3BlbkNvbmZpcm1VbnNlbmRNb2RhbCh1bnNlbmRCdXR0b24sIGFib3J0Q29udHJvbGxlcikge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJXb3JrZmxvdyBzdGVwIDMgOiBDbGlja2luZyB1bnNlbmRCdXR0b24gYW5kIHdhaXRpbmcgZm9yIGRpYWxvZyB0byBhcHBlYXIuLi5cIilcblx0XHRyZXR1cm4gdGhpcy5jbGlja0VsZW1lbnRBbmRXYWl0Rm9yKFxuXHRcdFx0dW5zZW5kQnV0dG9uLFxuXHRcdFx0dGhpcy5yb290Lm93bmVyRG9jdW1lbnQuYm9keSxcblx0XHRcdCgpID0+IHRoaXMucm9vdC5vd25lckRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCJbcm9sZT1kaWFsb2ddIGJ1dHRvblwiKSxcblx0XHRcdGFib3J0Q29udHJvbGxlclxuXHRcdClcblx0fVxuXG5cdC8qKlxuXHQgKiBDbGljayB1bnNlbmQgY29uZmlybSBidXR0b25cblx0ICogQHBhcmFtIHtIVE1MQnV0dG9uRWxlbWVudH0gZGlhbG9nQnV0dG9uXG5cdCAqIEBwYXJhbSB7QWJvcnRDb250cm9sbGVyfSBhYm9ydENvbnRyb2xsZXJcblx0ICogQHJldHVybnMge1Byb21pc2V9XG5cdCAqL1xuXHRhc3luYyBjb25maXJtVW5zZW5kKGRpYWxvZ0J1dHRvbiwgYWJvcnRDb250cm9sbGVyKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIldvcmtmbG93IGZpbmFsIHN0ZXAgOiBjb25maXJtVW5zZW5kXCIsIGRpYWxvZ0J1dHRvbilcblx0XHQvLyB3YWl0IHVudGlsIGNvbmZpcm0gYnV0dG9uIGlzIHJlbW92ZWRcblx0XHRhd2FpdCB0aGlzLmNsaWNrRWxlbWVudEFuZFdhaXRGb3IoXG5cdFx0XHRkaWFsb2dCdXR0b24sXG5cdFx0XHR0aGlzLnJvb3Qub3duZXJEb2N1bWVudC5ib2R5LFxuXHRcdFx0KCkgPT4gdGhpcy5yb290Lm93bmVyRG9jdW1lbnQucXVlcnlTZWxlY3RvcihcIltyb2xlPWRpYWxvZ10gYnV0dG9uXCIpID09PSBudWxsLFxuXHRcdFx0YWJvcnRDb250cm9sbGVyXG5cdFx0KVxuXHR9XG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgVUlNZXNzYWdlXG4iLCIvKiogQG1vZHVsZSB1aXBpLW1lc3NhZ2UgQVBJIGZvciBVSU1lc3NhZ2UgKi9cblxuLyogZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLXVudXNlZC12YXJzICovXG5pbXBvcnQgVUlNZXNzYWdlIGZyb20gXCIuLi91aS9kZWZhdWx0L3VpLW1lc3NhZ2UuanNcIlxuXG5jbGFzcyBGYWlsZWRXb3JrZmxvd0V4Y2VwdGlvbiBleHRlbmRzIEVycm9yIHt9XG5cbmNsYXNzIFVJUElNZXNzYWdlIHtcblxuXHQvKipcblx0ICogQHBhcmFtIHtVSU1lc3NhZ2V9IHVpTWVzc2FnZVxuXHQgKi9cblx0Y29uc3RydWN0b3IodWlNZXNzYWdlKSB7XG5cdFx0dGhpcy5fdWlNZXNzYWdlID0gdWlNZXNzYWdlXG5cdH1cblxuXHQvKipcblx0ICogQHBhcmFtIHtBYm9ydENvbnRyb2xsZXJ9IGFib3J0Q29udHJvbGxlclxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZTxib29sZWFuPn1cblx0ICovXG5cdGFzeW5jIHVuc2VuZChhYm9ydENvbnRyb2xsZXIpIHsgLy8gVE9ETyBhYm9ydCBVSVBJIC8gd2FpdEZvckVsZW1lbnQgZXRjLi5cblx0XHRjb25zb2xlLmRlYnVnKFwiVUlQSU1lc3NhZ2UgdW5zZW5kXCIpXG5cdFx0bGV0IGFjdGlvbkJ1dHRvblxuXHRcdGxldCB1bnNlbmRCdXR0b25cblx0XHR0cnkge1xuXHRcdFx0YWN0aW9uQnV0dG9uID0gYXdhaXQgdGhpcy51aU1lc3NhZ2Uuc2hvd0FjdGlvbnNNZW51QnV0dG9uKGFib3J0Q29udHJvbGxlcilcblx0XHRcdHVuc2VuZEJ1dHRvbiA9IGF3YWl0IHRoaXMudWlNZXNzYWdlLm9wZW5BY3Rpb25zTWVudShhY3Rpb25CdXR0b24sIGFib3J0Q29udHJvbGxlcilcblx0XHRcdGNvbnNvbGUuZGVidWcoXCJ1bnNlbmRCdXR0b25cIiwgdW5zZW5kQnV0dG9uKVxuXHRcdFx0Y29uc3QgZGlhbG9nQnV0dG9uID0gYXdhaXQgdGhpcy51aU1lc3NhZ2Uub3BlbkNvbmZpcm1VbnNlbmRNb2RhbCh1bnNlbmRCdXR0b24sIGFib3J0Q29udHJvbGxlcilcblx0XHRcdGF3YWl0IHRoaXMudWlNZXNzYWdlLmNvbmZpcm1VbnNlbmQoZGlhbG9nQnV0dG9uLCBhYm9ydENvbnRyb2xsZXIpXG5cdFx0XHR0aGlzLnVpTWVzc2FnZS5yb290LnNldEF0dHJpYnV0ZShcImRhdGEtaWRtdS11bnNlbnRcIiwgXCJcIilcblx0XHRcdHJldHVybiB0cnVlXG5cdFx0fSBjYXRjaChleCkge1xuXHRcdFx0Y29uc29sZS5lcnJvcihleClcblx0XHRcdHRoaXMudWlNZXNzYWdlLnJvb3Quc2V0QXR0cmlidXRlKFwiZGF0YS1pZG11LWlnbm9yZVwiLCBcIlwiKVxuXHRcdFx0dGhyb3cgbmV3IEZhaWxlZFdvcmtmbG93RXhjZXB0aW9uKFwiRmFpbGVkIHRvIGV4ZWN1dGUgd29ya2Zsb3cgZm9yIHRoaXMgbWVzc2FnZVwiLCBleClcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogQHR5cGUge1VJTWVzc2FnZX1cblx0ICovXG5cdGdldCB1aU1lc3NhZ2UoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX3VpTWVzc2FnZVxuXHR9XG5cbn1cbmV4cG9ydCB7IEZhaWxlZFdvcmtmbG93RXhjZXB0aW9uIH1cbmV4cG9ydCBkZWZhdWx0IFVJUElNZXNzYWdlXG4iLCJpbXBvcnQgVUlDb21wb25lbnQgZnJvbSBcIi4vdWktY29tcG9uZW50LmpzXCJcblxuLyogZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLXVudXNlZC12YXJzICovXG5pbXBvcnQgVUlQSU1lc3NhZ2UgZnJvbSBcIi4uL3VpcGkvdWlwaS1tZXNzYWdlLmpzXCJcblxuLyoqXG4gKlxuICogQGFic3RyYWN0XG4gKi9cbmNsYXNzIFVJIGV4dGVuZHMgVUlDb21wb25lbnQge1xuXG5cdC8qKlxuXHQgKlxuXHQgKiBAYWJzdHJhY3Rcblx0ICogQHJldHVybnMge1VJfVxuXHQgKi9cblx0c3RhdGljIGNyZWF0ZSgpIHtcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAYWJzdHJhY3Rcblx0ICogQHBhcmFtIHtBYm9ydENvbnRyb2xsZXJ9IGFib3J0Q29udHJvbGxlclxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZX1cblx0ICovXG5cdC8qIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby11bnVzZWQtdmFycyAqL1xuXHRhc3luYyBmZXRjaEFuZFJlbmRlclRocmVhZE5leHRNZXNzYWdlUGFnZShhYm9ydENvbnRyb2xsZXIpIHtcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAYWJzdHJhY3Rcblx0ICogQHJldHVybnMge1Byb21pc2U8VUlQSU1lc3NhZ2U+fVxuXHQgKi9cblx0YXN5bmMgZ2V0TmV4dFVJUElNZXNzYWdlKCkge1xuXHR9XG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgVUlcbiIsIi8qKiBAbW9kdWxlIGRvbS1sb29rdXAgVXRpbHMgbW9kdWxlIGZvciBsb29raW5nIHVwIGVsZW1lbnRzIG9uIHRoZSBkZWZhdWx0IFVJICovXG5cbmltcG9ydCB7IHdhaXRGb3JFbGVtZW50IH0gZnJvbSBcIi4uLy4uL2RvbS9hc3luYy1ldmVudHMuanNcIlxuXG4vKipcbiAqXG4gKiBAcGFyYW0ge0VsZW1lbnR9IHJvb3RcbiAqIEBwYXJhbSB7QWJvcnRDb250cm9sbGVyfSBhYm9ydENvbnRyb2xsZXJcbiAqIEByZXR1cm5zIHtQcm9taXNlPEVsZW1lbnRbXT59XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRGaXJzdFZpc2libGVNZXNzYWdlKHJvb3QsIGFib3J0Q29udHJvbGxlcikge1xuXHRjb25zdCBlbGVtZW50cyA9IFsuLi5yb290LnF1ZXJ5U2VsZWN0b3JBbGwoXCJkaXZbcm9sZT1yb3ddOm5vdChbZGF0YS1pZG11LWlnbm9yZV0pXCIpXVxuXHRcdC5maWx0ZXIoZCA9PiBkLnRleHRDb250ZW50Lmxlbmd0aCA+IDMgJiYgZC50ZXh0Q29udGVudC5zdWJzdHJpbmcoMCwgMykgPT09IFwiWW91XCIpXG5cdGVsZW1lbnRzLnJldmVyc2UoKVxuXHRjb25zb2xlLmRlYnVnKFwiZ2V0Rmlyc3RWaXNpYmxlTWVzc2FnZVwiLCBlbGVtZW50cy5sZW5ndGgsIFwiZWxlbWVudHNcIilcblx0Zm9yKGNvbnN0IGVsZW1lbnQgb2YgZWxlbWVudHMpIHtcblx0XHRpZihhYm9ydENvbnRyb2xsZXIuc2lnbmFsLmFib3J0ZWQpIHtcblx0XHRcdGJyZWFrXG5cdFx0fVxuXHRcdGNvbnN0IHZpc2liaWxpdHlDaGVjayA9IGVsZW1lbnQuY2hlY2tWaXNpYmlsaXR5KHtcblx0XHRcdHZpc2liaWxpdHlQcm9wZXJ0eTogdHJ1ZSxcblx0XHRcdGNvbnRlbnRWaXNpYmlsaXR5QXV0bzogdHJ1ZSxcblx0XHRcdG9wYWNpdHlQcm9wZXJ0eTogdHJ1ZSxcblx0XHR9KVxuXHRcdGlmKHZpc2liaWxpdHlDaGVjayA9PT0gZmFsc2UpIHtcblx0XHRcdGNvbnNvbGUuZGVidWcoXCJ2aXNpYmlsaXR5Q2hlY2tcIiwgdmlzaWJpbGl0eUNoZWNrKVxuXHRcdFx0Y29udGludWVcblx0XHR9XG5cdFx0Y29uc3QgaXNJblZpZXcgPSBlbGVtZW50LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLnkgPiAxMDBcblx0XHRpZihpc0luVmlldyA9PT0gZmFsc2UpIHtcblx0XHRcdGNvbnNvbGUuZGVidWcoXCJpc0luVmlld1wiLCBpc0luVmlldylcblx0XHRcdGNvbnRpbnVlXG5cdFx0fVxuXHRcdGVsZW1lbnQuc2V0QXR0cmlidXRlKFwiZGF0YS1pZG11LWlnbm9yZVwiLCBcIlwiKSAvLyBOZXh0IGl0ZXJhdGlvbiBzaG91bGQgbm90IGluY2x1ZGUgdGhpcyBtZXNzYWdlXG5cdFx0Y29uc29sZS5kZWJ1ZyhcIk1lc3NhZ2UgaW4gdmlldywgdGVzdGluZyB3b3JrZmxvdy4uLlwiLCBlbGVtZW50KVxuXHRcdHJldHVybiBlbGVtZW50XG5cdH1cbn1cblxuLyoqXG4gKlxuICogQHBhcmFtIHtXaW5kb3d9IHdpbmRvd1xuICogQHJldHVybnMge0hUTUxEaXZFbGVtZW50fVxuICovXG5leHBvcnQgZnVuY3Rpb24gZmluZE1lc3NhZ2VzV3JhcHBlcih3aW5kb3cpIHtcblx0cmV0dXJuIHdpbmRvdy5kb2N1bWVudC5xdWVyeVNlbGVjdG9yKFwiZGl2W3JvbGU9Z3JpZF0gPiBkaXYgPiBkaXYgPiBkaXYgPiBkaXZcIilcbn1cblxuLyoqXG4gKlxuICogQHBhcmFtIHtFbGVtZW50fSByb290XG4gKiBAcGFyYW0ge0Fib3J0Q29udHJvbGxlcn0gYWJvcnRDb250cm9sbGVyXG4gKiBAcmV0dXJucyB7UHJvbWlzZTxib29sZWFuPn1cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGxvYWRNb3JlTWVzc2FnZXMocm9vdCwgYWJvcnRDb250cm9sbGVyKSB7XG5cdGNvbnNvbGUuZGVidWcoXCJsb2FkTW9yZU1lc3NhZ2VzIGxvb2tpbmcgZm9yIGxvYWRlci4uLiBcIilcblx0bGV0IGZpbmRMb2FkZXJUaW1lb3V0XG5cdGxldCBsb2FkaW5nRWxlbWVudFxuXHRsZXQgcmVzb2x2ZVRpbWVvdXRcblx0Y29uc3Qgc2Nyb2xsQWJvcnRDb250cm9sbGVyID0gbmV3IEFib3J0Q29udHJvbGxlcigpIC8vIFNlcGFyYXRlIGFib3J0Q29udHJvbGxlciB0byBzdG9wIHNjcm9sbGluZyBpZiB3ZSBjYW4ndCBmaW5kIHRoZSBsb2FkZXIgaW4gMTBzXG5cdGNvbnN0IGFib3J0SGFuZGxlciA9ICgpID0+IHtcblx0XHRzY3JvbGxBYm9ydENvbnRyb2xsZXIuYWJvcnQoKVxuXHRcdGNsZWFyVGltZW91dChmaW5kTG9hZGVyVGltZW91dClcblx0XHRpZihyZXNvbHZlVGltZW91dCkge1xuXHRcdFx0cmVzb2x2ZVRpbWVvdXQoKVxuXHRcdH1cblx0fVxuXHRhYm9ydENvbnRyb2xsZXIuc2lnbmFsLmFkZEV2ZW50TGlzdGVuZXIoXCJhYm9ydFwiLCBhYm9ydEhhbmRsZXIpXG5cdHJvb3Quc2Nyb2xsVG9wID0gMFxuXHR0cnkge1xuXHRcdGxvYWRpbmdFbGVtZW50ID0gYXdhaXQgUHJvbWlzZS5yYWNlKFtcblx0XHRcdHdhaXRGb3JFbGVtZW50KHJvb3QsICgpID0+IHtcblx0XHRcdFx0aWYocm9vdC5xdWVyeVNlbGVjdG9yKGBbcm9sZT1wcm9ncmVzc2Jhcl1gKSA9PT0gbnVsbCkge1xuXHRcdFx0XHRcdHJvb3Quc2Nyb2xsVG9wID0gMFxuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiByb290LnF1ZXJ5U2VsZWN0b3IoYFtyb2xlPXByb2dyZXNzYmFyXWApXG5cdFx0XHR9LCBzY3JvbGxBYm9ydENvbnRyb2xsZXIpLFxuXHRcdFx0bmV3IFByb21pc2UocmVzb2x2ZSA9PiB7XG5cdFx0XHRcdHJlc29sdmVUaW1lb3V0ID0gcmVzb2x2ZVxuXHRcdFx0XHRmaW5kTG9hZGVyVGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4geyAvLyBUT0RPIFJlcGxhY2Ugd2l0aCBmZXRjaCBvdmVycmlkZVxuXHRcdFx0XHRcdHJlc29sdmUoKVxuXHRcdFx0XHR9LCAxMDAwMCkgLy8gSURNVV9TQ1JPTExfREVURUNUSU9OX1RJTUVPVVRcblx0XHRcdH0pXG5cdFx0XSlcblx0fSBjYXRjaChleCkge1xuXHRcdGNvbnNvbGUuZXJyb3IoZXgpXG5cdH1cblx0c2Nyb2xsQWJvcnRDb250cm9sbGVyLmFib3J0KCkgLy8gSWYgaXQgdG9vayBtb3JlIHRoYW4gMTBzIHN0b3Agc2Nyb2xsaW5nXG5cdGFib3J0Q29udHJvbGxlci5zaWduYWwucmVtb3ZlRXZlbnRMaXN0ZW5lcihcImFib3J0XCIsIGFib3J0SGFuZGxlcilcblx0Y2xlYXJUaW1lb3V0KGZpbmRMb2FkZXJUaW1lb3V0KVxuXHRpZihsb2FkaW5nRWxlbWVudCAmJiBsb2FkaW5nRWxlbWVudCAhPT0gdHJ1ZSkge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJsb2FkTW9yZU1lc3NhZ2VzOiBGb3VuZCBsb2FkZXI7IFN0YW5kLWJ5IHVudGlsIGl0IGlzIHJlbW92ZWRcIilcblx0XHRjb25zb2xlLmRlYnVnKFwibG9hZE1vcmVNZXNzYWdlczogc2Nyb2xsVG9wXCIsIHJvb3Quc2Nyb2xsVG9wKVxuXHRcdGF3YWl0IHdhaXRGb3JFbGVtZW50KHJvb3QsICgpID0+IHJvb3QucXVlcnlTZWxlY3RvcihgW3JvbGU9cHJvZ3Jlc3NiYXJdYCkgPT09IG51bGwsIGFib3J0Q29udHJvbGxlcilcblx0fVxuXHRjb25zb2xlLmRlYnVnKFwibG9hZE1vcmVNZXNzYWdlczogTG9hZGVyIHdhcyByZW1vdmVkLCBvbGRlciBtZXNzYWdlcyBsb2FkaW5nIGNvbXBsZXRlZFwiKVxuXHRjb25zb2xlLmRlYnVnKGBsb2FkTW9yZU1lc3NhZ2VzOiBzY3JvbGxUb3AgaXMgJHtyb290LnNjcm9sbFRvcH0gd2UgJHtyb290LnNjcm9sbFRvcCA9PT0gMCA/IFwicmVhY2hlZCBsYXN0IHBhZ2VcIiA6IFwiZGlkIG5vdCByZWFjaCBsYXN0IHBhZ2UgYW5kIHdpbGwgYmVnaW4gbG9hZGluZyBvbGRlciBtZXNzYWdlcyBzaG9ydGx5XCJ9YCwgKVxuXHRyZXR1cm4gcm9vdC5zY3JvbGxUb3AgPT09IDBcbn1cbiIsIi8qKiBAbW9kdWxlIHVpLW1lc3NhZ2VzLXdyYXBwZXIgVUkgZWxlbWVudCByZXByZXNlbnRpbmcgdGhlIG1lc3NhZ2VzIHdyYXBwZXIgKi9cblxuaW1wb3J0IHsgbG9hZE1vcmVNZXNzYWdlcyB9IGZyb20gXCIuL2RvbS1sb29rdXAuanNcIlxuaW1wb3J0IFVJQ29tcG9uZW50IGZyb20gXCIuLi91aS1jb21wb25lbnQuanNcIlxuXG5jbGFzcyBVSU1lc3NhZ2VzV3JhcHBlciBleHRlbmRzIFVJQ29tcG9uZW50IHtcblxuXHQvKipcblx0ICogQHBhcmFtIHtBYm9ydENvbnRyb2xsZXJ9IGFib3J0Q29udHJvbGxlclxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZX1cblx0ICovXG5cdGZldGNoQW5kUmVuZGVyVGhyZWFkTmV4dE1lc3NhZ2VQYWdlKGFib3J0Q29udHJvbGxlcikge1xuXHRcdHJldHVybiBsb2FkTW9yZU1lc3NhZ2VzKHRoaXMucm9vdCwgYWJvcnRDb250cm9sbGVyKVxuXHR9XG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgVUlNZXNzYWdlc1dyYXBwZXJcbiIsIi8qKiBAbW9kdWxlIGRlZmF1bHQtdWkgRGVmYXVsdCBVSSAvIEVuZ2xpc2ggVUkgKi9cblxuaW1wb3J0IFVJIGZyb20gXCIuLi91aS5qc1wiXG5pbXBvcnQgeyBmaW5kTWVzc2FnZXNXcmFwcGVyLCBnZXRGaXJzdFZpc2libGVNZXNzYWdlIH0gZnJvbSBcIi4vZG9tLWxvb2t1cC5qc1wiXG5pbXBvcnQgVUlQSU1lc3NhZ2UgZnJvbSBcIi4uLy4uL3VpcGkvdWlwaS1tZXNzYWdlLmpzXCJcbmltcG9ydCBVSU1lc3NhZ2UgZnJvbSBcIi4vdWktbWVzc2FnZS5qc1wiXG5pbXBvcnQgVUlNZXNzYWdlc1dyYXBwZXIgZnJvbSBcIi4vdWktbWVzc2FnZXMtd3JhcHBlci5qc1wiXG5cbmNsYXNzIERlZmF1bHRVSSBleHRlbmRzIFVJIHtcblxuXHRjb25zdHJ1Y3Rvcihyb290LCBpZGVudGlmaWVyPXt9KSB7XG5cdFx0c3VwZXIocm9vdCwgaWRlbnRpZmllcilcblx0XHR0aGlzLmxhc3RTY3JvbGxUb3AgPSBudWxsXG5cdH1cblxuXHQvKipcblx0ICogQHBhcmFtIHtXaW5kb3d9IHdpbmRvd1xuXHQgKiBAcmV0dXJucyB7RGVmYXVsdFVJfVxuXHQgKi9cblx0c3RhdGljIGNyZWF0ZSh3aW5kb3cpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwiVUkgY3JlYXRlXCIpXG5cdFx0Y29uc3QgbWVzc2FnZXNXcmFwcGVyRWxlbWVudCA9IGZpbmRNZXNzYWdlc1dyYXBwZXIod2luZG93KVxuXHRcdGlmKG1lc3NhZ2VzV3JhcHBlckVsZW1lbnQgIT09IG51bGwpIHtcblx0XHRcdGNvbnNvbGUuZGVidWcoXCJGb3VuZCBtZXNzYWdlc1dyYXBwZXJFbGVtZW50XCIsIG1lc3NhZ2VzV3JhcHBlckVsZW1lbnQpXG5cdFx0XHRjb25zdCB1aU1lc3NhZ2VzV3JhcHBlciA9IG5ldyBVSU1lc3NhZ2VzV3JhcHBlcihtZXNzYWdlc1dyYXBwZXJFbGVtZW50KVxuXHRcdFx0cmV0dXJuIG5ldyBEZWZhdWx0VUkod2luZG93LCB7IHVpTWVzc2FnZXNXcmFwcGVyIH0pXG5cdFx0fSBlbHNlIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihcIlVuYWJsZSB0byBmaW5kIG1lc3NhZ2VzV3JhcHBlckVsZW1lbnRcIilcblx0XHR9XG5cdH1cblxuXHQvKipcblx0KiBAcGFyYW0ge0Fib3J0Q29udHJvbGxlcn0gYWJvcnRDb250cm9sbGVyXG5cdCogQHJldHVybnMge1Byb21pc2V9XG5cdCovXG5cdGFzeW5jIGZldGNoQW5kUmVuZGVyVGhyZWFkTmV4dE1lc3NhZ2VQYWdlKGFib3J0Q29udHJvbGxlcikge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJVSSBmZXRjaEFuZFJlbmRlclRocmVhZE5leHRNZXNzYWdlUGFnZVwiKVxuXHRcdHJldHVybiBhd2FpdCB0aGlzLmlkZW50aWZpZXIudWlNZXNzYWdlc1dyYXBwZXIuZmV0Y2hBbmRSZW5kZXJUaHJlYWROZXh0TWVzc2FnZVBhZ2UoYWJvcnRDb250cm9sbGVyKVxuXHR9XG5cblx0LyoqXG5cdCAqIEBwYXJhbSB7QWJvcnRDb250cm9sbGVyfSBhYm9ydENvbnRyb2xsZXJcblx0ICogQHJldHVybnMge1Byb21pc2U8VUlQSU1lc3NhZ2U+fVxuXHQgKi9cblx0YXN5bmMgZ2V0TmV4dFVJUElNZXNzYWdlKGFib3J0Q29udHJvbGxlcikge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJVSSBnZXROZXh0VUlQSU1lc3NhZ2VcIiwgdGhpcy5sYXN0U2Nyb2xsVG9wKVxuXHRcdGNvbnN0IHVpTWVzc2FnZXNXcmFwcGVyUm9vdCA9IHRoaXMuaWRlbnRpZmllci51aU1lc3NhZ2VzV3JhcHBlci5yb290XG5cdFx0Y29uc3Qgc3RhcnRTY3JvbGxUb3AgPSB0aGlzLmxhc3RTY3JvbGxUb3AgfHwgdWlNZXNzYWdlc1dyYXBwZXJSb290LnNjcm9sbEhlaWdodCAtIHVpTWVzc2FnZXNXcmFwcGVyUm9vdC5jbGllbnRIZWlnaHRcblx0XHRjb25zb2xlLmRlYnVnKFwic3RhcnRTY3JvbGxUb3BcIiwgc3RhcnRTY3JvbGxUb3ApXG5cdFx0Zm9yKGxldCBpID0gTWF0aC5tYXgoMSwgc3RhcnRTY3JvbGxUb3ApO2kgPiAwO2kgPSBpIC0gMzAgKSB7XG5cdFx0XHRpZihhYm9ydENvbnRyb2xsZXIuc2lnbmFsLmFib3J0ZWQpIHtcblx0XHRcdFx0YnJlYWtcblx0XHRcdH1cblx0XHRcdHRoaXMubGFzdFNjcm9sbFRvcCA9IGlcblx0XHRcdHVpTWVzc2FnZXNXcmFwcGVyUm9vdC5zY3JvbGxUb3AgPSBpXG5cdFx0XHR1aU1lc3NhZ2VzV3JhcHBlclJvb3QuZGlzcGF0Y2hFdmVudChuZXcgdGhpcy5yb290LkV2ZW50KFwic2Nyb2xsXCIpKVxuXHRcdFx0Y29uc29sZS5kZWJ1ZyhcInNjcm9sbFwiKVxuXHRcdFx0YXdhaXQgbmV3IFByb21pc2UocmVzb2x2ZSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIDIwKSlcblx0XHRcdHRyeSB7XG5cdFx0XHRcdGNvbnN0IG1lc3NhZ2VFbGVtZW50ID0gZ2V0Rmlyc3RWaXNpYmxlTWVzc2FnZSh1aU1lc3NhZ2VzV3JhcHBlclJvb3QsIGFib3J0Q29udHJvbGxlcilcblx0XHRcdFx0aWYobWVzc2FnZUVsZW1lbnQpIHtcblx0XHRcdFx0XHRjb25zdCB1aU1lc3NhZ2UgPSBuZXcgVUlNZXNzYWdlKG1lc3NhZ2VFbGVtZW50KVxuXHRcdFx0XHRcdHJldHVybiBuZXcgVUlQSU1lc3NhZ2UodWlNZXNzYWdlKVxuXHRcdFx0XHR9XG5cdFx0XHR9IGNhdGNoKGV4KSB7XG5cdFx0XHRcdGNvbnNvbGUuZXJyb3IoZXgpXG5cdFx0XHR9XG5cdFx0fVxuXHRcdC8vIFRPRE8gdGhyb3cgZW5kT2ZTY3JvbGxFeGNlcHRpb25cblx0XHRyZXR1cm4gZmFsc2UgLy8gZW5kIG9mIHNjcm9sbCByZWFjaGVkXG5cdH1cblxufVxuXG5leHBvcnQgZGVmYXVsdCBEZWZhdWx0VUlcbiIsIi8qKiBAbW9kdWxlIGdldC11aSBVSSBsb2FkZXIgbW9kdWxlLiBBbGxvdyBsb2FkaW5nIG9mIGEgY2VydGFpbiBVSSBiYXNlZCBvbiBhIGdpdmVuIHN0cmF0ZWd5IChsb2NhbGUgZXRjLi4pXG4gKiBUaGVyZSBtaWdodCBiZSBuZWVkIGZvciBtdWx0aXBsZSBVSSBhcyBJbnN0YWdyYW0gbWlnaHQgc2VydmUgZGlmZmVyZW50IGFwcHMgYmFzZWQgb24gbG9jYXRpb24gZm9yIGV4YW1wbGUuXG4gKiBUaGVyZSBpcyBhbHNvIGEgbmVlZCB0byBpbnRlcm5hdGlvbmFsaXplIGVhY2ggdWkgc28gdGhhdCBpdCBkb2Vzbid0IGZhaWwgaWYgd2UgY2hhbmdlIHRoZSBsYW5ndWFnZS5cbiAqL1xuXG5pbXBvcnQgRGVmYXVsdFVJIGZyb20gXCIuL2RlZmF1bHQvZGVmYXVsdC11aS5qc1wiXG4vKiBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tdW51c2VkLXZhcnMgKi9cbmltcG9ydCBVSSBmcm9tIFwiLi91aS5qc1wiXG5cbi8qKlxuICpcbiAqIEByZXR1cm5zIHtVSX1cbiAqL1xuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gZ2V0VUkoKSB7XG5cdHJldHVybiBEZWZhdWx0VUlcbn1cbiIsIi8qKiBAbW9kdWxlIHVpcGkgQVBJIGZvciBVSSAqL1xuXG5pbXBvcnQgZ2V0VUkgZnJvbSBcIi4uL3VpL2dldC11aS5qc1wiXG5cbi8qIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby11bnVzZWQtdmFycyAqL1xuaW1wb3J0IFVJIGZyb20gXCIuLi91aS91aS5qc1wiXG4vKiBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tdW51c2VkLXZhcnMgKi9cbmltcG9ydCBVSVBJTWVzc2FnZSBmcm9tIFwiLi91aXBpLW1lc3NhZ2UuanNcIlxuXG4vKipcbiAqIFVJIEludGVyZmFjZSBBUElcbiAqL1xuY2xhc3MgVUlQSSB7XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7VUl9IHVpXG5cdCAqL1xuXHRjb25zdHJ1Y3Rvcih1aSkge1xuXHRcdHRoaXMuX3VpID0gdWlcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge1dpbmRvd30gd2luZG93XG5cdCAqIEByZXR1cm5zIHtVSVBJfVxuXHQgKi9cblx0c3RhdGljIGNyZWF0ZSh3aW5kb3cpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwiVUlQSS5jcmVhdGVcIilcblx0XHRjb25zdCB1aSA9IGdldFVJKCkuY3JlYXRlKHdpbmRvdylcblx0XHRyZXR1cm4gbmV3IFVJUEkodWkpXG5cdH1cblxuXHQvKipcblx0ICogQHBhcmFtIHtBYm9ydENvbnRyb2xsZXJ9IGFib3J0Q29udHJvbGxlclxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZX1cblx0ICovXG5cdGZldGNoQW5kUmVuZGVyVGhyZWFkTmV4dE1lc3NhZ2VQYWdlKGFib3J0Q29udHJvbGxlcikge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJVSVBJIGZldGNoQW5kUmVuZGVyVGhyZWFkTmV4dE1lc3NhZ2VQYWdlXCIpXG5cdFx0cmV0dXJuIHRoaXMudWkuZmV0Y2hBbmRSZW5kZXJUaHJlYWROZXh0TWVzc2FnZVBhZ2UoYWJvcnRDb250cm9sbGVyKVxuXHR9XG5cblx0LyoqXG5cdCAqIEBwYXJhbSB7QWJvcnRDb250cm9sbGVyfSBhYm9ydENvbnRyb2xsZXJcblx0ICogQHJldHVybnMge1Byb21pc2U8VUlQSU1lc3NhZ2U+fVxuXHQgKi9cblx0Z2V0TmV4dFVJUElNZXNzYWdlKGFib3J0Q29udHJvbGxlcikge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJVSVBJIGdldE5leHRVSVBJTWVzc2FnZVwiKVxuXHRcdHJldHVybiB0aGlzLnVpLmdldE5leHRVSVBJTWVzc2FnZShhYm9ydENvbnRyb2xsZXIpXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHR5cGUge1VJfVxuXHQgKi9cblx0Z2V0IHVpKCkge1xuXHRcdHJldHVybiB0aGlzLl91aVxuXHR9XG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgVUlQSVxuIiwiLyoqIEBtb2R1bGUgaWRtdSBHbG9iYWwvTWFpbiBBUEkgZm9yIGludGVyYWN0aW5nIHdpdGggdGhlIFVJICovXG5cbmltcG9ydCBVSVBJIGZyb20gXCIuLi91aXBpL3VpcGkuanNcIlxuLyogZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLXVudXNlZC12YXJzICovXG5pbXBvcnQgVUlQSU1lc3NhZ2UgZnJvbSBcIi4uL3VpcGkvdWlwaS1tZXNzYWdlLmpzXCJcblxuY2xhc3MgSURNVSB7XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7V2luZG93fSB3aW5kb3dcblx0ICogQHBhcmFtIHtjYWxsYmFja30gb25TdGF0dXNUZXh0XG5cdCAqL1xuXHRjb25zdHJ1Y3Rvcih3aW5kb3csIG9uU3RhdHVzVGV4dCkge1xuXHRcdHRoaXMud2luZG93ID0gd2luZG93XG5cdFx0dGhpcy51aXBpID0gbnVsbFxuXHRcdHRoaXMub25TdGF0dXNUZXh0ID0gb25TdGF0dXNUZXh0XG5cdH1cblxuXHQvKipcblx0ICogQHBhcmFtIHtBYm9ydENvbnRyb2xsZXJ9IGFib3J0Q29udHJvbGxlclxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZTxVSVBJTWVzc2FnZT59XG5cdCAqL1xuXHRnZXROZXh0VUlQSU1lc3NhZ2UoYWJvcnRDb250cm9sbGVyKSB7XG5cdFx0cmV0dXJuIHRoaXMudWlwaS5nZXROZXh0VUlQSU1lc3NhZ2UoYWJvcnRDb250cm9sbGVyKVxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0XG5cdCAqL1xuXHRzZXRTdGF0dXNUZXh0KHRleHQpIHtcblx0XHR0aGlzLm9uU3RhdHVzVGV4dCh0ZXh0KVxuXHR9XG5cblxuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHtBYm9ydENvbnRyb2xsZXJ9IGFib3J0Q29udHJvbGxlclxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZX1cblx0ICovXG5cdGZldGNoQW5kUmVuZGVyVGhyZWFkTmV4dE1lc3NhZ2VQYWdlKGFib3J0Q29udHJvbGxlcikge1xuXHRcdHJldHVybiB0aGlzLnVpcGkuZmV0Y2hBbmRSZW5kZXJUaHJlYWROZXh0TWVzc2FnZVBhZ2UoYWJvcnRDb250cm9sbGVyKVxuXHR9XG5cblx0LyoqXG5cdCAqIE1hcCBJbnN0YWdyYW0gVUlcblx0ICovXG5cdGxvYWRVSVBJKCkge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJsb2FkVUlQSVwiKVxuXHRcdHRoaXMudWlwaSA9IFVJUEkuY3JlYXRlKHRoaXMud2luZG93KVxuXHR9XG5cblxufVxuZXhwb3J0IGRlZmF1bHQgSURNVVxuIiwiLyoqIEBtb2R1bGUgdW5zZW5kLXN0cmF0ZWd5IFZhcmlvdXMgc3RyYXRlZ2llcyBmb3IgdW5zZW5kaW5nIG1lc3NhZ2VzICovXG5cbi8qIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby11bnVzZWQtdmFycyAqL1xuaW1wb3J0IElETVUgZnJvbSBcIi4uL2lkbXUvaWRtdS5qc1wiXG5cbi8qKlxuICpcbiAqIEBhYnN0cmFjdFxuICovXG5jbGFzcyBVbnNlbmRTdHJhdGVneSB7XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7SURNVX0gaWRtdVxuXHQgKi9cblx0Y29uc3RydWN0b3IoaWRtdSkge1xuXHRcdHRoaXMuX2lkbXUgPSBpZG11XG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQGFic3RyYWN0XG5cdCAqIEByZXR1cm5zIHtib29sZWFufVxuXHQgKi9cblx0aXNSdW5uaW5nKCkge1xuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBhYnN0cmFjdFxuXHQgKi9cblx0c3RvcCgpIHtcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAYWJzdHJhY3Rcblx0ICovXG5cdHJlc2V0KCkge1xuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBhYnN0cmFjdFxuXHQgKi9cblx0YXN5bmMgcnVuKCkge1xuXHR9XG5cblx0LyoqXG5cdCAqIEByZWFkb25seVxuXHQgKiBAdHlwZSB7SURNVX1cblx0ICovXG5cdGdldCBpZG11KCkge1xuXHRcdHJldHVybiB0aGlzLl9pZG11XG5cdH1cblxufVxuXG5leHBvcnQgeyBVbnNlbmRTdHJhdGVneSB9XG4iLCIvKiogQG1vZHVsZSB1bnNlbmQtc3RyYXRlZ3kgVmFyaW91cyBzdHJhdGVnaWVzIGZvciB1bnNlbmRpbmcgbWVzc2FnZXMgKi9cblxuLyogZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLXVudXNlZC12YXJzICovXG5pbXBvcnQgSURNVSBmcm9tIFwiLi4vLi4vaWRtdS9pZG11LmpzXCJcbmltcG9ydCB7IFVuc2VuZFN0cmF0ZWd5IH0gZnJvbSBcIi4uL3Vuc2VuZC1zdHJhdGVneS5qc1wiXG5cbi8qKlxuICogTG9hZHMgbXVsdGlwbGUgcGFnZXMgYmVmb3JlIHVuc2VuZGluZyBtZXNzYWdlXG4gKi9cbmNsYXNzIERlZmF1bHRTdHJhdGVneSBleHRlbmRzIFVuc2VuZFN0cmF0ZWd5IHtcblxuXHQvKipcblx0ICogQHBhcmFtIHtJRE1VfSBpZG11XG5cdCAqL1xuXHRjb25zdHJ1Y3RvcihpZG11KSB7XG5cdFx0c3VwZXIoaWRtdSlcblx0XHR0aGlzLl9hbGxQYWdlc0xvYWRlZCA9IGZhbHNlXG5cdFx0dGhpcy5fdW5zZW50Q291bnQgPSAwXG5cdFx0dGhpcy5fcGFnZXNMb2FkZWRDb3VudCA9IDBcblx0XHR0aGlzLl9ydW5uaW5nID0gZmFsc2Vcblx0XHR0aGlzLl9hYm9ydENvbnRyb2xsZXIgPSBudWxsXG5cdFx0dGhpcy5fbGFzdFVuc2VuZERhdGUgPSBudWxsXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHJldHVybnMge2Jvb2xlYW59XG5cdCAqL1xuXHRpc1J1bm5pbmcoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX3J1bm5pbmcgJiYgdGhpcy5fYWJvcnRDb250cm9sbGVyICYmIHRoaXMuX2Fib3J0Q29udHJvbGxlci5zaWduYWwuYWJvcnRlZCA9PT0gZmFsc2Vcblx0fVxuXG5cdHN0b3AoKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIkRlZmF1bHRTdHJhdGVneSBzdG9wXCIpXG5cdFx0dGhpcy5pZG11LnNldFN0YXR1c1RleHQoXCJTdG9wcGluZy4uLlwiKVxuXHRcdHRoaXMuX2Fib3J0Q29udHJvbGxlci5hYm9ydCgpXG5cdH1cblxuXHRyZXNldCgpIHtcblx0XHR0aGlzLl9hbGxQYWdlc0xvYWRlZCA9IGZhbHNlXG5cdFx0dGhpcy5fdW5zZW50Q291bnQgPSAwXG5cdFx0dGhpcy5fbGFzdFVuc2VuZERhdGUgPSBudWxsXG5cdFx0dGhpcy5fcGFnZXNMb2FkZWRDb3VudCA9IDBcblx0XHR0aGlzLmlkbXUuc2V0U3RhdHVzVGV4dChcIlJlYWR5XCIpXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHJldHVybnMge1Byb21pc2V9XG5cdCAqL1xuXHRhc3luYyBydW4oKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIkRlZmF1bHRTdHJhdGVneS5ydW4oKVwiKVxuXHRcdHRoaXMuX3Vuc2VudENvdW50ID0gMFxuXHRcdHRoaXMuX3BhZ2VzTG9hZGVkQ291bnQgPSAwXG5cdFx0dGhpcy5fcnVubmluZyA9IHRydWVcblx0XHR0aGlzLl9hYm9ydENvbnRyb2xsZXIgPSBuZXcgQWJvcnRDb250cm9sbGVyKClcblx0XHR0aGlzLmlkbXUubG9hZFVJUEkoKVxuXHRcdHRyeSB7XG5cdFx0XHRpZih0aGlzLl9hbGxQYWdlc0xvYWRlZCkge1xuXHRcdFx0XHRhd2FpdCB0aGlzLiN1bnNlbmROZXh0TWVzc2FnZSgpXG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRhd2FpdCB0aGlzLiNsb2FkTmV4dFBhZ2UoKVxuXHRcdFx0fVxuXHRcdFx0aWYodGhpcy5fYWJvcnRDb250cm9sbGVyLnNpZ25hbC5hYm9ydGVkKSB7XG5cdFx0XHRcdHRoaXMuaWRtdS5zZXRTdGF0dXNUZXh0KGBBYm9ydGVkLiAke3RoaXMuX3Vuc2VudENvdW50fSBtZXNzYWdlKHMpIHVuc2VudC5gKVxuXHRcdFx0XHRjb25zb2xlLmRlYnVnKFwiRGVmYXVsdFN0cmF0ZWd5IGFib3J0ZWRcIilcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuaWRtdS5zZXRTdGF0dXNUZXh0KGBEb25lLiAke3RoaXMuX3Vuc2VudENvdW50fSBtZXNzYWdlKHMpIHVuc2VudC5gKVxuXHRcdFx0XHRjb25zb2xlLmRlYnVnKFwiRGVmYXVsdFN0cmF0ZWd5IGRvbmVcIilcblx0XHRcdH1cblx0XHR9IGNhdGNoKGV4KSB7XG5cdFx0XHRjb25zb2xlLmVycm9yKGV4KVxuXHRcdFx0dGhpcy5pZG11LnNldFN0YXR1c1RleHQoYEVycm9yZWQuICR7dGhpcy5fdW5zZW50Q291bnR9IG1lc3NhZ2UocykgdW5zZW50LmApXG5cdFx0XHRjb25zb2xlLmRlYnVnKFwiRGVmYXVsdFN0cmF0ZWd5IGVycm9yZWRcIilcblx0XHR9XG5cdFx0dGhpcy5fcnVubmluZyA9IGZhbHNlXG5cdH1cblxuXHQvKipcblx0ICogVHJpZXMgdG8gbG9hZCB0aGUgdGhyZWFkIG5leHQgcGFnZVxuXHQgKi9cblx0YXN5bmMgI2xvYWROZXh0UGFnZSgpIHtcblx0XHRpZih0aGlzLl9hYm9ydENvbnRyb2xsZXIuc2lnbmFsLmFib3J0ZWQpIHtcblx0XHRcdHJldHVyblxuXHRcdH1cblx0XHR0aGlzLmlkbXUuc2V0U3RhdHVzVGV4dChcIkxvYWRpbmcgbmV4dCBwYWdlLi4uXCIpXG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IGRvbmUgPSBhd2FpdCB0aGlzLmlkbXUuZmV0Y2hBbmRSZW5kZXJUaHJlYWROZXh0TWVzc2FnZVBhZ2UodGhpcy5fYWJvcnRDb250cm9sbGVyKVxuXHRcdFx0aWYodGhpcy5fYWJvcnRDb250cm9sbGVyLnNpZ25hbC5hYm9ydGVkID09PSBmYWxzZSkge1xuXHRcdFx0XHRpZihkb25lKSB7XG5cdFx0XHRcdFx0dGhpcy5pZG11LnNldFN0YXR1c1RleHQoYEFsbCBwYWdlcyBsb2FkZWQgKCR7dGhpcy5fcGFnZXNMb2FkZWRDb3VudH0gaW4gdG90YWwpLi4uYClcblx0XHRcdFx0XHR0aGlzLl9hbGxQYWdlc0xvYWRlZCA9IHRydWVcblx0XHRcdFx0XHRhd2FpdCB0aGlzLiN1bnNlbmROZXh0TWVzc2FnZSgpXG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dGhpcy5fcGFnZXNMb2FkZWRDb3VudCsrXG5cdFx0XHRcdFx0YXdhaXQgdGhpcy4jbG9hZE5leHRQYWdlKClcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0gY2F0Y2goZXgpIHtcblx0XHRcdGNvbnNvbGUuZXJyb3IoZXgpXG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIFVuc2VuZCBmaXJzdCBtZXNzYWdlIGluIHZpZXdwb3J0XG5cdCAqL1xuXHRhc3luYyAjdW5zZW5kTmV4dE1lc3NhZ2UoKSB7XG5cdFx0aWYodGhpcy5fYWJvcnRDb250cm9sbGVyLnNpZ25hbC5hYm9ydGVkKSB7XG5cdFx0XHRyZXR1cm5cblx0XHR9XG5cdFx0bGV0IGNhblNjcm9sbCA9IHRydWVcblx0XHR0cnkge1xuXHRcdFx0dGhpcy5pZG11LnNldFN0YXR1c1RleHQoXCJSZXRyaWV2aW5nIG5leHQgbWVzc2FnZS4uLlwiKVxuXHRcdFx0Y29uc3QgdWlwaU1lc3NhZ2UgPSBhd2FpdCB0aGlzLmlkbXUuZ2V0TmV4dFVJUElNZXNzYWdlKHRoaXMuX2Fib3J0Q29udHJvbGxlcilcblx0XHRcdGNhblNjcm9sbCA9IHVpcGlNZXNzYWdlICE9PSBmYWxzZVxuXHRcdFx0aWYodWlwaU1lc3NhZ2UpIHtcblx0XHRcdFx0dGhpcy5pZG11LnNldFN0YXR1c1RleHQoXCJVbnNlbmRpbmcgbWVzc2FnZS4uLlwiKVxuXHRcdFx0XHRpZiAodGhpcy5fbGFzdFVuc2VuZERhdGUgIT09IG51bGwpIHtcblx0XHRcdFx0XHRjb25zdCBsYXN0VW5zZW5kRGF0ZURpZmYgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKSAtIHRoaXMuX2xhc3RVbnNlbmREYXRlLmdldFRpbWUoKVxuXHRcdFx0XHRcdGlmKGxhc3RVbnNlbmREYXRlRGlmZiA8IDEwMDApIHtcblx0XHRcdFx0XHRcdHRoaXMuaWRtdS5zZXRTdGF0dXNUZXh0KGBXYWl0aW5nICR7bGFzdFVuc2VuZERhdGVEaWZmfW1zIGJlZm9yZSB1bnNlbmRpbmcgbmV4dCBtZXNzYWdlLi4uYClcblx0XHRcdFx0XHRcdGF3YWl0IG5ldyBQcm9taXNlKHJlc29sdmUgPT4gc2V0VGltZW91dChyZXNvbHZlLCBsYXN0VW5zZW5kRGF0ZURpZmYpKVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRjb25zdCB1bnNlbnQgPSBhd2FpdCB1aXBpTWVzc2FnZS51bnNlbmQodGhpcy5fYWJvcnRDb250cm9sbGVyKVxuXHRcdFx0XHRpZih1bnNlbnQpIHtcblx0XHRcdFx0XHR0aGlzLl9sYXN0VW5zZW5kRGF0ZSA9IG5ldyBEYXRlKClcblx0XHRcdFx0XHR0aGlzLl91bnNlbnRDb3VudCsrXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9IGNhdGNoKGV4KSB7XG5cdFx0XHRjb25zb2xlLmVycm9yKGV4KVxuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRpZihjYW5TY3JvbGwpIHtcblx0XHRcdFx0YXdhaXQgdGhpcy4jdW5zZW5kTmV4dE1lc3NhZ2UoKVxuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG59XG5cbmV4cG9ydCB7IERlZmF1bHRTdHJhdGVneSB9XG4iLCIvKiogQG1vZHVsZSBhbGVydCBBbGVydCBVSSAqL1xuXG4vKipcbiAqXG4gKiBAcGFyYW0ge0RvY3VtZW50fSBkb2N1bWVudFxuICogQHJldHVybnMge0hUTUxCdXR0b25FbGVtZW50fVxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQWxlcnRzV3JhcHBlckVsZW1lbnQoZG9jdW1lbnQpIHtcblx0Y29uc3QgYWxlcnRzV3JhcHBlckVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpXG5cdGFsZXJ0c1dyYXBwZXJFbGVtZW50LmlkID0gXCJpZG11LWFsZXJ0c1wiXG5cdGFsZXJ0c1dyYXBwZXJFbGVtZW50LnN0eWxlLnBvc2l0aW9uID0gXCJmaXhlZFwiXG5cdGFsZXJ0c1dyYXBwZXJFbGVtZW50LnN0eWxlLnRvcCA9IFwiMjBweFwiXG5cdGFsZXJ0c1dyYXBwZXJFbGVtZW50LnN0eWxlLnJpZ2h0ID0gXCIyMHB4XCJcblx0YWxlcnRzV3JhcHBlckVsZW1lbnQuc3R5bGUuZGlzcGxheSA9IFwiZ3JpZFwiXG5cdHJldHVybiBhbGVydHNXcmFwcGVyRWxlbWVudFxufVxuXG4vKipcbiAqXG4gKiBAcGFyYW0ge0RvY3VtZW50fSBkb2N1bWVudFxuICogQHBhcmFtIHtzdHJpbmd9ICAgdGV4dFxuICogQHJldHVybnMge0hUTUxCdXR0b25FbGVtZW50fVxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQWxlcnRFbGVtZW50KGRvY3VtZW50LCB0ZXh0KSB7XG5cdGNvbnN0IGFsZXJ0RWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIilcblx0YWxlcnRFbGVtZW50LnRleHRDb250ZW50ID0gdGV4dFxuXHRyZXR1cm4gYWxlcnRFbGVtZW50XG59XG4iLCIvKiogQG1vZHVsZSBvdmVybGF5IElETVUncyBvdmVybGF5ICovXG5cbi8qKlxuICogQHBhcmFtIHtEb2N1bWVudH0gZG9jdW1lbnRcbiAqIEByZXR1cm5zIHtIVE1MRGl2RWxlbWVudH1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZU92ZXJsYXlFbGVtZW50KGRvY3VtZW50KSB7XG5cdGNvbnN0IG92ZXJsYXlFbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKVxuXHRvdmVybGF5RWxlbWVudC5pZCA9IFwiaWRtdS1vdmVybGF5XCJcblx0b3ZlcmxheUVsZW1lbnQudGFiSW5kZXggPSAwXG5cdG92ZXJsYXlFbGVtZW50LnN0eWxlLnRvcCA9IFwiMFwiXG5cdG92ZXJsYXlFbGVtZW50LnN0eWxlLnJpZ2h0ID0gXCIwXCJcblx0b3ZlcmxheUVsZW1lbnQuc3R5bGUucG9zaXRpb24gPSBcImZpeGVkXCJcblx0b3ZlcmxheUVsZW1lbnQuc3R5bGUud2lkdGggPSBcIjEwMHZ3XCJcblx0b3ZlcmxheUVsZW1lbnQuc3R5bGUuaGVpZ2h0ID0gXCIxMDB2aFwiXG5cdG92ZXJsYXlFbGVtZW50LnN0eWxlLnpJbmRleCA9IFwiOTk4XCJcblx0b3ZlcmxheUVsZW1lbnQuc3R5bGUuYmFja2dyb3VuZENvbG9yID0gXCIjMDAwMDAwZDZcIlxuXHRvdmVybGF5RWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCJcblx0cmV0dXJuIG92ZXJsYXlFbGVtZW50XG59XG4iLCIvKiogQG1vZHVsZSB1aSBJRE1VJ3Mgb3duIHVpL292ZXJsYXlcbiAqIFByb3ZpZGUgYSBidXR0b24gdG8gdW5zZW5kIG1lc3NhZ2VzXG4gKi9cblxuaW1wb3J0IHsgY3JlYXRlTWVudUJ1dHRvbkVsZW1lbnQgfSBmcm9tIFwiLi9tZW51LWJ1dHRvbi5qc1wiXG5pbXBvcnQgeyBjcmVhdGVNZW51RWxlbWVudCB9IGZyb20gXCIuL21lbnUuanNcIlxuaW1wb3J0IElETVUgZnJvbSBcIi4uLy4uLy4uL2lkbXUvaWRtdS5qc1wiXG5pbXBvcnQgeyBEZWZhdWx0U3RyYXRlZ3kgfSBmcm9tIFwiLi4vLi4vLi4vdWkvZGVmYXVsdC91bnNlbmQtc3RyYXRlZ3kuanNcIlxuaW1wb3J0IHsgY3JlYXRlQWxlcnRzV3JhcHBlckVsZW1lbnQgfSBmcm9tIFwiLi9hbGVydC5qc1wiXG5pbXBvcnQgeyBjcmVhdGVPdmVybGF5RWxlbWVudCB9IGZyb20gXCIuL292ZXJsYXkuanNcIlxuaW1wb3J0IHsgQlVUVE9OX1NUWUxFIH0gZnJvbSBcIi4vc3R5bGUvaW5zdGFncmFtLmpzXCJcbi8qIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby11bnVzZWQtdmFycyAqL1xuaW1wb3J0IHsgVW5zZW5kU3RyYXRlZ3kgfSBmcm9tIFwiLi4vLi4vLi4vdWkvdW5zZW5kLXN0cmF0ZWd5LmpzXCJcblxuY2xhc3MgT1NEIHtcblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7RG9jdW1lbnR9IGRvY3VtZW50XG5cdCAqIEBwYXJhbSB7SFRNTERpdkVsZW1lbnR9IHJvb3Rcblx0ICogQHBhcmFtIHtIVE1MRGl2RWxlbWVudH0gb3ZlcmxheUVsZW1lbnRcblx0ICogQHBhcmFtIHtIVE1MRGl2RWxlbWVudH0gbWVudUVsZW1lbnRcblx0ICogQHBhcmFtIHtIVE1MQnV0dG9uRWxlbWVudH0gdW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b25cblx0ICogQHBhcmFtIHtIVE1MRGl2RWxlbWVudH0gc3RhdHVzRWxlbWVudFxuXHQgKi9cblx0Y29uc3RydWN0b3IoZG9jdW1lbnQsIHJvb3QsIG92ZXJsYXlFbGVtZW50LCBtZW51RWxlbWVudCwgdW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24sIHN0YXR1c0VsZW1lbnQpIHtcblx0XHR0aGlzLl9kb2N1bWVudCA9IGRvY3VtZW50XG5cdFx0dGhpcy5fcm9vdCA9IHJvb3Rcblx0XHR0aGlzLl9vdmVybGF5RWxlbWVudCA9IG92ZXJsYXlFbGVtZW50XG5cdFx0dGhpcy5fbWVudUVsZW1lbnQgPSBtZW51RWxlbWVudFxuXHRcdHRoaXMuX3N0YXR1c0VsZW1lbnQgPSBzdGF0dXNFbGVtZW50XG5cdFx0dGhpcy5fdW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24gPSB1bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvblxuXHRcdHRoaXMuX2lkbXUgPSBuZXcgSURNVSh0aGlzLndpbmRvdywgdGhpcy5vblN0YXR1c1RleHQuYmluZCh0aGlzKSlcblx0XHR0aGlzLl9zdHJhdGVneSA9IG5ldyBEZWZhdWx0U3RyYXRlZ3kodGhpcy5faWRtdSkgLy8gVE9ETyBtb3ZlIG91dFxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7d2luZG93fSB3aW5kb3dcblx0ICogQHJldHVybnMge09TRH1cblx0ICovXG5cdHN0YXRpYyByZW5kZXIod2luZG93KSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcInJlbmRlclwiKVxuXHRcdGNvbnN0IHVpID0gT1NELmNyZWF0ZSh3aW5kb3cuZG9jdW1lbnQpXG5cdFx0d2luZG93LmRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQodWkucm9vdClcblx0XHRyZXR1cm4gdWlcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0gICB7RG9jdW1lbnR9IGRvY3VtZW50XG5cdCAqIEByZXR1cm5zIHtPU0R9XG5cdCAqL1xuXHRzdGF0aWMgY3JlYXRlKGRvY3VtZW50KSB7XG5cdFx0Y29uc3Qgcm9vdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIilcblx0XHRyb290LmlkID0gXCJpZG11LXJvb3RcIlxuXHRcdGNvbnN0IG1lbnVFbGVtZW50ID0gY3JlYXRlTWVudUVsZW1lbnQoZG9jdW1lbnQpXG5cdFx0Y29uc3Qgb3ZlcmxheUVsZW1lbnQgPSBjcmVhdGVPdmVybGF5RWxlbWVudChkb2N1bWVudClcblx0XHRjb25zdCBhbGVydHNXcmFwcGVyRWxlbWVudCA9IGNyZWF0ZUFsZXJ0c1dyYXBwZXJFbGVtZW50KGRvY3VtZW50KVxuXHRcdGNvbnN0IHVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uID0gY3JlYXRlTWVudUJ1dHRvbkVsZW1lbnQoZG9jdW1lbnQsIFwiVW5zZW5kIGFsbCBETXNcIiwgQlVUVE9OX1NUWUxFLlBSSU1BUlkpXG5cdFx0Y29uc3Qgc3RhdHVzRWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIilcblx0XHRzdGF0dXNFbGVtZW50LnRleHRDb250ZW50ID0gXCJSZWFkeVwiXG5cdFx0c3RhdHVzRWxlbWVudC5pZCA9IFwiaWRtdS1zdGF0dXNcIlxuXHRcdHN0YXR1c0VsZW1lbnQuc3R5bGUgPSBcIndpZHRoOiAyMDBweFwiXG5cdFx0ZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChvdmVybGF5RWxlbWVudClcblx0XHRkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGFsZXJ0c1dyYXBwZXJFbGVtZW50KVxuXHRcdG1lbnVFbGVtZW50LmFwcGVuZENoaWxkKHVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uKVxuXHRcdG1lbnVFbGVtZW50LmFwcGVuZENoaWxkKHN0YXR1c0VsZW1lbnQpXG5cdFx0cm9vdC5hcHBlbmRDaGlsZChtZW51RWxlbWVudClcblx0XHRjb25zdCB1aSA9IG5ldyBPU0QoZG9jdW1lbnQsIHJvb3QsIG92ZXJsYXlFbGVtZW50LCBtZW51RWxlbWVudCwgdW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24sIHN0YXR1c0VsZW1lbnQpXG5cdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcImtleWRvd25cIiwgKGV2ZW50KSA9PiB1aS4jb25XaW5kb3dLZXlFdmVudChldmVudCkpIC8vIFRPRE8gdGVzdFxuXHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJrZXl1cFwiLCAoZXZlbnQpID0+IHVpLiNvbldpbmRvd0tleUV2ZW50KGV2ZW50KSkgLy8gVE9ETyB0ZXN0XG5cdFx0dW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIChldmVudCkgPT4gdWkuI29uVW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b25DbGljayhldmVudCkpXG5cdFx0dWkuX211dGF0aW9uT2JzZXJ2ZXIgPSBuZXcgTXV0YXRpb25PYnNlcnZlcigobXV0YXRpb25zKSA9PiB1aS4jb25NdXRhdGlvbnModWksIG11dGF0aW9ucykpXG5cdFx0dWkuX211dGF0aW9uT2JzZXJ2ZXIub2JzZXJ2ZShkb2N1bWVudC5ib2R5LCB7IGNoaWxkTGlzdDogdHJ1ZSB9KSAvLyBUT0RPIHRlc3Rcblx0XHR1bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbi5kYXRhVGV4dENvbnRlbnQgPSB1bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbi50ZXh0Q29udGVudFxuXHRcdHVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uLmRhdGFCYWNrZ3JvdW5kQ29sb3IgPSB1bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbi5zdHlsZS5iYWNrZ3JvdW5kQ29sb3Jcblx0XHRyZXR1cm4gdWlcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gdGV4dFxuXHQgKi9cblx0b25TdGF0dXNUZXh0KHRleHQpIHtcblx0XHR0aGlzLnN0YXR1c0VsZW1lbnQudGV4dENvbnRlbnQgPSB0ZXh0XG5cdH1cblxuXHRhc3luYyAjc3RhcnRVbnNlbmRpbmcoKSB7XG5cdFx0O1suLi50aGlzLm1lbnVFbGVtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoXCJidXR0b25cIildLmZpbHRlcihidXR0b24gPT4gYnV0dG9uICE9PSB0aGlzLnVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uKS5mb3JFYWNoKGJ1dHRvbiA9PiB7XG5cdFx0XHRidXR0b24uc3R5bGUudmlzaWJpbGl0eSA9IFwiaGlkZGVuXCJcblx0XHRcdGJ1dHRvbi5kaXNhYmxlZCA9IHRydWVcblx0XHR9KVxuXHRcdHRoaXMub3ZlcmxheUVsZW1lbnQuc3R5bGUuZGlzcGxheSA9IFwiXCJcblx0XHR0aGlzLm92ZXJsYXlFbGVtZW50LmZvY3VzKClcblx0XHR0aGlzLnVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uLnRleHRDb250ZW50ID0gXCJTdG9wIHByb2Nlc3NpbmdcIlxuXHRcdHRoaXMudW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24uc3R5bGUuYmFja2dyb3VuZENvbG9yID0gXCIjRkEzODNFXCJcblx0XHR0aGlzLnN0YXR1c0VsZW1lbnQuc3R5bGUuY29sb3IgPSBcIndoaXRlXCJcblx0XHR0aGlzLl9tdXRhdGlvbk9ic2VydmVyLmRpc2Nvbm5lY3QoKVxuXHRcdGF3YWl0IHRoaXMuc3RyYXRlZ3kucnVuKClcblx0XHR0aGlzLiNvblVuc2VuZGluZ0ZpbmlzaGVkKClcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge09TRH0gdWlcblx0ICovXG5cdCNvbk11dGF0aW9ucyh1aSkge1xuXHRcdGlmKHVpLnJvb3Qub3duZXJEb2N1bWVudC5xdWVyeVNlbGVjdG9yKFwiW2lkXj1tb3VudF0gPiBkaXYgPiBkaXYgPiBkaXZcIikgIT09IG51bGwgJiYgdWkpIHtcblx0XHRcdGlmKHRoaXMuX211dGF0aW9uT2JzZXJ2ZXIpIHtcblx0XHRcdFx0dGhpcy5fbXV0YXRpb25PYnNlcnZlci5kaXNjb25uZWN0KClcblx0XHRcdH1cblx0XHRcdHRoaXMuX211dGF0aW9uT2JzZXJ2ZXIgPSBuZXcgTXV0YXRpb25PYnNlcnZlcih1aS4jb25NdXRhdGlvbnMuYmluZCh0aGlzLCB1aSkpXG5cdFx0XHR0aGlzLl9tdXRhdGlvbk9ic2VydmVyLm9ic2VydmUodWkucm9vdC5vd25lckRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCJbaWRePW1vdW50XSA+IGRpdiA+IGRpdiA+IGRpdlwiKSwgeyBjaGlsZExpc3Q6IHRydWUsIGF0dHJpYnV0ZXM6IHRydWUgfSlcblx0XHR9XG5cdFx0aWYodGhpcy53aW5kb3cubG9jYXRpb24ucGF0aG5hbWUuc3RhcnRzV2l0aChcIi9kaXJlY3QvdC9cIikpIHtcblx0XHRcdGlmKCF0aGlzLnN0cmF0ZWd5LmlzUnVubmluZygpKSB7XG5cdFx0XHRcdHRoaXMuc3RyYXRlZ3kucmVzZXQoKVxuXHRcdFx0fVxuXHRcdFx0dGhpcy5yb290LnN0eWxlLmRpc3BsYXkgPSBcIlwiXG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMucm9vdC5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCJcblx0XHRcdGlmKHRoaXMuc3RyYXRlZ3kuaXNSdW5uaW5nKCkpIHtcblx0XHRcdFx0dGhpcy5zdHJhdGVneS5zdG9wKClcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHtPU0R9IHVpXG5cdCAqIEBwYXJhbSB7RXZlbnR9IGV2ZW50XG5cdCAqL1xuXHQjb25VbnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbkNsaWNrKCkge1xuXHRcdGlmKHRoaXMuc3RyYXRlZ3kuaXNSdW5uaW5nKCkpIHtcblx0XHRcdGNvbnNvbGUuZGVidWcoXCJVc2VyIGFza2VkIGZvciBtZXNzYWdlcyB1bnNlbmRpbmcgdG8gc3RvcFwiKVxuXHRcdFx0dGhpcy5zdHJhdGVneS5zdG9wKClcblx0XHRcdHRoaXMuI29uVW5zZW5kaW5nRmluaXNoZWQoKVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zb2xlLmRlYnVnKFwiVXNlciBhc2tlZCBmb3IgbWVzc2FnZXMgdW5zZW5kaW5nIHRvIHN0YXJ0OyBVSSBpbnRlcmFjdGlvbiB3aWxsIGJlIGRpc2FibGVkIGluIHRoZSBtZWFudGltZVwiKVxuXHRcdFx0dGhpcy4jc3RhcnRVbnNlbmRpbmcoKVxuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge0V2ZW50fSBldmVudFxuXHQgKiBAcmV0dXJucyB7Ym9vbGVhbn1cblx0ICovXG5cdCNvbldpbmRvd0tleUV2ZW50KGV2ZW50KSB7XG5cdFx0aWYodGhpcy5zdHJhdGVneS5pc1J1bm5pbmcoKSkge1xuXHRcdFx0Y29uc29sZS5sb2coXCJVc2VyIGludGVyYWN0aW9uIGlzIGRpc2FibGVkIGFzIHRoZSB1bnNlbmRpbmcgaXMgc3RpbGwgcnVubmluZzsgUGxlYXNlIHN0b3AgdGhlIGV4ZWN1dGlvbiBmaXJzdC5cIilcblx0XHRcdGV2ZW50LnN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbigpXG5cdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpXG5cdFx0XHRldmVudC5zdG9wUHJvcGFnYXRpb24oKVxuXHRcdFx0dGhpcy5vdmVybGF5RWxlbWVudC5mb2N1cygpXG5cdFx0XHRyZXR1cm4gZmFsc2Vcblx0XHR9XG5cdH1cblxuXHQjb25VbnNlbmRpbmdGaW5pc2hlZCgpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwicmVuZGVyIG9uVW5zZW5kaW5nRmluaXNoZWRcIilcblx0XHQ7Wy4uLnRoaXMubWVudUVsZW1lbnQucXVlcnlTZWxlY3RvckFsbChcImJ1dHRvblwiKV0uZmlsdGVyKGJ1dHRvbiA9PiBidXR0b24gIT09IHRoaXMudW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24pLmZvckVhY2goYnV0dG9uID0+IHtcblx0XHRcdGJ1dHRvbi5zdHlsZS52aXNpYmlsaXR5ID0gXCJcIlxuXHRcdFx0YnV0dG9uLmRpc2FibGVkID0gZmFsc2Vcblx0XHR9KVxuXHRcdHRoaXMudW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24udGV4dENvbnRlbnQgPSB0aGlzLnVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uLmRhdGFUZXh0Q29udGVudFxuXHRcdHRoaXMudW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24uc3R5bGUuYmFja2dyb3VuZENvbG9yID0gdGhpcy51bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbi5kYXRhQmFja2dyb3VuZENvbG9yXG5cdFx0dGhpcy5vdmVybGF5RWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCJcblx0XHR0aGlzLnN0YXR1c0VsZW1lbnQuc3R5bGUuY29sb3IgPSBcIlwiXG5cdFx0dGhpcy5fbXV0YXRpb25PYnNlcnZlci5vYnNlcnZlKHRoaXMuX2RvY3VtZW50LmJvZHksIHsgY2hpbGRMaXN0OiB0cnVlIH0pIC8vIFRPRE8gdGVzdFxuXHR9XG5cblx0LyoqXG5cdCAqIEByZWFkb25seVxuXHQgKiBAdHlwZSB7RG9jdW1lbnR9XG5cdCAqL1xuXHRnZXQgZG9jdW1lbnQoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX2RvY3VtZW50XG5cdH1cblxuXHQvKipcblx0ICogQHJlYWRvbmx5XG5cdCAqIEB0eXBlIHtXaW5kb3d9XG5cdCAqL1xuXHRnZXQgd2luZG93KCkge1xuXHRcdHJldHVybiB0aGlzLl9kb2N1bWVudC5kZWZhdWx0Vmlld1xuXHR9XG5cblx0LyoqXG5cdCAqIEByZWFkb25seVxuXHQgKiBAdHlwZSB7SFRNTERpdkVsZW1lbnR9XG5cdCAqL1xuXHRnZXQgcm9vdCgpIHtcblx0XHRyZXR1cm4gdGhpcy5fcm9vdFxuXHR9XG5cblx0LyoqXG5cdCAqIEByZWFkb25seVxuXHQgKiBAdHlwZSB7SFRNTERpdkVsZW1lbnR9XG5cdCAqL1xuXHRnZXQgb3ZlcmxheUVsZW1lbnQoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX292ZXJsYXlFbGVtZW50XG5cdH1cblxuXHQvKipcblx0ICogQHJlYWRvbmx5XG5cdCAqIEB0eXBlIHtIVE1MRGl2RWxlbWVudH1cblx0ICovXG5cdGdldCBtZW51RWxlbWVudCgpIHtcblx0XHRyZXR1cm4gdGhpcy5fbWVudUVsZW1lbnRcblx0fVxuXG5cdC8qKlxuXHQgKiBAcmVhZG9ubHlcblx0ICogQHR5cGUge0hUTUxCdXR0b25FbGVtZW50fVxuXHQgKi9cblx0Z2V0IHVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uKCkge1xuXHRcdHJldHVybiB0aGlzLl91bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvblxuXHR9XG5cblx0LyoqXG5cdCAqIEByZWFkb25seVxuXHQgKiBAdHlwZSB7SFRNTERpdkVsZW1lbnR9XG5cdCAqL1xuXHRnZXQgc3RhdHVzRWxlbWVudCgpIHtcblx0XHRyZXR1cm4gdGhpcy5fc3RhdHVzRWxlbWVudFxuXHR9XG5cblx0LyoqXG5cdCAqIEByZWFkb25seVxuXHQgKiBAdHlwZSB7VW5zZW5kU3RyYXRlZ3l9XG5cdCAqL1xuXHRnZXQgc3RyYXRlZ3koKSB7IC8vIFRPRE8gbW92ZSBvdXRcblx0XHRyZXR1cm4gdGhpcy5fc3RyYXRlZ3lcblx0fVxuXG5cdC8qKlxuXHQgKiBAcmVhZG9ubHlcblx0ICogQHR5cGUge0lETVV9XG5cdCAqL1xuXHRnZXQgaWRtdSgpIHtcblx0XHRyZXR1cm4gdGhpcy5faWRtdVxuXHR9XG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgT1NEXG4iLCIvKiogQG1vZHVsZSBtYWluIE1haW4gbW9kdWxlICovXG5cbmltcG9ydCBPU0QgZnJvbSBcIi4vb3NkL29zZC5qc1wiXG5cbi8qKlxuICogQHBhcmFtIHtXaW5kb3d9IHdpbmRvd1xuICovXG5leHBvcnQgZnVuY3Rpb24gbWFpbih3aW5kb3cpIHtcblx0T1NELnJlbmRlcih3aW5kb3cpXG59XG5cbmlmKHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIpIHtcblx0bWFpbih3aW5kb3cpXG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQUFBO0FBQ0E7Q0FDTyxNQUFNLFlBQVksR0FBRztDQUM1QixDQUFDLFNBQVMsRUFBRSxTQUFTO0NBQ3JCLENBQUMsV0FBVyxFQUFFLFdBQVc7Q0FDekIsRUFBQztBQUNEO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNPLFNBQVMsZ0JBQWdCLENBQUMsYUFBYSxFQUFFLFNBQVMsRUFBRTtDQUMzRCxDQUFDLGFBQWEsQ0FBQyxL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
