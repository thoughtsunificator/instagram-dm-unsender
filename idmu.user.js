
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
// @version				0.6.0
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
		const elements = [...root.querySelectorAll("div[role=row]:not([data-idmu-ignore])")];
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaWRtdS51c2VyLmpzIiwic291cmNlcyI6WyIuLi9zcmMvcnVudGltZS91c2Vyc2NyaXB0L29zZC9zdHlsZS9pbnN0YWdyYW0uanMiLCIuLi9zcmMvcnVudGltZS91c2Vyc2NyaXB0L29zZC9tZW51LWJ1dHRvbi5qcyIsIi4uL3NyYy9ydW50aW1lL3VzZXJzY3JpcHQvb3NkL21lbnUuanMiLCIuLi9zcmMvZG9tL2FzeW5jLWV2ZW50cy5qcyIsIi4uL3NyYy91aS91aS1jb21wb25lbnQuanMiLCIuLi9zcmMvdWkvZGVmYXVsdC91aS1tZXNzYWdlLmpzIiwiLi4vc3JjL3VpcGkvdWlwaS1tZXNzYWdlLmpzIiwiLi4vc3JjL3VpL3VpLmpzIiwiLi4vc3JjL3VpL2RlZmF1bHQvZG9tLWxvb2t1cC5qcyIsIi4uL3NyYy91aS9kZWZhdWx0L3VpLW1lc3NhZ2VzLXdyYXBwZXIuanMiLCIuLi9zcmMvdWkvZGVmYXVsdC9kZWZhdWx0LXVpLmpzIiwiLi4vc3JjL3VpL2dldC11aS5qcyIsIi4uL3NyYy91aXBpL3VpcGkuanMiLCIuLi9zcmMvaWRtdS9pZG11LmpzIiwiLi4vc3JjL3VpL3Vuc2VuZC1zdHJhdGVneS5qcyIsIi4uL3NyYy91aS9kZWZhdWx0L3Vuc2VuZC1zdHJhdGVneS5qcyIsIi4uL3NyYy9ydW50aW1lL3VzZXJzY3JpcHQvb3NkL2FsZXJ0LmpzIiwiLi4vc3JjL3J1bnRpbWUvdXNlcnNjcmlwdC9vc2Qvb3ZlcmxheS5qcyIsIi4uL3NyYy9ydW50aW1lL3VzZXJzY3JpcHQvb3NkL29zZC5qcyIsIi4uL3NyYy9ydW50aW1lL3VzZXJzY3JpcHQvbWFpbi5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKiogQG1vZHVsZSBpbnN0YWdyYW0gSGVscGVycyB0byBtaW1pY2sgSW5zdGFncmFtJ3MgbG9vayBhbmQgZmVlbCAqL1xuXG5leHBvcnQgY29uc3QgQlVUVE9OX1NUWUxFID0ge1xuXHRcIlBSSU1BUllcIjogXCJwcmltYXJ5XCIsXG5cdFwiU0VDT05EQVJZXCI6IFwic2Vjb25kYXJ5XCIsXG59XG5cbi8qKlxuICpcbiAqIEBwYXJhbSB7SFRNTEJ1dHRvbkVsZW1lbnR9IGJ1dHRvbkVsZW1lbnRcbiAqIEBwYXJhbSB7c3RyaW5nfSAgICAgICAgICAgIHN0eWxlTmFtZVxuICovXG5leHBvcnQgZnVuY3Rpb24gYXBwbHlCdXR0b25TdHlsZShidXR0b25FbGVtZW50LCBzdHlsZU5hbWUpIHtcblx0YnV0dG9uRWxlbWVudC5zdHlsZS5mb250U2l6ZSA9IFwidmFyKC0tc3lzdGVtLTE0LWZvbnQtc2l6ZSlcIlxuXHRidXR0b25FbGVtZW50LnN0eWxlLmNvbG9yID0gXCJ3aGl0ZVwiXG5cdGJ1dHRvbkVsZW1lbnQuc3R5bGUuYm9yZGVyID0gXCIwcHhcIlxuXHRidXR0b25FbGVtZW50LnN0eWxlLmJvcmRlclJhZGl1cyA9IFwiOHB4XCJcblx0YnV0dG9uRWxlbWVudC5zdHlsZS5wYWRkaW5nID0gXCI4cHhcIlxuXHRidXR0b25FbGVtZW50LnN0eWxlLmZvbnRXZWlnaHQgPSBcImJvbGRcIlxuXHRidXR0b25FbGVtZW50LnN0eWxlLmN1cnNvciA9IFwicG9pbnRlclwiXG5cdGJ1dHRvbkVsZW1lbnQuc3R5bGUubGluZUhlaWdodCA9IFwidmFyKC0tc3lzdGVtLTE0LWxpbmUtaGVpZ2h0KVwiXG5cdGlmKHN0eWxlTmFtZSkge1xuXHRcdGJ1dHRvbkVsZW1lbnQuc3R5bGUuYmFja2dyb3VuZENvbG9yID0gYHJnYih2YXIoLS1pZy0ke3N0eWxlTmFtZX0tYnV0dG9uKSlgXG5cdH1cbn1cbiIsIi8qKiBAbW9kdWxlIG1lbnUtYnV0dG9uIEhlbHBlcnMgdG8gY3JlYXRlIGJ1dHRvbnMgdGhhdCBjYW4gYmUgdXNlZCBpbiBJRE1VJ3MgbWVudSAqL1xuXG5pbXBvcnQgeyBhcHBseUJ1dHRvblN0eWxlIH0gZnJvbSBcIi4vc3R5bGUvaW5zdGFncmFtLmpzXCJcblxuLyoqXG4gKlxuICogQHBhcmFtIHtEb2N1bWVudH0gZG9jdW1lbnRcbiAqIEBwYXJhbSB7c3RyaW5nfSAgIHRleHRcbiAqIEBwYXJhbSB7c3RyaW5nfSAgIHN0eWxlTmFtZVxuICogQHJldHVybnMge0hUTUxCdXR0b25FbGVtZW50fVxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlTWVudUJ1dHRvbkVsZW1lbnQoZG9jdW1lbnQsIHRleHQsIHN0eWxlTmFtZSkge1xuXHRjb25zdCBidXR0b25FbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImJ1dHRvblwiKVxuXHRidXR0b25FbGVtZW50LnRleHRDb250ZW50ID0gdGV4dFxuXHRhcHBseUJ1dHRvblN0eWxlKGJ1dHRvbkVsZW1lbnQsIHN0eWxlTmFtZSlcblx0YnV0dG9uRWxlbWVudC5hZGRFdmVudExpc3RlbmVyKFwibW91c2VvdmVyXCIsICgpID0+IHtcblx0XHRidXR0b25FbGVtZW50LnN0eWxlLmZpbHRlciA9IGBicmlnaHRuZXNzKDEuMTUpYFxuXHR9KVxuXHRidXR0b25FbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJtb3VzZW91dFwiLCAoKSA9PiB7XG5cdFx0YnV0dG9uRWxlbWVudC5zdHlsZS5maWx0ZXIgPSBgYFxuXHR9KVxuXHRyZXR1cm4gYnV0dG9uRWxlbWVudFxufVxuIiwiLyoqIEBtb2R1bGUgbWVudSBJRE1VJ3MgbWFpbiBtZW51ICovXG5cbi8qKlxuICogQHBhcmFtIHtEb2N1bWVudH0gZG9jdW1lbnRcbiAqIEByZXR1cm5zIHtIVE1MQnV0dG9uRWxlbWVudH1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZU1lbnVFbGVtZW50KGRvY3VtZW50KSB7XG5cdGNvbnN0IG1lbnVFbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKVxuXHRtZW51RWxlbWVudC5pZCA9IFwiaWRtdS1tZW51XCJcblx0bWVudUVsZW1lbnQuc3R5bGUudG9wID0gXCIyMHB4XCJcblx0bWVudUVsZW1lbnQuc3R5bGUucmlnaHQgPSBcIjQzMHB4XCJcblx0bWVudUVsZW1lbnQuc3R5bGUucG9zaXRpb24gPSBcImZpeGVkXCJcblx0bWVudUVsZW1lbnQuc3R5bGUuekluZGV4ID0gOTk5XG5cdG1lbnVFbGVtZW50LnN0eWxlLmRpc3BsYXkgPSBcImZsZXhcIlxuXHRtZW51RWxlbWVudC5zdHlsZS5nYXAgPSBcIjEwcHhcIlxuXHRtZW51RWxlbWVudC5zdHlsZS5wbGFjZUl0ZW1zID0gXCJjZW50ZXJcIlxuXHRyZXR1cm4gbWVudUVsZW1lbnRcbn1cbiIsIi8qKiBAbW9kdWxlIGFzeW5jLWV2ZW50cyBVdGlscyBtb2R1bGUgZm9yIGZpbmRpbmcgZWxlbWVudHMgYXN5bmNocm9ub3VzbHkgaW4gdGhlIERPTSAqL1xuXG4vKipcbiAqXG4gKiBAY2FsbGJhY2sgZ2V0RWxlbWVudFxuICogQHJldHVybnMge0VsZW1lbnR9XG4gKi9cblxuLyoqXG4gKlxuICogQHBhcmFtIHtFbGVtZW50fSB0YXJnZXRcbiAqIEBwYXJhbSB7Z2V0RWxlbWVudH0gZ2V0RWxlbWVudFxuICogQHBhcmFtIHtBYm9ydENvbnRyb2xsZXJ9IGFib3J0Q29udHJvbGxlclxuICogQHJldHVybnMge1Byb21pc2U8RWxlbWVudD59XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB3YWl0Rm9yRWxlbWVudCh0YXJnZXQsIGdldEVsZW1lbnQsIGFib3J0Q29udHJvbGxlcikge1xuXHRyZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuXHRcdGxldCBtdXRhdGlvbk9ic2VydmVyXG5cdFx0Y29uc3QgYWJvcnRIYW5kbGVyID0gKCkgPT4ge1xuXHRcdFx0aWYobXV0YXRpb25PYnNlcnZlcikge1xuXHRcdFx0XHRyZWplY3QobmV3IERPTUV4Y2VwdGlvbihcIkFib3J0ZWQ6IERpc2Nvbm5lY3RpbmcgbXV0YXRpb24gb2JzZXJ2ZXIuLi5cIiwgXCJBYm9ydEVycm9yXCIpKVxuXHRcdFx0XHRtdXRhdGlvbk9ic2VydmVyLmRpc2Nvbm5lY3QoKVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmVqZWN0KG5ldyBET01FeGNlcHRpb24oXCJBYm9ydGVkXCIsIFwiQWJvcnRFcnJvclwiKSlcblx0XHRcdH1cblx0XHR9XG5cdFx0YWJvcnRDb250cm9sbGVyLnNpZ25hbC5hZGRFdmVudExpc3RlbmVyKFwiYWJvcnRcIiwgYWJvcnRIYW5kbGVyKVxuXHRcdGxldCBlbGVtZW50ID0gZ2V0RWxlbWVudCgpXG5cdFx0aWYoZWxlbWVudCkge1xuXHRcdFx0cmVzb2x2ZShlbGVtZW50KVxuXHRcdFx0YWJvcnRDb250cm9sbGVyLnNpZ25hbC5yZW1vdmVFdmVudExpc3RlbmVyKFwiYWJvcnRcIiwgYWJvcnRIYW5kbGVyKVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRtdXRhdGlvbk9ic2VydmVyID0gbmV3IE11dGF0aW9uT2JzZXJ2ZXIoKG11dGF0aW9ucywgb2JzZXJ2ZXIpID0+IHtcblx0XHRcdFx0ZWxlbWVudCA9IGdldEVsZW1lbnQobXV0YXRpb25zKVxuXHRcdFx0XHRpZihlbGVtZW50KSB7XG5cdFx0XHRcdFx0b2JzZXJ2ZXIuZGlzY29ubmVjdCgpXG5cdFx0XHRcdFx0cmVzb2x2ZShlbGVtZW50KVxuXHRcdFx0XHRcdGFib3J0Q29udHJvbGxlci5zaWduYWwucmVtb3ZlRXZlbnRMaXN0ZW5lcihcImFib3J0XCIsIGFib3J0SGFuZGxlcilcblx0XHRcdFx0fVxuXHRcdFx0fSlcblx0XHRcdG11dGF0aW9uT2JzZXJ2ZXIub2JzZXJ2ZSh0YXJnZXQsIHsgc3VidHJlZTogdHJ1ZSwgY2hpbGRMaXN0OnRydWUgfSlcblx0XHR9XG5cdH0pXG59XG5cbi8qKlxuICpcbiAqIEBwYXJhbSB7RWxlbWVudH0gY2xpY2tUYXJnZXRcbiAqIEBwYXJhbSB7RWxlbWVudH0gdGFyZ2V0XG4gKiBAcGFyYW0ge2dldEVsZW1lbnR9IGdldEVsZW1lbnRcbiAqIEBwYXJhbSB7QWJvcnRDb250cm9sbGVyfSBhYm9ydENvbnRyb2xsZXJcbiAqIEByZXR1cm5zIHtFbGVtZW50fFByb21pc2U8RWxlbWVudD59XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjbGlja0VsZW1lbnRBbmRXYWl0Rm9yKGNsaWNrVGFyZ2V0LCB0YXJnZXQsIGdldEVsZW1lbnQsIGFib3J0Q29udHJvbGxlcikge1xuXHRjb25zdCBwcm9taXNlID0gd2FpdEZvckVsZW1lbnQodGFyZ2V0LCBnZXRFbGVtZW50LCBhYm9ydENvbnRyb2xsZXIpXG5cdGNsaWNrVGFyZ2V0LmNsaWNrKClcblx0cmV0dXJuIGdldEVsZW1lbnQoKSB8fCBwcm9taXNlXG59XG4iLCIvKiogQG1vZHVsZSB1aS1jb21wb25lbnQgQmFzZSBjbGFzcyBmb3IgYW55IGVsZW1lbnQgdGhhdCBpcyBhIHBhcnQgb2YgdGhlIFVJLiAqL1xuXG5pbXBvcnQgeyB3YWl0Rm9yRWxlbWVudCwgY2xpY2tFbGVtZW50QW5kV2FpdEZvciB9IGZyb20gXCIuLi9kb20vYXN5bmMtZXZlbnRzLmpzXCJcblxuLyoqXG4gKlxuICogQGFic3RyYWN0XG4gKi9cbmNsYXNzIFVJQ29tcG9uZW50IHtcblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7RWxlbWVudH0gcm9vdFxuXHQgKiBAcGFyYW0ge29iamVjdH0gaWRlbnRpZmllclxuXHQgKi9cblx0Y29uc3RydWN0b3Iocm9vdCwgaWRlbnRpZmllcj17fSkge1xuXHRcdHRoaXMucm9vdCA9IHJvb3Rcblx0XHR0aGlzLmlkZW50aWZpZXIgPSBpZGVudGlmaWVyXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHtFbGVtZW50fSB0YXJnZXRcblx0ICogQHBhcmFtIHtmdW5jdGlvbn0gZ2V0RWxlbWVudFxuXHQgKiBAcGFyYW0ge0Fib3J0Q29udHJvbGxlcn0gYWJvcnRDb250cm9sbGVyXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlPEVsZW1lbnQ+fVxuXHQgKi9cblx0d2FpdEZvckVsZW1lbnQodGFyZ2V0LCBnZXRFbGVtZW50LCBhYm9ydENvbnRyb2xsZXIpIHtcblx0XHRyZXR1cm4gZ2V0RWxlbWVudCgpIHx8IHdhaXRGb3JFbGVtZW50KHRhcmdldCwgZ2V0RWxlbWVudCwgYWJvcnRDb250cm9sbGVyKVxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7RWxlbWVudH0gY2xpY2tUYXJnZXRcblx0ICogQHBhcmFtIHtFbGVtZW50fSB0YXJnZXRcblx0ICogQHBhcmFtIHtmdW5jdGlvbn0gZ2V0RWxlbWVudFxuXHQgKiBAcGFyYW0ge0Fib3J0Q29udHJvbGxlcn0gYWJvcnRDb250cm9sbGVyXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlPEVsZW1lbnQ+fVxuXHQgKi9cblx0Y2xpY2tFbGVtZW50QW5kV2FpdEZvcihjbGlja1RhcmdldCwgdGFyZ2V0LCBnZXRFbGVtZW50LCBhYm9ydENvbnRyb2xsZXIpIHtcblx0XHRyZXR1cm4gY2xpY2tFbGVtZW50QW5kV2FpdEZvcihjbGlja1RhcmdldCwgdGFyZ2V0LCBnZXRFbGVtZW50LCBhYm9ydENvbnRyb2xsZXIpXG5cdH1cblxufVxuXG5leHBvcnQgZGVmYXVsdCBVSUNvbXBvbmVudFxuIiwiLyoqIEBtb2R1bGUgdWktbWVzc2FnZSBVSSBlbGVtZW50IHJlcHJlc2VudGluZyBhIG1lc3NhZ2UgKi9cblxuaW1wb3J0IFVJQ29tcG9uZW50IGZyb20gXCIuLi91aS1jb21wb25lbnQuanNcIlxuXG5jbGFzcyBVSU1lc3NhZ2UgZXh0ZW5kcyBVSUNvbXBvbmVudCB7XG5cblx0LyoqXG5cdCAqIEBwYXJhbSB7QWJvcnRDb250cm9sbGVyfSBhYm9ydENvbnRyb2xsZXJcblx0ICogQHJldHVybnMge1Byb21pc2U8SFRNTEJ1dHRvbkVsZW1lbnQ+fVxuXHQgKi9cblx0YXN5bmMgc2hvd0FjdGlvbnNNZW51QnV0dG9uKGFib3J0Q29udHJvbGxlcikge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJXb3JrZmxvdyBzdGVwIDEgOiBzaG93QWN0aW9uc01lbnVCdXR0b25cIiwgdGhpcy5yb290KVxuXHRcdHRoaXMucm9vdC5kaXNwYXRjaEV2ZW50KG5ldyBNb3VzZUV2ZW50KFwibW91c2Vtb3ZlXCIsIHsgYnViYmxlczogdHJ1ZSB9KSlcblx0XHR0aGlzLnJvb3QuZGlzcGF0Y2hFdmVudChuZXcgTW91c2VFdmVudChcIm1vdXNlb3ZlclwiLCB7IGJ1YmJsZXM6IHRydWUgfSkpXG5cdFx0dGhpcy5yb290LmRpc3BhdGNoRXZlbnQobmV3IE1vdXNlRXZlbnQoXCJtb3VzZW50ZXJcIiwgeyBidWJibGVzOiB0cnVlIH0pKVxuXHRcdGNvbnN0IHdhaXRBYm9ydENvbnRyb2xsZXIgPSBuZXcgQWJvcnRDb250cm9sbGVyKClcblx0XHRsZXQgcHJvbWlzZVRpbWVvdXRcblx0XHRsZXQgcmVzb2x2ZVRpbWVvdXRcblx0XHRjb25zdCBhYm9ydEhhbmRsZXIgPSAoKSA9PiB7XG5cdFx0XHR3YWl0QWJvcnRDb250cm9sbGVyLmFib3J0KClcblx0XHRcdGNsZWFyVGltZW91dChwcm9taXNlVGltZW91dClcblx0XHRcdGlmKHJlc29sdmVUaW1lb3V0KSB7XG5cdFx0XHRcdHJlc29sdmVUaW1lb3V0KClcblx0XHRcdH1cblx0XHR9XG5cdFx0YWJvcnRDb250cm9sbGVyLnNpZ25hbC5hZGRFdmVudExpc3RlbmVyKFwiYWJvcnRcIiwgYWJvcnRIYW5kbGVyKVxuXHRcdGNvbnN0IGFjdGlvbkJ1dHRvbiA9IGF3YWl0IFByb21pc2UucmFjZShbXG5cdFx0XHR0aGlzLndhaXRGb3JFbGVtZW50KHRoaXMucm9vdCwgKCkgPT4gdGhpcy5yb290LnF1ZXJ5U2VsZWN0b3IoXCJbYXJpYS1sYWJlbF49J1NlZSBtb3JlIG9wdGlvbnMgZm9yIG1lc3NhZ2UnXVwiKT8ucGFyZW50Tm9kZSwgd2FpdEFib3J0Q29udHJvbGxlciksXG5cdFx0XHRuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cdFx0XHRcdHByb21pc2VUaW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiByZWplY3QoXCJUaW1lb3V0IHNob3dBY3Rpb25zTWVudUJ1dHRvblwiKSwgMjAwKVxuXHRcdFx0fSlcblx0XHRdKVxuXHRcdHdhaXRBYm9ydENvbnRyb2xsZXIuYWJvcnQoKVxuXHRcdGNsZWFyVGltZW91dChwcm9taXNlVGltZW91dClcblx0XHRyZXR1cm4gYWN0aW9uQnV0dG9uXG5cdH1cblxuXHQvKipcblx0ICogQHBhcmFtIHtBYm9ydENvbnRyb2xsZXJ9IGFib3J0Q29udHJvbGxlclxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZTxib29sZWFuPn1cblx0ICovXG5cdGFzeW5jIGhpZGVBY3Rpb25NZW51QnV0dG9uKGFib3J0Q29udHJvbGxlcikgeyAvLyBGSVhNRVxuXHRcdGNvbnNvbGUuZGVidWcoXCJoaWRlQWN0aW9uTWVudUJ1dHRvblwiLCB0aGlzLnJvb3QpXG5cdFx0dGhpcy5yb290LmRpc3BhdGNoRXZlbnQobmV3IE1vdXNlRXZlbnQoXCJtb3VzZW1vdmVcIiwgeyBidWJibGVzOiB0cnVlIH0pKVxuXHRcdHRoaXMucm9vdC5kaXNwYXRjaEV2ZW50KG5ldyBNb3VzZUV2ZW50KFwibW91c2VvdXRcIiwgeyBidWJibGVzOiB0cnVlIH0pKVxuXHRcdHRoaXMucm9vdC5kaXNwYXRjaEV2ZW50KG5ldyBNb3VzZUV2ZW50KFwibW91c2VsZWF2ZVwiLCB7IGJ1YmJsZXM6IHRydWUgfSkpXG5cdFx0Y29uc3Qgd2FpdEFib3J0Q29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKVxuXHRcdGxldCBwcm9taXNlVGltZW91dFxuXHRcdGxldCByZXNvbHZlVGltZW91dFxuXHRcdGNvbnN0IGFib3J0SGFuZGxlciA9ICgpID0+IHtcblx0XHRcdHdhaXRBYm9ydENvbnRyb2xsZXIuYWJvcnQoKVxuXHRcdFx0Y2xlYXJUaW1lb3V0KHByb21pc2VUaW1lb3V0KVxuXHRcdFx0aWYocmVzb2x2ZVRpbWVvdXQpIHtcblx0XHRcdFx0cmVzb2x2ZVRpbWVvdXQoKVxuXHRcdFx0fVxuXHRcdH1cblx0XHRhYm9ydENvbnRyb2xsZXIuc2lnbmFsLmFkZEV2ZW50TGlzdGVuZXIoXCJhYm9ydFwiLCBhYm9ydEhhbmRsZXIpXG5cdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgUHJvbWlzZS5yYWNlKFtcblx0XHRcdHRoaXMud2FpdEZvckVsZW1lbnQodGhpcy5yb290LCAoKSA9PiB0aGlzLnJvb3QucXVlcnlTZWxlY3RvcihcIlthcmlhLWxhYmVsPU1vcmVdXCIpID09PSBudWxsLCB3YWl0QWJvcnRDb250cm9sbGVyKSxcblx0XHRcdG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcblx0XHRcdFx0cmVzb2x2ZVRpbWVvdXQgPSByZXNvbHZlXG5cdFx0XHRcdHByb21pc2VUaW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiByZWplY3QoXCJUaW1lb3V0IGhpZGVBY3Rpb25NZW51QnV0dG9uXCIpLCAyMDApXG5cdFx0XHR9KVxuXHRcdF0pXG5cdFx0d2FpdEFib3J0Q29udHJvbGxlci5hYm9ydCgpXG5cdFx0Y2xlYXJUaW1lb3V0KHByb21pc2VUaW1lb3V0KVxuXHRcdHJldHVybiByZXN1bHRcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge0hUTUxCdXR0b25FbGVtZW50fSBhY3Rpb25CdXR0b25cblx0ICogQHBhcmFtIHtBYm9ydENvbnRyb2xsZXJ9IGFib3J0Q29udHJvbGxlclxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZX1cblx0ICovXG5cdGFzeW5jIG9wZW5BY3Rpb25zTWVudShhY3Rpb25CdXR0b24sIGFib3J0Q29udHJvbGxlcikge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJXb3JrZmxvdyBzdGVwIDIgOiBDbGlja2luZyBhY3Rpb25CdXR0b24gYW5kIHdhaXRpbmcgZm9yIHVuc2VuZCBtZW51IGl0ZW0gdG8gYXBwZWFyXCIsIGFjdGlvbkJ1dHRvbilcblx0XHRjb25zdCB3YWl0QWJvcnRDb250cm9sbGVyID0gbmV3IEFib3J0Q29udHJvbGxlcigpXG5cdFx0bGV0IHByb21pc2VUaW1lb3V0XG5cdFx0bGV0IHJlc29sdmVUaW1lb3V0XG5cdFx0Y29uc3QgYWJvcnRIYW5kbGVyID0gKCkgPT4ge1xuXHRcdFx0d2FpdEFib3J0Q29udHJvbGxlci5hYm9ydCgpXG5cdFx0XHRjbGVhclRpbWVvdXQocHJvbWlzZVRpbWVvdXQpXG5cdFx0XHRpZihyZXNvbHZlVGltZW91dCkge1xuXHRcdFx0XHRyZXNvbHZlVGltZW91dCgpXG5cdFx0XHR9XG5cdFx0fVxuXHRcdGFib3J0Q29udHJvbGxlci5zaWduYWwuYWRkRXZlbnRMaXN0ZW5lcihcImFib3J0XCIsIGFib3J0SGFuZGxlcilcblx0XHRjb25zdCB1bnNlbmRCdXR0b24gPSBhd2FpdCBQcm9taXNlLnJhY2UoW1xuXHRcdFx0dGhpcy5jbGlja0VsZW1lbnRBbmRXYWl0Rm9yKFxuXHRcdFx0XHRhY3Rpb25CdXR0b24sXG5cdFx0XHRcdHRoaXMucm9vdC5vd25lckRvY3VtZW50LmJvZHksXG5cdFx0XHRcdChtdXRhdGlvbnMpID0+IHtcblx0XHRcdFx0XHRpZihtdXRhdGlvbnMpIHtcblx0XHRcdFx0XHRcdGNvbnN0IGFkZGVkTm9kZXMgPSBbIC4uLm11dGF0aW9ucy5tYXAobXV0YXRpb24gPT4gWy4uLm11dGF0aW9uLmFkZGVkTm9kZXNdKSBdLmZsYXQoKS5maWx0ZXIobm9kZSA9PiBub2RlLm5vZGVUeXBlID09PSAxKVxuXHRcdFx0XHRcdFx0Y29uc29sZS5kZWJ1ZyhcIldvcmtmbG93IHN0ZXAgMiA6IFwiLCBhZGRlZE5vZGVzLCBhZGRlZE5vZGVzLmZpbmQobm9kZSA9PiBub2RlLnRleHRDb250ZW50LnRyaW0oKS50b0xvY2FsZUxvd2VyQ2FzZSgpID09PSBcInVuc2VuZFwiKSlcblx0XHRcdFx0XHRcdGZvcihjb25zdCBhZGRlZE5vZGUgb2YgYWRkZWROb2Rlcykge1xuXHRcdFx0XHRcdFx0XHRjb25zdCBub2RlID0gWy4uLmFkZGVkTm9kZS5xdWVyeVNlbGVjdG9yQWxsKFwic3BhbixkaXZcIildLmZpbmQobm9kZSA9PiBub2RlLnRleHRDb250ZW50LnRyaW0oKS50b0xvY2FsZUxvd2VyQ2FzZSgpID09PSBcInVuc2VuZFwiICYmIG5vZGUuZmlyc3RDaGlsZD8ubm9kZVR5cGUgPT09IDMpXG5cdFx0XHRcdFx0XHRcdHJldHVybiBub2RlXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LFxuXHRcdFx0XHR3YWl0QWJvcnRDb250cm9sbGVyXG5cdFx0XHQpLFxuXHRcdFx0bmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuXHRcdFx0XHRwcm9taXNlVGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4gcmVqZWN0KFwiVGltZW91dCBvcGVuQWN0aW9uc01lbnVcIiksIDIwMClcblx0XHRcdH0pXG5cdFx0XSlcblx0XHRjb25zb2xlLmRlYnVnKFwiV29ya2Zsb3cgc3RlcCAyIDogRm91bmQgdW5zZW5kQnV0dG9uXCIsIHVuc2VuZEJ1dHRvbilcblx0XHR3YWl0QWJvcnRDb250cm9sbGVyLmFib3J0KClcblx0XHRjbGVhclRpbWVvdXQocHJvbWlzZVRpbWVvdXQpXG5cdFx0cmV0dXJuIHVuc2VuZEJ1dHRvblxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7SFRNTEJ1dHRvbkVsZW1lbnR9IGFjdGlvbkJ1dHRvblxuXHQgKiBAcGFyYW0ge0hUTUxEaXZFbGVtZW50fSBhY3Rpb25zTWVudUVsZW1lbnRcblx0ICogQHBhcmFtIHtBYm9ydENvbnRyb2xsZXJ9IGFib3J0Q29udHJvbGxlclxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZTxib29sZWFuPn1cblx0ICovXG5cdGFzeW5jIGNsb3NlQWN0aW9uc01lbnUoYWN0aW9uQnV0dG9uLCBhY3Rpb25zTWVudUVsZW1lbnQsIGFib3J0Q29udHJvbGxlcikge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJjbG9zZUFjdGlvbnNNZW51XCIpXG5cdFx0Y29uc3Qgd2FpdEFib3J0Q29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKVxuXHRcdGxldCBwcm9taXNlVGltZW91dFxuXHRcdGxldCByZXNvbHZlVGltZW91dFxuXHRcdGNvbnN0IGFib3J0SGFuZGxlciA9ICgpID0+IHtcblx0XHRcdHdhaXRBYm9ydENvbnRyb2xsZXIuYWJvcnQoKVxuXHRcdFx0Y2xlYXJUaW1lb3V0KHByb21pc2VUaW1lb3V0KVxuXHRcdFx0aWYocmVzb2x2ZVRpbWVvdXQpIHtcblx0XHRcdFx0cmVzb2x2ZVRpbWVvdXQoKVxuXHRcdFx0fVxuXHRcdH1cblx0XHRhYm9ydENvbnRyb2xsZXIuc2lnbmFsLmFkZEV2ZW50TGlzdGVuZXIoXCJhYm9ydFwiLCBhYm9ydEhhbmRsZXIpXG5cdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgUHJvbWlzZS5yYWNlKFtcblx0XHRcdHRoaXMuY2xpY2tFbGVtZW50QW5kV2FpdEZvcihcblx0XHRcdFx0YWN0aW9uQnV0dG9uLFxuXHRcdFx0XHR0aGlzLnJvb3Qub3duZXJEb2N1bWVudC5ib2R5LFxuXHRcdFx0XHQoKSA9PiB0aGlzLnJvb3Qub3duZXJEb2N1bWVudC5ib2R5LmNvbnRhaW5zKGFjdGlvbnNNZW51RWxlbWVudCkgPT09IGZhbHNlLFxuXHRcdFx0XHRhYm9ydENvbnRyb2xsZXJcblx0XHRcdCksXG5cdFx0XHRuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cdFx0XHRcdHByb21pc2VUaW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiByZWplY3QoXCJUaW1lb3V0IG9wZW5BY3Rpb25zTWVudVwiKSwgMjAwKVxuXHRcdFx0fSlcblx0XHRdKVxuXHRcdHdhaXRBYm9ydENvbnRyb2xsZXIuYWJvcnQoKVxuXHRcdGNsZWFyVGltZW91dChwcm9taXNlVGltZW91dClcblx0XHRyZXR1cm4gcmVzdWx0ICE9PSBudWxsXG5cdH1cblxuXHQvKipcblx0ICogQ2xpY2sgdW5zZW5kIGJ1dHRvblxuXHQgKiBAcGFyYW0ge0hUTUxTcGFuRWxlbWVudH0gdW5zZW5kQnV0dG9uXG5cdCAqIEBwYXJhbSB7QWJvcnRDb250cm9sbGVyfSBhYm9ydENvbnRyb2xsZXJcblx0ICogQHJldHVybnMge1Byb21pc2U8SFRNTEJ1dHRvbkVsZW1lbnQ+fFByb21pc2U8RXJyb3I+fVxuXHQgKi9cblx0b3BlbkNvbmZpcm1VbnNlbmRNb2RhbCh1bnNlbmRCdXR0b24sIGFib3J0Q29udHJvbGxlcikge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJXb3JrZmxvdyBzdGVwIDMgOiBDbGlja2luZyB1bnNlbmRCdXR0b24gYW5kIHdhaXRpbmcgZm9yIGRpYWxvZyB0byBhcHBlYXIuLi5cIilcblx0XHRyZXR1cm4gdGhpcy5jbGlja0VsZW1lbnRBbmRXYWl0Rm9yKFxuXHRcdFx0dW5zZW5kQnV0dG9uLFxuXHRcdFx0dGhpcy5yb290Lm93bmVyRG9jdW1lbnQuYm9keSxcblx0XHRcdCgpID0+IHRoaXMucm9vdC5vd25lckRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCJbcm9sZT1kaWFsb2ddIGJ1dHRvblwiKSxcblx0XHRcdGFib3J0Q29udHJvbGxlclxuXHRcdClcblx0fVxuXG5cdC8qKlxuXHQgKiBDbGljayB1bnNlbmQgY29uZmlybSBidXR0b25cblx0ICogQHBhcmFtIHtIVE1MQnV0dG9uRWxlbWVudH0gZGlhbG9nQnV0dG9uXG5cdCAqIEBwYXJhbSB7QWJvcnRDb250cm9sbGVyfSBhYm9ydENvbnRyb2xsZXJcblx0ICogQHJldHVybnMge1Byb21pc2V9XG5cdCAqL1xuXHRhc3luYyBjb25maXJtVW5zZW5kKGRpYWxvZ0J1dHRvbiwgYWJvcnRDb250cm9sbGVyKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIldvcmtmbG93IGZpbmFsIHN0ZXAgOiBjb25maXJtVW5zZW5kXCIsIGRpYWxvZ0J1dHRvbilcblx0XHQvLyB3YWl0IHVudGlsIGNvbmZpcm0gYnV0dG9uIGlzIHJlbW92ZWRcblx0XHRhd2FpdCB0aGlzLmNsaWNrRWxlbWVudEFuZFdhaXRGb3IoXG5cdFx0XHRkaWFsb2dCdXR0b24sXG5cdFx0XHR0aGlzLnJvb3Qub3duZXJEb2N1bWVudC5ib2R5LFxuXHRcdFx0KCkgPT4gdGhpcy5yb290Lm93bmVyRG9jdW1lbnQucXVlcnlTZWxlY3RvcihcIltyb2xlPWRpYWxvZ10gYnV0dG9uXCIpID09PSBudWxsLFxuXHRcdFx0YWJvcnRDb250cm9sbGVyXG5cdFx0KVxuXHR9XG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgVUlNZXNzYWdlXG4iLCIvKiogQG1vZHVsZSB1aXBpLW1lc3NhZ2UgQVBJIGZvciBVSU1lc3NhZ2UgKi9cblxuLyogZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLXVudXNlZC12YXJzICovXG5pbXBvcnQgVUlNZXNzYWdlIGZyb20gXCIuLi91aS9kZWZhdWx0L3VpLW1lc3NhZ2UuanNcIlxuXG5jbGFzcyBGYWlsZWRXb3JrZmxvd0V4Y2VwdGlvbiBleHRlbmRzIEVycm9yIHt9XG5cbmNsYXNzIFVJUElNZXNzYWdlIHtcblxuXHQvKipcblx0ICogQHBhcmFtIHtVSU1lc3NhZ2V9IHVpTWVzc2FnZVxuXHQgKi9cblx0Y29uc3RydWN0b3IodWlNZXNzYWdlKSB7XG5cdFx0dGhpcy5fdWlNZXNzYWdlID0gdWlNZXNzYWdlXG5cdH1cblxuXHQvKipcblx0ICogQHBhcmFtIHtBYm9ydENvbnRyb2xsZXJ9IGFib3J0Q29udHJvbGxlclxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZTxib29sZWFuPn1cblx0ICovXG5cdGFzeW5jIHVuc2VuZChhYm9ydENvbnRyb2xsZXIpIHsgLy8gVE9ETyBhYm9ydCBVSVBJIC8gd2FpdEZvckVsZW1lbnQgZXRjLi5cblx0XHRjb25zb2xlLmRlYnVnKFwiVUlQSU1lc3NhZ2UgdW5zZW5kXCIpXG5cdFx0bGV0IGFjdGlvbkJ1dHRvblxuXHRcdGxldCB1bnNlbmRCdXR0b25cblx0XHR0cnkge1xuXHRcdFx0YWN0aW9uQnV0dG9uID0gYXdhaXQgdGhpcy51aU1lc3NhZ2Uuc2hvd0FjdGlvbnNNZW51QnV0dG9uKGFib3J0Q29udHJvbGxlcilcblx0XHRcdHVuc2VuZEJ1dHRvbiA9IGF3YWl0IHRoaXMudWlNZXNzYWdlLm9wZW5BY3Rpb25zTWVudShhY3Rpb25CdXR0b24sIGFib3J0Q29udHJvbGxlcilcblx0XHRcdGNvbnNvbGUuZGVidWcoXCJ1bnNlbmRCdXR0b25cIiwgdW5zZW5kQnV0dG9uKVxuXHRcdFx0Y29uc3QgZGlhbG9nQnV0dG9uID0gYXdhaXQgdGhpcy51aU1lc3NhZ2Uub3BlbkNvbmZpcm1VbnNlbmRNb2RhbCh1bnNlbmRCdXR0b24sIGFib3J0Q29udHJvbGxlcilcblx0XHRcdGF3YWl0IHRoaXMudWlNZXNzYWdlLmNvbmZpcm1VbnNlbmQoZGlhbG9nQnV0dG9uLCBhYm9ydENvbnRyb2xsZXIpXG5cdFx0XHR0aGlzLnVpTWVzc2FnZS5yb290LnNldEF0dHJpYnV0ZShcImRhdGEtaWRtdS11bnNlbnRcIiwgXCJcIilcblx0XHRcdHJldHVybiB0cnVlXG5cdFx0fSBjYXRjaChleCkge1xuXHRcdFx0Y29uc29sZS5lcnJvcihleClcblx0XHRcdHRoaXMudWlNZXNzYWdlLnJvb3Quc2V0QXR0cmlidXRlKFwiZGF0YS1pZG11LWlnbm9yZVwiLCBcIlwiKVxuXHRcdFx0dGhyb3cgbmV3IEZhaWxlZFdvcmtmbG93RXhjZXB0aW9uKFwiRmFpbGVkIHRvIGV4ZWN1dGUgd29ya2Zsb3cgZm9yIHRoaXMgbWVzc2FnZVwiLCBleClcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogQHR5cGUge1VJTWVzc2FnZX1cblx0ICovXG5cdGdldCB1aU1lc3NhZ2UoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX3VpTWVzc2FnZVxuXHR9XG5cbn1cbmV4cG9ydCB7IEZhaWxlZFdvcmtmbG93RXhjZXB0aW9uIH1cbmV4cG9ydCBkZWZhdWx0IFVJUElNZXNzYWdlXG4iLCJpbXBvcnQgVUlDb21wb25lbnQgZnJvbSBcIi4vdWktY29tcG9uZW50LmpzXCJcblxuLyogZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLXVudXNlZC12YXJzICovXG5pbXBvcnQgVUlQSU1lc3NhZ2UgZnJvbSBcIi4uL3VpcGkvdWlwaS1tZXNzYWdlLmpzXCJcblxuLyoqXG4gKlxuICogQGFic3RyYWN0XG4gKi9cbmNsYXNzIFVJIGV4dGVuZHMgVUlDb21wb25lbnQge1xuXG5cdC8qKlxuXHQgKlxuXHQgKiBAYWJzdHJhY3Rcblx0ICogQHJldHVybnMge1VJfVxuXHQgKi9cblx0c3RhdGljIGNyZWF0ZSgpIHtcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAYWJzdHJhY3Rcblx0ICogQHBhcmFtIHtBYm9ydENvbnRyb2xsZXJ9IGFib3J0Q29udHJvbGxlclxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZX1cblx0ICovXG5cdC8qIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby11bnVzZWQtdmFycyAqL1xuXHRhc3luYyBmZXRjaEFuZFJlbmRlclRocmVhZE5leHRNZXNzYWdlUGFnZShhYm9ydENvbnRyb2xsZXIpIHtcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAYWJzdHJhY3Rcblx0ICogQHJldHVybnMge1Byb21pc2U8VUlQSU1lc3NhZ2U+fVxuXHQgKi9cblx0YXN5bmMgZ2V0TmV4dFVJUElNZXNzYWdlKCkge1xuXHR9XG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgVUlcbiIsIi8qKiBAbW9kdWxlIGRvbS1sb29rdXAgVXRpbHMgbW9kdWxlIGZvciBsb29raW5nIHVwIGVsZW1lbnRzIG9uIHRoZSBkZWZhdWx0IFVJICovXG5cbmltcG9ydCB7IHdhaXRGb3JFbGVtZW50IH0gZnJvbSBcIi4uLy4uL2RvbS9hc3luYy1ldmVudHMuanNcIlxuXG4vKipcbiAqXG4gKiBAcGFyYW0ge0VsZW1lbnR9IHJvb3RcbiAqIEBwYXJhbSB7QWJvcnRDb250cm9sbGVyfSBhYm9ydENvbnRyb2xsZXJcbiAqIEByZXR1cm5zIHtQcm9taXNlPEVsZW1lbnRbXT59XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRGaXJzdFZpc2libGVNZXNzYWdlKHJvb3QsIGFib3J0Q29udHJvbGxlcikge1xuXHRjb25zdCBlbGVtZW50cyA9IFsuLi5yb290LnF1ZXJ5U2VsZWN0b3JBbGwoXCJkaXZbcm9sZT1yb3ddOm5vdChbZGF0YS1pZG11LWlnbm9yZV0pXCIpXVxuXHRlbGVtZW50cy5yZXZlcnNlKClcblx0Y29uc29sZS5kZWJ1ZyhcImdldEZpcnN0VmlzaWJsZU1lc3NhZ2VcIiwgZWxlbWVudHMubGVuZ3RoLCBcImVsZW1lbnRzXCIpXG5cdGZvcihjb25zdCBlbGVtZW50IG9mIGVsZW1lbnRzKSB7XG5cdFx0aWYoYWJvcnRDb250cm9sbGVyLnNpZ25hbC5hYm9ydGVkKSB7XG5cdFx0XHRicmVha1xuXHRcdH1cblx0XHRjb25zdCB2aXNpYmlsaXR5Q2hlY2sgPSBlbGVtZW50LmNoZWNrVmlzaWJpbGl0eSh7XG5cdFx0XHR2aXNpYmlsaXR5UHJvcGVydHk6IHRydWUsXG5cdFx0XHRjb250ZW50VmlzaWJpbGl0eUF1dG86IHRydWUsXG5cdFx0XHRvcGFjaXR5UHJvcGVydHk6IHRydWUsXG5cdFx0fSlcblx0XHRpZih2aXNpYmlsaXR5Q2hlY2sgPT09IGZhbHNlKSB7XG5cdFx0XHRjb25zb2xlLmRlYnVnKFwidmlzaWJpbGl0eUNoZWNrXCIsIHZpc2liaWxpdHlDaGVjaylcblx0XHRcdGNvbnRpbnVlXG5cdFx0fVxuXHRcdGNvbnN0IGlzSW5WaWV3ID0gZWxlbWVudC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKS55ID4gMTAwXG5cdFx0aWYoaXNJblZpZXcgPT09IGZhbHNlKSB7XG5cdFx0XHRjb25zb2xlLmRlYnVnKFwiaXNJblZpZXdcIiwgaXNJblZpZXcpXG5cdFx0XHRjb250aW51ZVxuXHRcdH1cblx0XHRlbGVtZW50LnNldEF0dHJpYnV0ZShcImRhdGEtaWRtdS1pZ25vcmVcIiwgXCJcIikgLy8gTmV4dCBpdGVyYXRpb24gc2hvdWxkIG5vdCBpbmNsdWRlIHRoaXMgbWVzc2FnZVxuXHRcdGNvbnNvbGUuZGVidWcoXCJNZXNzYWdlIGluIHZpZXcsIHRlc3Rpbmcgd29ya2Zsb3cuLi5cIiwgZWxlbWVudClcblx0XHRyZXR1cm4gZWxlbWVudFxuXHR9XG59XG5cbi8qKlxuICpcbiAqIEBwYXJhbSB7V2luZG93fSB3aW5kb3dcbiAqIEByZXR1cm5zIHtIVE1MRGl2RWxlbWVudH1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGZpbmRNZXNzYWdlc1dyYXBwZXIod2luZG93KSB7XG5cdHJldHVybiB3aW5kb3cuZG9jdW1lbnQucXVlcnlTZWxlY3RvcihcImRpdltyb2xlPWdyaWRdID4gZGl2ID4gZGl2ID4gZGl2ID4gZGl2XCIpXG59XG5cbi8qKlxuICpcbiAqIEBwYXJhbSB7RWxlbWVudH0gcm9vdFxuICogQHBhcmFtIHtBYm9ydENvbnRyb2xsZXJ9IGFib3J0Q29udHJvbGxlclxuICogQHJldHVybnMge1Byb21pc2U8Ym9vbGVhbj59XG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBsb2FkTW9yZU1lc3NhZ2VzKHJvb3QsIGFib3J0Q29udHJvbGxlcikge1xuXHRjb25zb2xlLmRlYnVnKFwibG9hZE1vcmVNZXNzYWdlcyBsb29raW5nIGZvciBsb2FkZXIuLi4gXCIpXG5cdGxldCBmaW5kTG9hZGVyVGltZW91dFxuXHRsZXQgbG9hZGluZ0VsZW1lbnRcblx0bGV0IHJlc29sdmVUaW1lb3V0XG5cdGNvbnN0IHNjcm9sbEFib3J0Q29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKSAvLyBTZXBhcmF0ZSBhYm9ydENvbnRyb2xsZXIgdG8gc3RvcCBzY3JvbGxpbmcgaWYgd2UgY2FuJ3QgZmluZCB0aGUgbG9hZGVyIGluIDEwc1xuXHRjb25zdCBhYm9ydEhhbmRsZXIgPSAoKSA9PiB7XG5cdFx0c2Nyb2xsQWJvcnRDb250cm9sbGVyLmFib3J0KClcblx0XHRjbGVhclRpbWVvdXQoZmluZExvYWRlclRpbWVvdXQpXG5cdFx0aWYocmVzb2x2ZVRpbWVvdXQpIHtcblx0XHRcdHJlc29sdmVUaW1lb3V0KClcblx0XHR9XG5cdH1cblx0YWJvcnRDb250cm9sbGVyLnNpZ25hbC5hZGRFdmVudExpc3RlbmVyKFwiYWJvcnRcIiwgYWJvcnRIYW5kbGVyKVxuXHRyb290LnNjcm9sbFRvcCA9IDBcblx0dHJ5IHtcblx0XHRsb2FkaW5nRWxlbWVudCA9IGF3YWl0IFByb21pc2UucmFjZShbXG5cdFx0XHR3YWl0Rm9yRWxlbWVudChyb290LCAoKSA9PiB7XG5cdFx0XHRcdGlmKHJvb3QucXVlcnlTZWxlY3RvcihgW3JvbGU9cHJvZ3Jlc3NiYXJdYCkgPT09IG51bGwpIHtcblx0XHRcdFx0XHRyb290LnNjcm9sbFRvcCA9IDBcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gcm9vdC5xdWVyeVNlbGVjdG9yKGBbcm9sZT1wcm9ncmVzc2Jhcl1gKVxuXHRcdFx0fSwgc2Nyb2xsQWJvcnRDb250cm9sbGVyKSxcblx0XHRcdG5ldyBQcm9taXNlKHJlc29sdmUgPT4ge1xuXHRcdFx0XHRyZXNvbHZlVGltZW91dCA9IHJlc29sdmVcblx0XHRcdFx0ZmluZExvYWRlclRpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHsgLy8gVE9ETyBSZXBsYWNlIHdpdGggZmV0Y2ggb3ZlcnJpZGVcblx0XHRcdFx0XHRyZXNvbHZlKClcblx0XHRcdFx0fSwgMTAwMDApIC8vIElETVVfU0NST0xMX0RFVEVDVElPTl9USU1FT1VUXG5cdFx0XHR9KVxuXHRcdF0pXG5cdH0gY2F0Y2goZXgpIHtcblx0XHRjb25zb2xlLmVycm9yKGV4KVxuXHR9XG5cdHNjcm9sbEFib3J0Q29udHJvbGxlci5hYm9ydCgpIC8vIElmIGl0IHRvb2sgbW9yZSB0aGFuIDEwcyBzdG9wIHNjcm9sbGluZ1xuXHRhYm9ydENvbnRyb2xsZXIuc2lnbmFsLnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJhYm9ydFwiLCBhYm9ydEhhbmRsZXIpXG5cdGNsZWFyVGltZW91dChmaW5kTG9hZGVyVGltZW91dClcblx0aWYobG9hZGluZ0VsZW1lbnQgJiYgbG9hZGluZ0VsZW1lbnQgIT09IHRydWUpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwibG9hZE1vcmVNZXNzYWdlczogRm91bmQgbG9hZGVyOyBTdGFuZC1ieSB1bnRpbCBpdCBpcyByZW1vdmVkXCIpXG5cdFx0Y29uc29sZS5kZWJ1ZyhcImxvYWRNb3JlTWVzc2FnZXM6IHNjcm9sbFRvcFwiLCByb290LnNjcm9sbFRvcClcblx0XHRhd2FpdCB3YWl0Rm9yRWxlbWVudChyb290LCAoKSA9PiByb290LnF1ZXJ5U2VsZWN0b3IoYFtyb2xlPXByb2dyZXNzYmFyXWApID09PSBudWxsLCBhYm9ydENvbnRyb2xsZXIpXG5cdH1cblx0Y29uc29sZS5kZWJ1ZyhcImxvYWRNb3JlTWVzc2FnZXM6IExvYWRlciB3YXMgcmVtb3ZlZCwgb2xkZXIgbWVzc2FnZXMgbG9hZGluZyBjb21wbGV0ZWRcIilcblx0Y29uc29sZS5kZWJ1ZyhgbG9hZE1vcmVNZXNzYWdlczogc2Nyb2xsVG9wIGlzICR7cm9vdC5zY3JvbGxUb3B9IHdlICR7cm9vdC5zY3JvbGxUb3AgPT09IDAgPyBcInJlYWNoZWQgbGFzdCBwYWdlXCIgOiBcImRpZCBub3QgcmVhY2ggbGFzdCBwYWdlIGFuZCB3aWxsIGJlZ2luIGxvYWRpbmcgb2xkZXIgbWVzc2FnZXMgc2hvcnRseVwifWAsIClcblx0cmV0dXJuIHJvb3Quc2Nyb2xsVG9wID09PSAwXG59XG4iLCIvKiogQG1vZHVsZSB1aS1tZXNzYWdlcy13cmFwcGVyIFVJIGVsZW1lbnQgcmVwcmVzZW50aW5nIHRoZSBtZXNzYWdlcyB3cmFwcGVyICovXG5cbmltcG9ydCB7IGxvYWRNb3JlTWVzc2FnZXMgfSBmcm9tIFwiLi9kb20tbG9va3VwLmpzXCJcbmltcG9ydCBVSUNvbXBvbmVudCBmcm9tIFwiLi4vdWktY29tcG9uZW50LmpzXCJcblxuY2xhc3MgVUlNZXNzYWdlc1dyYXBwZXIgZXh0ZW5kcyBVSUNvbXBvbmVudCB7XG5cblx0LyoqXG5cdCAqIEBwYXJhbSB7QWJvcnRDb250cm9sbGVyfSBhYm9ydENvbnRyb2xsZXJcblx0ICogQHJldHVybnMge1Byb21pc2V9XG5cdCAqL1xuXHRmZXRjaEFuZFJlbmRlclRocmVhZE5leHRNZXNzYWdlUGFnZShhYm9ydENvbnRyb2xsZXIpIHtcblx0XHRyZXR1cm4gbG9hZE1vcmVNZXNzYWdlcyh0aGlzLnJvb3QsIGFib3J0Q29udHJvbGxlcilcblx0fVxuXG59XG5cbmV4cG9ydCBkZWZhdWx0IFVJTWVzc2FnZXNXcmFwcGVyXG4iLCIvKiogQG1vZHVsZSBkZWZhdWx0LXVpIERlZmF1bHQgVUkgLyBFbmdsaXNoIFVJICovXG5cbmltcG9ydCBVSSBmcm9tIFwiLi4vdWkuanNcIlxuaW1wb3J0IHsgZmluZE1lc3NhZ2VzV3JhcHBlciwgZ2V0Rmlyc3RWaXNpYmxlTWVzc2FnZSB9IGZyb20gXCIuL2RvbS1sb29rdXAuanNcIlxuaW1wb3J0IFVJUElNZXNzYWdlIGZyb20gXCIuLi8uLi91aXBpL3VpcGktbWVzc2FnZS5qc1wiXG5pbXBvcnQgVUlNZXNzYWdlIGZyb20gXCIuL3VpLW1lc3NhZ2UuanNcIlxuaW1wb3J0IFVJTWVzc2FnZXNXcmFwcGVyIGZyb20gXCIuL3VpLW1lc3NhZ2VzLXdyYXBwZXIuanNcIlxuXG5jbGFzcyBEZWZhdWx0VUkgZXh0ZW5kcyBVSSB7XG5cblx0Y29uc3RydWN0b3Iocm9vdCwgaWRlbnRpZmllcj17fSkge1xuXHRcdHN1cGVyKHJvb3QsIGlkZW50aWZpZXIpXG5cdFx0dGhpcy5sYXN0U2Nyb2xsVG9wID0gbnVsbFxuXHR9XG5cblx0LyoqXG5cdCAqIEBwYXJhbSB7V2luZG93fSB3aW5kb3dcblx0ICogQHJldHVybnMge0RlZmF1bHRVSX1cblx0ICovXG5cdHN0YXRpYyBjcmVhdGUod2luZG93KSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIlVJIGNyZWF0ZVwiKVxuXHRcdGNvbnN0IG1lc3NhZ2VzV3JhcHBlckVsZW1lbnQgPSBmaW5kTWVzc2FnZXNXcmFwcGVyKHdpbmRvdylcblx0XHRpZihtZXNzYWdlc1dyYXBwZXJFbGVtZW50ICE9PSBudWxsKSB7XG5cdFx0XHRjb25zb2xlLmRlYnVnKFwiRm91bmQgbWVzc2FnZXNXcmFwcGVyRWxlbWVudFwiLCBtZXNzYWdlc1dyYXBwZXJFbGVtZW50KVxuXHRcdFx0Y29uc3QgdWlNZXNzYWdlc1dyYXBwZXIgPSBuZXcgVUlNZXNzYWdlc1dyYXBwZXIobWVzc2FnZXNXcmFwcGVyRWxlbWVudClcblx0XHRcdHJldHVybiBuZXcgRGVmYXVsdFVJKHdpbmRvdywgeyB1aU1lc3NhZ2VzV3JhcHBlciB9KVxuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCJVbmFibGUgdG8gZmluZCBtZXNzYWdlc1dyYXBwZXJFbGVtZW50XCIpXG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCogQHBhcmFtIHtBYm9ydENvbnRyb2xsZXJ9IGFib3J0Q29udHJvbGxlclxuXHQqIEByZXR1cm5zIHtQcm9taXNlfVxuXHQqL1xuXHRhc3luYyBmZXRjaEFuZFJlbmRlclRocmVhZE5leHRNZXNzYWdlUGFnZShhYm9ydENvbnRyb2xsZXIpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwiVUkgZmV0Y2hBbmRSZW5kZXJUaHJlYWROZXh0TWVzc2FnZVBhZ2VcIilcblx0XHRyZXR1cm4gYXdhaXQgdGhpcy5pZGVudGlmaWVyLnVpTWVzc2FnZXNXcmFwcGVyLmZldGNoQW5kUmVuZGVyVGhyZWFkTmV4dE1lc3NhZ2VQYWdlKGFib3J0Q29udHJvbGxlcilcblx0fVxuXG5cdC8qKlxuXHQgKiBAcGFyYW0ge0Fib3J0Q29udHJvbGxlcn0gYWJvcnRDb250cm9sbGVyXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlPFVJUElNZXNzYWdlPn1cblx0ICovXG5cdGFzeW5jIGdldE5leHRVSVBJTWVzc2FnZShhYm9ydENvbnRyb2xsZXIpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwiVUkgZ2V0TmV4dFVJUElNZXNzYWdlXCIsIHRoaXMubGFzdFNjcm9sbFRvcClcblx0XHRjb25zdCB1aU1lc3NhZ2VzV3JhcHBlclJvb3QgPSB0aGlzLmlkZW50aWZpZXIudWlNZXNzYWdlc1dyYXBwZXIucm9vdFxuXHRcdGNvbnN0IHN0YXJ0U2Nyb2xsVG9wID0gdGhpcy5sYXN0U2Nyb2xsVG9wIHx8IHVpTWVzc2FnZXNXcmFwcGVyUm9vdC5zY3JvbGxIZWlnaHQgLSB1aU1lc3NhZ2VzV3JhcHBlclJvb3QuY2xpZW50SGVpZ2h0XG5cdFx0Y29uc29sZS5kZWJ1ZyhcInN0YXJ0U2Nyb2xsVG9wXCIsIHN0YXJ0U2Nyb2xsVG9wKVxuXHRcdGZvcihsZXQgaSA9IE1hdGgubWF4KDEsIHN0YXJ0U2Nyb2xsVG9wKTtpID4gMDtpID0gaSAtIDMwICkge1xuXHRcdFx0aWYoYWJvcnRDb250cm9sbGVyLnNpZ25hbC5hYm9ydGVkKSB7XG5cdFx0XHRcdGJyZWFrXG5cdFx0XHR9XG5cdFx0XHR0aGlzLmxhc3RTY3JvbGxUb3AgPSBpXG5cdFx0XHR1aU1lc3NhZ2VzV3JhcHBlclJvb3Quc2Nyb2xsVG9wID0gaVxuXHRcdFx0dWlNZXNzYWdlc1dyYXBwZXJSb290LmRpc3BhdGNoRXZlbnQobmV3IHRoaXMucm9vdC5FdmVudChcInNjcm9sbFwiKSlcblx0XHRcdGNvbnNvbGUuZGVidWcoXCJzY3JvbGxcIilcblx0XHRcdGF3YWl0IG5ldyBQcm9taXNlKHJlc29sdmUgPT4gc2V0VGltZW91dChyZXNvbHZlLCAyMCkpXG5cdFx0XHR0cnkge1xuXHRcdFx0XHRjb25zdCBtZXNzYWdlRWxlbWVudCA9IGdldEZpcnN0VmlzaWJsZU1lc3NhZ2UodWlNZXNzYWdlc1dyYXBwZXJSb290LCBhYm9ydENvbnRyb2xsZXIpXG5cdFx0XHRcdGlmKG1lc3NhZ2VFbGVtZW50KSB7XG5cdFx0XHRcdFx0Y29uc3QgdWlNZXNzYWdlID0gbmV3IFVJTWVzc2FnZShtZXNzYWdlRWxlbWVudClcblx0XHRcdFx0XHRyZXR1cm4gbmV3IFVJUElNZXNzYWdlKHVpTWVzc2FnZSlcblx0XHRcdFx0fVxuXHRcdFx0fSBjYXRjaChleCkge1xuXHRcdFx0XHRjb25zb2xlLmVycm9yKGV4KVxuXHRcdFx0fVxuXHRcdH1cblx0XHQvLyBUT0RPIHRocm93IGVuZE9mU2Nyb2xsRXhjZXB0aW9uXG5cdFx0cmV0dXJuIGZhbHNlIC8vIGVuZCBvZiBzY3JvbGwgcmVhY2hlZFxuXHR9XG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgRGVmYXVsdFVJXG4iLCIvKiogQG1vZHVsZSBnZXQtdWkgVUkgbG9hZGVyIG1vZHVsZS4gQWxsb3cgbG9hZGluZyBvZiBhIGNlcnRhaW4gVUkgYmFzZWQgb24gYSBnaXZlbiBzdHJhdGVneSAobG9jYWxlIGV0Yy4uKVxuICogVGhlcmUgbWlnaHQgYmUgbmVlZCBmb3IgbXVsdGlwbGUgVUkgYXMgSW5zdGFncmFtIG1pZ2h0IHNlcnZlIGRpZmZlcmVudCBhcHBzIGJhc2VkIG9uIGxvY2F0aW9uIGZvciBleGFtcGxlLlxuICogVGhlcmUgaXMgYWxzbyBhIG5lZWQgdG8gaW50ZXJuYXRpb25hbGl6ZSBlYWNoIHVpIHNvIHRoYXQgaXQgZG9lc24ndCBmYWlsIGlmIHdlIGNoYW5nZSB0aGUgbGFuZ3VhZ2UuXG4gKi9cblxuaW1wb3J0IERlZmF1bHRVSSBmcm9tIFwiLi9kZWZhdWx0L2RlZmF1bHQtdWkuanNcIlxuLyogZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLXVudXNlZC12YXJzICovXG5pbXBvcnQgVUkgZnJvbSBcIi4vdWkuanNcIlxuXG4vKipcbiAqXG4gKiBAcmV0dXJucyB7VUl9XG4gKi9cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIGdldFVJKCkge1xuXHRyZXR1cm4gRGVmYXVsdFVJXG59XG4iLCIvKiogQG1vZHVsZSB1aXBpIEFQSSBmb3IgVUkgKi9cblxuaW1wb3J0IGdldFVJIGZyb20gXCIuLi91aS9nZXQtdWkuanNcIlxuXG4vKiBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tdW51c2VkLXZhcnMgKi9cbmltcG9ydCBVSSBmcm9tIFwiLi4vdWkvdWkuanNcIlxuLyogZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLXVudXNlZC12YXJzICovXG5pbXBvcnQgVUlQSU1lc3NhZ2UgZnJvbSBcIi4vdWlwaS1tZXNzYWdlLmpzXCJcblxuLyoqXG4gKiBVSSBJbnRlcmZhY2UgQVBJXG4gKi9cbmNsYXNzIFVJUEkge1xuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge1VJfSB1aVxuXHQgKi9cblx0Y29uc3RydWN0b3IodWkpIHtcblx0XHR0aGlzLl91aSA9IHVpXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHtXaW5kb3d9IHdpbmRvd1xuXHQgKiBAcmV0dXJucyB7VUlQSX1cblx0ICovXG5cdHN0YXRpYyBjcmVhdGUod2luZG93KSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIlVJUEkuY3JlYXRlXCIpXG5cdFx0Y29uc3QgdWkgPSBnZXRVSSgpLmNyZWF0ZSh3aW5kb3cpXG5cdFx0cmV0dXJuIG5ldyBVSVBJKHVpKVxuXHR9XG5cblx0LyoqXG5cdCAqIEBwYXJhbSB7QWJvcnRDb250cm9sbGVyfSBhYm9ydENvbnRyb2xsZXJcblx0ICogQHJldHVybnMge1Byb21pc2V9XG5cdCAqL1xuXHRmZXRjaEFuZFJlbmRlclRocmVhZE5leHRNZXNzYWdlUGFnZShhYm9ydENvbnRyb2xsZXIpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwiVUlQSSBmZXRjaEFuZFJlbmRlclRocmVhZE5leHRNZXNzYWdlUGFnZVwiKVxuXHRcdHJldHVybiB0aGlzLnVpLmZldGNoQW5kUmVuZGVyVGhyZWFkTmV4dE1lc3NhZ2VQYWdlKGFib3J0Q29udHJvbGxlcilcblx0fVxuXG5cdC8qKlxuXHQgKiBAcGFyYW0ge0Fib3J0Q29udHJvbGxlcn0gYWJvcnRDb250cm9sbGVyXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlPFVJUElNZXNzYWdlPn1cblx0ICovXG5cdGdldE5leHRVSVBJTWVzc2FnZShhYm9ydENvbnRyb2xsZXIpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwiVUlQSSBnZXROZXh0VUlQSU1lc3NhZ2VcIilcblx0XHRyZXR1cm4gdGhpcy51aS5nZXROZXh0VUlQSU1lc3NhZ2UoYWJvcnRDb250cm9sbGVyKVxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEB0eXBlIHtVSX1cblx0ICovXG5cdGdldCB1aSgpIHtcblx0XHRyZXR1cm4gdGhpcy5fdWlcblx0fVxuXG59XG5cbmV4cG9ydCBkZWZhdWx0IFVJUElcbiIsIi8qKiBAbW9kdWxlIGlkbXUgR2xvYmFsL01haW4gQVBJIGZvciBpbnRlcmFjdGluZyB3aXRoIHRoZSBVSSAqL1xuXG5pbXBvcnQgVUlQSSBmcm9tIFwiLi4vdWlwaS91aXBpLmpzXCJcbi8qIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby11bnVzZWQtdmFycyAqL1xuaW1wb3J0IFVJUElNZXNzYWdlIGZyb20gXCIuLi91aXBpL3VpcGktbWVzc2FnZS5qc1wiXG5cbmNsYXNzIElETVUge1xuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge1dpbmRvd30gd2luZG93XG5cdCAqIEBwYXJhbSB7Y2FsbGJhY2t9IG9uU3RhdHVzVGV4dFxuXHQgKi9cblx0Y29uc3RydWN0b3Iod2luZG93LCBvblN0YXR1c1RleHQpIHtcblx0XHR0aGlzLndpbmRvdyA9IHdpbmRvd1xuXHRcdHRoaXMudWlwaSA9IG51bGxcblx0XHR0aGlzLm9uU3RhdHVzVGV4dCA9IG9uU3RhdHVzVGV4dFxuXHR9XG5cblx0LyoqXG5cdCAqIEBwYXJhbSB7QWJvcnRDb250cm9sbGVyfSBhYm9ydENvbnRyb2xsZXJcblx0ICogQHJldHVybnMge1Byb21pc2U8VUlQSU1lc3NhZ2U+fVxuXHQgKi9cblx0Z2V0TmV4dFVJUElNZXNzYWdlKGFib3J0Q29udHJvbGxlcikge1xuXHRcdHJldHVybiB0aGlzLnVpcGkuZ2V0TmV4dFVJUElNZXNzYWdlKGFib3J0Q29udHJvbGxlcilcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gdGV4dFxuXHQgKi9cblx0c2V0U3RhdHVzVGV4dCh0ZXh0KSB7XG5cdFx0dGhpcy5vblN0YXR1c1RleHQodGV4dClcblx0fVxuXG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7QWJvcnRDb250cm9sbGVyfSBhYm9ydENvbnRyb2xsZXJcblx0ICogQHJldHVybnMge1Byb21pc2V9XG5cdCAqL1xuXHRmZXRjaEFuZFJlbmRlclRocmVhZE5leHRNZXNzYWdlUGFnZShhYm9ydENvbnRyb2xsZXIpIHtcblx0XHRyZXR1cm4gdGhpcy51aXBpLmZldGNoQW5kUmVuZGVyVGhyZWFkTmV4dE1lc3NhZ2VQYWdlKGFib3J0Q29udHJvbGxlcilcblx0fVxuXG5cdC8qKlxuXHQgKiBNYXAgSW5zdGFncmFtIFVJXG5cdCAqL1xuXHRsb2FkVUlQSSgpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwibG9hZFVJUElcIilcblx0XHR0aGlzLnVpcGkgPSBVSVBJLmNyZWF0ZSh0aGlzLndpbmRvdylcblx0fVxuXG5cbn1cbmV4cG9ydCBkZWZhdWx0IElETVVcbiIsIi8qKiBAbW9kdWxlIHVuc2VuZC1zdHJhdGVneSBWYXJpb3VzIHN0cmF0ZWdpZXMgZm9yIHVuc2VuZGluZyBtZXNzYWdlcyAqL1xuXG4vKiBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tdW51c2VkLXZhcnMgKi9cbmltcG9ydCBJRE1VIGZyb20gXCIuLi9pZG11L2lkbXUuanNcIlxuXG4vKipcbiAqXG4gKiBAYWJzdHJhY3RcbiAqL1xuY2xhc3MgVW5zZW5kU3RyYXRlZ3kge1xuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge0lETVV9IGlkbXVcblx0ICovXG5cdGNvbnN0cnVjdG9yKGlkbXUpIHtcblx0XHR0aGlzLl9pZG11ID0gaWRtdVxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBhYnN0cmFjdFxuXHQgKiBAcmV0dXJucyB7Ym9vbGVhbn1cblx0ICovXG5cdGlzUnVubmluZygpIHtcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAYWJzdHJhY3Rcblx0ICovXG5cdHN0b3AoKSB7XG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQGFic3RyYWN0XG5cdCAqL1xuXHRyZXNldCgpIHtcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAYWJzdHJhY3Rcblx0ICovXG5cdGFzeW5jIHJ1bigpIHtcblx0fVxuXG5cdC8qKlxuXHQgKiBAcmVhZG9ubHlcblx0ICogQHR5cGUge0lETVV9XG5cdCAqL1xuXHRnZXQgaWRtdSgpIHtcblx0XHRyZXR1cm4gdGhpcy5faWRtdVxuXHR9XG5cbn1cblxuZXhwb3J0IHsgVW5zZW5kU3RyYXRlZ3kgfVxuIiwiLyoqIEBtb2R1bGUgdW5zZW5kLXN0cmF0ZWd5IFZhcmlvdXMgc3RyYXRlZ2llcyBmb3IgdW5zZW5kaW5nIG1lc3NhZ2VzICovXG5cbi8qIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby11bnVzZWQtdmFycyAqL1xuaW1wb3J0IElETVUgZnJvbSBcIi4uLy4uL2lkbXUvaWRtdS5qc1wiXG5pbXBvcnQgeyBVbnNlbmRTdHJhdGVneSB9IGZyb20gXCIuLi91bnNlbmQtc3RyYXRlZ3kuanNcIlxuXG4vKipcbiAqIExvYWRzIG11bHRpcGxlIHBhZ2VzIGJlZm9yZSB1bnNlbmRpbmcgbWVzc2FnZVxuICovXG5jbGFzcyBEZWZhdWx0U3RyYXRlZ3kgZXh0ZW5kcyBVbnNlbmRTdHJhdGVneSB7XG5cblx0LyoqXG5cdCAqIEBwYXJhbSB7SURNVX0gaWRtdVxuXHQgKi9cblx0Y29uc3RydWN0b3IoaWRtdSkge1xuXHRcdHN1cGVyKGlkbXUpXG5cdFx0dGhpcy5fYWxsUGFnZXNMb2FkZWQgPSBmYWxzZVxuXHRcdHRoaXMuX3Vuc2VudENvdW50ID0gMFxuXHRcdHRoaXMuX3BhZ2VzTG9hZGVkQ291bnQgPSAwXG5cdFx0dGhpcy5fcnVubmluZyA9IGZhbHNlXG5cdFx0dGhpcy5fYWJvcnRDb250cm9sbGVyID0gbnVsbFxuXHRcdHRoaXMuX2xhc3RVbnNlbmREYXRlID0gbnVsbFxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEByZXR1cm5zIHtib29sZWFufVxuXHQgKi9cblx0aXNSdW5uaW5nKCkge1xuXHRcdHJldHVybiB0aGlzLl9ydW5uaW5nICYmIHRoaXMuX2Fib3J0Q29udHJvbGxlciAmJiB0aGlzLl9hYm9ydENvbnRyb2xsZXIuc2lnbmFsLmFib3J0ZWQgPT09IGZhbHNlXG5cdH1cblxuXHRzdG9wKCkge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJEZWZhdWx0U3RyYXRlZ3kgc3RvcFwiKVxuXHRcdHRoaXMuaWRtdS5zZXRTdGF0dXNUZXh0KFwiU3RvcHBpbmcuLi5cIilcblx0XHR0aGlzLl9hYm9ydENvbnRyb2xsZXIuYWJvcnQoKVxuXHR9XG5cblx0cmVzZXQoKSB7XG5cdFx0dGhpcy5fYWxsUGFnZXNMb2FkZWQgPSBmYWxzZVxuXHRcdHRoaXMuX3Vuc2VudENvdW50ID0gMFxuXHRcdHRoaXMuX2xhc3RVbnNlbmREYXRlID0gbnVsbFxuXHRcdHRoaXMuX3BhZ2VzTG9hZGVkQ291bnQgPSAwXG5cdFx0dGhpcy5pZG11LnNldFN0YXR1c1RleHQoXCJSZWFkeVwiKVxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlfVxuXHQgKi9cblx0YXN5bmMgcnVuKCkge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJEZWZhdWx0U3RyYXRlZ3kucnVuKClcIilcblx0XHR0aGlzLl91bnNlbnRDb3VudCA9IDBcblx0XHR0aGlzLl9wYWdlc0xvYWRlZENvdW50ID0gMFxuXHRcdHRoaXMuX3J1bm5pbmcgPSB0cnVlXG5cdFx0dGhpcy5fYWJvcnRDb250cm9sbGVyID0gbmV3IEFib3J0Q29udHJvbGxlcigpXG5cdFx0dGhpcy5pZG11LmxvYWRVSVBJKClcblx0XHR0cnkge1xuXHRcdFx0aWYodGhpcy5fYWxsUGFnZXNMb2FkZWQpIHtcblx0XHRcdFx0YXdhaXQgdGhpcy4jdW5zZW5kTmV4dE1lc3NhZ2UoKVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0YXdhaXQgdGhpcy4jbG9hZE5leHRQYWdlKClcblx0XHRcdH1cblx0XHRcdGlmKHRoaXMuX2Fib3J0Q29udHJvbGxlci5zaWduYWwuYWJvcnRlZCkge1xuXHRcdFx0XHR0aGlzLmlkbXUuc2V0U3RhdHVzVGV4dChgQWJvcnRlZC4gJHt0aGlzLl91bnNlbnRDb3VudH0gbWVzc2FnZShzKSB1bnNlbnQuYClcblx0XHRcdFx0Y29uc29sZS5kZWJ1ZyhcIkRlZmF1bHRTdHJhdGVneSBhYm9ydGVkXCIpXG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLmlkbXUuc2V0U3RhdHVzVGV4dChgRG9uZS4gJHt0aGlzLl91bnNlbnRDb3VudH0gbWVzc2FnZShzKSB1bnNlbnQuYClcblx0XHRcdFx0Y29uc29sZS5kZWJ1ZyhcIkRlZmF1bHRTdHJhdGVneSBkb25lXCIpXG5cdFx0XHR9XG5cdFx0fSBjYXRjaChleCkge1xuXHRcdFx0Y29uc29sZS5lcnJvcihleClcblx0XHRcdHRoaXMuaWRtdS5zZXRTdGF0dXNUZXh0KGBFcnJvcmVkLiAke3RoaXMuX3Vuc2VudENvdW50fSBtZXNzYWdlKHMpIHVuc2VudC5gKVxuXHRcdFx0Y29uc29sZS5kZWJ1ZyhcIkRlZmF1bHRTdHJhdGVneSBlcnJvcmVkXCIpXG5cdFx0fVxuXHRcdHRoaXMuX3J1bm5pbmcgPSBmYWxzZVxuXHR9XG5cblx0LyoqXG5cdCAqIFRyaWVzIHRvIGxvYWQgdGhlIHRocmVhZCBuZXh0IHBhZ2Vcblx0ICovXG5cdGFzeW5jICNsb2FkTmV4dFBhZ2UoKSB7XG5cdFx0aWYodGhpcy5fYWJvcnRDb250cm9sbGVyLnNpZ25hbC5hYm9ydGVkKSB7XG5cdFx0XHRyZXR1cm5cblx0XHR9XG5cdFx0dGhpcy5pZG11LnNldFN0YXR1c1RleHQoXCJMb2FkaW5nIG5leHQgcGFnZS4uLlwiKVxuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBkb25lID0gYXdhaXQgdGhpcy5pZG11LmZldGNoQW5kUmVuZGVyVGhyZWFkTmV4dE1lc3NhZ2VQYWdlKHRoaXMuX2Fib3J0Q29udHJvbGxlcilcblx0XHRcdGlmKHRoaXMuX2Fib3J0Q29udHJvbGxlci5zaWduYWwuYWJvcnRlZCA9PT0gZmFsc2UpIHtcblx0XHRcdFx0aWYoZG9uZSkge1xuXHRcdFx0XHRcdHRoaXMuaWRtdS5zZXRTdGF0dXNUZXh0KGBBbGwgcGFnZXMgbG9hZGVkICgke3RoaXMuX3BhZ2VzTG9hZGVkQ291bnR9IGluIHRvdGFsKS4uLmApXG5cdFx0XHRcdFx0dGhpcy5fYWxsUGFnZXNMb2FkZWQgPSB0cnVlXG5cdFx0XHRcdFx0YXdhaXQgdGhpcy4jdW5zZW5kTmV4dE1lc3NhZ2UoKVxuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHRoaXMuX3BhZ2VzTG9hZGVkQ291bnQrK1xuXHRcdFx0XHRcdGF3YWl0IHRoaXMuI2xvYWROZXh0UGFnZSgpXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9IGNhdGNoKGV4KSB7XG5cdFx0XHRjb25zb2xlLmVycm9yKGV4KVxuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBVbnNlbmQgZmlyc3QgbWVzc2FnZSBpbiB2aWV3cG9ydFxuXHQgKi9cblx0YXN5bmMgI3Vuc2VuZE5leHRNZXNzYWdlKCkge1xuXHRcdGlmKHRoaXMuX2Fib3J0Q29udHJvbGxlci5zaWduYWwuYWJvcnRlZCkge1xuXHRcdFx0cmV0dXJuXG5cdFx0fVxuXHRcdGxldCBjYW5TY3JvbGwgPSB0cnVlXG5cdFx0dHJ5IHtcblx0XHRcdHRoaXMuaWRtdS5zZXRTdGF0dXNUZXh0KFwiUmV0cmlldmluZyBuZXh0IG1lc3NhZ2UuLi5cIilcblx0XHRcdGNvbnN0IHVpcGlNZXNzYWdlID0gYXdhaXQgdGhpcy5pZG11LmdldE5leHRVSVBJTWVzc2FnZSh0aGlzLl9hYm9ydENvbnRyb2xsZXIpXG5cdFx0XHRjYW5TY3JvbGwgPSB1aXBpTWVzc2FnZSAhPT0gZmFsc2Vcblx0XHRcdGlmKHVpcGlNZXNzYWdlKSB7XG5cdFx0XHRcdHRoaXMuaWRtdS5zZXRTdGF0dXNUZXh0KFwiVW5zZW5kaW5nIG1lc3NhZ2UuLi5cIilcblx0XHRcdFx0aWYgKHRoaXMuX2xhc3RVbnNlbmREYXRlICE9PSBudWxsKSB7XG5cdFx0XHRcdFx0Y29uc3QgbGFzdFVuc2VuZERhdGVEaWZmID0gbmV3IERhdGUoKS5nZXRUaW1lKCkgLSB0aGlzLl9sYXN0VW5zZW5kRGF0ZS5nZXRUaW1lKClcblx0XHRcdFx0XHRpZihsYXN0VW5zZW5kRGF0ZURpZmYgPCAxMDAwKSB7XG5cdFx0XHRcdFx0XHR0aGlzLmlkbXUuc2V0U3RhdHVzVGV4dChgV2FpdGluZyAke2xhc3RVbnNlbmREYXRlRGlmZn1tcyBiZWZvcmUgdW5zZW5kaW5nIG5leHQgbWVzc2FnZS4uLmApXG5cdFx0XHRcdFx0XHRhd2FpdCBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgbGFzdFVuc2VuZERhdGVEaWZmKSlcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0Y29uc3QgdW5zZW50ID0gYXdhaXQgdWlwaU1lc3NhZ2UudW5zZW5kKHRoaXMuX2Fib3J0Q29udHJvbGxlcilcblx0XHRcdFx0aWYodW5zZW50KSB7XG5cdFx0XHRcdFx0dGhpcy5fbGFzdFVuc2VuZERhdGUgPSBuZXcgRGF0ZSgpXG5cdFx0XHRcdFx0dGhpcy5fdW5zZW50Q291bnQrK1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSBjYXRjaChleCkge1xuXHRcdFx0Y29uc29sZS5lcnJvcihleClcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0aWYoY2FuU2Nyb2xsKSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMuI3Vuc2VuZE5leHRNZXNzYWdlKClcblx0XHRcdH1cblx0XHR9XG5cdH1cblxufVxuXG5leHBvcnQgeyBEZWZhdWx0U3RyYXRlZ3kgfVxuIiwiLyoqIEBtb2R1bGUgYWxlcnQgQWxlcnQgVUkgKi9cblxuLyoqXG4gKlxuICogQHBhcmFtIHtEb2N1bWVudH0gZG9jdW1lbnRcbiAqIEByZXR1cm5zIHtIVE1MQnV0dG9uRWxlbWVudH1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUFsZXJ0c1dyYXBwZXJFbGVtZW50KGRvY3VtZW50KSB7XG5cdGNvbnN0IGFsZXJ0c1dyYXBwZXJFbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKVxuXHRhbGVydHNXcmFwcGVyRWxlbWVudC5pZCA9IFwiaWRtdS1hbGVydHNcIlxuXHRhbGVydHNXcmFwcGVyRWxlbWVudC5zdHlsZS5wb3NpdGlvbiA9IFwiZml4ZWRcIlxuXHRhbGVydHNXcmFwcGVyRWxlbWVudC5zdHlsZS50b3AgPSBcIjIwcHhcIlxuXHRhbGVydHNXcmFwcGVyRWxlbWVudC5zdHlsZS5yaWdodCA9IFwiMjBweFwiXG5cdGFsZXJ0c1dyYXBwZXJFbGVtZW50LnN0eWxlLmRpc3BsYXkgPSBcImdyaWRcIlxuXHRyZXR1cm4gYWxlcnRzV3JhcHBlckVsZW1lbnRcbn1cblxuLyoqXG4gKlxuICogQHBhcmFtIHtEb2N1bWVudH0gZG9jdW1lbnRcbiAqIEBwYXJhbSB7c3RyaW5nfSAgIHRleHRcbiAqIEByZXR1cm5zIHtIVE1MQnV0dG9uRWxlbWVudH1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUFsZXJ0RWxlbWVudChkb2N1bWVudCwgdGV4dCkge1xuXHRjb25zdCBhbGVydEVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpXG5cdGFsZXJ0RWxlbWVudC50ZXh0Q29udGVudCA9IHRleHRcblx0cmV0dXJuIGFsZXJ0RWxlbWVudFxufVxuIiwiLyoqIEBtb2R1bGUgb3ZlcmxheSBJRE1VJ3Mgb3ZlcmxheSAqL1xuXG4vKipcbiAqIEBwYXJhbSB7RG9jdW1lbnR9IGRvY3VtZW50XG4gKiBAcmV0dXJucyB7SFRNTERpdkVsZW1lbnR9XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVPdmVybGF5RWxlbWVudChkb2N1bWVudCkge1xuXHRjb25zdCBvdmVybGF5RWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIilcblx0b3ZlcmxheUVsZW1lbnQuaWQgPSBcImlkbXUtb3ZlcmxheVwiXG5cdG92ZXJsYXlFbGVtZW50LnRhYkluZGV4ID0gMFxuXHRvdmVybGF5RWxlbWVudC5zdHlsZS50b3AgPSBcIjBcIlxuXHRvdmVybGF5RWxlbWVudC5zdHlsZS5yaWdodCA9IFwiMFwiXG5cdG92ZXJsYXlFbGVtZW50LnN0eWxlLnBvc2l0aW9uID0gXCJmaXhlZFwiXG5cdG92ZXJsYXlFbGVtZW50LnN0eWxlLndpZHRoID0gXCIxMDB2d1wiXG5cdG92ZXJsYXlFbGVtZW50LnN0eWxlLmhlaWdodCA9IFwiMTAwdmhcIlxuXHRvdmVybGF5RWxlbWVudC5zdHlsZS56SW5kZXggPSBcIjk5OFwiXG5cdG92ZXJsYXlFbGVtZW50LnN0eWxlLmJhY2tncm91bmRDb2xvciA9IFwiIzAwMDAwMGQ2XCJcblx0b3ZlcmxheUVsZW1lbnQuc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiXG5cdHJldHVybiBvdmVybGF5RWxlbWVudFxufVxuIiwiLyoqIEBtb2R1bGUgdWkgSURNVSdzIG93biB1aS9vdmVybGF5XG4gKiBQcm92aWRlIGEgYnV0dG9uIHRvIHVuc2VuZCBtZXNzYWdlc1xuICovXG5cbmltcG9ydCB7IGNyZWF0ZU1lbnVCdXR0b25FbGVtZW50IH0gZnJvbSBcIi4vbWVudS1idXR0b24uanNcIlxuaW1wb3J0IHsgY3JlYXRlTWVudUVsZW1lbnQgfSBmcm9tIFwiLi9tZW51LmpzXCJcbmltcG9ydCBJRE1VIGZyb20gXCIuLi8uLi8uLi9pZG11L2lkbXUuanNcIlxuaW1wb3J0IHsgRGVmYXVsdFN0cmF0ZWd5IH0gZnJvbSBcIi4uLy4uLy4uL3VpL2RlZmF1bHQvdW5zZW5kLXN0cmF0ZWd5LmpzXCJcbmltcG9ydCB7IGNyZWF0ZUFsZXJ0c1dyYXBwZXJFbGVtZW50IH0gZnJvbSBcIi4vYWxlcnQuanNcIlxuaW1wb3J0IHsgY3JlYXRlT3ZlcmxheUVsZW1lbnQgfSBmcm9tIFwiLi9vdmVybGF5LmpzXCJcbmltcG9ydCB7IEJVVFRPTl9TVFlMRSB9IGZyb20gXCIuL3N0eWxlL2luc3RhZ3JhbS5qc1wiXG4vKiBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tdW51c2VkLXZhcnMgKi9cbmltcG9ydCB7IFVuc2VuZFN0cmF0ZWd5IH0gZnJvbSBcIi4uLy4uLy4uL3VpL3Vuc2VuZC1zdHJhdGVneS5qc1wiXG5cbmNsYXNzIE9TRCB7XG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge0RvY3VtZW50fSBkb2N1bWVudFxuXHQgKiBAcGFyYW0ge0hUTUxEaXZFbGVtZW50fSByb290XG5cdCAqIEBwYXJhbSB7SFRNTERpdkVsZW1lbnR9IG92ZXJsYXlFbGVtZW50XG5cdCAqIEBwYXJhbSB7SFRNTERpdkVsZW1lbnR9IG1lbnVFbGVtZW50XG5cdCAqIEBwYXJhbSB7SFRNTEJ1dHRvbkVsZW1lbnR9IHVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uXG5cdCAqIEBwYXJhbSB7SFRNTERpdkVsZW1lbnR9IHN0YXR1c0VsZW1lbnRcblx0ICovXG5cdGNvbnN0cnVjdG9yKGRvY3VtZW50LCByb290LCBvdmVybGF5RWxlbWVudCwgbWVudUVsZW1lbnQsIHVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uLCBzdGF0dXNFbGVtZW50KSB7XG5cdFx0dGhpcy5fZG9jdW1lbnQgPSBkb2N1bWVudFxuXHRcdHRoaXMuX3Jvb3QgPSByb290XG5cdFx0dGhpcy5fb3ZlcmxheUVsZW1lbnQgPSBvdmVybGF5RWxlbWVudFxuXHRcdHRoaXMuX21lbnVFbGVtZW50ID0gbWVudUVsZW1lbnRcblx0XHR0aGlzLl9zdGF0dXNFbGVtZW50ID0gc3RhdHVzRWxlbWVudFxuXHRcdHRoaXMuX3Vuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uID0gdW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b25cblx0XHR0aGlzLl9pZG11ID0gbmV3IElETVUodGhpcy53aW5kb3csIHRoaXMub25TdGF0dXNUZXh0LmJpbmQodGhpcykpXG5cdFx0dGhpcy5fc3RyYXRlZ3kgPSBuZXcgRGVmYXVsdFN0cmF0ZWd5KHRoaXMuX2lkbXUpIC8vIFRPRE8gbW92ZSBvdXRcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge3dpbmRvd30gd2luZG93XG5cdCAqIEByZXR1cm5zIHtPU0R9XG5cdCAqL1xuXHRzdGF0aWMgcmVuZGVyKHdpbmRvdykge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJyZW5kZXJcIilcblx0XHRjb25zdCB1aSA9IE9TRC5jcmVhdGUod2luZG93LmRvY3VtZW50KVxuXHRcdHdpbmRvdy5kb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHVpLnJvb3QpXG5cdFx0cmV0dXJuIHVpXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHBhcmFtICAge0RvY3VtZW50fSBkb2N1bWVudFxuXHQgKiBAcmV0dXJucyB7T1NEfVxuXHQgKi9cblx0c3RhdGljIGNyZWF0ZShkb2N1bWVudCkge1xuXHRcdGNvbnN0IHJvb3QgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpXG5cdFx0cm9vdC5pZCA9IFwiaWRtdS1yb290XCJcblx0XHRjb25zdCBtZW51RWxlbWVudCA9IGNyZWF0ZU1lbnVFbGVtZW50KGRvY3VtZW50KVxuXHRcdGNvbnN0IG92ZXJsYXlFbGVtZW50ID0gY3JlYXRlT3ZlcmxheUVsZW1lbnQoZG9jdW1lbnQpXG5cdFx0Y29uc3QgYWxlcnRzV3JhcHBlckVsZW1lbnQgPSBjcmVhdGVBbGVydHNXcmFwcGVyRWxlbWVudChkb2N1bWVudClcblx0XHRjb25zdCB1bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbiA9IGNyZWF0ZU1lbnVCdXR0b25FbGVtZW50KGRvY3VtZW50LCBcIlVuc2VuZCBhbGwgRE1zXCIsIEJVVFRPTl9TVFlMRS5QUklNQVJZKVxuXHRcdGNvbnN0IHN0YXR1c0VsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpXG5cdFx0c3RhdHVzRWxlbWVudC50ZXh0Q29udGVudCA9IFwiUmVhZHlcIlxuXHRcdHN0YXR1c0VsZW1lbnQuaWQgPSBcImlkbXUtc3RhdHVzXCJcblx0XHRzdGF0dXNFbGVtZW50LnN0eWxlID0gXCJ3aWR0aDogMjAwcHhcIlxuXHRcdGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQob3ZlcmxheUVsZW1lbnQpXG5cdFx0ZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChhbGVydHNXcmFwcGVyRWxlbWVudClcblx0XHRtZW51RWxlbWVudC5hcHBlbmRDaGlsZCh1bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbilcblx0XHRtZW51RWxlbWVudC5hcHBlbmRDaGlsZChzdGF0dXNFbGVtZW50KVxuXHRcdHJvb3QuYXBwZW5kQ2hpbGQobWVudUVsZW1lbnQpXG5cdFx0Y29uc3QgdWkgPSBuZXcgT1NEKGRvY3VtZW50LCByb290LCBvdmVybGF5RWxlbWVudCwgbWVudUVsZW1lbnQsIHVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uLCBzdGF0dXNFbGVtZW50KVxuXHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJrZXlkb3duXCIsIChldmVudCkgPT4gdWkuI29uV2luZG93S2V5RXZlbnQoZXZlbnQpKSAvLyBUT0RPIHRlc3Rcblx0XHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKFwia2V5dXBcIiwgKGV2ZW50KSA9PiB1aS4jb25XaW5kb3dLZXlFdmVudChldmVudCkpIC8vIFRPRE8gdGVzdFxuXHRcdHVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoZXZlbnQpID0+IHVpLiNvblVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uQ2xpY2soZXZlbnQpKVxuXHRcdHVpLl9tdXRhdGlvbk9ic2VydmVyID0gbmV3IE11dGF0aW9uT2JzZXJ2ZXIoKG11dGF0aW9ucykgPT4gdWkuI29uTXV0YXRpb25zKHVpLCBtdXRhdGlvbnMpKVxuXHRcdHVpLl9tdXRhdGlvbk9ic2VydmVyLm9ic2VydmUoZG9jdW1lbnQuYm9keSwgeyBjaGlsZExpc3Q6IHRydWUgfSkgLy8gVE9ETyB0ZXN0XG5cdFx0dW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24uZGF0YVRleHRDb250ZW50ID0gdW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24udGV4dENvbnRlbnRcblx0XHR1bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbi5kYXRhQmFja2dyb3VuZENvbG9yID0gdW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24uc3R5bGUuYmFja2dyb3VuZENvbG9yXG5cdFx0cmV0dXJuIHVpXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHtzdHJpbmd9IHRleHRcblx0ICovXG5cdG9uU3RhdHVzVGV4dCh0ZXh0KSB7XG5cdFx0dGhpcy5zdGF0dXNFbGVtZW50LnRleHRDb250ZW50ID0gdGV4dFxuXHR9XG5cblx0YXN5bmMgI3N0YXJ0VW5zZW5kaW5nKCkge1xuXHRcdDtbLi4udGhpcy5tZW51RWxlbWVudC5xdWVyeVNlbGVjdG9yQWxsKFwiYnV0dG9uXCIpXS5maWx0ZXIoYnV0dG9uID0+IGJ1dHRvbiAhPT0gdGhpcy51bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbikuZm9yRWFjaChidXR0b24gPT4ge1xuXHRcdFx0YnV0dG9uLnN0eWxlLnZpc2liaWxpdHkgPSBcImhpZGRlblwiXG5cdFx0XHRidXR0b24uZGlzYWJsZWQgPSB0cnVlXG5cdFx0fSlcblx0XHR0aGlzLm92ZXJsYXlFbGVtZW50LnN0eWxlLmRpc3BsYXkgPSBcIlwiXG5cdFx0dGhpcy5vdmVybGF5RWxlbWVudC5mb2N1cygpXG5cdFx0dGhpcy51bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbi50ZXh0Q29udGVudCA9IFwiU3RvcCBwcm9jZXNzaW5nXCJcblx0XHR0aGlzLnVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uLnN0eWxlLmJhY2tncm91bmRDb2xvciA9IFwiI0ZBMzgzRVwiXG5cdFx0dGhpcy5zdGF0dXNFbGVtZW50LnN0eWxlLmNvbG9yID0gXCJ3aGl0ZVwiXG5cdFx0dGhpcy5fbXV0YXRpb25PYnNlcnZlci5kaXNjb25uZWN0KClcblx0XHRhd2FpdCB0aGlzLnN0cmF0ZWd5LnJ1bigpXG5cdFx0dGhpcy4jb25VbnNlbmRpbmdGaW5pc2hlZCgpXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHtPU0R9IHVpXG5cdCAqL1xuXHQjb25NdXRhdGlvbnModWkpIHtcblx0XHRpZih1aS5yb290Lm93bmVyRG9jdW1lbnQucXVlcnlTZWxlY3RvcihcIltpZF49bW91bnRdID4gZGl2ID4gZGl2ID4gZGl2XCIpICE9PSBudWxsICYmIHVpKSB7XG5cdFx0XHRpZih0aGlzLl9tdXRhdGlvbk9ic2VydmVyKSB7XG5cdFx0XHRcdHRoaXMuX211dGF0aW9uT2JzZXJ2ZXIuZGlzY29ubmVjdCgpXG5cdFx0XHR9XG5cdFx0XHR0aGlzLl9tdXRhdGlvbk9ic2VydmVyID0gbmV3IE11dGF0aW9uT2JzZXJ2ZXIodWkuI29uTXV0YXRpb25zLmJpbmQodGhpcywgdWkpKVxuXHRcdFx0dGhpcy5fbXV0YXRpb25PYnNlcnZlci5vYnNlcnZlKHVpLnJvb3Qub3duZXJEb2N1bWVudC5xdWVyeVNlbGVjdG9yKFwiW2lkXj1tb3VudF0gPiBkaXYgPiBkaXYgPiBkaXZcIiksIHsgY2hpbGRMaXN0OiB0cnVlLCBhdHRyaWJ1dGVzOiB0cnVlIH0pXG5cdFx0fVxuXHRcdGlmKHRoaXMud2luZG93LmxvY2F0aW9uLnBhdGhuYW1lLnN0YXJ0c1dpdGgoXCIvZGlyZWN0L3QvXCIpKSB7XG5cdFx0XHRpZighdGhpcy5zdHJhdGVneS5pc1J1bm5pbmcoKSkge1xuXHRcdFx0XHR0aGlzLnN0cmF0ZWd5LnJlc2V0KClcblx0XHRcdH1cblx0XHRcdHRoaXMucm9vdC5zdHlsZS5kaXNwbGF5ID0gXCJcIlxuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLnJvb3Quc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiXG5cdFx0XHRpZih0aGlzLnN0cmF0ZWd5LmlzUnVubmluZygpKSB7XG5cdFx0XHRcdHRoaXMuc3RyYXRlZ3kuc3RvcCgpXG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7T1NEfSB1aVxuXHQgKiBAcGFyYW0ge0V2ZW50fSBldmVudFxuXHQgKi9cblx0I29uVW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b25DbGljaygpIHtcblx0XHRpZih0aGlzLnN0cmF0ZWd5LmlzUnVubmluZygpKSB7XG5cdFx0XHRjb25zb2xlLmRlYnVnKFwiVXNlciBhc2tlZCBmb3IgbWVzc2FnZXMgdW5zZW5kaW5nIHRvIHN0b3BcIilcblx0XHRcdHRoaXMuc3RyYXRlZ3kuc3RvcCgpXG5cdFx0XHR0aGlzLiNvblVuc2VuZGluZ0ZpbmlzaGVkKClcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc29sZS5kZWJ1ZyhcIlVzZXIgYXNrZWQgZm9yIG1lc3NhZ2VzIHVuc2VuZGluZyB0byBzdGFydDsgVUkgaW50ZXJhY3Rpb24gd2lsbCBiZSBkaXNhYmxlZCBpbiB0aGUgbWVhbnRpbWVcIilcblx0XHRcdHRoaXMuI3N0YXJ0VW5zZW5kaW5nKClcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHtFdmVudH0gZXZlbnRcblx0ICogQHJldHVybnMge2Jvb2xlYW59XG5cdCAqL1xuXHQjb25XaW5kb3dLZXlFdmVudChldmVudCkge1xuXHRcdGlmKHRoaXMuc3RyYXRlZ3kuaXNSdW5uaW5nKCkpIHtcblx0XHRcdGNvbnNvbGUubG9nKFwiVXNlciBpbnRlcmFjdGlvbiBpcyBkaXNhYmxlZCBhcyB0aGUgdW5zZW5kaW5nIGlzIHN0aWxsIHJ1bm5pbmc7IFBsZWFzZSBzdG9wIHRoZSBleGVjdXRpb24gZmlyc3QuXCIpXG5cdFx0XHRldmVudC5zdG9wSW1tZWRpYXRlUHJvcGFnYXRpb24oKVxuXHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKVxuXHRcdFx0ZXZlbnQuc3RvcFByb3BhZ2F0aW9uKClcblx0XHRcdHRoaXMub3ZlcmxheUVsZW1lbnQuZm9jdXMoKVxuXHRcdFx0cmV0dXJuIGZhbHNlXG5cdFx0fVxuXHR9XG5cblx0I29uVW5zZW5kaW5nRmluaXNoZWQoKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcInJlbmRlciBvblVuc2VuZGluZ0ZpbmlzaGVkXCIpXG5cdFx0O1suLi50aGlzLm1lbnVFbGVtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoXCJidXR0b25cIildLmZpbHRlcihidXR0b24gPT4gYnV0dG9uICE9PSB0aGlzLnVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uKS5mb3JFYWNoKGJ1dHRvbiA9PiB7XG5cdFx0XHRidXR0b24uc3R5bGUudmlzaWJpbGl0eSA9IFwiXCJcblx0XHRcdGJ1dHRvbi5kaXNhYmxlZCA9IGZhbHNlXG5cdFx0fSlcblx0XHR0aGlzLnVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uLnRleHRDb250ZW50ID0gdGhpcy51bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbi5kYXRhVGV4dENvbnRlbnRcblx0XHR0aGlzLnVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uLnN0eWxlLmJhY2tncm91bmRDb2xvciA9IHRoaXMudW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24uZGF0YUJhY2tncm91bmRDb2xvclxuXHRcdHRoaXMub3ZlcmxheUVsZW1lbnQuc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiXG5cdFx0dGhpcy5zdGF0dXNFbGVtZW50LnN0eWxlLmNvbG9yID0gXCJcIlxuXHRcdHRoaXMuX211dGF0aW9uT2JzZXJ2ZXIub2JzZXJ2ZSh0aGlzLl9kb2N1bWVudC5ib2R5LCB7IGNoaWxkTGlzdDogdHJ1ZSB9KSAvLyBUT0RPIHRlc3Rcblx0fVxuXG5cdC8qKlxuXHQgKiBAcmVhZG9ubHlcblx0ICogQHR5cGUge0RvY3VtZW50fVxuXHQgKi9cblx0Z2V0IGRvY3VtZW50KCkge1xuXHRcdHJldHVybiB0aGlzLl9kb2N1bWVudFxuXHR9XG5cblx0LyoqXG5cdCAqIEByZWFkb25seVxuXHQgKiBAdHlwZSB7V2luZG93fVxuXHQgKi9cblx0Z2V0IHdpbmRvdygpIHtcblx0XHRyZXR1cm4gdGhpcy5fZG9jdW1lbnQuZGVmYXVsdFZpZXdcblx0fVxuXG5cdC8qKlxuXHQgKiBAcmVhZG9ubHlcblx0ICogQHR5cGUge0hUTUxEaXZFbGVtZW50fVxuXHQgKi9cblx0Z2V0IHJvb3QoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX3Jvb3Rcblx0fVxuXG5cdC8qKlxuXHQgKiBAcmVhZG9ubHlcblx0ICogQHR5cGUge0hUTUxEaXZFbGVtZW50fVxuXHQgKi9cblx0Z2V0IG92ZXJsYXlFbGVtZW50KCkge1xuXHRcdHJldHVybiB0aGlzLl9vdmVybGF5RWxlbWVudFxuXHR9XG5cblx0LyoqXG5cdCAqIEByZWFkb25seVxuXHQgKiBAdHlwZSB7SFRNTERpdkVsZW1lbnR9XG5cdCAqL1xuXHRnZXQgbWVudUVsZW1lbnQoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX21lbnVFbGVtZW50XG5cdH1cblxuXHQvKipcblx0ICogQHJlYWRvbmx5XG5cdCAqIEB0eXBlIHtIVE1MQnV0dG9uRWxlbWVudH1cblx0ICovXG5cdGdldCB1bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbigpIHtcblx0XHRyZXR1cm4gdGhpcy5fdW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b25cblx0fVxuXG5cdC8qKlxuXHQgKiBAcmVhZG9ubHlcblx0ICogQHR5cGUge0hUTUxEaXZFbGVtZW50fVxuXHQgKi9cblx0Z2V0IHN0YXR1c0VsZW1lbnQoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX3N0YXR1c0VsZW1lbnRcblx0fVxuXG5cdC8qKlxuXHQgKiBAcmVhZG9ubHlcblx0ICogQHR5cGUge1Vuc2VuZFN0cmF0ZWd5fVxuXHQgKi9cblx0Z2V0IHN0cmF0ZWd5KCkgeyAvLyBUT0RPIG1vdmUgb3V0XG5cdFx0cmV0dXJuIHRoaXMuX3N0cmF0ZWd5XG5cdH1cblxuXHQvKipcblx0ICogQHJlYWRvbmx5XG5cdCAqIEB0eXBlIHtJRE1VfVxuXHQgKi9cblx0Z2V0IGlkbXUoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX2lkbXVcblx0fVxuXG59XG5cbmV4cG9ydCBkZWZhdWx0IE9TRFxuIiwiLyoqIEBtb2R1bGUgbWFpbiBNYWluIG1vZHVsZSAqL1xuXG5pbXBvcnQgT1NEIGZyb20gXCIuL29zZC9vc2QuanNcIlxuXG4vKipcbiAqIEBwYXJhbSB7V2luZG93fSB3aW5kb3dcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG1haW4od2luZG93KSB7XG5cdE9TRC5yZW5kZXIod2luZG93KVxufVxuXG5pZih0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiKSB7XG5cdG1haW4od2luZG93KVxufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Q0FBQTtBQUNBO0NBQ08sTUFBTSxZQUFZLEdBQUc7Q0FDNUIsQ0FBQyxTQUFTLEVBQUUsU0FBUztDQUNyQixDQUFDLFdBQVcsRUFBRSxXQUFXO0NBQ3pCLEVBQUM7QUFDRDtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDTyxTQUFTLGdCQUFnQixDQUFDLGFBQWEsRUFBRSxTQUFTLEVBQUU7Q0FDM0QsQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLFFBQVEsR0FBRyw2QkFBNEI7Q0FDNUQsQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLEtBQUssR0FBRyxRQUFPO0NBQ3BDLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxNQUFNLEdBQUcsTUFBSztDQUNuQyxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsWUFBWSxHQUFHLE1BQUs7Q0FDekMsQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLE9BQU8sR0FBRyxNQUFLO0NBQ3BDLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxVQUFVLEdBQUcsT0FBTTtDQUN4QyxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLFVBQVM7Q0FDdkMsQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLFVBQVUsR0FBRywrQkFBOEI7Q0FDaEUsQ0FBQyxHQUFHLFNBQVMsRUFBRTtDQUNmLEVBQUUsYUFBYSxDQUFDLEtBQUssQ0FBQyxlQUFlLEdBQUcsQ0FBQyxhQUFhLEVBQUUsU0FBUyxDQUFDLFNBQVMsRUFBQztDQUM1RSxFQUFFO0NBQ0Y7O0NDeEJBO0FBQ0E7QUFFQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ08sU0FBUyx1QkFBdUIsQ0FBQyxRQUFRLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRTtDQUNuRSxDQUFDLE1BQU0sYUFBYSxHQUFHLFFBQVEsQ0FBQyxhQUFhLENBQUMsUUFBUSxFQUFDO0NBQ3ZELENBQUMsYUFBYSxDQUFDLFdBQVcsR0FBRyxLQUFJO0NBQ2pDLENBQUMsZ0JBQWdCLENBQUMsYUFBYSxFQUFFLFNBQVMsRUFBQztDQUMzQyxDQUFDLGFBQWEsQ0FBQyxnQkFBZ0IsQ0FBQyxXQUFXLEVBQUUsTUFBTTtDQUNuRCxFQUFFLGFBQWEsQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLENBQUMsZ0JBQWdCLEVBQUM7Q0FDakQsRUFBRSxFQUFDO0NBQ0gsQ0FBQyxhQUFhLENBQUMsZ0JBQWdCLENBQUMsVUFBVSxFQUFFLE1BQU07Q0FDbEQsRUFBRSxhQUFhLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUM7Q0FDakMsRUFBRSxFQUFDO0NBQ0gsQ0FBQyxPQUFPLGFBQWE7Q0FDckI7O0NDdEJBO0FBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNPLFNBQVMsaUJBQWlCLENBQUMsUUFBUSxFQUFFO0NBQzVDLENBQUMsTUFBTSxXQUFXLEdBQUcsUUFBUSxDQUFDLGFBQWEsQ0FBQyxLQUFLLEVBQUM7Q0FDbEQsQ0FBQyxXQUFXLENBQUMsRUFBRSxHQUFHLFlBQVc7Q0FDN0IsQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLEdBQUcsR0FBRyxPQUFNO0NBQy9CLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxLQUFLLEdBQUcsUUFBTztDQUNsQyxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsUUFBUSxHQUFHLFFBQU87Q0FDckMsQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxJQUFHO0NBQy9CLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxPQUFPLEdBQUcsT0FBTTtDQUNuQyxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsR0FBRyxHQUFHLE9BQU07Q0FDL0IsQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLFVBQVUsR0FBRyxTQUFRO0NBQ3hDLENBQUMsT0FBTyxXQUFXO0NBQ25COztDQ2pCQTtBQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtBQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDTyxTQUFTLGNBQWMsQ0FBQyxNQUFNLEVBQUUsVUFBVSxFQUFFLGVBQWUsRUFBRTtDQUNwRSxDQUFDLE9BQU8sSUFBSSxPQUFPLENBQUMsQ0FBQyxPQUFPLEVBQUUsTUFBTSxLQUFLO0NBQ3pDLEVBQUUsSUFBSSxpQkFBZ0I7Q0FDdEIsRUFBRSxNQUFNLFlBQVksR0FBRyxNQUFNO0NBQzdCLEdBQUcsR0FBRyxnQkFBZ0IsRUFBRTtDQUN4QixJQUFJLE1BQU0sQ0FBQyxJQUFJLFlBQVksQ0FBQyw2Q0FBNkMsRUFBRSxZQUFZLENBQUMsRUFBQztDQUN6RixJQUFJLGdCQUFnQixDQUFDLFVBQVUsR0FBRTtDQUNqQyxJQUFJLE1BQU07Q0FDVixJQUFJLE1BQU0sQ0FBQyxJQUFJLFlBQVksQ0FBQyxTQUFTLEVBQUUsWUFBWSxDQUFDLEVBQUM7Q0FDckQsSUFBSTtDQUNKLElBQUc7Q0FDSCxFQUFFLGVBQWUsQ0FBQyxNQUFNLENBQUMsZ0JBQWdCLENBQUMsT0FBTyxFQUFFLFlBQVksRUFBQztDQUNoRSxFQUFFLElBQUksT0FBTyxHQUFHLFVBQVUsR0FBRTtDQUM1QixFQUFFLEdBQUcsT0FBTyxFQUFFO0NBQ2QsR0FBRyxPQUFPLENBQUMsT0FBTyxFQUFDO0NBQ25CLEdBQUcsZUFBZSxDQUFDLE1BQU0sQ0FBQyxtQkFBbUIsQ0FBQyxPQUFPLEVBQUUsWUFBWSxFQUFDO0NBQ3BFLEdBQUcsTUFBTTtDQUNULEdBQUcsZ0JBQWdCLEdBQUcsSUFBSSxnQkFBZ0IsQ0FBQyxDQUFDLFNBQVMsRUFBRSxRQUFRLEtBQUs7Q0FDcEUsSUFBSSxPQUFPLEdBQUcsVUFBVSxDQUFDLFNBQVMsRUFBQztDQUNuQyxJQUFJLEdBQUcsT0FBTyxFQUFFO0NBQ2hCLEtBQUssUUFBUSxDQUFDLFVBQVUsR0FBRTtDQUMxQixLQUFLLE9BQU8sQ0FBQyxPQUFPLEVBQUM7Q0FDckIsS0FBSyxlQUFlLENBQUMsTUFBTSxDQUFDLG1CQUFtQixDQUFDLE9BQU8sRUFBRSxZQUFZLEVBQUM7Q0FDdEUsS0FBSztDQUNMLElBQUksRUFBQztDQUNMLEdBQUcsZ0JBQWdCLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRSxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsU0FBUyxDQUFDLElBQUksRUFBRSxFQUFDO0NBQ3RFLEdBQUc7Q0FDSCxFQUFFLENBQUM7Q0FDSCxDQUFDO0FBQ0Q7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ08sU0FBUyxzQkFBc0IsQ0FBQyxXQUFXLEVBQUUsTUFBTSxFQUFFLFVBQVUsRUFBRSxlQUFlLEVBQUU7Q0FDekYsQ0FBQyxNQUFNLE9BQU8sR0FBRyxjQUFjLENBQUMsTUFBTSxFQUFFLFVBQVUsRUFBRSxlQUFlLEVBQUM7Q0FDcEUsQ0FBQyxXQUFXLENBQUMsS0FBSyxHQUFFO0NBQ3BCLENBQUMsT0FBTyxVQUFVLEVBQUUsSUFBSSxPQUFPO0NBQy9COztDQ3pEQTtBQUNBO0FBRUE7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLE1BQU0sV0FBVyxDQUFDO0NBQ2xCO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLFdBQVcsQ0FBQyxJQUFJLEVBQUUsVUFBVSxDQUFDLEVBQUUsRUFBRTtDQUNsQyxFQUFFLElBQUksQ0FBQyxJQUFJLEdBQUcsS0FBSTtDQUNsQixFQUFFLElBQUksQ0FBQyxVQUFVLEdBQUcsV0FBVTtDQUM5QixFQUFFO0FBQ0Y7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsY0FBYyxDQUFDLE1BQU0sRUFBRSxVQUFVLEVBQUUsZUFBZSxFQUFFO0NBQ3JELEVBQUUsT0FBTyxVQUFVLEVBQUUsSUFBSSxjQUFjLENBQUMsTUFBTSxFQUFFLFVBQVUsRUFBRSxlQUFlLENBQUM7Q0FDNUUsRUFBRTtBQUNGO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsc0JBQXNCLENBQUMsV0FBVyxFQUFFLE1BQU0sRUFBRSxVQUFVLEVBQUUsZUFBZSxFQUFFO0NBQzFFLEVBQUUsT0FBTyxzQkFBc0IsQ0FBQyxXQUFXLEVBQUUsTUFBTSxFQUFFLFVBQVUsRUFBRSxlQUFlLENBQUM7Q0FDakYsRUFBRTtBQUNGO0NBQ0E7O0NDMUNBO0FBQ0E7QUFFQTtDQUNBLE1BQU0sU0FBUyxTQUFTLFdBQVcsQ0FBQztBQUNwQztDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsQ0FBQyxNQUFNLHFCQUFxQixDQUFDLGVBQWUsRUFBRTtDQUM5QyxFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMseUNBQXlDLEVBQUUsSUFBSSxDQUFDLElBQUksRUFBQztDQUNyRSxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksVUFBVSxDQUFDLFdBQVcsRUFBRSxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsQ0FBQyxFQUFDO0NBQ3pFLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxVQUFVLENBQUMsV0FBVyxFQUFFLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxDQUFDLEVBQUM7Q0FDekUsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxXQUFXLEVBQUUsRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLENBQUMsRUFBQztDQUN6RSxFQUFFLE1BQU0sbUJBQW1CLEdBQUcsSUFBSSxlQUFlLEdBQUU7Q0FDbkQsRUFBRSxJQUFJLGVBQWM7Q0FFcEIsRUFBRSxNQUFNLFlBQVksR0FBRyxNQUFNO0NBQzdCLEdBQUcsbUJBQW1CLENBQUMsS0FBSyxHQUFFO0NBQzlCLEdBQUcsWUFBWSxDQUFDLGNBQWMsRUFBQztDQUkvQixJQUFHO0NBQ0gsRUFBRSxlQUFlLENBQUMsTUFBTSxDQUFDLGdCQUFnQixDQUFDLE9BQU8sRUFBRSxZQUFZLEVBQUM7Q0FDaEUsRUFBRSxNQUFNLFlBQVksR0FBRyxNQUFNLE9BQU8sQ0FBQyxJQUFJLENBQUM7Q0FDMUMsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsTUFBTSxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyw4Q0FBOEMsQ0FBQyxFQUFFLFVBQVUsRUFBRSxtQkFBbUIsQ0FBQztDQUNqSixHQUFHLElBQUksT0FBTyxDQUFDLENBQUMsT0FBTyxFQUFFLE1BQU0sS0FBSztDQUNwQyxJQUFJLGNBQWMsR0FBRyxVQUFVLENBQUMsTUFBTSxNQUFNLENBQUMsK0JBQStCLENBQUMsRUFBRSxHQUFHLEVBQUM7Q0FDbkYsSUFBSSxDQUFDO0NBQ0wsR0FBRyxFQUFDO0NBQ0osRUFBRSxtQkFBbUIsQ0FBQyxLQUFLLEdBQUU7Q0FDN0IsRUFBRSxZQUFZLENBQUMsY0FBYyxFQUFDO0NBQzlCLEVBQUUsT0FBTyxZQUFZO0NBQ3JCLEVBQUU7QUFDRjtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsQ0FBQyxNQUFNLG9CQUFvQixDQUFDLGVBQWUsRUFBRTtDQUM3QyxFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMsc0JBQXNCLEVBQUUsSUFBSSxDQUFDLElBQUksRUFBQztDQUNsRCxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksVUFBVSxDQUFDLFdBQVcsRUFBRSxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsQ0FBQyxFQUFDO0NBQ3pFLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxVQUFVLENBQUMsVUFBVSxFQUFFLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxDQUFDLEVBQUM7Q0FDeEUsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxZQUFZLEVBQUUsRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLENBQUMsRUFBQztDQUMxRSxFQUFFLE1BQU0sbUJBQW1CLEdBQUcsSUFBSSxlQUFlLEdBQUU7Q0FDbkQsRUFBRSxJQUFJLGVBQWM7Q0FDcEIsRUFBRSxJQUFJLGVBQWM7Q0FDcEIsRUFBRSxNQUFNLFlBQVksR0FBRyxNQUFNO0NBQzdCLEdBQUcsbUJBQW1CLENBQUMsS0FBSyxHQUFFO0NBQzlCLEdBQUcsWUFBWSxDQUFDLGNBQWMsRUFBQztDQUMvQixHQUFHLEdBQUcsY0FBYyxFQUFFO0NBQ3RCLElBQUksY0FBYyxHQUFFO0NBQ3BCLElBQUk7Q0FDSixJQUFHO0NBQ0gsRUFBRSxlQUFlLENBQUMsTUFBTSxDQUFDLGdCQUFnQixDQUFDLE9BQU8sRUFBRSxZQUFZLEVBQUM7Q0FDaEUsRUFBRSxNQUFNLE1BQU0sR0FBRyxNQUFNLE9BQU8sQ0FBQyxJQUFJLENBQUM7Q0FDcEMsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsTUFBTSxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxtQkFBbUIsQ0FBQyxLQUFLLElBQUksRUFBRSxtQkFBbUIsQ0FBQztDQUNuSCxHQUFHLElBQUksT0FBTyxDQUFDLENBQUMsT0FBTyxFQUFFLE1BQU0sS0FBSztDQUNwQyxJQUFJLGNBQWMsR0FBRyxRQUFPO0NBQzVCLElBQUksY0FBYyxHQUFHLFVBQVUsQ0FBQyxNQUFNLE1BQU0sQ0FBQyw4QkFBOEIsQ0FBQyxFQUFFLEdBQUcsRUFBQztDQUNsRixJQUFJLENBQUM7Q0FDTCxHQUFHLEVBQUM7Q0FDSixFQUFFLG1CQUFtQixDQUFDLEtBQUssR0FBRTtDQUM3QixFQUFFLFlBQVksQ0FBQyxjQUFjLEVBQUM7Q0FDOUIsRUFBRSxPQUFPLE1BQU07Q0FDZixFQUFFO0FBQ0Y7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLE1BQU0sZUFBZSxDQUFDLFlBQVksRUFBRSxlQUFlLEVBQUU7Q0FDdEQsRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLG9GQUFvRixFQUFFLFlBQVksRUFBQztDQUNuSCxFQUFFLE1BQU0sbUJBQW1CLEdBQUcsSUFBSSxlQUFlLEdBQUU7Q0FDbkQsRUFBRSxJQUFJLGVBQWM7Q0FFcEIsRUFBRSxNQUFNLFlBQVksR0FBRyxNQUFNO0NBQzdCLEdBQUcsbUJBQW1CLENBQUMsS0FBSyxHQUFFO0NBQzlCLEdBQUcsWUFBWSxDQUFDLGNBQWMsRUFBQztDQUkvQixJQUFHO0NBQ0gsRUFBRSxlQUFlLENBQUMsTUFBTSxDQUFDLGdCQUFnQixDQUFDLE9BQU8sRUFBRSxZQUFZLEVBQUM7Q0FDaEUsRUFBRSxNQUFNLFlBQVksR0FBRyxNQUFNLE9BQU8sQ0FBQyxJQUFJLENBQUM7Q0FDMUMsR0FBRyxJQUFJLENBQUMsc0JBQXNCO0NBQzlCLElBQUksWUFBWTtDQUNoQixJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUk7Q0FDaEMsSUFBSSxDQUFDLFNBQVMsS0FBSztDQUNuQixLQUFLLEdBQUcsU0FBUyxFQUFFO0NBQ25CLE1BQU0sTUFBTSxVQUFVLEdBQUcsRUFBRSxHQUFHLFNBQVMsQ0FBQyxHQUFHLENBQUMsUUFBUSxJQUFJLENBQUMsR0FBRyxRQUFRLENBQUMsVUFBVSxDQUFDLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLElBQUksSUFBSSxDQUFDLFFBQVEsS0FBSyxDQUFDLEVBQUM7Q0FDOUgsTUFBTSxPQUFPLENBQUMsS0FBSyxDQUFDLG9CQUFvQixFQUFFLFVBQVUsRUFBRSxVQUFVLENBQUMsSUFBSSxDQUFDLElBQUksSUFBSSxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksRUFBRSxDQUFDLGlCQUFpQixFQUFFLEtBQUssUUFBUSxDQUFDLEVBQUM7Q0FDeEksTUFBTSxJQUFJLE1BQU0sU0FBUyxJQUFJLFVBQVUsRUFBRTtDQUN6QyxPQUFPLE1BQU0sSUFBSSxHQUFHLENBQUMsR0FBRyxTQUFTLENBQUMsZ0JBQWdCLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxJQUFJLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxFQUFFLENBQUMsaUJBQWlCLEVBQUUsS0FBSyxRQUFRLElBQUksSUFBSSxDQUFDLFVBQVUsRUFBRSxRQUFRLEtBQUssQ0FBQyxFQUFDO0NBQ3pLLE9BQU8sT0FBTyxJQUFJO0NBQ2xCLE9BQU87Q0FDUCxNQUFNO0NBQ04sS0FBSztDQUNMLElBQUksbUJBQW1CO0NBQ3ZCLElBQUk7Q0FDSixHQUFHLElBQUksT0FBTyxDQUFDLENBQUMsT0FBTyxFQUFFLE1BQU0sS0FBSztDQUNwQyxJQUFJLGNBQWMsR0FBRyxVQUFVLENBQUMsTUFBTSxNQUFNLENBQUMseUJBQXlCLENBQUMsRUFBRSxHQUFHLEVBQUM7Q0FDN0UsSUFBSSxDQUFDO0NBQ0wsR0FBRyxFQUFDO0NBQ0osRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLHNDQUFzQyxFQUFFLFlBQVksRUFBQztDQUNyRSxFQUFFLG1CQUFtQixDQUFDLEtBQUssR0FBRTtDQUM3QixFQUFFLFlBQVksQ0FBQyxjQUFjLEVBQUM7Q0FDOUIsRUFBRSxPQUFPLFlBQVk7Q0FDckIsRUFBRTtBQUNGO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLE1BQU0sZ0JBQWdCLENBQUMsWUFBWSxFQUFFLGtCQUFrQixFQUFFLGVBQWUsRUFBRTtDQUMzRSxFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMsa0JBQWtCLEVBQUM7Q0FDbkMsRUFBRSxNQUFNLG1CQUFtQixHQUFHLElBQUksZUFBZSxHQUFFO0NBQ25ELEVBQUUsSUFBSSxlQUFjO0NBRXBCLEVBQUUsTUFBTSxZQUFZLEdBQUcsTUFBTTtDQUM3QixHQUFHLG1CQUFtQixDQUFDLEtBQUssR0FBRTtDQUM5QixHQUFHLFlBQVksQ0FBQyxjQUFjLEVBQUM7Q0FJL0IsSUFBRztDQUNILEVBQUUsZUFBZSxDQUFDLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxPQUFPLEVBQUUsWUFBWSxFQUFDO0NBQ2hFLEVBQUUsTUFBTSxNQUFNLEdBQUcsTUFBTSxPQUFPLENBQUMsSUFBSSxDQUFDO0NBQ3BDLEdBQUcsSUFBSSxDQUFDLHNCQUFzQjtDQUM5QixJQUFJLFlBQVk7Q0FDaEIsSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJO0NBQ2hDLElBQUksTUFBTSxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLGtCQUFrQixDQUFDLEtBQUssS0FBSztDQUM3RSxJQUFJLGVBQWU7Q0FDbkIsSUFBSTtDQUNKLEdBQUcsSUFBSSxPQUFPLENBQUMsQ0FBQyxPQUFPLEVBQUUsTUFBTSxLQUFLO0NBQ3BDLElBQUksY0FBYyxHQUFHLFVBQVUsQ0FBQyxNQUFNLE1BQU0sQ0FBQyx5QkFBeUIsQ0FBQyxFQUFFLEdBQUcsRUFBQztDQUM3RSxJQUFJLENBQUM7Q0FDTCxHQUFHLEVBQUM7Q0FDSixFQUFFLG1CQUFtQixDQUFDLEtBQUssR0FBRTtDQUM3QixFQUFFLFlBQVksQ0FBQyxjQUFjLEVBQUM7Q0FDOUIsRUFBRSxPQUFPLE1BQU0sS0FBSyxJQUFJO0NBQ3hCLEVBQUU7QUFDRjtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsc0JBQXNCLENBQUMsWUFBWSxFQUFFLGVBQWUsRUFBRTtDQUN2RCxFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMsNkVBQTZFLEVBQUM7Q0FDOUYsRUFBRSxPQUFPLElBQUksQ0FBQyxzQkFBc0I7Q0FDcEMsR0FBRyxZQUFZO0NBQ2YsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJO0NBQy9CLEdBQUcsTUFBTSxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxhQUFhLENBQUMsc0JBQXNCLENBQUM7Q0FDdEUsR0FBRyxlQUFlO0NBQ2xCLEdBQUc7Q0FDSCxFQUFFO0FBQ0Y7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLE1BQU0sYUFBYSxDQUFDLFlBQVksRUFBRSxlQUFlLEVBQUU7Q0FDcEQsRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLHFDQUFxQyxFQUFFLFlBQVksRUFBQztDQUNwRTtDQUNBLEVBQUUsTUFBTSxJQUFJLENBQUMsc0JBQXNCO0NBQ25DLEdBQUcsWUFBWTtDQUNmLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSTtDQUMvQixHQUFHLE1BQU0sSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsYUFBYSxDQUFDLHNCQUFzQixDQUFDLEtBQUssSUFBSTtDQUMvRSxHQUFHLGVBQWU7Q0FDbEIsSUFBRztDQUNILEVBQUU7QUFDRjtDQUNBOztDQ3ZMQTtBQUNBO0FBR0E7Q0FDQSxNQUFNLHVCQUF1QixTQUFTLEtBQUssQ0FBQyxFQUFFO0FBQzlDO0NBQ0EsTUFBTSxXQUFXLENBQUM7QUFDbEI7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLFdBQVcsQ0FBQyxTQUFTLEVBQUU7Q0FDeEIsRUFBRSxJQUFJLENBQUMsVUFBVSxHQUFHLFVBQVM7Q0FDN0IsRUFBRTtBQUNGO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLE1BQU0sTUFBTSxDQUFDLGVBQWUsRUFBRTtDQUMvQixFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMsb0JBQW9CLEVBQUM7Q0FDckMsRUFBRSxJQUFJLGFBQVk7Q0FDbEIsRUFBRSxJQUFJLGFBQVk7Q0FDbEIsRUFBRSxJQUFJO0NBQ04sR0FBRyxZQUFZLEdBQUcsTUFBTSxJQUFJLENBQUMsU0FBUyxDQUFDLHFCQUFxQixDQUFDLGVBQWUsRUFBQztDQUM3RSxHQUFHLFlBQVksR0FBRyxNQUFNLElBQUksQ0FBQyxTQUFTLENBQUMsZUFBZSxDQUFDLFlBQVksRUFBRSxlQUFlLEVBQUM7Q0FDckYsR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDLGNBQWMsRUFBRSxZQUFZLEVBQUM7Q0FDOUMsR0FBRyxNQUFNLFlBQVksR0FBRyxNQUFNLElBQUksQ0FBQyxTQUFTLENBQUMsc0JBQXNCLENBQUMsWUFBWSxFQUFFLGVBQWUsRUFBQztDQUNsRyxHQUFHLE1BQU0sSUFBSSxDQUFDLFNBQVMsQ0FBQyxhQUFhLENBQUMsWUFBWSxFQUFFLGVBQWUsRUFBQztDQUNwRSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxrQkFBa0IsRUFBRSxFQUFFLEVBQUM7Q0FDM0QsR0FBRyxPQUFPLElBQUk7Q0FDZCxHQUFHLENBQUMsTUFBTSxFQUFFLEVBQUU7Q0FDZCxHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUMsRUFBRSxFQUFDO0NBQ3BCLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLGtCQUFrQixFQUFFLEVBQUUsRUFBQztDQUMzRCxHQUFHLE1BQU0sSUFBSSx1QkFBdUIsQ0FBQyw2Q0FBNkMsRUFBRSxFQUFFLENBQUM7Q0FDdkYsR0FBRztDQUNILEVBQUU7QUFDRjtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsSUFBSSxTQUFTLEdBQUc7Q0FDakIsRUFBRSxPQUFPLElBQUksQ0FBQyxVQUFVO0NBQ3hCLEVBQUU7QUFDRjtDQUNBOztDQ3pDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLE1BQU0sRUFBRSxTQUFTLFdBQVcsQ0FBQztBQUM3QjtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLE9BQU8sTUFBTSxHQUFHO0NBQ2pCLEVBQUU7QUFDRjtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsQ0FBQyxNQUFNLG1DQUFtQyxDQUFDLGVBQWUsRUFBRTtDQUM1RCxFQUFFO0FBQ0Y7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsQ0FBQyxNQUFNLGtCQUFrQixHQUFHO0NBQzVCLEVBQUU7QUFDRjtDQUNBOztDQ3JDQTtBQUNBO0FBRUE7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDTyxTQUFTLHNCQUFzQixDQUFDLElBQUksRUFBRSxlQUFlLEVBQUU7Q0FDOUQsQ0FBQyxNQUFNLFFBQVEsR0FBRyxDQUFDLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLHVDQUF1QyxDQUFDLEVBQUM7Q0FDckYsQ0FBQyxRQUFRLENBQUMsT0FBTyxHQUFFO0NBQ25CLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyx3QkFBd0IsRUFBRSxRQUFRLENBQUMsTUFBTSxFQUFFLFVBQVUsRUFBQztDQUNyRSxDQUFDLElBQUksTUFBTSxPQUFPLElBQUksUUFBUSxFQUFFO0NBQ2hDLEVBQUUsR0FBRyxlQUFlLENBQUMsTUFBTSxDQUFDLE9BQU8sRUFBRTtDQUNyQyxHQUFHLEtBQUs7Q0FDUixHQUFHO0NBQ0gsRUFBRSxNQUFNLGVBQWUsR0FBRyxPQUFPLENBQUMsZUFBZSxDQUFDO0NBQ2xELEdBQUcsa0JBQWtCLEVBQUUsSUFBSTtDQUMzQixHQUFHLHFCQUFxQixFQUFFLElBQUk7Q0FDOUIsR0FBRyxlQUFlLEVBQUUsSUFBSTtDQUN4QixHQUFHLEVBQUM7Q0FDSixFQUFFLEdBQUcsZUFBZSxLQUFLLEtBQUssRUFBRTtDQUNoQyxHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUMsaUJBQWlCLEVBQUUsZUFBZSxFQUFDO0NBQ3BELEdBQUcsUUFBUTtDQUNYLEdBQUc7Q0FDSCxFQUFFLE1BQU0sUUFBUSxHQUFHLE9BQU8sQ0FBQyxxQkFBcUIsRUFBRSxDQUFDLENBQUMsR0FBRyxJQUFHO0NBQzFELEVBQUUsR0FBRyxRQUFRLEtBQUssS0FBSyxFQUFFO0NBQ3pCLEdBQUcsT0FBTyxDQUFDLEtBQUssQ0FBQyxVQUFVLEVBQUUsUUFBUSxFQUFDO0NBQ3RDLEdBQUcsUUFBUTtDQUNYLEdBQUc7Q0FDSCxFQUFFLE9BQU8sQ0FBQyxZQUFZLENBQUMsa0JBQWtCLEVBQUUsRUFBRSxFQUFDO0NBQzlDLEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyxzQ0FBc0MsRUFBRSxPQUFPLEVBQUM7Q0FDaEUsRUFBRSxPQUFPLE9BQU87Q0FDaEIsRUFBRTtDQUNGLENBQUM7QUFDRDtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDTyxTQUFTLG1CQUFtQixDQUFDLE1BQU0sRUFBRTtDQUM1QyxDQUFDLE9BQU8sTUFBTSxDQUFDLFFBQVEsQ0FBQyxhQUFhLENBQUMsd0NBQXdDLENBQUM7Q0FDL0UsQ0FBQztBQUNEO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ08sZUFBZSxnQkFBZ0IsQ0FBQyxJQUFJLEVBQUUsZUFBZSxFQUFFO0NBQzlELENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyx5Q0FBeUMsRUFBQztDQUN6RCxDQUFDLElBQUksa0JBQWlCO0NBQ3RCLENBQUMsSUFBSSxlQUFjO0NBQ25CLENBQUMsSUFBSSxlQUFjO0NBQ25CLENBQUMsTUFBTSxxQkFBcUIsR0FBRyxJQUFJLGVBQWUsR0FBRTtDQUNwRCxDQUFDLE1BQU0sWUFBWSxHQUFHLE1BQU07Q0FDNUIsRUFBRSxxQkFBcUIsQ0FBQyxLQUFLLEdBQUU7Q0FDL0IsRUFBRSxZQUFZLENBQUMsaUJBQWlCLEVBQUM7Q0FDakMsRUFBRSxHQUFHLGNBQWMsRUFBRTtDQUNyQixHQUFHLGNBQWMsR0FBRTtDQUNuQixHQUFHO0NBQ0gsR0FBRTtDQUNGLENBQUMsZUFBZSxDQUFDLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxPQUFPLEVBQUUsWUFBWSxFQUFDO0NBQy9ELENBQUMsSUFBSSxDQUFDLFNBQVMsR0FBRyxFQUFDO0NBQ25CLENBQUMsSUFBSTtDQUNMLEVBQUUsY0FBYyxHQUFHLE1BQU0sT0FBTyxDQUFDLElBQUksQ0FBQztDQUN0QyxHQUFHLGNBQWMsQ0FBQyxJQUFJLEVBQUUsTUFBTTtDQUM5QixJQUFJLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDLGtCQUFrQixDQUFDLENBQUMsS0FBSyxJQUFJLEVBQUU7Q0FDMUQsS0FBSyxJQUFJLENBQUMsU0FBUyxHQUFHLEVBQUM7Q0FDdkIsS0FBSztDQUNMLElBQUksT0FBTyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsa0JBQWtCLENBQUMsQ0FBQztDQUNuRCxJQUFJLEVBQUUscUJBQXFCLENBQUM7Q0FDNUIsR0FBRyxJQUFJLE9BQU8sQ0FBQyxPQUFPLElBQUk7Q0FDMUIsSUFBSSxjQUFjLEdBQUcsUUFBTztDQUM1QixJQUFJLGlCQUFpQixHQUFHLFVBQVUsQ0FBQyxNQUFNO0NBQ3pDLEtBQUssT0FBTyxHQUFFO0NBQ2QsS0FBSyxFQUFFLEtBQUssRUFBQztDQUNiLElBQUksQ0FBQztDQUNMLEdBQUcsRUFBQztDQUNKLEVBQUUsQ0FBQyxNQUFNLEVBQUUsRUFBRTtDQUNiLEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyxFQUFFLEVBQUM7Q0FDbkIsRUFBRTtDQUNGLENBQUMscUJBQXFCLENBQUMsS0FBSyxHQUFFO0NBQzlCLENBQUMsZUFBZSxDQUFDLE1BQU0sQ0FBQyxtQkFBbUIsQ0FBQyxPQUFPLEVBQUUsWUFBWSxFQUFDO0NBQ2xFLENBQUMsWUFBWSxDQUFDLGlCQUFpQixFQUFDO0NBQ2hDLENBQUMsR0FBRyxjQUFjLElBQUksY0FBYyxLQUFLLElBQUksRUFBRTtDQUMvQyxFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMsOERBQThELEVBQUM7Q0FDL0UsRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLDZCQUE2QixFQUFFLElBQUksQ0FBQyxTQUFTLEVBQUM7Q0FDOUQsRUFBRSxNQUFNLGNBQWMsQ0FBQyxJQUFJLEVBQUUsTUFBTSxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxLQUFLLElBQUksRUFBRSxlQUFlLEVBQUM7Q0FDdEcsRUFBRTtDQUNGLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyx3RUFBd0UsRUFBQztDQUN4RixDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQywrQkFBK0IsRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsU0FBUyxLQUFLLENBQUMsR0FBRyxtQkFBbUIsR0FBRyx1RUFBdUUsQ0FBQyxDQUFDLElBQUc7Q0FDL0wsQ0FBQyxPQUFPLElBQUksQ0FBQyxTQUFTLEtBQUssQ0FBQztDQUM1Qjs7Q0NqR0E7QUFDQTtBQUdBO0NBQ0EsTUFBTSxpQkFBaUIsU0FBUyxXQUFXLENBQUM7QUFDNUM7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsbUNBQW1DLENBQUMsZUFBZSxFQUFFO0NBQ3RELEVBQUUsT0FBTyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLGVBQWUsQ0FBQztDQUNyRCxFQUFFO0FBQ0Y7Q0FDQTs7Q0NmQTtBQUNBO0FBTUE7Q0FDQSxNQUFNLFNBQVMsU0FBUyxFQUFFLENBQUM7QUFDM0I7Q0FDQSxDQUFDLFdBQVcsQ0FBQyxJQUFJLEVBQUUsVUFBVSxDQUFDLEVBQUUsRUFBRTtDQUNsQyxFQUFFLEtBQUssQ0FBQyxJQUFJLEVBQUUsVUFBVSxFQUFDO0NBQ3pCLEVBQUUsSUFBSSxDQUFDLGFBQWEsR0FBRyxLQUFJO0NBQzNCLEVBQUU7QUFDRjtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsQ0FBQyxPQUFPLE1BQU0sQ0FBQyxNQUFNLEVBQUU7Q0FDdkIsRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLFdBQVcsRUFBQztDQUM1QixFQUFFLE1BQU0sc0JBQXNCLEdBQUcsbUJBQW1CLENBQUMsTUFBTSxFQUFDO0NBQzVELEVBQUUsR0FBRyxzQkFBc0IsS0FBSyxJQUFJLEVBQUU7Q0FDdEMsR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDLDhCQUE4QixFQUFFLHNCQUFzQixFQUFDO0NBQ3hFLEdBQUcsTUFBTSxpQkFBaUIsR0FBRyxJQUFJLGlCQUFpQixDQUFDLHNCQUFzQixFQUFDO0NBQzFFLEdBQUcsT0FBTyxJQUFJLFNBQVMsQ0FBQyxNQUFNLEVBQUUsRUFBRSxpQkFBaUIsRUFBRSxDQUFDO0NBQ3RELEdBQUcsTUFBTTtDQUNULEdBQUcsTUFBTSxJQUFJLEtBQUssQ0FBQyx1Q0FBdUMsQ0FBQztDQUMzRCxHQUFHO0NBQ0gsRUFBRTtBQUNGO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLE1BQU0sbUNBQW1DLENBQUMsZUFBZSxFQUFFO0NBQzVELEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyx3Q0FBd0MsRUFBQztDQUN6RCxFQUFFLE9BQU8sTUFBTSxJQUFJLENBQUMsVUFBVSxDQUFDLGlCQUFpQixDQUFDLG1DQUFtQyxDQUFDLGVBQWUsQ0FBQztDQUNyRyxFQUFFO0FBQ0Y7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsTUFBTSxrQkFBa0IsQ0FBQyxlQUFlLEVBQUU7Q0FDM0MsRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLHVCQUF1QixFQUFFLElBQUksQ0FBQyxhQUFhLEVBQUM7Q0FDNUQsRUFBRSxNQUFNLHFCQUFxQixHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsaUJBQWlCLENBQUMsS0FBSTtDQUN0RSxFQUFFLE1BQU0sY0FBYyxHQUFHLElBQUksQ0FBQyxhQUFhLElBQUkscUJBQXFCLENBQUMsWUFBWSxHQUFHLHFCQUFxQixDQUFDLGFBQVk7Q0FDdEgsRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLGdCQUFnQixFQUFFLGNBQWMsRUFBQztDQUNqRCxFQUFFLElBQUksSUFBSSxDQUFDLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsY0FBYyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsR0FBRztDQUM3RCxHQUFHLEdBQUcsZUFBZSxDQUFDLE1BQU0sQ0FBQyxPQUFPLEVBQUU7Q0FDdEMsSUFBSSxLQUFLO0NBQ1QsSUFBSTtDQUNKLEdBQUcsSUFBSSxDQUFDLGFBQWEsR0FBRyxFQUFDO0NBQ3pCLEdBQUcscUJBQXFCLENBQUMsU0FBUyxHQUFHLEVBQUM7Q0FDdEMsR0FBRyxxQkFBcUIsQ0FBQyxhQUFhLENBQUMsSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsRUFBQztDQUNyRSxHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUMsUUFBUSxFQUFDO0NBQzFCLEdBQUcsTUFBTSxJQUFJLE9BQU8sQ0FBQyxPQUFPLElBQUksVUFBVSxDQUFDLE9BQU8sRUFBRSxFQUFFLENBQUMsRUFBQztDQUN4RCxHQUFHLElBQUk7Q0FDUCxJQUFJLE1BQU0sY0FBYyxHQUFHLHNCQUFzQixDQUFDLHFCQUFxQixFQUFFLGVBQWUsRUFBQztDQUN6RixJQUFJLEdBQUcsY0FBYyxFQUFFO0NBQ3ZCLEtBQUssTUFBTSxTQUFTLEdBQUcsSUFBSSxTQUFTLENBQUMsY0FBYyxFQUFDO0NBQ3BELEtBQUssT0FBTyxJQUFJLFdBQVcsQ0FBQyxTQUFTLENBQUM7Q0FDdEMsS0FBSztDQUNMLElBQUksQ0FBQyxNQUFNLEVBQUUsRUFBRTtDQUNmLElBQUksT0FBTyxDQUFDLEtBQUssQ0FBQyxFQUFFLEVBQUM7Q0FDckIsSUFBSTtDQUNKLEdBQUc7Q0FDSDtDQUNBLEVBQUUsT0FBTyxLQUFLO0NBQ2QsRUFBRTtBQUNGO0NBQ0E7O0NDeEVBO0NBQ0E7Q0FDQTtDQUNBO0FBQ0E7QUFJQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ2UsU0FBUyxLQUFLLEdBQUc7Q0FDaEMsQ0FBQyxPQUFPLFNBQVM7Q0FDakI7O0NDZkE7QUFDQTtBQU9BO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsTUFBTSxJQUFJLENBQUM7QUFDWDtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsQ0FBQyxXQUFXLENBQUMsRUFBRSxFQUFFO0NBQ2pCLEVBQUUsSUFBSSxDQUFDLEdBQUcsR0FBRyxHQUFFO0NBQ2YsRUFBRTtBQUNGO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsT0FBTyxNQUFNLENBQUMsTUFBTSxFQUFFO0NBQ3ZCLEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyxhQUFhLEVBQUM7Q0FDOUIsRUFBRSxNQUFNLEVBQUUsR0FBRyxLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFDO0NBQ25DLEVBQUUsT0FBTyxJQUFJLElBQUksQ0FBQyxFQUFFLENBQUM7Q0FDckIsRUFBRTtBQUNGO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLG1DQUFtQyxDQUFDLGVBQWUsRUFBRTtDQUN0RCxFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMsMENBQTBDLEVBQUM7Q0FDM0QsRUFBRSxPQUFPLElBQUksQ0FBQyxFQUFFLENBQUMsbUNBQW1DLENBQUMsZUFBZSxDQUFDO0NBQ3JFLEVBQUU7QUFDRjtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsQ0FBQyxrQkFBa0IsQ0FBQyxlQUFlLEVBQUU7Q0FDckMsRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLHlCQUF5QixFQUFDO0NBQzFDLEVBQUUsT0FBTyxJQUFJLENBQUMsRUFBRSxDQUFDLGtCQUFrQixDQUFDLGVBQWUsQ0FBQztDQUNwRCxFQUFFO0FBQ0Y7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsSUFBSSxFQUFFLEdBQUc7Q0FDVixFQUFFLE9BQU8sSUFBSSxDQUFDLEdBQUc7Q0FDakIsRUFBRTtBQUNGO0NBQ0E7O0NDM0RBO0FBQ0E7QUFJQTtDQUNBLE1BQU0sSUFBSSxDQUFDO0FBQ1g7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsQ0FBQyxXQUFXLENBQUMsTUFBTSxFQUFFLFlBQVksRUFBRTtDQUNuQyxFQUFFLElBQUksQ0FBQyxNQUFNLEdBQUcsT0FBTTtDQUN0QixFQUFFLElBQUksQ0FBQyxJQUFJLEdBQUcsS0FBSTtDQUNsQixFQUFFLElBQUksQ0FBQyxZQUFZLEdBQUcsYUFBWTtDQUNsQyxFQUFFO0FBQ0Y7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsa0JBQWtCLENBQUMsZUFBZSxFQUFFO0NBQ3JDLEVBQUUsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLGtCQUFrQixDQUFDLGVBQWUsQ0FBQztDQUN0RCxFQUFFO0FBQ0Y7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsYUFBYSxDQUFDLElBQUksRUFBRTtDQUNyQixFQUFFLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxFQUFDO0NBQ3pCLEVBQUU7QUFDRjtBQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsbUNBQW1DLENBQUMsZUFBZSxFQUFFO0NBQ3RELEVBQUUsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLG1DQUFtQyxDQUFDLGVBQWUsQ0FBQztDQUN2RSxFQUFFO0FBQ0Y7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLFFBQVEsR0FBRztDQUNaLEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyxVQUFVLEVBQUM7Q0FDM0IsRUFBRSxJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBQztDQUN0QyxFQUFFO0FBQ0Y7QUFDQTtDQUNBOztDQ3REQTtBQUNBO0FBR0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLE1BQU0sY0FBYyxDQUFDO0FBQ3JCO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLFdBQVcsQ0FBQyxJQUFJLEVBQUU7Q0FDbkIsRUFBRSxJQUFJLENBQUMsS0FBSyxHQUFHLEtBQUk7Q0FDbkIsRUFBRTtBQUNGO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsU0FBUyxHQUFHO0NBQ2IsRUFBRTtBQUNGO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLElBQUksR0FBRztDQUNSLEVBQUU7QUFDRjtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsQ0FBQyxLQUFLLEdBQUc7Q0FDVCxFQUFFO0FBQ0Y7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsTUFBTSxHQUFHLEdBQUc7Q0FDYixFQUFFO0FBQ0Y7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsSUFBSSxJQUFJLEdBQUc7Q0FDWixFQUFFLE9BQU8sSUFBSSxDQUFDLEtBQUs7Q0FDbkIsRUFBRTtBQUNGO0NBQ0E7O0NDeERBO0FBQ0E7QUFJQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLE1BQU0sZUFBZSxTQUFTLGNBQWMsQ0FBQztBQUM3QztDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsV0FBVyxDQUFDLElBQUksRUFBRTtDQUNuQixFQUFFLEtBQUssQ0FBQyxJQUFJLEVBQUM7Q0FDYixFQUFFLElBQUksQ0FBQyxlQUFlLEdBQUcsTUFBSztDQUM5QixFQUFFLElBQUksQ0FBQyxZQUFZLEdBQUcsRUFBQztDQUN2QixFQUFFLElBQUksQ0FBQyxpQkFBaUIsR0FBRyxFQUFDO0NBQzVCLEVBQUUsSUFBSSxDQUFDLFFBQVEsR0FBRyxNQUFLO0NBQ3ZCLEVBQUUsSUFBSSxDQUFDLGdCQUFnQixHQUFHLEtBQUk7Q0FDOUIsRUFBRSxJQUFJLENBQUMsZUFBZSxHQUFHLEtBQUk7Q0FDN0IsRUFBRTtBQUNGO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLFNBQVMsR0FBRztDQUNiLEVBQUUsT0FBTyxJQUFJLENBQUMsUUFBUSxJQUFJLElBQUksQ0FBQyxnQkFBZ0IsSUFBSSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsTUFBTSxDQUFDLE9BQU8sS0FBSyxLQUFLO0NBQ2pHLEVBQUU7QUFDRjtDQUNBLENBQUMsSUFBSSxHQUFHO0NBQ1IsRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLHNCQUFzQixFQUFDO0NBQ3ZDLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsYUFBYSxFQUFDO0NBQ3hDLEVBQUUsSUFBSSxDQUFDLGdCQUFnQixDQUFDLEtBQUssR0FBRTtDQUMvQixFQUFFO0FBQ0Y7Q0FDQSxDQUFDLEtBQUssR0FBRztDQUNULEVBQUUsSUFBSSxDQUFDLGVBQWUsR0FBRyxNQUFLO0NBQzlCLEVBQUUsSUFBSSxDQUFDLFlBQVksR0FBRyxFQUFDO0NBQ3ZCLEVBQUUsSUFBSSxDQUFDLGVBQWUsR0FBRyxLQUFJO0NBQzdCLEVBQUUsSUFBSSxDQUFDLGlCQUFpQixHQUFHLEVBQUM7Q0FDNUIsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxPQUFPLEVBQUM7Q0FDbEMsRUFBRTtBQUNGO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLE1BQU0sR0FBRyxHQUFHO0NBQ2IsRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLHVCQUF1QixFQUFDO0NBQ3hDLEVBQUUsSUFBSSxDQUFDLFlBQVksR0FBRyxFQUFDO0NBQ3ZCLEVBQUUsSUFBSSxDQUFDLGlCQUFpQixHQUFHLEVBQUM7Q0FDNUIsRUFBRSxJQUFJLENBQUMsUUFBUSxHQUFHLEtBQUk7Q0FDdEIsRUFBRSxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsSUFBSSxlQUFlLEdBQUU7Q0FDL0MsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsR0FBRTtDQUN0QixFQUFFLElBQUk7Q0FDTixHQUFHLEdBQUcsSUFBSSxDQUFDLGVBQWUsRUFBRTtDQUM1QixJQUFJLE1BQU0sSUFBSSxDQUFDLGtCQUFrQixHQUFFO0NBQ25DLElBQUksTUFBTTtDQUNWLElBQUksTUFBTSxJQUFJLENBQUMsYUFBYSxHQUFFO0NBQzlCLElBQUk7Q0FDSixHQUFHLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLE1BQU0sQ0FBQyxPQUFPLEVBQUU7Q0FDNUMsSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsWUFBWSxDQUFDLG1CQUFtQixDQUFDLEVBQUM7Q0FDL0UsSUFBSSxPQUFPLENBQUMsS0FBSyxDQUFDLHlCQUF5QixFQUFDO0NBQzVDLElBQUksTUFBTTtDQUNWLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLFlBQVksQ0FBQyxtQkFBbUIsQ0FBQyxFQUFDO0NBQzVFLElBQUksT0FBTyxDQUFDLEtBQUssQ0FBQyxzQkFBc0IsRUFBQztDQUN6QyxJQUFJO0NBQ0osR0FBRyxDQUFDLE1BQU0sRUFBRSxFQUFFO0NBQ2QsR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDLEVBQUUsRUFBQztDQUNwQixHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxZQUFZLENBQUMsbUJBQW1CLENBQUMsRUFBQztDQUM5RSxHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUMseUJBQXlCLEVBQUM7Q0FDM0MsR0FBRztDQUNILEVBQUUsSUFBSSxDQUFDLFFBQVEsR0FBRyxNQUFLO0NBQ3ZCLEVBQUU7QUFDRjtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsTUFBTSxhQUFhLEdBQUc7Q0FDdkIsRUFBRSxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxNQUFNLENBQUMsT0FBTyxFQUFFO0NBQzNDLEdBQUcsTUFBTTtDQUNULEdBQUc7Q0FDSCxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLHNCQUFzQixFQUFDO0NBQ2pELEVBQUUsSUFBSTtDQUNOLEdBQUcsTUFBTSxJQUFJLEdBQUcsTUFBTSxJQUFJLENBQUMsSUFBSSxDQUFDLG1DQUFtQyxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsRUFBQztDQUMxRixHQUFHLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLE1BQU0sQ0FBQyxPQUFPLEtBQUssS0FBSyxFQUFFO0NBQ3RELElBQUksR0FBRyxJQUFJLEVBQUU7Q0FDYixLQUFLLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsa0JBQWtCLEVBQUUsSUFBSSxDQUFDLGlCQUFpQixDQUFDLGFBQWEsQ0FBQyxFQUFDO0NBQ3hGLEtBQUssSUFBSSxDQUFDLGVBQWUsR0FBRyxLQUFJO0NBQ2hDLEtBQUssTUFBTSxJQUFJLENBQUMsa0JBQWtCLEdBQUU7Q0FDcEMsS0FBSyxNQUFNO0NBQ1gsS0FBSyxJQUFJLENBQUMsaUJBQWlCLEdBQUU7Q0FDN0IsS0FBSyxNQUFNLElBQUksQ0FBQyxhQUFhLEdBQUU7Q0FDL0IsS0FBSztDQUNMLElBQUk7Q0FDSixHQUFHLENBQUMsTUFBTSxFQUFFLEVBQUU7Q0FDZCxHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUMsRUFBRSxFQUFDO0NBQ3BCLEdBQUc7Q0FDSCxFQUFFO0FBQ0Y7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLE1BQU0sa0JBQWtCLEdBQUc7Q0FDNUIsRUFBRSxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxNQUFNLENBQUMsT0FBTyxFQUFFO0NBQzNDLEdBQUcsTUFBTTtDQUNULEdBQUc7Q0FDSCxFQUFFLElBQUksU0FBUyxHQUFHLEtBQUk7Q0FDdEIsRUFBRSxJQUFJO0NBQ04sR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyw0QkFBNEIsRUFBQztDQUN4RCxHQUFHLE1BQU0sV0FBVyxHQUFHLE1BQU0sSUFBSSxDQUFDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLEVBQUM7Q0FDaEYsR0FBRyxTQUFTLEdBQUcsV0FBVyxLQUFLLE1BQUs7Q0FDcEMsR0FBRyxHQUFHLFdBQVcsRUFBRTtDQUNuQixJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLHNCQUFzQixFQUFDO0NBQ25ELElBQUksSUFBSSxJQUFJLENBQUMsZUFBZSxLQUFLLElBQUksRUFBRTtDQUN2QyxLQUFLLE1BQU0sa0JBQWtCLEdBQUcsSUFBSSxJQUFJLEVBQUUsQ0FBQyxPQUFPLEVBQUUsR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLE9BQU8sR0FBRTtDQUNyRixLQUFLLEdBQUcsa0JBQWtCLEdBQUcsSUFBSSxFQUFFO0NBQ25DLE1BQU0sSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxRQUFRLEVBQUUsa0JBQWtCLENBQUMsbUNBQW1DLENBQUMsRUFBQztDQUNqRyxNQUFNLE1BQU0sSUFBSSxPQUFPLENBQUMsT0FBTyxJQUFJLFVBQVUsQ0FBQyxPQUFPLEVBQUUsa0JBQWtCLENBQUMsRUFBQztDQUMzRSxNQUFNO0NBQ04sS0FBSztDQUNMLElBQUksTUFBTSxNQUFNLEdBQUcsTUFBTSxXQUFXLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsRUFBQztDQUNsRSxJQUFJLEdBQUcsTUFBTSxFQUFFO0NBQ2YsS0FBSyxJQUFJLENBQUMsZUFBZSxHQUFHLElBQUksSUFBSSxHQUFFO0NBQ3RDLEtBQUssSUFBSSxDQUFDLFlBQVksR0FBRTtDQUN4QixLQUFLO0NBQ0wsSUFBSTtDQUNKLEdBQUcsQ0FBQyxNQUFNLEVBQUUsRUFBRTtDQUNkLEdBQUcsT0FBTyxDQUFDLEtBQUssQ0FBQyxFQUFFLEVBQUM7Q0FDcEIsR0FBRyxTQUFTO0NBQ1osR0FBRyxHQUFHLFNBQVMsRUFBRTtDQUNqQixJQUFJLE1BQU0sSUFBSSxDQUFDLGtCQUFrQixHQUFFO0NBQ25DLElBQUk7Q0FDSixHQUFHO0NBQ0gsRUFBRTtBQUNGO0NBQ0E7O0NDM0lBO0FBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ08sU0FBUywwQkFBMEIsQ0FBQyxRQUFRLEVBQUU7Q0FDckQsQ0FBQyxNQUFNLG9CQUFvQixHQUFHLFFBQVEsQ0FBQyxhQUFhLENBQUMsS0FBSyxFQUFDO0NBQzNELENBQUMsb0JBQW9CLENBQUMsRUFBRSxHQUFHLGNBQWE7Q0FDeEMsQ0FBQyxvQkFBb0IsQ0FBQyxLQUFLLENBQUMsUUFBUSxHQUFHLFFBQU87Q0FDOUMsQ0FBQyxvQkFBb0IsQ0FBQyxLQUFLLENBQUMsR0FBRyxHQUFHLE9BQU07Q0FDeEMsQ0FBQyxvQkFBb0IsQ0FBQyxLQUFLLENBQUMsS0FBSyxHQUFHLE9BQU07Q0FDMUMsQ0FBQyxvQkFBb0IsQ0FBQyxLQUFLLENBQUMsT0FBTyxHQUFHLE9BQU07Q0FDNUMsQ0FBQyxPQUFPLG9CQUFvQjtDQUM1Qjs7Q0NmQTtBQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDTyxTQUFTLG9CQUFvQixDQUFDLFFBQVEsRUFBRTtDQUMvQyxDQUFDLE1BQU0sY0FBYyxHQUFHLFFBQVEsQ0FBQyxhQUFhLENBQUMsS0FBSyxFQUFDO0NBQ3JELENBQUMsY0FBYyxDQUFDLEVBQUUsR0FBRyxlQUFjO0NBQ25DLENBQUMsY0FBYyxDQUFDLFFBQVEsR0FBRyxFQUFDO0NBQzVCLENBQUMsY0FBYyxDQUFDLEtBQUssQ0FBQyxHQUFHLEdBQUcsSUFBRztDQUMvQixDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsS0FBSyxHQUFHLElBQUc7Q0FDakMsQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLFFBQVEsR0FBRyxRQUFPO0NBQ3hDLENBQUMsY0FBYyxDQUFDLEtBQUssQ0FBQyxLQUFLLEdBQUcsUUFBTztDQUNyQyxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLFFBQU87Q0FDdEMsQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxNQUFLO0NBQ3BDLENBQUMsY0FBYyxDQUFDLEtBQUssQ0FBQyxlQUFlLEdBQUcsWUFBVztDQUNuRCxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsT0FBTyxHQUFHLE9BQU07Q0FDdEMsQ0FBQyxPQUFPLGNBQWM7Q0FDdEI7O0NDbkJBO0NBQ0E7Q0FDQTtBQUNBO0FBVUE7Q0FDQSxNQUFNLEdBQUcsQ0FBQztDQUNWO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsV0FBVyxDQUFDLFFBQVEsRUFBRSxJQUFJLEVBQUUsY0FBYyxFQUFFLFdBQVcsRUFBRSwwQkFBMEIsRUFBRSxhQUFhLEVBQUU7Q0FDckcsRUFBRSxJQUFJLENBQUMsU0FBUyxHQUFHLFNBQVE7Q0FDM0IsRUFBRSxJQUFJLENBQUMsS0FBSyxHQUFHLEtBQUk7Q0FDbkIsRUFBRSxJQUFJLENBQUMsZUFBZSxHQUFHLGVBQWM7Q0FDdkMsRUFBRSxJQUFJLENBQUMsWUFBWSxHQUFHLFlBQVc7Q0FDakMsRUFBRSxJQUFJLENBQUMsY0FBYyxHQUFHLGNBQWE7Q0FDckMsRUFBRSxJQUFJLENBQUMsMkJBQTJCLEdBQUcsMkJBQTBCO0NBQy9ELEVBQUUsSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFDO0NBQ2xFLEVBQUUsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLGVBQWUsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFDO0NBQ2xELEVBQUU7QUFDRjtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLE9BQU8sTUFBTSxDQUFDLE1BQU0sRUFBRTtDQUN2QixFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMsUUFBUSxFQUFDO0NBQ3pCLEVBQUUsTUFBTSxFQUFFLEdBQUcsR0FBRyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsUUFBUSxFQUFDO0NBQ3hDLEVBQUUsTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUM7Q0FDM0MsRUFBRSxPQUFPLEVBQUU7Q0FDWCxFQUFFO0FBQ0Y7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsQ0FBQyxPQUFPLE1BQU0sQ0FBQyxRQUFRLEVBQUU7Q0FDekIsRUFBRSxNQUFNLElBQUksR0FBRyxRQUFRLENBQUMsYUFBYSxDQUFDLEtBQUssRUFBQztDQUM1QyxFQUFFLElBQUksQ0FBQyxFQUFFLEdBQUcsWUFBVztDQUN2QixFQUFFLE1BQU0sV0FBVyxHQUFHLGlCQUFpQixDQUFDLFFBQVEsRUFBQztDQUNqRCxFQUFFLE1BQU0sY0FBYyxHQUFHLG9CQUFvQixDQUFDLFFBQVEsRUFBQztDQUN2RCxFQUFFLE1BQU0sb0JBQW9CLEdBQUcsMEJBQTBCLENBQUMsUUFBUSxFQUFDO0NBQ25FLEVBQUUsTUFBTSwwQkFBMEIsR0FBRyx1QkFBdUIsQ0FBQyxRQUFRLEVBQUUsZ0JBQWdCLEVBQUUsWUFBWSxDQUFDLE9BQU8sRUFBQztDQUM5RyxFQUFFLE1BQU0sYUFBYSxHQUFHLFFBQVEsQ0FBQyxhQUFhLENBQUMsS0FBSyxFQUFDO0NBQ3JELEVBQUUsYUFBYSxDQUFDLFdBQVcsR0FBRyxRQUFPO0NBQ3JDLEVBQUUsYUFBYSxDQUFDLEVBQUUsR0FBRyxjQUFhO0NBQ2xDLEVBQUUsYUFBYSxDQUFDLEtBQUssR0FBRyxlQUFjO0NBQ3RDLEVBQUUsUUFBUSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsY0FBYyxFQUFDO0NBQzNDLEVBQUUsUUFBUSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsb0JBQW9CLEVBQUM7Q0FDakQsRUFBRSxXQUFXLENBQUMsV0FBVyxDQUFDLDBCQUEwQixFQUFDO0NBQ3JELEVBQUUsV0FBVyxDQUFDLFdBQVcsQ0FBQyxhQUFhLEVBQUM7Q0FDeEMsRUFBRSxJQUFJLENBQUMsV0FBVyxDQUFDLFdBQVcsRUFBQztDQUMvQixFQUFFLE1BQU0sRUFBRSxHQUFHLElBQUksR0FBRyxDQUFDLFFBQVEsRUFBRSxJQUFJLEVBQUUsY0FBYyxFQUFFLFdBQVcsRUFBRSwwQkFBMEIsRUFBRSxhQUFhLEVBQUM7Q0FDNUcsRUFBRSxRQUFRLENBQUMsZ0JBQWdCLENBQUMsU0FBUyxFQUFFLENBQUMsS0FBSyxLQUFLLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxLQUFLLENBQUMsRUFBQztDQUM5RSxFQUFFLFFBQVEsQ0FBQyxnQkFBZ0IsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxLQUFLLEtBQUssRUFBRSxDQUFDLGlCQUFpQixDQUFDLEtBQUssQ0FBQyxFQUFDO0NBQzVFLEVBQUUsMEJBQTBCLENBQUMsZ0JBQWdCLENBQUMsT0FBTyxFQUFFLENBQUMsS0FBSyxLQUFLLEVBQUUsQ0FBQyxrQ0FBa0MsQ0FBQyxLQUFLLENBQUMsRUFBQztDQUMvRyxFQUFFLEVBQUUsQ0FBQyxpQkFBaUIsR0FBRyxJQUFJLGdCQUFnQixDQUFDLENBQUMsU0FBUyxLQUFLLEVBQUUsQ0FBQyxZQUFZLENBQUMsRUFBRSxFQUFFLFNBQVMsQ0FBQyxFQUFDO0NBQzVGLEVBQUUsRUFBRSxDQUFDLGlCQUFpQixDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLEVBQUUsU0FBUyxFQUFFLElBQUksRUFBRSxFQUFDO0NBQ2xFLEVBQUUsMEJBQTBCLENBQUMsZUFBZSxHQUFHLDBCQUEwQixDQUFDLFlBQVc7Q0FDckYsRUFBRSwwQkFBMEIsQ0FBQyxtQkFBbUIsR0FBRywwQkFBMEIsQ0FBQyxLQUFLLENBQUMsZ0JBQWU7Q0FDbkcsRUFBRSxPQUFPLEVBQUU7Q0FDWCxFQUFFO0FBQ0Y7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsWUFBWSxDQUFDLElBQUksRUFBRTtDQUNwQixFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsV0FBVyxHQUFHLEtBQUk7Q0FDdkMsRUFBRTtBQUNGO0NBQ0EsQ0FBQyxNQUFNLGVBQWUsR0FBRztDQUN0QixDQUFDLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxnQkFBZ0IsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxNQUFNLElBQUksTUFBTSxLQUFLLElBQUksQ0FBQywwQkFBMEIsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxNQUFNLElBQUk7Q0FDbkksR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDLFVBQVUsR0FBRyxTQUFRO0NBQ3JDLEdBQUcsTUFBTSxDQUFDLFFBQVEsR0FBRyxLQUFJO0NBQ3pCLEdBQUcsRUFBQztDQUNKLEVBQUUsSUFBSSxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsT0FBTyxHQUFHLEdBQUU7Q0FDeEMsRUFBRSxJQUFJLENBQUMsY0FBYyxDQUFDLEtBQUssR0FBRTtDQUM3QixFQUFFLElBQUksQ0FBQywwQkFBMEIsQ0FBQyxXQUFXLEdBQUcsa0JBQWlCO0NBQ2pFLEVBQUUsSUFBSSxDQUFDLDBCQUEwQixDQUFDLEtBQUssQ0FBQyxlQUFlLEdBQUcsVUFBUztDQUNuRSxFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLEtBQUssR0FBRyxRQUFPO0NBQzFDLEVBQUUsSUFBSSxDQUFDLGlCQUFpQixDQUFDLFVBQVUsR0FBRTtDQUNyQyxFQUFFLE1BQU0sSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLEdBQUU7Q0FDM0IsRUFBRSxJQUFJLENBQUMsb0JBQW9CLEdBQUU7Q0FDN0IsRUFBRTtBQUNGO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLFlBQVksQ0FBQyxFQUFFLEVBQUU7Q0FDbEIsRUFBRSxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLGFBQWEsQ0FBQywrQkFBK0IsQ0FBQyxLQUFLLElBQUksSUFBSSxFQUFFLEVBQUU7Q0FDMUYsR0FBRyxHQUFHLElBQUksQ0FBQyxpQkFBaUIsRUFBRTtDQUM5QixJQUFJLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxVQUFVLEdBQUU7Q0FDdkMsSUFBSTtDQUNKLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixHQUFHLElBQUksZ0JBQWdCLENBQUMsRUFBRSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxFQUFDO0NBQ2hGLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxhQUFhLENBQUMsK0JBQStCLENBQUMsRUFBRSxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsVUFBVSxFQUFFLElBQUksRUFBRSxFQUFDO0NBQzlJLEdBQUc7Q0FDSCxFQUFFLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxZQUFZLENBQUMsRUFBRTtDQUM3RCxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLFNBQVMsRUFBRSxFQUFFO0NBQ2xDLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLEdBQUU7Q0FDekIsSUFBSTtDQUNKLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxHQUFHLEdBQUU7Q0FDL0IsR0FBRyxNQUFNO0NBQ1QsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLEdBQUcsT0FBTTtDQUNuQyxHQUFHLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxTQUFTLEVBQUUsRUFBRTtDQUNqQyxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxHQUFFO0NBQ3hCLElBQUk7Q0FDSixHQUFHO0NBQ0gsRUFBRTtBQUNGO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsa0NBQWtDLEdBQUc7Q0FDdEMsRUFBRSxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsU0FBUyxFQUFFLEVBQUU7Q0FDaEMsR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDLDJDQUEyQyxFQUFDO0NBQzdELEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEdBQUU7Q0FDdkIsR0FBRyxJQUFJLENBQUMsb0JBQW9CLEdBQUU7Q0FDOUIsR0FBRyxNQUFNO0NBQ1QsR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDLDZGQUE2RixFQUFDO0NBQy9HLEdBQUcsSUFBSSxDQUFDLGVBQWUsR0FBRTtDQUN6QixHQUFHO0NBQ0gsRUFBRTtBQUNGO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsaUJBQWlCLENBQUMsS0FBSyxFQUFFO0NBQzFCLEVBQUUsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLFNBQVMsRUFBRSxFQUFFO0NBQ2hDLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxrR0FBa0csRUFBQztDQUNsSCxHQUFHLEtBQUssQ0FBQyx3QkFBd0IsR0FBRTtDQUNuQyxHQUFHLEtBQUssQ0FBQyxjQUFjLEdBQUU7Q0FDekIsR0FBRyxLQUFLLENBQUMsZUFBZSxHQUFFO0NBQzFCLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxLQUFLLEdBQUU7Q0FDOUIsR0FBRyxPQUFPLEtBQUs7Q0FDZixHQUFHO0NBQ0gsRUFBRTtBQUNGO0NBQ0EsQ0FBQyxvQkFBb0IsR0FBRztDQUN4QixFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMsNEJBQTRCLENBQUM7Q0FDN0MsR0FBRyxDQUFDLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxnQkFBZ0IsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxNQUFNLElBQUksTUFBTSxLQUFLLElBQUksQ0FBQywwQkFBMEIsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxNQUFNLElBQUk7Q0FDbkksR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDLFVBQVUsR0FBRyxHQUFFO0NBQy9CLEdBQUcsTUFBTSxDQUFDLFFBQVEsR0FBRyxNQUFLO0NBQzFCLEdBQUcsRUFBQztDQUNKLEVBQUUsSUFBSSxDQUFDLDBCQUEwQixDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUMsMEJBQTBCLENBQUMsZ0JBQWU7Q0FDL0YsRUFBRSxJQUFJLENBQUMsMEJBQTBCLENBQUMsS0FBSyxDQUFDLGVBQWUsR0FBRyxJQUFJLENBQUMsMEJBQTBCLENBQUMsb0JBQW1CO0NBQzdHLEVBQUUsSUFBSSxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsT0FBTyxHQUFHLE9BQU07Q0FDNUMsRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxLQUFLLEdBQUcsR0FBRTtDQUNyQyxFQUFFLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsRUFBRSxTQUFTLEVBQUUsSUFBSSxFQUFFLEVBQUM7Q0FDMUUsRUFBRTtBQUNGO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLElBQUksUUFBUSxHQUFHO0NBQ2hCLEVBQUUsT0FBTyxJQUFJLENBQUMsU0FBUztDQUN2QixFQUFFO0FBQ0Y7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsSUFBSSxNQUFNLEdBQUc7Q0FDZCxFQUFFLE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQyxXQUFXO0NBQ25DLEVBQUU7QUFDRjtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsQ0FBQyxJQUFJLElBQUksR0FBRztDQUNaLEVBQUUsT0FBTyxJQUFJLENBQUMsS0FBSztDQUNuQixFQUFFO0FBQ0Y7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsSUFBSSxjQUFjLEdBQUc7Q0FDdEIsRUFBRSxPQUFPLElBQUksQ0FBQyxlQUFlO0NBQzdCLEVBQUU7QUFDRjtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsQ0FBQyxJQUFJLFdBQVcsR0FBRztDQUNuQixFQUFFLE9BQU8sSUFBSSxDQUFDLFlBQVk7Q0FDMUIsRUFBRTtBQUNGO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLElBQUksMEJBQTBCLEdBQUc7Q0FDbEMsRUFBRSxPQUFPLElBQUksQ0FBQywyQkFBMkI7Q0FDekMsRUFBRTtBQUNGO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLElBQUksYUFBYSxHQUFHO0NBQ3JCLEVBQUUsT0FBTyxJQUFJLENBQUMsY0FBYztDQUM1QixFQUFFO0FBQ0Y7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsSUFBSSxRQUFRLEdBQUc7Q0FDaEIsRUFBRSxPQUFPLElBQUksQ0FBQyxTQUFTO0NBQ3ZCLEVBQUU7QUFDRjtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsQ0FBQyxJQUFJLElBQUksR0FBRztDQUNaLEVBQUUsT0FBTyxJQUFJLENBQUMsS0FBSztDQUNuQixFQUFFO0FBQ0Y7Q0FDQTs7Q0NwUEE7QUFDQTtBQUVBO0NBQ0E7Q0FDQTtDQUNBO0NBQ08sU0FBUyxJQUFJLENBQUMsTUFBTSxFQUFFO0NBQzdCLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUM7Q0FDbkIsQ0FBQztBQUNEO0NBQ0EsR0FBRyxPQUFPLE1BQU0sS0FBSyxXQUFXLEVBQUU7Q0FDbEMsQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFDO0NBQ2I7Ozs7Ozs7Ozs7In0=
