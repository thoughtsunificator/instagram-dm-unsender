
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
// @version				0.5.20
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
				this.waitForElement(this.root, () => this.root.querySelector("[aria-label=More]")?.parentNode, waitAbortController),
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
		 * @param {AbortController} abortController
		 * @returns {Promise}
		 */
		async fetchAndRenderThreadNextMessagePage(abortController) {
		}

		/**
		 *
		 * @abstract
		 * @returns {Promise<UIPIMessage>}
		 */
		async getNextUIPIMessage() {
		}

	};

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


	class DefaultUI extends UI$1 {

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
			for(let i = startScrollTop;i > 0;i = i - 30 ) {
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
					// if(unsent) {
					this._lastUnsendDate = new Date();
					this._unsentCount++;
					// }
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
				this.strategy.reset();
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaWRtdS51c2VyLmpzIiwic291cmNlcyI6WyIuLi9zcmMvcnVudGltZS91c2Vyc2NyaXB0L3VpL3N0eWxlL2luc3RhZ3JhbS5qcyIsIi4uL3NyYy9ydW50aW1lL3VzZXJzY3JpcHQvdWkvbWVudS1idXR0b24uanMiLCIuLi9zcmMvcnVudGltZS91c2Vyc2NyaXB0L3VpL21lbnUuanMiLCIuLi9zcmMvZG9tL2FzeW5jLWV2ZW50cy5qcyIsIi4uL3NyYy91aS91aS1jb21wb25lbnQuanMiLCIuLi9zcmMvdWkvZGVmYXVsdC91aS1tZXNzYWdlLmpzIiwiLi4vc3JjL3VpcGkvdWlwaS1tZXNzYWdlLmpzIiwiLi4vc3JjL3VpL3VpLmpzIiwiLi4vc3JjL3VpL2RlZmF1bHQvZG9tLWxvb2t1cC5qcyIsIi4uL3NyYy91aS9kZWZhdWx0L3VpLW1lc3NhZ2VzLXdyYXBwZXIuanMiLCIuLi9zcmMvdWkvZGVmYXVsdC9kZWZhdWx0LXVpLmpzIiwiLi4vc3JjL3VpL2dldC11aS5qcyIsIi4uL3NyYy91aXBpL3VpcGkuanMiLCIuLi9zcmMvaWRtdS9pZG11LmpzIiwiLi4vc3JjL3VpL3Vuc2VuZC1zdHJhdGVneS5qcyIsIi4uL3NyYy91aS9kZWZhdWx0L3Vuc2VuZC1zdHJhdGVneS5qcyIsIi4uL3NyYy9ydW50aW1lL3VzZXJzY3JpcHQvdWkvYWxlcnQuanMiLCIuLi9zcmMvcnVudGltZS91c2Vyc2NyaXB0L3VpL292ZXJsYXkuanMiLCIuLi9zcmMvcnVudGltZS91c2Vyc2NyaXB0L3VpL3VpLmpzIiwiLi4vc3JjL3J1bnRpbWUvdXNlcnNjcmlwdC9tYWluLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKiBAbW9kdWxlIGluc3RhZ3JhbSBIZWxwZXJzIHRvIG1pbWljayBJbnN0YWdyYW0ncyBsb29rIGFuZCBmZWVsICovXG5cbmV4cG9ydCBjb25zdCBCVVRUT05fU1RZTEUgPSB7XG5cdFwiUFJJTUFSWVwiOiBcInByaW1hcnlcIixcblx0XCJTRUNPTkRBUllcIjogXCJzZWNvbmRhcnlcIixcbn1cblxuLyoqXG4gKlxuICogQHBhcmFtIHtIVE1MQnV0dG9uRWxlbWVudH0gYnV0dG9uRWxlbWVudFxuICogQHBhcmFtIHtzdHJpbmd9ICAgICAgICAgICAgc3R5bGVOYW1lXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBhcHBseUJ1dHRvblN0eWxlKGJ1dHRvbkVsZW1lbnQsIHN0eWxlTmFtZSkge1xuXHRidXR0b25FbGVtZW50LnN0eWxlLmZvbnRTaXplID0gXCJ2YXIoLS1zeXN0ZW0tMTQtZm9udC1zaXplKVwiXG5cdGJ1dHRvbkVsZW1lbnQuc3R5bGUuY29sb3IgPSBcIndoaXRlXCJcblx0YnV0dG9uRWxlbWVudC5zdHlsZS5ib3JkZXIgPSBcIjBweFwiXG5cdGJ1dHRvbkVsZW1lbnQuc3R5bGUuYm9yZGVyUmFkaXVzID0gXCI4cHhcIlxuXHRidXR0b25FbGVtZW50LnN0eWxlLnBhZGRpbmcgPSBcIjhweFwiXG5cdGJ1dHRvbkVsZW1lbnQuc3R5bGUuZm9udFdlaWdodCA9IFwiYm9sZFwiXG5cdGJ1dHRvbkVsZW1lbnQuc3R5bGUuY3Vyc29yID0gXCJwb2ludGVyXCJcblx0YnV0dG9uRWxlbWVudC5zdHlsZS5saW5lSGVpZ2h0ID0gXCJ2YXIoLS1zeXN0ZW0tMTQtbGluZS1oZWlnaHQpXCJcblx0aWYoc3R5bGVOYW1lKSB7XG5cdFx0YnV0dG9uRWxlbWVudC5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSBgcmdiKHZhcigtLWlnLSR7c3R5bGVOYW1lfS1idXR0b24pKWBcblx0fVxufVxuIiwiLyoqIEBtb2R1bGUgbWVudS1idXR0b24gSGVscGVycyB0byBjcmVhdGUgYnV0dG9ucyB0aGF0IGNhbiBiZSB1c2VkIGluIElETVUncyBtZW51ICovXG5cbmltcG9ydCB7IGFwcGx5QnV0dG9uU3R5bGUgfSBmcm9tIFwiLi9zdHlsZS9pbnN0YWdyYW0uanNcIlxuXG4vKipcbiAqXG4gKiBAcGFyYW0ge0RvY3VtZW50fSBkb2N1bWVudFxuICogQHBhcmFtIHtzdHJpbmd9ICAgdGV4dFxuICogQHBhcmFtIHtzdHJpbmd9ICAgc3R5bGVOYW1lXG4gKiBAcmV0dXJucyB7SFRNTEJ1dHRvbkVsZW1lbnR9XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVNZW51QnV0dG9uRWxlbWVudChkb2N1bWVudCwgdGV4dCwgc3R5bGVOYW1lKSB7XG5cdGNvbnN0IGJ1dHRvbkVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiYnV0dG9uXCIpXG5cdGJ1dHRvbkVsZW1lbnQudGV4dENvbnRlbnQgPSB0ZXh0XG5cdGFwcGx5QnV0dG9uU3R5bGUoYnV0dG9uRWxlbWVudCwgc3R5bGVOYW1lKVxuXHRidXR0b25FbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJtb3VzZW92ZXJcIiwgKCkgPT4ge1xuXHRcdGJ1dHRvbkVsZW1lbnQuc3R5bGUuZmlsdGVyID0gYGJyaWdodG5lc3MoMS4xNSlgXG5cdH0pXG5cdGJ1dHRvbkVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNlb3V0XCIsICgpID0+IHtcblx0XHRidXR0b25FbGVtZW50LnN0eWxlLmZpbHRlciA9IGBgXG5cdH0pXG5cdHJldHVybiBidXR0b25FbGVtZW50XG59XG4iLCIvKiogQG1vZHVsZSBtZW51IElETVUncyBtYWluIG1lbnUgKi9cblxuLyoqXG4gKiBAcGFyYW0ge0RvY3VtZW50fSBkb2N1bWVudFxuICogQHJldHVybnMge0hUTUxCdXR0b25FbGVtZW50fVxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlTWVudUVsZW1lbnQoZG9jdW1lbnQpIHtcblx0Y29uc3QgbWVudUVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpXG5cdG1lbnVFbGVtZW50LmlkID0gXCJpZG11LW1lbnVcIlxuXHRtZW51RWxlbWVudC5zdHlsZS50b3AgPSBcIjIwcHhcIlxuXHRtZW51RWxlbWVudC5zdHlsZS5yaWdodCA9IFwiNDMwcHhcIlxuXHRtZW51RWxlbWVudC5zdHlsZS5wb3NpdGlvbiA9IFwiZml4ZWRcIlxuXHRtZW51RWxlbWVudC5zdHlsZS56SW5kZXggPSA5OTlcblx0bWVudUVsZW1lbnQuc3R5bGUuZGlzcGxheSA9IFwiZmxleFwiXG5cdG1lbnVFbGVtZW50LnN0eWxlLmdhcCA9IFwiMTBweFwiXG5cdG1lbnVFbGVtZW50LnN0eWxlLnBsYWNlSXRlbXMgPSBcImNlbnRlclwiXG5cdHJldHVybiBtZW51RWxlbWVudFxufVxuIiwiLyoqIEBtb2R1bGUgYXN5bmMtZXZlbnRzIFV0aWxzIG1vZHVsZSBmb3IgZmluZGluZyBlbGVtZW50cyBhc3luY2hyb25vdXNseSBpbiB0aGUgRE9NICovXG5cbi8qKlxuICpcbiAqIEBjYWxsYmFjayBnZXRFbGVtZW50XG4gKiBAcmV0dXJucyB7RWxlbWVudH1cbiAqL1xuXG4vKipcbiAqXG4gKiBAcGFyYW0ge0VsZW1lbnR9IHRhcmdldFxuICogQHBhcmFtIHtnZXRFbGVtZW50fSBnZXRFbGVtZW50XG4gKiBAcGFyYW0ge0Fib3J0Q29udHJvbGxlcn0gYWJvcnRDb250cm9sbGVyXG4gKiBAcmV0dXJucyB7UHJvbWlzZTxFbGVtZW50Pn1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHdhaXRGb3JFbGVtZW50KHRhcmdldCwgZ2V0RWxlbWVudCwgYWJvcnRDb250cm9sbGVyKSB7XG5cdHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cdFx0bGV0IG11dGF0aW9uT2JzZXJ2ZXJcblx0XHRjb25zdCBhYm9ydEhhbmRsZXIgPSAoKSA9PiB7XG5cdFx0XHRpZihtdXRhdGlvbk9ic2VydmVyKSB7XG5cdFx0XHRcdHJlamVjdChuZXcgRE9NRXhjZXB0aW9uKFwiQWJvcnRlZDogRGlzY29ubmVjdGluZyBtdXRhdGlvbiBvYnNlcnZlci4uLlwiLCBcIkFib3J0RXJyb3JcIikpXG5cdFx0XHRcdG11dGF0aW9uT2JzZXJ2ZXIuZGlzY29ubmVjdCgpXG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZWplY3QobmV3IERPTUV4Y2VwdGlvbihcIkFib3J0ZWRcIiwgXCJBYm9ydEVycm9yXCIpKVxuXHRcdFx0fVxuXHRcdH1cblx0XHRhYm9ydENvbnRyb2xsZXIuc2lnbmFsLmFkZEV2ZW50TGlzdGVuZXIoXCJhYm9ydFwiLCBhYm9ydEhhbmRsZXIpXG5cdFx0bGV0IGVsZW1lbnQgPSBnZXRFbGVtZW50KClcblx0XHRpZihlbGVtZW50KSB7XG5cdFx0XHRyZXNvbHZlKGVsZW1lbnQpXG5cdFx0XHRhYm9ydENvbnRyb2xsZXIuc2lnbmFsLnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJhYm9ydFwiLCBhYm9ydEhhbmRsZXIpXG5cdFx0fSBlbHNlIHtcblx0XHRcdG11dGF0aW9uT2JzZXJ2ZXIgPSBuZXcgTXV0YXRpb25PYnNlcnZlcigobXV0YXRpb25zLCBvYnNlcnZlcikgPT4ge1xuXHRcdFx0XHRlbGVtZW50ID0gZ2V0RWxlbWVudChtdXRhdGlvbnMpXG5cdFx0XHRcdGlmKGVsZW1lbnQpIHtcblx0XHRcdFx0XHRvYnNlcnZlci5kaXNjb25uZWN0KClcblx0XHRcdFx0XHRyZXNvbHZlKGVsZW1lbnQpXG5cdFx0XHRcdFx0YWJvcnRDb250cm9sbGVyLnNpZ25hbC5yZW1vdmVFdmVudExpc3RlbmVyKFwiYWJvcnRcIiwgYWJvcnRIYW5kbGVyKVxuXHRcdFx0XHR9XG5cdFx0XHR9KVxuXHRcdFx0bXV0YXRpb25PYnNlcnZlci5vYnNlcnZlKHRhcmdldCwgeyBzdWJ0cmVlOiB0cnVlLCBjaGlsZExpc3Q6dHJ1ZSB9KVxuXHRcdH1cblx0fSlcbn1cblxuLyoqXG4gKlxuICogQHBhcmFtIHtFbGVtZW50fSBjbGlja1RhcmdldFxuICogQHBhcmFtIHtFbGVtZW50fSB0YXJnZXRcbiAqIEBwYXJhbSB7Z2V0RWxlbWVudH0gZ2V0RWxlbWVudFxuICogQHBhcmFtIHtBYm9ydENvbnRyb2xsZXJ9IGFib3J0Q29udHJvbGxlclxuICogQHJldHVybnMge0VsZW1lbnR8UHJvbWlzZTxFbGVtZW50Pn1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNsaWNrRWxlbWVudEFuZFdhaXRGb3IoY2xpY2tUYXJnZXQsIHRhcmdldCwgZ2V0RWxlbWVudCwgYWJvcnRDb250cm9sbGVyKSB7XG5cdGNvbnN0IHByb21pc2UgPSB3YWl0Rm9yRWxlbWVudCh0YXJnZXQsIGdldEVsZW1lbnQsIGFib3J0Q29udHJvbGxlcilcblx0Y2xpY2tUYXJnZXQuY2xpY2soKVxuXHRyZXR1cm4gZ2V0RWxlbWVudCgpIHx8IHByb21pc2Vcbn1cbiIsIi8qKiBAbW9kdWxlIHVpLWNvbXBvbmVudCBCYXNlIGNsYXNzIGZvciBhbnkgZWxlbWVudCB0aGF0IGlzIGEgcGFydCBvZiB0aGUgVUkuICovXG5cbmltcG9ydCB7IHdhaXRGb3JFbGVtZW50LCBjbGlja0VsZW1lbnRBbmRXYWl0Rm9yIH0gZnJvbSBcIi4uL2RvbS9hc3luYy1ldmVudHMuanNcIlxuXG5leHBvcnQgY2xhc3MgVUlDb21wb25lbnQge1xuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHtFbGVtZW50fSByb290XG5cdCAqIEBwYXJhbSB7b2JqZWN0fSBpZGVudGlmaWVyXG5cdCAqL1xuXHRjb25zdHJ1Y3Rvcihyb290LCBpZGVudGlmaWVyPXt9KSB7XG5cdFx0dGhpcy5yb290ID0gcm9vdFxuXHRcdHRoaXMuaWRlbnRpZmllciA9IGlkZW50aWZpZXJcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge0VsZW1lbnR9IHRhcmdldFxuXHQgKiBAcGFyYW0ge2Z1bmN0aW9ufSBnZXRFbGVtZW50XG5cdCAqIEBwYXJhbSB7QWJvcnRDb250cm9sbGVyfSBhYm9ydENvbnRyb2xsZXJcblx0ICogQHJldHVybnMge1Byb21pc2U8RWxlbWVudD59XG5cdCAqL1xuXHR3YWl0Rm9yRWxlbWVudCh0YXJnZXQsIGdldEVsZW1lbnQsIGFib3J0Q29udHJvbGxlcikge1xuXHRcdHJldHVybiBnZXRFbGVtZW50KCkgfHwgd2FpdEZvckVsZW1lbnQodGFyZ2V0LCBnZXRFbGVtZW50LCBhYm9ydENvbnRyb2xsZXIpXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHtFbGVtZW50fSBjbGlja1RhcmdldFxuXHQgKiBAcGFyYW0ge0VsZW1lbnR9IHRhcmdldFxuXHQgKiBAcGFyYW0ge2Z1bmN0aW9ufSBnZXRFbGVtZW50XG5cdCAqIEBwYXJhbSB7QWJvcnRDb250cm9sbGVyfSBhYm9ydENvbnRyb2xsZXJcblx0ICogQHJldHVybnMge1Byb21pc2U8RWxlbWVudD59XG5cdCAqL1xuXHRjbGlja0VsZW1lbnRBbmRXYWl0Rm9yKGNsaWNrVGFyZ2V0LCB0YXJnZXQsIGdldEVsZW1lbnQsIGFib3J0Q29udHJvbGxlcikge1xuXHRcdHJldHVybiBjbGlja0VsZW1lbnRBbmRXYWl0Rm9yKGNsaWNrVGFyZ2V0LCB0YXJnZXQsIGdldEVsZW1lbnQsIGFib3J0Q29udHJvbGxlcilcblx0fVxuXG59XG5cbmV4cG9ydCBkZWZhdWx0IFVJQ29tcG9uZW50XG4iLCIvKiogQG1vZHVsZSB1aS1tZXNzYWdlIFVJIGVsZW1lbnQgcmVwcmVzZW50aW5nIGEgbWVzc2FnZSAqL1xuXG5pbXBvcnQgVUlDb21wb25lbnQgZnJvbSBcIi4uL3VpLWNvbXBvbmVudC5qc1wiXG5cbmNsYXNzIFVJTWVzc2FnZSBleHRlbmRzIFVJQ29tcG9uZW50IHtcblxuXHQvKipcblx0ICogQHBhcmFtIHtBYm9ydENvbnRyb2xsZXJ9IGFib3J0Q29udHJvbGxlclxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZTxIVE1MQnV0dG9uRWxlbWVudD59XG5cdCAqL1xuXHRhc3luYyBzaG93QWN0aW9uc01lbnVCdXR0b24oYWJvcnRDb250cm9sbGVyKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIldvcmtmbG93IHN0ZXAgMSA6IHNob3dBY3Rpb25zTWVudUJ1dHRvblwiLCB0aGlzLnJvb3QpXG5cdFx0dGhpcy5yb290LmRpc3BhdGNoRXZlbnQobmV3IE1vdXNlRXZlbnQoXCJtb3VzZW1vdmVcIiwgeyBidWJibGVzOiB0cnVlIH0pKVxuXHRcdHRoaXMucm9vdC5kaXNwYXRjaEV2ZW50KG5ldyBNb3VzZUV2ZW50KFwibW91c2VvdmVyXCIsIHsgYnViYmxlczogdHJ1ZSB9KSlcblx0XHR0aGlzLnJvb3QuZGlzcGF0Y2hFdmVudChuZXcgTW91c2VFdmVudChcIm1vdXNlbnRlclwiLCB7IGJ1YmJsZXM6IHRydWUgfSkpXG5cdFx0Y29uc3Qgd2FpdEFib3J0Q29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKVxuXHRcdGxldCBwcm9taXNlVGltZW91dFxuXHRcdGxldCByZXNvbHZlVGltZW91dFxuXHRcdGNvbnN0IGFib3J0SGFuZGxlciA9ICgpID0+IHtcblx0XHRcdHdhaXRBYm9ydENvbnRyb2xsZXIuYWJvcnQoKVxuXHRcdFx0Y2xlYXJUaW1lb3V0KHByb21pc2VUaW1lb3V0KVxuXHRcdFx0aWYocmVzb2x2ZVRpbWVvdXQpIHtcblx0XHRcdFx0cmVzb2x2ZVRpbWVvdXQoKVxuXHRcdFx0fVxuXHRcdH1cblx0XHRhYm9ydENvbnRyb2xsZXIuc2lnbmFsLmFkZEV2ZW50TGlzdGVuZXIoXCJhYm9ydFwiLCBhYm9ydEhhbmRsZXIpXG5cdFx0Y29uc3QgYWN0aW9uQnV0dG9uID0gYXdhaXQgUHJvbWlzZS5yYWNlKFtcblx0XHRcdHRoaXMud2FpdEZvckVsZW1lbnQodGhpcy5yb290LCAoKSA9PiB0aGlzLnJvb3QucXVlcnlTZWxlY3RvcihcIlthcmlhLWxhYmVsPU1vcmVdXCIpPy5wYXJlbnROb2RlLCB3YWl0QWJvcnRDb250cm9sbGVyKSxcblx0XHRcdG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcblx0XHRcdFx0cHJvbWlzZVRpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHJlamVjdChcIlRpbWVvdXQgc2hvd0FjdGlvbnNNZW51QnV0dG9uXCIpLCAyMDApXG5cdFx0XHR9KVxuXHRcdF0pXG5cdFx0d2FpdEFib3J0Q29udHJvbGxlci5hYm9ydCgpXG5cdFx0Y2xlYXJUaW1lb3V0KHByb21pc2VUaW1lb3V0KVxuXHRcdHJldHVybiBhY3Rpb25CdXR0b25cblx0fVxuXG5cdC8qKlxuXHQgKiBAcGFyYW0ge0Fib3J0Q29udHJvbGxlcn0gYWJvcnRDb250cm9sbGVyXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlPGJvb2xlYW4+fVxuXHQgKi9cblx0YXN5bmMgaGlkZUFjdGlvbk1lbnVCdXR0b24oYWJvcnRDb250cm9sbGVyKSB7IC8vIEZJWE1FXG5cdFx0Y29uc29sZS5kZWJ1ZyhcImhpZGVBY3Rpb25NZW51QnV0dG9uXCIsIHRoaXMucm9vdClcblx0XHR0aGlzLnJvb3QuZGlzcGF0Y2hFdmVudChuZXcgTW91c2VFdmVudChcIm1vdXNlbW92ZVwiLCB7IGJ1YmJsZXM6IHRydWUgfSkpXG5cdFx0dGhpcy5yb290LmRpc3BhdGNoRXZlbnQobmV3IE1vdXNlRXZlbnQoXCJtb3VzZW91dFwiLCB7IGJ1YmJsZXM6IHRydWUgfSkpXG5cdFx0dGhpcy5yb290LmRpc3BhdGNoRXZlbnQobmV3IE1vdXNlRXZlbnQoXCJtb3VzZWxlYXZlXCIsIHsgYnViYmxlczogdHJ1ZSB9KSlcblx0XHRjb25zdCB3YWl0QWJvcnRDb250cm9sbGVyID0gbmV3IEFib3J0Q29udHJvbGxlcigpXG5cdFx0bGV0IHByb21pc2VUaW1lb3V0XG5cdFx0bGV0IHJlc29sdmVUaW1lb3V0XG5cdFx0Y29uc3QgYWJvcnRIYW5kbGVyID0gKCkgPT4ge1xuXHRcdFx0d2FpdEFib3J0Q29udHJvbGxlci5hYm9ydCgpXG5cdFx0XHRjbGVhclRpbWVvdXQocHJvbWlzZVRpbWVvdXQpXG5cdFx0XHRpZihyZXNvbHZlVGltZW91dCkge1xuXHRcdFx0XHRyZXNvbHZlVGltZW91dCgpXG5cdFx0XHR9XG5cdFx0fVxuXHRcdGFib3J0Q29udHJvbGxlci5zaWduYWwuYWRkRXZlbnRMaXN0ZW5lcihcImFib3J0XCIsIGFib3J0SGFuZGxlcilcblx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCBQcm9taXNlLnJhY2UoW1xuXHRcdFx0dGhpcy53YWl0Rm9yRWxlbWVudCh0aGlzLnJvb3QsICgpID0+IHRoaXMucm9vdC5xdWVyeVNlbGVjdG9yKFwiW2FyaWEtbGFiZWw9TW9yZV1cIikgPT09IG51bGwsIHdhaXRBYm9ydENvbnRyb2xsZXIpLFxuXHRcdFx0bmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuXHRcdFx0XHRyZXNvbHZlVGltZW91dCA9IHJlc29sdmVcblx0XHRcdFx0cHJvbWlzZVRpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHJlamVjdChcIlRpbWVvdXQgaGlkZUFjdGlvbk1lbnVCdXR0b25cIiksIDIwMClcblx0XHRcdH0pXG5cdFx0XSlcblx0XHR3YWl0QWJvcnRDb250cm9sbGVyLmFib3J0KClcblx0XHRjbGVhclRpbWVvdXQocHJvbWlzZVRpbWVvdXQpXG5cdFx0cmV0dXJuIHJlc3VsdFxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7SFRNTEJ1dHRvbkVsZW1lbnR9IGFjdGlvbkJ1dHRvblxuXHQgKiBAcGFyYW0ge0Fib3J0Q29udHJvbGxlcn0gYWJvcnRDb250cm9sbGVyXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlfVxuXHQgKi9cblx0YXN5bmMgb3BlbkFjdGlvbnNNZW51KGFjdGlvbkJ1dHRvbiwgYWJvcnRDb250cm9sbGVyKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIldvcmtmbG93IHN0ZXAgMiA6IENsaWNraW5nIGFjdGlvbkJ1dHRvbiBhbmQgd2FpdGluZyBmb3IgdW5zZW5kIG1lbnUgaXRlbSB0byBhcHBlYXJcIiwgYWN0aW9uQnV0dG9uKVxuXHRcdGNvbnN0IHdhaXRBYm9ydENvbnRyb2xsZXIgPSBuZXcgQWJvcnRDb250cm9sbGVyKClcblx0XHRsZXQgcHJvbWlzZVRpbWVvdXRcblx0XHRsZXQgcmVzb2x2ZVRpbWVvdXRcblx0XHRjb25zdCBhYm9ydEhhbmRsZXIgPSAoKSA9PiB7XG5cdFx0XHR3YWl0QWJvcnRDb250cm9sbGVyLmFib3J0KClcblx0XHRcdGNsZWFyVGltZW91dChwcm9taXNlVGltZW91dClcblx0XHRcdGlmKHJlc29sdmVUaW1lb3V0KSB7XG5cdFx0XHRcdHJlc29sdmVUaW1lb3V0KClcblx0XHRcdH1cblx0XHR9XG5cdFx0YWJvcnRDb250cm9sbGVyLnNpZ25hbC5hZGRFdmVudExpc3RlbmVyKFwiYWJvcnRcIiwgYWJvcnRIYW5kbGVyKVxuXHRcdGNvbnN0IHVuc2VuZEJ1dHRvbiA9IGF3YWl0IFByb21pc2UucmFjZShbXG5cdFx0XHR0aGlzLmNsaWNrRWxlbWVudEFuZFdhaXRGb3IoXG5cdFx0XHRcdGFjdGlvbkJ1dHRvbixcblx0XHRcdFx0dGhpcy5yb290Lm93bmVyRG9jdW1lbnQuYm9keSxcblx0XHRcdFx0KG11dGF0aW9ucykgPT4ge1xuXHRcdFx0XHRcdGlmKG11dGF0aW9ucykge1xuXHRcdFx0XHRcdFx0Y29uc3QgYWRkZWROb2RlcyA9IFsgLi4ubXV0YXRpb25zLm1hcChtdXRhdGlvbiA9PiBbLi4ubXV0YXRpb24uYWRkZWROb2Rlc10pIF0uZmxhdCgpLmZpbHRlcihub2RlID0+IG5vZGUubm9kZVR5cGUgPT09IDEpXG5cdFx0XHRcdFx0XHRjb25zb2xlLmRlYnVnKFwiV29ya2Zsb3cgc3RlcCAyIDogXCIsIGFkZGVkTm9kZXMsIGFkZGVkTm9kZXMuZmluZChub2RlID0+IG5vZGUudGV4dENvbnRlbnQudHJpbSgpLnRvTG9jYWxlTG93ZXJDYXNlKCkgPT09IFwidW5zZW5kXCIpKVxuXHRcdFx0XHRcdFx0Zm9yKGNvbnN0IGFkZGVkTm9kZSBvZiBhZGRlZE5vZGVzKSB7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IG5vZGUgPSBbLi4uYWRkZWROb2RlLnF1ZXJ5U2VsZWN0b3JBbGwoXCJzcGFuLGRpdlwiKV0uZmluZChub2RlID0+IG5vZGUudGV4dENvbnRlbnQudHJpbSgpLnRvTG9jYWxlTG93ZXJDYXNlKCkgPT09IFwidW5zZW5kXCIgJiYgbm9kZS5maXJzdENoaWxkPy5ub2RlVHlwZSA9PT0gMylcblx0XHRcdFx0XHRcdFx0cmV0dXJuIG5vZGVcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0sXG5cdFx0XHRcdHdhaXRBYm9ydENvbnRyb2xsZXJcblx0XHRcdCksXG5cdFx0XHRuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cdFx0XHRcdHByb21pc2VUaW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiByZWplY3QoXCJUaW1lb3V0IG9wZW5BY3Rpb25zTWVudVwiKSwgMjAwKVxuXHRcdFx0fSlcblx0XHRdKVxuXHRcdGNvbnNvbGUuZGVidWcoXCJXb3JrZmxvdyBzdGVwIDIgOiBGb3VuZCB1bnNlbmRCdXR0b25cIiwgdW5zZW5kQnV0dG9uKVxuXHRcdHdhaXRBYm9ydENvbnRyb2xsZXIuYWJvcnQoKVxuXHRcdGNsZWFyVGltZW91dChwcm9taXNlVGltZW91dClcblx0XHRyZXR1cm4gdW5zZW5kQnV0dG9uXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHtIVE1MQnV0dG9uRWxlbWVudH0gYWN0aW9uQnV0dG9uXG5cdCAqIEBwYXJhbSB7SFRNTERpdkVsZW1lbnR9IGFjdGlvbnNNZW51RWxlbWVudFxuXHQgKiBAcGFyYW0ge0Fib3J0Q29udHJvbGxlcn0gYWJvcnRDb250cm9sbGVyXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlPGJvb2xlYW4+fVxuXHQgKi9cblx0YXN5bmMgY2xvc2VBY3Rpb25zTWVudShhY3Rpb25CdXR0b24sIGFjdGlvbnNNZW51RWxlbWVudCwgYWJvcnRDb250cm9sbGVyKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcImNsb3NlQWN0aW9uc01lbnVcIilcblx0XHRjb25zdCB3YWl0QWJvcnRDb250cm9sbGVyID0gbmV3IEFib3J0Q29udHJvbGxlcigpXG5cdFx0bGV0IHByb21pc2VUaW1lb3V0XG5cdFx0bGV0IHJlc29sdmVUaW1lb3V0XG5cdFx0Y29uc3QgYWJvcnRIYW5kbGVyID0gKCkgPT4ge1xuXHRcdFx0d2FpdEFib3J0Q29udHJvbGxlci5hYm9ydCgpXG5cdFx0XHRjbGVhclRpbWVvdXQocHJvbWlzZVRpbWVvdXQpXG5cdFx0XHRpZihyZXNvbHZlVGltZW91dCkge1xuXHRcdFx0XHRyZXNvbHZlVGltZW91dCgpXG5cdFx0XHR9XG5cdFx0fVxuXHRcdGFib3J0Q29udHJvbGxlci5zaWduYWwuYWRkRXZlbnRMaXN0ZW5lcihcImFib3J0XCIsIGFib3J0SGFuZGxlcilcblx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCBQcm9taXNlLnJhY2UoW1xuXHRcdFx0dGhpcy5jbGlja0VsZW1lbnRBbmRXYWl0Rm9yKFxuXHRcdFx0XHRhY3Rpb25CdXR0b24sXG5cdFx0XHRcdHRoaXMucm9vdC5vd25lckRvY3VtZW50LmJvZHksXG5cdFx0XHRcdCgpID0+IHRoaXMucm9vdC5vd25lckRvY3VtZW50LmJvZHkuY29udGFpbnMoYWN0aW9uc01lbnVFbGVtZW50KSA9PT0gZmFsc2UsXG5cdFx0XHRcdGFib3J0Q29udHJvbGxlclxuXHRcdFx0KSxcblx0XHRcdG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcblx0XHRcdFx0cHJvbWlzZVRpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHJlamVjdChcIlRpbWVvdXQgb3BlbkFjdGlvbnNNZW51XCIpLCAyMDApXG5cdFx0XHR9KVxuXHRcdF0pXG5cdFx0d2FpdEFib3J0Q29udHJvbGxlci5hYm9ydCgpXG5cdFx0Y2xlYXJUaW1lb3V0KHByb21pc2VUaW1lb3V0KVxuXHRcdHJldHVybiByZXN1bHQgIT09IG51bGxcblx0fVxuXG5cdC8qKlxuXHQgKiBDbGljayB1bnNlbmQgYnV0dG9uXG5cdCAqIEBwYXJhbSB7SFRNTFNwYW5FbGVtZW50fSB1bnNlbmRCdXR0b25cblx0ICogQHBhcmFtIHtBYm9ydENvbnRyb2xsZXJ9IGFib3J0Q29udHJvbGxlclxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZTxIVE1MQnV0dG9uRWxlbWVudD58UHJvbWlzZTxFcnJvcj59XG5cdCAqL1xuXHRvcGVuQ29uZmlybVVuc2VuZE1vZGFsKHVuc2VuZEJ1dHRvbiwgYWJvcnRDb250cm9sbGVyKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIldvcmtmbG93IHN0ZXAgMyA6IENsaWNraW5nIHVuc2VuZEJ1dHRvbiBhbmQgd2FpdGluZyBmb3IgZGlhbG9nIHRvIGFwcGVhci4uLlwiKVxuXHRcdHJldHVybiB0aGlzLmNsaWNrRWxlbWVudEFuZFdhaXRGb3IoXG5cdFx0XHR1bnNlbmRCdXR0b24sXG5cdFx0XHR0aGlzLnJvb3Qub3duZXJEb2N1bWVudC5ib2R5LFxuXHRcdFx0KCkgPT4gdGhpcy5yb290Lm93bmVyRG9jdW1lbnQucXVlcnlTZWxlY3RvcihcIltyb2xlPWRpYWxvZ10gYnV0dG9uXCIpLFxuXHRcdFx0YWJvcnRDb250cm9sbGVyXG5cdFx0KVxuXHR9XG5cblx0LyoqXG5cdCAqIENsaWNrIHVuc2VuZCBjb25maXJtIGJ1dHRvblxuXHQgKiBAcGFyYW0ge0hUTUxCdXR0b25FbGVtZW50fSBkaWFsb2dCdXR0b25cblx0ICogQHBhcmFtIHtBYm9ydENvbnRyb2xsZXJ9IGFib3J0Q29udHJvbGxlclxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZX1cblx0ICovXG5cdGFzeW5jIGNvbmZpcm1VbnNlbmQoZGlhbG9nQnV0dG9uLCBhYm9ydENvbnRyb2xsZXIpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwiV29ya2Zsb3cgZmluYWwgc3RlcCA6IGNvbmZpcm1VbnNlbmRcIiwgZGlhbG9nQnV0dG9uKVxuXHRcdC8vIHdhaXQgdW50aWwgY29uZmlybSBidXR0b24gaXMgcmVtb3ZlZFxuXHRcdGF3YWl0IHRoaXMuY2xpY2tFbGVtZW50QW5kV2FpdEZvcihcblx0XHRcdGRpYWxvZ0J1dHRvbixcblx0XHRcdHRoaXMucm9vdC5vd25lckRvY3VtZW50LmJvZHksXG5cdFx0XHQoKSA9PiB0aGlzLnJvb3Qub3duZXJEb2N1bWVudC5xdWVyeVNlbGVjdG9yKFwiW3JvbGU9ZGlhbG9nXSBidXR0b25cIikgPT09IG51bGwsXG5cdFx0XHRhYm9ydENvbnRyb2xsZXJcblx0XHQpXG5cdH1cblxufVxuXG5leHBvcnQgZGVmYXVsdCBVSU1lc3NhZ2VcbiIsIi8qKiBAbW9kdWxlIHVpcGktbWVzc2FnZSBBUEkgZm9yIFVJTWVzc2FnZSAqL1xuXG4gXG5pbXBvcnQgVUlNZXNzYWdlIGZyb20gXCIuLi91aS9kZWZhdWx0L3VpLW1lc3NhZ2UuanNcIlxuXG5jbGFzcyBGYWlsZWRXb3JrZmxvd0V4Y2VwdGlvbiBleHRlbmRzIEVycm9yIHt9XG5cbmNsYXNzIFVJUElNZXNzYWdlIHtcblxuXHQvKipcblx0ICogQHBhcmFtIHtVSU1lc3NhZ2V9IHVpTWVzc2FnZVxuXHQgKi9cblx0Y29uc3RydWN0b3IodWlNZXNzYWdlKSB7XG5cdFx0dGhpcy5fdWlNZXNzYWdlID0gdWlNZXNzYWdlXG5cdH1cblxuXHQvKipcblx0ICogQHBhcmFtIHtBYm9ydENvbnRyb2xsZXJ9IGFib3J0Q29udHJvbGxlclxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZTxib29sZWFuPn1cblx0ICovXG5cdGFzeW5jIHVuc2VuZChhYm9ydENvbnRyb2xsZXIpIHsgLy8gVE9ETyBhYm9ydCBVSVBJIC8gd2FpdEZvckVsZW1lbnQgZXRjLi5cblx0XHRjb25zb2xlLmRlYnVnKFwiVUlQSU1lc3NhZ2UgdW5zZW5kXCIpXG5cdFx0bGV0IGFjdGlvbkJ1dHRvblxuXHRcdGxldCB1bnNlbmRCdXR0b25cblx0XHR0cnkge1xuXHRcdFx0YWN0aW9uQnV0dG9uID0gYXdhaXQgdGhpcy51aU1lc3NhZ2Uuc2hvd0FjdGlvbnNNZW51QnV0dG9uKGFib3J0Q29udHJvbGxlcilcblx0XHRcdHVuc2VuZEJ1dHRvbiA9IGF3YWl0IHRoaXMudWlNZXNzYWdlLm9wZW5BY3Rpb25zTWVudShhY3Rpb25CdXR0b24sIGFib3J0Q29udHJvbGxlcilcblx0XHRcdGNvbnNvbGUuZGVidWcoXCJ1bnNlbmRCdXR0b25cIiwgdW5zZW5kQnV0dG9uKVxuXHRcdFx0Y29uc3QgZGlhbG9nQnV0dG9uID0gYXdhaXQgdGhpcy51aU1lc3NhZ2Uub3BlbkNvbmZpcm1VbnNlbmRNb2RhbCh1bnNlbmRCdXR0b24sIGFib3J0Q29udHJvbGxlcilcblx0XHRcdGF3YWl0IHRoaXMudWlNZXNzYWdlLmNvbmZpcm1VbnNlbmQoZGlhbG9nQnV0dG9uLCBhYm9ydENvbnRyb2xsZXIpXG5cdFx0XHR0aGlzLnVpTWVzc2FnZS5yb290LnNldEF0dHJpYnV0ZShcImRhdGEtaWRtdS11bnNlbnRcIiwgXCJcIilcblx0XHRcdHJldHVybiB0cnVlXG5cdFx0fSBjYXRjaChleCkge1xuXHRcdFx0Y29uc29sZS5lcnJvcihleClcblx0XHRcdHRoaXMudWlNZXNzYWdlLnJvb3Quc2V0QXR0cmlidXRlKFwiZGF0YS1pZG11LWlnbm9yZVwiLCBcIlwiKVxuXHRcdFx0dGhyb3cgbmV3IEZhaWxlZFdvcmtmbG93RXhjZXB0aW9uKFwiRmFpbGVkIHRvIGV4ZWN1dGUgd29ya2Zsb3cgZm9yIHRoaXMgbWVzc2FnZVwiLCBleClcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogQHR5cGUge1VJTWVzc2FnZX1cblx0ICovXG5cdGdldCB1aU1lc3NhZ2UoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX3VpTWVzc2FnZVxuXHR9XG5cbn1cbmV4cG9ydCB7IEZhaWxlZFdvcmtmbG93RXhjZXB0aW9uIH1cbmV4cG9ydCBkZWZhdWx0IFVJUElNZXNzYWdlXG4iLCJpbXBvcnQgVUlDb21wb25lbnQgZnJvbSBcIi4vdWktY29tcG9uZW50LmpzXCJcblxuIFxuaW1wb3J0IFVJUElNZXNzYWdlIGZyb20gXCIuLi91aXBpL3VpcGktbWVzc2FnZS5qc1wiXG5cbmNsYXNzIFVJIGV4dGVuZHMgVUlDb21wb25lbnQge1xuXG5cdC8qKlxuXHQgKlxuXHQgKiBAYWJzdHJhY3Rcblx0ICogQHJldHVybnMge1VJfVxuXHQgKi9cblx0c3RhdGljIGNyZWF0ZSgpIHtcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAYWJzdHJhY3Rcblx0ICogQHBhcmFtIHtBYm9ydENvbnRyb2xsZXJ9IGFib3J0Q29udHJvbGxlclxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZX1cblx0ICovXG5cdGFzeW5jIGZldGNoQW5kUmVuZGVyVGhyZWFkTmV4dE1lc3NhZ2VQYWdlKGFib3J0Q29udHJvbGxlcikge1xuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBhYnN0cmFjdFxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZTxVSVBJTWVzc2FnZT59XG5cdCAqL1xuXHRhc3luYyBnZXROZXh0VUlQSU1lc3NhZ2UoKSB7XG5cdH1cblxufVxuXG5leHBvcnQgZGVmYXVsdCBVSVxuIiwiLyoqIEBtb2R1bGUgZG9tLWxvb2t1cCBVdGlscyBtb2R1bGUgZm9yIGxvb2tpbmcgdXAgZWxlbWVudHMgb24gdGhlIGRlZmF1bHQgVUkgKi9cblxuaW1wb3J0IHsgd2FpdEZvckVsZW1lbnQgfSBmcm9tIFwiLi4vLi4vZG9tL2FzeW5jLWV2ZW50cy5qc1wiXG5cbi8qKlxuICpcbiAqIEBwYXJhbSB7RWxlbWVudH0gcm9vdFxuICogQHBhcmFtIHtBYm9ydENvbnRyb2xsZXJ9IGFib3J0Q29udHJvbGxlclxuICogQHJldHVybnMge1Byb21pc2U8RWxlbWVudFtdPn1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldEZpcnN0VmlzaWJsZU1lc3NhZ2Uocm9vdCwgYWJvcnRDb250cm9sbGVyKSB7XG5cdGNvbnN0IGVsZW1lbnRzID0gWy4uLnJvb3QucXVlcnlTZWxlY3RvckFsbChcImRpdltyb2xlPXJvd106bm90KFtkYXRhLWlkbXUtaWdub3JlXSlcIildXG5cdGVsZW1lbnRzLnJldmVyc2UoKVxuXHRjb25zb2xlLmRlYnVnKFwiZ2V0Rmlyc3RWaXNpYmxlTWVzc2FnZVwiLCBlbGVtZW50cy5sZW5ndGgsIFwiZWxlbWVudHNcIilcblx0Zm9yKGNvbnN0IGVsZW1lbnQgb2YgZWxlbWVudHMpIHtcblx0XHRpZihhYm9ydENvbnRyb2xsZXIuc2lnbmFsLmFib3J0ZWQpIHtcblx0XHRcdGJyZWFrXG5cdFx0fVxuXHRcdGNvbnN0IHZpc2liaWxpdHlDaGVjayA9IGVsZW1lbnQuY2hlY2tWaXNpYmlsaXR5KHtcblx0XHRcdHZpc2liaWxpdHlQcm9wZXJ0eTogdHJ1ZSxcblx0XHRcdGNvbnRlbnRWaXNpYmlsaXR5QXV0bzogdHJ1ZSxcblx0XHRcdG9wYWNpdHlQcm9wZXJ0eTogdHJ1ZSxcblx0XHR9KVxuXHRcdGlmKHZpc2liaWxpdHlDaGVjayA9PT0gZmFsc2UpIHtcblx0XHRcdGNvbnNvbGUuZGVidWcoXCJ2aXNpYmlsaXR5Q2hlY2tcIiwgdmlzaWJpbGl0eUNoZWNrKVxuXHRcdFx0Y29udGludWVcblx0XHR9XG5cdFx0Y29uc3QgaXNJblZpZXcgPSBlbGVtZW50LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLnkgPiAxMDBcblx0XHRpZihpc0luVmlldyA9PT0gZmFsc2UpIHtcblx0XHRcdGNvbnNvbGUuZGVidWcoXCJpc0luVmlld1wiLCBpc0luVmlldylcblx0XHRcdGNvbnRpbnVlXG5cdFx0fVxuXHRcdGVsZW1lbnQuc2V0QXR0cmlidXRlKFwiZGF0YS1pZG11LWlnbm9yZVwiLCBcIlwiKSAvLyBOZXh0IGl0ZXJhdGlvbiBzaG91bGQgbm90IGluY2x1ZGUgdGhpcyBtZXNzYWdlXG5cdFx0Y29uc29sZS5kZWJ1ZyhcIk1lc3NhZ2UgaW4gdmlldywgdGVzdGluZyB3b3JrZmxvdy4uLlwiLCBlbGVtZW50KVxuXHRcdHJldHVybiBlbGVtZW50XG5cdH1cbn1cblxuLyoqXG4gKlxuICogQHBhcmFtIHtXaW5kb3d9IHdpbmRvd1xuICogQHJldHVybnMge0hUTUxEaXZFbGVtZW50fVxuICovXG5leHBvcnQgZnVuY3Rpb24gZmluZE1lc3NhZ2VzV3JhcHBlcih3aW5kb3cpIHtcblx0cmV0dXJuIHdpbmRvdy5kb2N1bWVudC5xdWVyeVNlbGVjdG9yKFwiZGl2W3JvbGU9Z3JpZF0gPiBkaXYgPiBkaXYgPiBkaXYgPiBkaXZcIilcbn1cblxuLyoqXG4gKlxuICogQHBhcmFtIHtFbGVtZW50fSByb290XG4gKiBAcGFyYW0ge0Fib3J0Q29udHJvbGxlcn0gYWJvcnRDb250cm9sbGVyXG4gKiBAcmV0dXJucyB7UHJvbWlzZTxib29sZWFuPn1cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGxvYWRNb3JlTWVzc2FnZXMocm9vdCwgYWJvcnRDb250cm9sbGVyKSB7XG5cdGNvbnNvbGUuZGVidWcoXCJsb2FkTW9yZU1lc3NhZ2VzIGxvb2tpbmcgZm9yIGxvYWRlci4uLiBcIilcblx0bGV0IGZpbmRMb2FkZXJUaW1lb3V0XG5cdGxldCBsb2FkaW5nRWxlbWVudFxuXHRsZXQgcmVzb2x2ZVRpbWVvdXRcblx0Y29uc3Qgc2Nyb2xsQWJvcnRDb250cm9sbGVyID0gbmV3IEFib3J0Q29udHJvbGxlcigpIC8vIFNlcGFyYXRlIGFib3J0Q29udHJvbGxlciB0byBzdG9wIHNjcm9sbGluZyBpZiB3ZSBjYW4ndCBmaW5kIHRoZSBsb2FkZXIgaW4gMTBzXG5cdGNvbnN0IGFib3J0SGFuZGxlciA9ICgpID0+IHtcblx0XHRzY3JvbGxBYm9ydENvbnRyb2xsZXIuYWJvcnQoKVxuXHRcdGNsZWFyVGltZW91dChmaW5kTG9hZGVyVGltZW91dClcblx0XHRpZihyZXNvbHZlVGltZW91dCkge1xuXHRcdFx0cmVzb2x2ZVRpbWVvdXQoKVxuXHRcdH1cblx0fVxuXHRhYm9ydENvbnRyb2xsZXIuc2lnbmFsLmFkZEV2ZW50TGlzdGVuZXIoXCJhYm9ydFwiLCBhYm9ydEhhbmRsZXIpXG5cdHJvb3Quc2Nyb2xsVG9wID0gMFxuXHR0cnkge1xuXHRcdGxvYWRpbmdFbGVtZW50ID0gYXdhaXQgUHJvbWlzZS5yYWNlKFtcblx0XHRcdHdhaXRGb3JFbGVtZW50KHJvb3QsICgpID0+IHtcblx0XHRcdFx0aWYocm9vdC5xdWVyeVNlbGVjdG9yKGBbcm9sZT1wcm9ncmVzc2Jhcl1gKSA9PT0gbnVsbCkge1xuXHRcdFx0XHRcdHJvb3Quc2Nyb2xsVG9wID0gMFxuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiByb290LnF1ZXJ5U2VsZWN0b3IoYFtyb2xlPXByb2dyZXNzYmFyXWApXG5cdFx0XHR9LCBzY3JvbGxBYm9ydENvbnRyb2xsZXIpLFxuXHRcdFx0bmV3IFByb21pc2UocmVzb2x2ZSA9PiB7XG5cdFx0XHRcdHJlc29sdmVUaW1lb3V0ID0gcmVzb2x2ZVxuXHRcdFx0XHRmaW5kTG9hZGVyVGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4geyAvLyBUT0RPIFJlcGxhY2Ugd2l0aCBmZXRjaCBvdmVycmlkZVxuXHRcdFx0XHRcdHJlc29sdmUoKVxuXHRcdFx0XHR9LCAxMDAwMCkgLy8gSURNVV9TQ1JPTExfREVURUNUSU9OX1RJTUVPVVRcblx0XHRcdH0pXG5cdFx0XSlcblx0fSBjYXRjaChleCkge1xuXHRcdGNvbnNvbGUuZXJyb3IoZXgpXG5cdH1cblx0c2Nyb2xsQWJvcnRDb250cm9sbGVyLmFib3J0KCkgLy8gSWYgaXQgdG9vayBtb3JlIHRoYW4gMTBzIHN0b3Agc2Nyb2xsaW5nXG5cdGFib3J0Q29udHJvbGxlci5zaWduYWwucmVtb3ZlRXZlbnRMaXN0ZW5lcihcImFib3J0XCIsIGFib3J0SGFuZGxlcilcblx0Y2xlYXJUaW1lb3V0KGZpbmRMb2FkZXJUaW1lb3V0KVxuXHRpZihsb2FkaW5nRWxlbWVudCAmJiBsb2FkaW5nRWxlbWVudCAhPT0gdHJ1ZSkge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJsb2FkTW9yZU1lc3NhZ2VzOiBGb3VuZCBsb2FkZXI7IFN0YW5kLWJ5IHVudGlsIGl0IGlzIHJlbW92ZWRcIilcblx0XHRjb25zb2xlLmRlYnVnKFwibG9hZE1vcmVNZXNzYWdlczogc2Nyb2xsVG9wXCIsIHJvb3Quc2Nyb2xsVG9wKVxuXHRcdGF3YWl0IHdhaXRGb3JFbGVtZW50KHJvb3QsICgpID0+IHJvb3QucXVlcnlTZWxlY3RvcihgW3JvbGU9cHJvZ3Jlc3NiYXJdYCkgPT09IG51bGwsIGFib3J0Q29udHJvbGxlcilcblx0fVxuXHRjb25zb2xlLmRlYnVnKFwibG9hZE1vcmVNZXNzYWdlczogTG9hZGVyIHdhcyByZW1vdmVkLCBvbGRlciBtZXNzYWdlcyBsb2FkaW5nIGNvbXBsZXRlZFwiKVxuXHRjb25zb2xlLmRlYnVnKGBsb2FkTW9yZU1lc3NhZ2VzOiBzY3JvbGxUb3AgaXMgJHtyb290LnNjcm9sbFRvcH0gd2UgJHtyb290LnNjcm9sbFRvcCA9PT0gMCA/IFwicmVhY2hlZCBsYXN0IHBhZ2VcIiA6IFwiZGlkIG5vdCByZWFjaCBsYXN0IHBhZ2UgYW5kIHdpbGwgYmVnaW4gbG9hZGluZyBvbGRlciBtZXNzYWdlcyBzaG9ydGx5XCJ9YCwgKVxuXHRyZXR1cm4gcm9vdC5zY3JvbGxUb3AgPT09IDBcbn1cbiIsIi8qKiBAbW9kdWxlIHVpLW1lc3NhZ2VzLXdyYXBwZXIgVUkgZWxlbWVudCByZXByZXNlbnRpbmcgdGhlIG1lc3NhZ2VzIHdyYXBwZXIgKi9cblxuaW1wb3J0IHsgbG9hZE1vcmVNZXNzYWdlcyB9IGZyb20gXCIuL2RvbS1sb29rdXAuanNcIlxuaW1wb3J0IFVJQ29tcG9uZW50IGZyb20gXCIuLi91aS1jb21wb25lbnQuanNcIlxuXG5jbGFzcyBVSU1lc3NhZ2VzV3JhcHBlciBleHRlbmRzIFVJQ29tcG9uZW50IHtcblxuXHQvKipcblx0ICogQHBhcmFtIHtBYm9ydENvbnRyb2xsZXJ9IGFib3J0Q29udHJvbGxlclxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZX1cblx0ICovXG5cdGZldGNoQW5kUmVuZGVyVGhyZWFkTmV4dE1lc3NhZ2VQYWdlKGFib3J0Q29udHJvbGxlcikge1xuXHRcdHJldHVybiBsb2FkTW9yZU1lc3NhZ2VzKHRoaXMucm9vdCwgYWJvcnRDb250cm9sbGVyKVxuXHR9XG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgVUlNZXNzYWdlc1dyYXBwZXJcbiIsIi8qKiBAbW9kdWxlIGRlZmF1bHQtdWkgRGVmYXVsdCBVSSAvIEVuZ2xpc2ggVUkgKi9cblxuaW1wb3J0IFVJIGZyb20gXCIuLi91aS5qc1wiXG5pbXBvcnQgeyBmaW5kTWVzc2FnZXNXcmFwcGVyLCBnZXRGaXJzdFZpc2libGVNZXNzYWdlIH0gZnJvbSBcIi4vZG9tLWxvb2t1cC5qc1wiXG5pbXBvcnQgVUlQSU1lc3NhZ2UgZnJvbSBcIi4uLy4uL3VpcGkvdWlwaS1tZXNzYWdlLmpzXCJcbmltcG9ydCBVSU1lc3NhZ2UgZnJvbSBcIi4vdWktbWVzc2FnZS5qc1wiXG5pbXBvcnQgVUlNZXNzYWdlc1dyYXBwZXIgZnJvbSBcIi4vdWktbWVzc2FnZXMtd3JhcHBlci5qc1wiXG5cbmNsYXNzIERlZmF1bHRVSSBleHRlbmRzIFVJIHtcblxuXHRjb25zdHJ1Y3Rvcihyb290LCBpZGVudGlmaWVyPXt9KSB7XG5cdFx0c3VwZXIocm9vdCwgaWRlbnRpZmllcilcblx0XHR0aGlzLmxhc3RTY3JvbGxUb3AgPSBudWxsXG5cdH1cblxuXHQvKipcblx0ICogQHBhcmFtIHtXaW5kb3d9IHdpbmRvd1xuXHQgKiBAcmV0dXJucyB7RGVmYXVsdFVJfVxuXHQgKi9cblx0c3RhdGljIGNyZWF0ZSh3aW5kb3cpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwiVUkgY3JlYXRlXCIpXG5cdFx0Y29uc3QgbWVzc2FnZXNXcmFwcGVyRWxlbWVudCA9IGZpbmRNZXNzYWdlc1dyYXBwZXIod2luZG93KVxuXHRcdGlmKG1lc3NhZ2VzV3JhcHBlckVsZW1lbnQgIT09IG51bGwpIHtcblx0XHRcdGNvbnNvbGUuZGVidWcoXCJGb3VuZCBtZXNzYWdlc1dyYXBwZXJFbGVtZW50XCIsIG1lc3NhZ2VzV3JhcHBlckVsZW1lbnQpXG5cdFx0XHRjb25zdCB1aU1lc3NhZ2VzV3JhcHBlciA9IG5ldyBVSU1lc3NhZ2VzV3JhcHBlcihtZXNzYWdlc1dyYXBwZXJFbGVtZW50KVxuXHRcdFx0cmV0dXJuIG5ldyBEZWZhdWx0VUkod2luZG93LCB7IHVpTWVzc2FnZXNXcmFwcGVyIH0pXG5cdFx0fSBlbHNlIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihcIlVuYWJsZSB0byBmaW5kIG1lc3NhZ2VzV3JhcHBlckVsZW1lbnRcIilcblx0XHR9XG5cdH1cblxuXHQvKipcblx0KiBAcGFyYW0ge0Fib3J0Q29udHJvbGxlcn0gYWJvcnRDb250cm9sbGVyXG5cdCogQHJldHVybnMge1Byb21pc2V9XG5cdCovXG5cdGFzeW5jIGZldGNoQW5kUmVuZGVyVGhyZWFkTmV4dE1lc3NhZ2VQYWdlKGFib3J0Q29udHJvbGxlcikge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJVSSBmZXRjaEFuZFJlbmRlclRocmVhZE5leHRNZXNzYWdlUGFnZVwiKVxuXHRcdHJldHVybiBhd2FpdCB0aGlzLmlkZW50aWZpZXIudWlNZXNzYWdlc1dyYXBwZXIuZmV0Y2hBbmRSZW5kZXJUaHJlYWROZXh0TWVzc2FnZVBhZ2UoYWJvcnRDb250cm9sbGVyKVxuXHR9XG5cblx0LyoqXG5cdCAqIEBwYXJhbSB7QWJvcnRDb250cm9sbGVyfSBhYm9ydENvbnRyb2xsZXJcblx0ICogQHJldHVybnMge1Byb21pc2U8VUlQSU1lc3NhZ2U+fVxuXHQgKi9cblx0YXN5bmMgZ2V0TmV4dFVJUElNZXNzYWdlKGFib3J0Q29udHJvbGxlcikge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJVSSBnZXROZXh0VUlQSU1lc3NhZ2VcIiwgdGhpcy5sYXN0U2Nyb2xsVG9wKVxuXHRcdGNvbnN0IHVpTWVzc2FnZXNXcmFwcGVyUm9vdCA9IHRoaXMuaWRlbnRpZmllci51aU1lc3NhZ2VzV3JhcHBlci5yb290XG5cdFx0Y29uc3Qgc3RhcnRTY3JvbGxUb3AgPSB0aGlzLmxhc3RTY3JvbGxUb3AgfHwgdWlNZXNzYWdlc1dyYXBwZXJSb290LnNjcm9sbEhlaWdodCAtIHVpTWVzc2FnZXNXcmFwcGVyUm9vdC5jbGllbnRIZWlnaHRcblx0XHRjb25zb2xlLmRlYnVnKFwic3RhcnRTY3JvbGxUb3BcIiwgc3RhcnRTY3JvbGxUb3ApXG5cdFx0Zm9yKGxldCBpID0gc3RhcnRTY3JvbGxUb3A7aSA+IDA7aSA9IGkgLSAzMCApIHtcblx0XHRcdGlmKGFib3J0Q29udHJvbGxlci5zaWduYWwuYWJvcnRlZCkge1xuXHRcdFx0XHRicmVha1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5sYXN0U2Nyb2xsVG9wID0gaVxuXHRcdFx0dWlNZXNzYWdlc1dyYXBwZXJSb290LnNjcm9sbFRvcCA9IGlcblx0XHRcdHVpTWVzc2FnZXNXcmFwcGVyUm9vdC5kaXNwYXRjaEV2ZW50KG5ldyB0aGlzLnJvb3QuRXZlbnQoXCJzY3JvbGxcIikpXG5cdFx0XHRjb25zb2xlLmRlYnVnKFwic2Nyb2xsXCIpXG5cdFx0XHRhd2FpdCBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgMjApKVxuXHRcdFx0dHJ5IHtcblx0XHRcdFx0Y29uc3QgbWVzc2FnZUVsZW1lbnQgPSBnZXRGaXJzdFZpc2libGVNZXNzYWdlKHVpTWVzc2FnZXNXcmFwcGVyUm9vdCwgYWJvcnRDb250cm9sbGVyKVxuXHRcdFx0XHRpZihtZXNzYWdlRWxlbWVudCkge1xuXHRcdFx0XHRcdGNvbnN0IHVpTWVzc2FnZSA9IG5ldyBVSU1lc3NhZ2UobWVzc2FnZUVsZW1lbnQpXG5cdFx0XHRcdFx0cmV0dXJuIG5ldyBVSVBJTWVzc2FnZSh1aU1lc3NhZ2UpXG5cdFx0XHRcdH1cblx0XHRcdH0gY2F0Y2goZXgpIHtcblx0XHRcdFx0Y29uc29sZS5lcnJvcihleClcblx0XHRcdH1cblx0XHR9XG5cdFx0Ly8gVE9ETyB0aHJvdyBlbmRPZlNjcm9sbEV4Y2VwdGlvblxuXHRcdHJldHVybiBmYWxzZSAvLyBlbmQgb2Ygc2Nyb2xsIHJlYWNoZWRcblx0fVxuXG59XG5cbmV4cG9ydCBkZWZhdWx0IERlZmF1bHRVSVxuIiwiLyoqIEBtb2R1bGUgZ2V0LXVpIFVJIGxvYWRlciBtb2R1bGUuIEFsbG93IGxvYWRpbmcgb2YgYSBjZXJ0YWluIFVJIGJhc2VkIG9uIGEgZ2l2ZW4gc3RyYXRlZ3kgKGxvY2FsZSBldGMuLilcbiAqIFRoZXJlIG1pZ2h0IGJlIG5lZWQgZm9yIG11bHRpcGxlIFVJIGFzIEluc3RhZ3JhbSBtaWdodCBzZXJ2ZSBkaWZmZXJlbnQgYXBwcyBiYXNlZCBvbiBsb2NhdGlvbiBmb3IgZXhhbXBsZS5cbiAqIFRoZXJlIGlzIGFsc28gYSBuZWVkIHRvIGludGVybmF0aW9uYWxpemUgZWFjaCB1aSBzbyB0aGF0IGl0IGRvZXNuJ3QgZmFpbCBpZiB3ZSBjaGFuZ2UgdGhlIGxhbmd1YWdlLlxuICovXG5cbmltcG9ydCBEZWZhdWx0VUkgZnJvbSBcIi4vZGVmYXVsdC9kZWZhdWx0LXVpLmpzXCJcblxuLyoqXG4gKlxuICogQHJldHVybnMge0RlZmF1bHRVSX1cbiAqL1xuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gZ2V0VUkoKSB7XG5cdHJldHVybiBEZWZhdWx0VUlcbn1cbiIsIi8qKiBAbW9kdWxlIHVpcGkgQVBJIGZvciBVSSAqL1xuXG5pbXBvcnQgZ2V0VUkgZnJvbSBcIi4uL3VpL2dldC11aS5qc1wiXG5cbiBcbmltcG9ydCBVSSBmcm9tIFwiLi4vdWkvdWkuanNcIlxuIFxuaW1wb3J0IFVJUElNZXNzYWdlIGZyb20gXCIuL3VpcGktbWVzc2FnZS5qc1wiXG5cbi8qKlxuICogVUkgSW50ZXJmYWNlIEFQSVxuICovXG5jbGFzcyBVSVBJIHtcblxuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHtVSX0gdWlcblx0ICovXG5cdGNvbnN0cnVjdG9yKHVpKSB7XG5cdFx0dGhpcy5fdWkgPSB1aVxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7V2luZG93fSB3aW5kb3dcblx0ICogQHJldHVybnMge1VJUEl9XG5cdCAqL1xuXHRzdGF0aWMgY3JlYXRlKHdpbmRvdykge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJVSVBJLmNyZWF0ZVwiKVxuXHRcdGNvbnN0IHVpID0gZ2V0VUkoKS5jcmVhdGUod2luZG93KVxuXHRcdHJldHVybiBuZXcgVUlQSSh1aSlcblx0fVxuXG5cdC8qKlxuXHQgKiBAcGFyYW0ge0Fib3J0Q29udHJvbGxlcn0gYWJvcnRDb250cm9sbGVyXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlfVxuXHQgKi9cblx0ZmV0Y2hBbmRSZW5kZXJUaHJlYWROZXh0TWVzc2FnZVBhZ2UoYWJvcnRDb250cm9sbGVyKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIlVJUEkgZmV0Y2hBbmRSZW5kZXJUaHJlYWROZXh0TWVzc2FnZVBhZ2VcIilcblx0XHRyZXR1cm4gdGhpcy51aS5mZXRjaEFuZFJlbmRlclRocmVhZE5leHRNZXNzYWdlUGFnZShhYm9ydENvbnRyb2xsZXIpXG5cdH1cblxuXHQvKipcblx0ICogQHBhcmFtIHtBYm9ydENvbnRyb2xsZXJ9IGFib3J0Q29udHJvbGxlclxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZTxVSVBJTWVzc2FnZT59XG5cdCAqL1xuXHRnZXROZXh0VUlQSU1lc3NhZ2UoYWJvcnRDb250cm9sbGVyKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIlVJUEkgZ2V0TmV4dFVJUElNZXNzYWdlXCIpXG5cdFx0cmV0dXJuIHRoaXMudWkuZ2V0TmV4dFVJUElNZXNzYWdlKGFib3J0Q29udHJvbGxlcilcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAdHlwZSB7VUl9XG5cdCAqL1xuXHRnZXQgdWkoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX3VpXG5cdH1cblxufVxuXG5leHBvcnQgZGVmYXVsdCBVSVBJXG4iLCIvKiogQG1vZHVsZSBpZG11IEdsb2JhbC9NYWluIEFQSSBmb3IgaW50ZXJhY3Rpbmcgd2l0aCB0aGUgVUkgKi9cblxuaW1wb3J0IFVJUEkgZnJvbSBcIi4uL3VpcGkvdWlwaS5qc1wiXG5cbiBcbmltcG9ydCBVSVBJTWVzc2FnZSBmcm9tIFwiLi4vdWlwaS91aXBpLW1lc3NhZ2UuanNcIlxuXG5jbGFzcyBJRE1VIHtcblxuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHtXaW5kb3d9IHdpbmRvd1xuXHQgKiBAcGFyYW0ge2NhbGxiYWNrfSBvblN0YXR1c1RleHRcblx0ICovXG5cdGNvbnN0cnVjdG9yKHdpbmRvdywgb25TdGF0dXNUZXh0KSB7XG5cdFx0dGhpcy53aW5kb3cgPSB3aW5kb3dcblx0XHR0aGlzLnVpcGkgPSBudWxsXG5cdFx0dGhpcy5vblN0YXR1c1RleHQgPSBvblN0YXR1c1RleHRcblx0fVxuXG5cdC8qKlxuXHQgKiBAcGFyYW0ge0Fib3J0Q29udHJvbGxlcn0gYWJvcnRDb250cm9sbGVyXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlPFVJUElNZXNzYWdlPn1cblx0ICovXG5cdGdldE5leHRVSVBJTWVzc2FnZShhYm9ydENvbnRyb2xsZXIpIHtcblx0XHRyZXR1cm4gdGhpcy51aXBpLmdldE5leHRVSVBJTWVzc2FnZShhYm9ydENvbnRyb2xsZXIpXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHtzdHJpbmd9IHRleHRcblx0ICovXG5cdHNldFN0YXR1c1RleHQodGV4dCkge1xuXHRcdHRoaXMub25TdGF0dXNUZXh0KHRleHQpXG5cdH1cblxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge0Fib3J0Q29udHJvbGxlcn0gYWJvcnRDb250cm9sbGVyXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlfVxuXHQgKi9cblx0ZmV0Y2hBbmRSZW5kZXJUaHJlYWROZXh0TWVzc2FnZVBhZ2UoYWJvcnRDb250cm9sbGVyKSB7XG5cdFx0cmV0dXJuIHRoaXMudWlwaS5mZXRjaEFuZFJlbmRlclRocmVhZE5leHRNZXNzYWdlUGFnZShhYm9ydENvbnRyb2xsZXIpXG5cdH1cblxuXHQvKipcblx0ICogTWFwIEluc3RhZ3JhbSBVSVxuXHQgKi9cblx0bG9hZFVJUEkoKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcImxvYWRVSVBJXCIpXG5cdFx0dGhpcy51aXBpID0gVUlQSS5jcmVhdGUodGhpcy53aW5kb3cpXG5cdH1cblxuXG59XG5leHBvcnQgZGVmYXVsdCBJRE1VXG4iLCIvKiogQG1vZHVsZSB1bnNlbmQtc3RyYXRlZ3kgVmFyaW91cyBzdHJhdGVnaWVzIGZvciB1bnNlbmRpbmcgbWVzc2FnZXMgKi9cblxuIFxuaW1wb3J0IElETVUgZnJvbSBcIi4uL2lkbXUvaWRtdS5qc1wiXG5cbmNsYXNzIFVuc2VuZFN0cmF0ZWd5IHtcblxuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHtJRE1VfSBpZG11XG5cdCAqL1xuXHRjb25zdHJ1Y3RvcihpZG11KSB7XG5cdFx0dGhpcy5faWRtdSA9IGlkbXVcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAYWJzdHJhY3Rcblx0ICogQHJldHVybnMge2Jvb2xlYW59XG5cdCAqL1xuXHRpc1J1bm5pbmcoKSB7XG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQGFic3RyYWN0XG5cdCAqL1xuXHRzdG9wKCkge1xuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBhYnN0cmFjdFxuXHQgKi9cblx0cmVzZXQoKSB7XG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQGFic3RyYWN0XG5cdCAqL1xuXHRhc3luYyBydW4oKSB7XG5cdH1cblxuXHQvKipcblx0ICogQHJlYWRvbmx5XG5cdCAqIEB0eXBlIHtJRE1VfVxuXHQgKi9cblx0Z2V0IGlkbXUoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX2lkbXVcblx0fVxuXG59XG5cbmV4cG9ydCB7IFVuc2VuZFN0cmF0ZWd5IH1cbiIsIi8qKiBAbW9kdWxlIHVuc2VuZC1zdHJhdGVneSBWYXJpb3VzIHN0cmF0ZWdpZXMgZm9yIHVuc2VuZGluZyBtZXNzYWdlcyAqL1xuXG4gXG5pbXBvcnQgSURNVSBmcm9tIFwiLi4vLi4vaWRtdS9pZG11LmpzXCJcbmltcG9ydCB7IFVuc2VuZFN0cmF0ZWd5IH0gZnJvbSBcIi4uL3Vuc2VuZC1zdHJhdGVneS5qc1wiXG5cbi8qKlxuICogTG9hZHMgbXVsdGlwbGUgcGFnZXMgYmVmb3JlIHVuc2VuZGluZyBtZXNzYWdlXG4gKi9cbmNsYXNzIERlZmF1bHRTdHJhdGVneSBleHRlbmRzIFVuc2VuZFN0cmF0ZWd5IHtcblxuXHQvKipcblx0ICogQHBhcmFtIHtJRE1VfSBpZG11XG5cdCAqL1xuXHRjb25zdHJ1Y3RvcihpZG11KSB7XG5cdFx0c3VwZXIoaWRtdSlcblx0XHR0aGlzLl9hbGxQYWdlc0xvYWRlZCA9IGZhbHNlXG5cdFx0dGhpcy5fdW5zZW50Q291bnQgPSAwXG5cdFx0dGhpcy5fcGFnZXNMb2FkZWRDb3VudCA9IDBcblx0XHR0aGlzLl9ydW5uaW5nID0gZmFsc2Vcblx0XHR0aGlzLl9hYm9ydENvbnRyb2xsZXIgPSBudWxsXG5cdFx0dGhpcy5fbGFzdFVuc2VuZERhdGUgPSBudWxsXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHJldHVybnMge2Jvb2xlYW59XG5cdCAqL1xuXHRpc1J1bm5pbmcoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX3J1bm5pbmcgJiYgdGhpcy5fYWJvcnRDb250cm9sbGVyICYmIHRoaXMuX2Fib3J0Q29udHJvbGxlci5zaWduYWwuYWJvcnRlZCA9PT0gZmFsc2Vcblx0fVxuXG5cdHN0b3AoKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIkRlZmF1bHRTdHJhdGVneSBzdG9wXCIpXG5cdFx0dGhpcy5pZG11LnNldFN0YXR1c1RleHQoXCJTdG9wcGluZy4uLlwiKVxuXHRcdHRoaXMuX2Fib3J0Q29udHJvbGxlci5hYm9ydCgpXG5cdH1cblxuXHRyZXNldCgpIHtcblx0XHR0aGlzLl9hbGxQYWdlc0xvYWRlZCA9IGZhbHNlXG5cdFx0dGhpcy5fdW5zZW50Q291bnQgPSAwXG5cdFx0dGhpcy5fbGFzdFVuc2VuZERhdGUgPSBudWxsXG5cdFx0dGhpcy5fcGFnZXNMb2FkZWRDb3VudCA9IDBcblx0XHR0aGlzLmlkbXUuc2V0U3RhdHVzVGV4dChcIlJlYWR5XCIpXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHJldHVybnMge1Byb21pc2V9XG5cdCAqL1xuXHRhc3luYyBydW4oKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIkRlZmF1bHRTdHJhdGVneS5ydW4oKVwiKVxuXHRcdHRoaXMuX3Vuc2VudENvdW50ID0gMFxuXHRcdHRoaXMuX3BhZ2VzTG9hZGVkQ291bnQgPSAwXG5cdFx0dGhpcy5fcnVubmluZyA9IHRydWVcblx0XHR0aGlzLl9hYm9ydENvbnRyb2xsZXIgPSBuZXcgQWJvcnRDb250cm9sbGVyKClcblx0XHR0aGlzLmlkbXUubG9hZFVJUEkoKVxuXHRcdHRyeSB7XG5cdFx0XHRpZih0aGlzLl9hbGxQYWdlc0xvYWRlZCkge1xuXHRcdFx0XHRhd2FpdCB0aGlzLiN1bnNlbmROZXh0TWVzc2FnZSgpXG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRhd2FpdCB0aGlzLiNsb2FkTmV4dFBhZ2UoKVxuXHRcdFx0fVxuXHRcdFx0aWYodGhpcy5fYWJvcnRDb250cm9sbGVyLnNpZ25hbC5hYm9ydGVkKSB7XG5cdFx0XHRcdHRoaXMuaWRtdS5zZXRTdGF0dXNUZXh0KGBBYm9ydGVkLiAke3RoaXMuX3Vuc2VudENvdW50fSBtZXNzYWdlKHMpIHVuc2VudC5gKVxuXHRcdFx0XHRjb25zb2xlLmRlYnVnKFwiRGVmYXVsdFN0cmF0ZWd5IGFib3J0ZWRcIilcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuaWRtdS5zZXRTdGF0dXNUZXh0KGBEb25lLiAke3RoaXMuX3Vuc2VudENvdW50fSBtZXNzYWdlKHMpIHVuc2VudC5gKVxuXHRcdFx0XHRjb25zb2xlLmRlYnVnKFwiRGVmYXVsdFN0cmF0ZWd5IGRvbmVcIilcblx0XHRcdH1cblx0XHR9IGNhdGNoKGV4KSB7XG5cdFx0XHRjb25zb2xlLmVycm9yKGV4KVxuXHRcdFx0dGhpcy5pZG11LnNldFN0YXR1c1RleHQoYEVycm9yZWQuICR7dGhpcy5fdW5zZW50Q291bnR9IG1lc3NhZ2UocykgdW5zZW50LmApXG5cdFx0XHRjb25zb2xlLmRlYnVnKFwiRGVmYXVsdFN0cmF0ZWd5IGVycm9yZWRcIilcblx0XHR9XG5cdFx0dGhpcy5fcnVubmluZyA9IGZhbHNlXG5cdH1cblxuXHQvKipcblx0ICogVHJpZXMgdG8gbG9hZCB0aGUgdGhyZWFkIG5leHQgcGFnZVxuXHQgKi9cblx0YXN5bmMgI2xvYWROZXh0UGFnZSgpIHtcblx0XHRpZih0aGlzLl9hYm9ydENvbnRyb2xsZXIuc2lnbmFsLmFib3J0ZWQpIHtcblx0XHRcdHJldHVyblxuXHRcdH1cblx0XHR0aGlzLmlkbXUuc2V0U3RhdHVzVGV4dChcIkxvYWRpbmcgbmV4dCBwYWdlLi4uXCIpXG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IGRvbmUgPSBhd2FpdCB0aGlzLmlkbXUuZmV0Y2hBbmRSZW5kZXJUaHJlYWROZXh0TWVzc2FnZVBhZ2UodGhpcy5fYWJvcnRDb250cm9sbGVyKVxuXHRcdFx0aWYodGhpcy5fYWJvcnRDb250cm9sbGVyLnNpZ25hbC5hYm9ydGVkID09PSBmYWxzZSkge1xuXHRcdFx0XHRpZihkb25lKSB7XG5cdFx0XHRcdFx0dGhpcy5pZG11LnNldFN0YXR1c1RleHQoYEFsbCBwYWdlcyBsb2FkZWQgKCR7dGhpcy5fcGFnZXNMb2FkZWRDb3VudH0gaW4gdG90YWwpLi4uYClcblx0XHRcdFx0XHR0aGlzLl9hbGxQYWdlc0xvYWRlZCA9IHRydWVcblx0XHRcdFx0XHRhd2FpdCB0aGlzLiN1bnNlbmROZXh0TWVzc2FnZSgpXG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dGhpcy5fcGFnZXNMb2FkZWRDb3VudCsrXG5cdFx0XHRcdFx0YXdhaXQgdGhpcy4jbG9hZE5leHRQYWdlKClcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0gY2F0Y2goZXgpIHtcblx0XHRcdGNvbnNvbGUuZXJyb3IoZXgpXG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIFVuc2VuZCBmaXJzdCBtZXNzYWdlIGluIHZpZXdwb3J0XG5cdCAqL1xuXHRhc3luYyAjdW5zZW5kTmV4dE1lc3NhZ2UoKSB7XG5cdFx0aWYodGhpcy5fYWJvcnRDb250cm9sbGVyLnNpZ25hbC5hYm9ydGVkKSB7XG5cdFx0XHRyZXR1cm5cblx0XHR9XG5cdFx0bGV0IGNhblNjcm9sbCA9IHRydWVcblx0XHR0cnkge1xuXHRcdFx0dGhpcy5pZG11LnNldFN0YXR1c1RleHQoXCJSZXRyaWV2aW5nIG5leHQgbWVzc2FnZS4uLlwiKVxuXHRcdFx0Y29uc3QgdWlwaU1lc3NhZ2UgPSBhd2FpdCB0aGlzLmlkbXUuZ2V0TmV4dFVJUElNZXNzYWdlKHRoaXMuX2Fib3J0Q29udHJvbGxlcilcblx0XHRcdGNhblNjcm9sbCA9IHVpcGlNZXNzYWdlICE9PSBmYWxzZVxuXHRcdFx0aWYodWlwaU1lc3NhZ2UpIHtcblx0XHRcdFx0dGhpcy5pZG11LnNldFN0YXR1c1RleHQoXCJVbnNlbmRpbmcgbWVzc2FnZS4uLlwiKVxuXHRcdFx0XHRpZiAodGhpcy5fbGFzdFVuc2VuZERhdGUgIT09IG51bGwpIHtcblx0XHRcdFx0XHRjb25zdCBsYXN0VW5zZW5kRGF0ZURpZmYgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKSAtIHRoaXMuX2xhc3RVbnNlbmREYXRlLmdldFRpbWUoKVxuXHRcdFx0XHRcdGlmKGxhc3RVbnNlbmREYXRlRGlmZiA8IDEwMDApIHtcblx0XHRcdFx0XHRcdHRoaXMuaWRtdS5zZXRTdGF0dXNUZXh0KGBXYWl0aW5nICR7bGFzdFVuc2VuZERhdGVEaWZmfW1zIGJlZm9yZSB1bnNlbmRpbmcgbmV4dCBtZXNzYWdlLi4uYClcblx0XHRcdFx0XHRcdGF3YWl0IG5ldyBQcm9taXNlKHJlc29sdmUgPT4gc2V0VGltZW91dChyZXNvbHZlLCBsYXN0VW5zZW5kRGF0ZURpZmYpKVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRjb25zdCB1bnNlbnQgPSBhd2FpdCB1aXBpTWVzc2FnZS51bnNlbmQodGhpcy5fYWJvcnRDb250cm9sbGVyKVxuXHRcdFx0XHQvLyBpZih1bnNlbnQpIHtcblx0XHRcdFx0dGhpcy5fbGFzdFVuc2VuZERhdGUgPSBuZXcgRGF0ZSgpXG5cdFx0XHRcdHRoaXMuX3Vuc2VudENvdW50Kytcblx0XHRcdFx0Ly8gfVxuXHRcdFx0fVxuXHRcdH0gY2F0Y2goZXgpIHtcblx0XHRcdGNvbnNvbGUuZXJyb3IoZXgpXG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdGlmKGNhblNjcm9sbCkge1xuXHRcdFx0XHRhd2FpdCB0aGlzLiN1bnNlbmROZXh0TWVzc2FnZSgpXG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cbn1cblxuZXhwb3J0IHsgRGVmYXVsdFN0cmF0ZWd5IH1cbiIsIi8qKiBAbW9kdWxlIGFsZXJ0IEFsZXJ0IFVJICovXG5cbi8qKlxuICpcbiAqIEBwYXJhbSB7RG9jdW1lbnR9IGRvY3VtZW50XG4gKiBAcmV0dXJucyB7SFRNTEJ1dHRvbkVsZW1lbnR9XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVBbGVydHNXcmFwcGVyRWxlbWVudChkb2N1bWVudCkge1xuXHRjb25zdCBhbGVydHNXcmFwcGVyRWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIilcblx0YWxlcnRzV3JhcHBlckVsZW1lbnQuaWQgPSBcImlkbXUtYWxlcnRzXCJcblx0YWxlcnRzV3JhcHBlckVsZW1lbnQuc3R5bGUucG9zaXRpb24gPSBcImZpeGVkXCJcblx0YWxlcnRzV3JhcHBlckVsZW1lbnQuc3R5bGUudG9wID0gXCIyMHB4XCJcblx0YWxlcnRzV3JhcHBlckVsZW1lbnQuc3R5bGUucmlnaHQgPSBcIjIwcHhcIlxuXHRhbGVydHNXcmFwcGVyRWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gXCJncmlkXCJcblx0cmV0dXJuIGFsZXJ0c1dyYXBwZXJFbGVtZW50XG59XG5cbi8qKlxuICpcbiAqIEBwYXJhbSB7RG9jdW1lbnR9IGRvY3VtZW50XG4gKiBAcGFyYW0ge3N0cmluZ30gICB0ZXh0XG4gKiBAcmV0dXJucyB7SFRNTEJ1dHRvbkVsZW1lbnR9XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVBbGVydEVsZW1lbnQoZG9jdW1lbnQsIHRleHQpIHtcblx0Y29uc3QgYWxlcnRFbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKVxuXHRhbGVydEVsZW1lbnQudGV4dENvbnRlbnQgPSB0ZXh0XG5cdHJldHVybiBhbGVydEVsZW1lbnRcbn1cbiIsIi8qKiBAbW9kdWxlIG92ZXJsYXkgSURNVSdzIG92ZXJsYXkgKi9cblxuLyoqXG4gKiBAcGFyYW0ge0RvY3VtZW50fSBkb2N1bWVudFxuICogQHJldHVybnMge0hUTUxEaXZFbGVtZW50fVxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlT3ZlcmxheUVsZW1lbnQoZG9jdW1lbnQpIHtcblx0Y29uc3Qgb3ZlcmxheUVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpXG5cdG92ZXJsYXlFbGVtZW50LmlkID0gXCJpZG11LW92ZXJsYXlcIlxuXHRvdmVybGF5RWxlbWVudC50YWJJbmRleCA9IDBcblx0b3ZlcmxheUVsZW1lbnQuc3R5bGUudG9wID0gXCIwXCJcblx0b3ZlcmxheUVsZW1lbnQuc3R5bGUucmlnaHQgPSBcIjBcIlxuXHRvdmVybGF5RWxlbWVudC5zdHlsZS5wb3NpdGlvbiA9IFwiZml4ZWRcIlxuXHRvdmVybGF5RWxlbWVudC5zdHlsZS53aWR0aCA9IFwiMTAwdndcIlxuXHRvdmVybGF5RWxlbWVudC5zdHlsZS5oZWlnaHQgPSBcIjEwMHZoXCJcblx0b3ZlcmxheUVsZW1lbnQuc3R5bGUuekluZGV4ID0gXCI5OThcIlxuXHRvdmVybGF5RWxlbWVudC5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSBcIiMwMDAwMDBkNlwiXG5cdG92ZXJsYXlFbGVtZW50LnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIlxuXHRyZXR1cm4gb3ZlcmxheUVsZW1lbnRcbn1cbiIsIi8qKiBAbW9kdWxlIHVpIElETVUncyBvd24gdWkvb3ZlcmxheVxuICogUHJvdmlkZSBhIGJ1dHRvbiB0byB1bnNlbmQgbWVzc2FnZXNcbiovXG5cbmltcG9ydCB7IGNyZWF0ZU1lbnVCdXR0b25FbGVtZW50IH0gZnJvbSBcIi4vbWVudS1idXR0b24uanNcIlxuaW1wb3J0IHsgY3JlYXRlTWVudUVsZW1lbnQgfSBmcm9tIFwiLi9tZW51LmpzXCJcbmltcG9ydCBJRE1VIGZyb20gXCIuLi8uLi8uLi9pZG11L2lkbXUuanNcIlxuaW1wb3J0IHsgRGVmYXVsdFN0cmF0ZWd5IH0gZnJvbSBcIi4uLy4uLy4uL3VpL2RlZmF1bHQvdW5zZW5kLXN0cmF0ZWd5LmpzXCJcbmltcG9ydCB7IGNyZWF0ZUFsZXJ0c1dyYXBwZXJFbGVtZW50IH0gZnJvbSBcIi4vYWxlcnQuanNcIlxuaW1wb3J0IHsgY3JlYXRlT3ZlcmxheUVsZW1lbnQgfSBmcm9tIFwiLi9vdmVybGF5LmpzXCJcbmltcG9ydCB7IEJVVFRPTl9TVFlMRSB9IGZyb20gXCIuL3N0eWxlL2luc3RhZ3JhbS5qc1wiXG5cbiBcbmltcG9ydCB7IFVuc2VuZFN0cmF0ZWd5IH0gZnJvbSBcIi4uLy4uLy4uL3VpL3Vuc2VuZC1zdHJhdGVneS5qc1wiXG5cbmNsYXNzIFVJIHtcblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7RG9jdW1lbnR9IGRvY3VtZW50XG5cdCAqIEBwYXJhbSB7SFRNTERpdkVsZW1lbnR9IHJvb3Rcblx0ICogQHBhcmFtIHtIVE1MRGl2RWxlbWVudH0gb3ZlcmxheUVsZW1lbnRcblx0ICogQHBhcmFtIHtIVE1MRGl2RWxlbWVudH0gbWVudUVsZW1lbnRcblx0ICogQHBhcmFtIHtIVE1MQnV0dG9uRWxlbWVudH0gdW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b25cblx0ICogQHBhcmFtIHtIVE1MRGl2RWxlbWVudH0gc3RhdHVzRWxlbWVudFxuXHQgKi9cblx0Y29uc3RydWN0b3IoZG9jdW1lbnQsIHJvb3QsIG92ZXJsYXlFbGVtZW50LCBtZW51RWxlbWVudCwgdW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24sIHN0YXR1c0VsZW1lbnQpIHtcblx0XHR0aGlzLl9kb2N1bWVudCA9IGRvY3VtZW50XG5cdFx0dGhpcy5fcm9vdCA9IHJvb3Rcblx0XHR0aGlzLl9vdmVybGF5RWxlbWVudCA9IG92ZXJsYXlFbGVtZW50XG5cdFx0dGhpcy5fbWVudUVsZW1lbnQgPSBtZW51RWxlbWVudFxuXHRcdHRoaXMuX3N0YXR1c0VsZW1lbnQgPSBzdGF0dXNFbGVtZW50XG5cdFx0dGhpcy5fdW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24gPSB1bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvblxuXHRcdHRoaXMuX2lkbXUgPSBuZXcgSURNVSh0aGlzLndpbmRvdywgdGhpcy5vblN0YXR1c1RleHQuYmluZCh0aGlzKSlcblx0XHR0aGlzLl9zdHJhdGVneSA9IG5ldyBEZWZhdWx0U3RyYXRlZ3kodGhpcy5faWRtdSlcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge3dpbmRvd30gd2luZG93XG5cdCAqIEByZXR1cm5zIHtVSX1cblx0ICovXG5cdHN0YXRpYyByZW5kZXIod2luZG93KSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcInJlbmRlclwiKVxuXHRcdGNvbnN0IHVpID0gVUkuY3JlYXRlKHdpbmRvdy5kb2N1bWVudClcblx0XHR3aW5kb3cuZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCh1aS5yb290KVxuXHRcdHJldHVybiB1aVxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSAgIHtEb2N1bWVudH0gZG9jdW1lbnRcblx0ICogQHJldHVybnMge1VJfVxuXHQgKi9cblx0c3RhdGljIGNyZWF0ZShkb2N1bWVudCkge1xuXHRcdGNvbnN0IHJvb3QgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpXG5cdFx0cm9vdC5pZCA9IFwiaWRtdS1yb290XCJcblx0XHRjb25zdCBtZW51RWxlbWVudCA9IGNyZWF0ZU1lbnVFbGVtZW50KGRvY3VtZW50KVxuXHRcdGNvbnN0IG92ZXJsYXlFbGVtZW50ID0gY3JlYXRlT3ZlcmxheUVsZW1lbnQoZG9jdW1lbnQpXG5cdFx0Y29uc3QgYWxlcnRzV3JhcHBlckVsZW1lbnQgPSBjcmVhdGVBbGVydHNXcmFwcGVyRWxlbWVudChkb2N1bWVudClcblx0XHRjb25zdCB1bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbiA9IGNyZWF0ZU1lbnVCdXR0b25FbGVtZW50KGRvY3VtZW50LCBcIlVuc2VuZCBhbGwgRE1zXCIsIEJVVFRPTl9TVFlMRS5QUklNQVJZKVxuXHRcdGNvbnN0IHN0YXR1c0VsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpXG5cdFx0c3RhdHVzRWxlbWVudC50ZXh0Q29udGVudCA9IFwiUmVhZHlcIlxuXHRcdHN0YXR1c0VsZW1lbnQuaWQgPSBcImlkbXUtc3RhdHVzXCJcblx0XHRzdGF0dXNFbGVtZW50LnN0eWxlID0gXCJ3aWR0aDogMjAwcHhcIlxuXHRcdGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQob3ZlcmxheUVsZW1lbnQpXG5cdFx0ZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChhbGVydHNXcmFwcGVyRWxlbWVudClcblx0XHRtZW51RWxlbWVudC5hcHBlbmRDaGlsZCh1bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbilcblx0XHRtZW51RWxlbWVudC5hcHBlbmRDaGlsZChzdGF0dXNFbGVtZW50KVxuXHRcdHJvb3QuYXBwZW5kQ2hpbGQobWVudUVsZW1lbnQpXG5cdFx0Y29uc3QgdWkgPSBuZXcgVUkoZG9jdW1lbnQsIHJvb3QsIG92ZXJsYXlFbGVtZW50LCBtZW51RWxlbWVudCwgdW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24sIHN0YXR1c0VsZW1lbnQpXG5cdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcImtleWRvd25cIiwgKGV2ZW50KSA9PiB1aS4jb25XaW5kb3dLZXlFdmVudChldmVudCkpIC8vIFRPRE8gdGVzdFxuXHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJrZXl1cFwiLCAoZXZlbnQpID0+IHVpLiNvbldpbmRvd0tleUV2ZW50KGV2ZW50KSkgLy8gVE9ETyB0ZXN0XG5cdFx0dW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIChldmVudCkgPT4gdWkuI29uVW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b25DbGljayhldmVudCkpXG5cdFx0dGhpcy5fbXV0YXRpb25PYnNlcnZlciA9IG5ldyBNdXRhdGlvbk9ic2VydmVyKChtdXRhdGlvbnMpID0+IHVpLiNvbk11dGF0aW9ucyh1aSwgbXV0YXRpb25zKSlcblx0XHR0aGlzLl9tdXRhdGlvbk9ic2VydmVyLm9ic2VydmUoZG9jdW1lbnQuYm9keSwgeyBjaGlsZExpc3Q6IHRydWUgfSkgLy8gVE9ETyB0ZXN0XG5cdFx0dW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24uZGF0YVRleHRDb250ZW50ID0gdW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24udGV4dENvbnRlbnRcblx0XHR1bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbi5kYXRhQmFja2dyb3VuZENvbG9yID0gdW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24uc3R5bGUuYmFja2dyb3VuZENvbG9yXG5cdFx0cmV0dXJuIHVpXG5cdH1cblxuXHRhc3luYyAjc3RhcnRVbnNlbmRpbmcoKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIlVzZXIgYXNrZWQgZm9yIG1lc3NhZ2VzIHVuc2VuZGluZyB0byBzdGFydDsgVUkgaW50ZXJhY3Rpb24gd2lsbCBiZSBkaXNhYmxlZCBpbiB0aGUgbWVhbnRpbWVcIilcblx0XHQ7Wy4uLnRoaXMubWVudUVsZW1lbnQucXVlcnlTZWxlY3RvckFsbChcImJ1dHRvblwiKV0uZmlsdGVyKGJ1dHRvbiA9PiBidXR0b24gIT09IHRoaXMudW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24pLmZvckVhY2goYnV0dG9uID0+IHtcblx0XHRcdGJ1dHRvbi5zdHlsZS52aXNpYmlsaXR5ID0gXCJoaWRkZW5cIlxuXHRcdFx0YnV0dG9uLmRpc2FibGVkID0gdHJ1ZVxuXHRcdH0pXG5cdFx0dGhpcy5vdmVybGF5RWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gXCJcIlxuXHRcdHRoaXMub3ZlcmxheUVsZW1lbnQuZm9jdXMoKVxuXHRcdHRoaXMudW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24udGV4dENvbnRlbnQgPSBcIlN0b3AgcHJvY2Vzc2luZ1wiXG5cdFx0dGhpcy51bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbi5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSBcIiNGQTM4M0VcIlxuXHRcdGF3YWl0IHRoaXMuc3RyYXRlZ3kucnVuKClcblx0XHR0aGlzLiNvblVuc2VuZGluZ0ZpbmlzaGVkKClcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge1VJfSB1aVxuXHQgKi9cblx0I29uTXV0YXRpb25zKHVpKSB7XG5cdFx0aWYodWkucm9vdC5vd25lckRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCJbaWRePW1vdW50XSA+IGRpdiA+IGRpdiA+IGRpdlwiKSAhPT0gbnVsbCAmJiB1aSkge1xuXHRcdFx0aWYodGhpcy5fbXV0YXRpb25PYnNlcnZlcikge1xuXHRcdFx0XHR0aGlzLl9tdXRhdGlvbk9ic2VydmVyLmRpc2Nvbm5lY3QoKVxuXHRcdFx0fVxuXHRcdFx0dGhpcy5fbXV0YXRpb25PYnNlcnZlciA9IG5ldyBNdXRhdGlvbk9ic2VydmVyKHVpLiNvbk11dGF0aW9ucy5iaW5kKHRoaXMsIHVpKSlcblx0XHRcdHRoaXMuX211dGF0aW9uT2JzZXJ2ZXIub2JzZXJ2ZSh1aS5yb290Lm93bmVyRG9jdW1lbnQucXVlcnlTZWxlY3RvcihcIltpZF49bW91bnRdID4gZGl2ID4gZGl2ID4gZGl2XCIpLCB7IGNoaWxkTGlzdDogdHJ1ZSwgYXR0cmlidXRlczogdHJ1ZSB9KVxuXHRcdH1cblx0XHRpZih0aGlzLndpbmRvdy5sb2NhdGlvbi5wYXRobmFtZS5zdGFydHNXaXRoKFwiL2RpcmVjdC90L1wiKSkge1xuXHRcdFx0dGhpcy5zdHJhdGVneS5yZXNldCgpXG5cdFx0XHR0aGlzLnJvb3Quc3R5bGUuZGlzcGxheSA9IFwiXCJcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5yb290LnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIlxuXHRcdFx0aWYodGhpcy5zdHJhdGVneS5pc1J1bm5pbmcoKSkge1xuXHRcdFx0XHR0aGlzLnN0cmF0ZWd5LnN0b3AoKVxuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge1VJfSB1aVxuXHQgKiBAcGFyYW0ge0V2ZW50fSBldmVudFxuXHQgKi9cblx0I29uVW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b25DbGljaygpIHtcblx0XHRpZih0aGlzLnN0cmF0ZWd5LmlzUnVubmluZygpKSB7XG5cdFx0XHRjb25zb2xlLmRlYnVnKFwiVXNlciBhc2tlZCBmb3IgbWVzc2FnZXMgdW5zZW5kaW5nIHRvIHN0b3BcIilcblx0XHRcdHRoaXMuc3RyYXRlZ3kuc3RvcCgpXG5cdFx0XHR0aGlzLiNvblVuc2VuZGluZ0ZpbmlzaGVkKClcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy4jc3RhcnRVbnNlbmRpbmcoKVxuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge0V2ZW50fSBldmVudFxuXHQgKiBAcmV0dXJucyB7Ym9vbGVhbn1cblx0ICovXG5cdCNvbldpbmRvd0tleUV2ZW50KGV2ZW50KSB7XG5cdFx0aWYodGhpcy5zdHJhdGVneS5pc1J1bm5pbmcoKSkge1xuXHRcdFx0Y29uc29sZS5sb2coXCJVc2VyIGludGVyYWN0aW9uIGlzIGRpc2FibGVkIGFzIHRoZSB1bnNlbmRpbmcgaXMgc3RpbGwgcnVubmluZzsgUGxlYXNlIHN0b3AgdGhlIGV4ZWN1dGlvbiBmaXJzdC5cIilcblx0XHRcdGV2ZW50LnN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbigpXG5cdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpXG5cdFx0XHRldmVudC5zdG9wUHJvcGFnYXRpb24oKVxuXHRcdFx0dGhpcy5vdmVybGF5RWxlbWVudC5mb2N1cygpXG5cdFx0XHRyZXR1cm4gZmFsc2Vcblx0XHR9XG5cdH1cblxuXHQjb25VbnNlbmRpbmdGaW5pc2hlZCgpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwicmVuZGVyIG9uVW5zZW5kaW5nRmluaXNoZWRcIilcblx0XHQ7Wy4uLnRoaXMubWVudUVsZW1lbnQucXVlcnlTZWxlY3RvckFsbChcImJ1dHRvblwiKV0uZmlsdGVyKGJ1dHRvbiA9PiBidXR0b24gIT09IHRoaXMudW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24pLmZvckVhY2goYnV0dG9uID0+IHtcblx0XHRcdGJ1dHRvbi5zdHlsZS52aXNpYmlsaXR5ID0gXCJcIlxuXHRcdFx0YnV0dG9uLmRpc2FibGVkID0gZmFsc2Vcblx0XHR9KVxuXHRcdHRoaXMudW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24udGV4dENvbnRlbnQgPSB0aGlzLnVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uLmRhdGFUZXh0Q29udGVudFxuXHRcdHRoaXMudW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24uc3R5bGUuYmFja2dyb3VuZENvbG9yID0gdGhpcy51bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbi5kYXRhQmFja2dyb3VuZENvbG9yXG5cdFx0dGhpcy5vdmVybGF5RWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCJcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gdGV4dFxuXHQgKi9cblx0b25TdGF0dXNUZXh0KHRleHQpIHtcblx0XHR0aGlzLnN0YXR1c0VsZW1lbnQudGV4dENvbnRlbnQgPSB0ZXh0XG5cdH1cblxuXG5cblx0LyoqXG5cdCAqIEByZWFkb25seVxuXHQgKiBAdHlwZSB7RG9jdW1lbnR9XG5cdCAqL1xuXHRnZXQgZG9jdW1lbnQoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX2RvY3VtZW50XG5cdH1cblxuXHQvKipcblx0ICogQHJlYWRvbmx5XG5cdCAqIEB0eXBlIHtXaW5kb3d9XG5cdCAqL1xuXHRnZXQgd2luZG93KCkge1xuXHRcdHJldHVybiB0aGlzLl9kb2N1bWVudC5kZWZhdWx0Vmlld1xuXHR9XG5cblx0LyoqXG5cdCAqIEByZWFkb25seVxuXHQgKiBAdHlwZSB7SFRNTERpdkVsZW1lbnR9XG5cdCAqL1xuXHRnZXQgcm9vdCgpIHtcblx0XHRyZXR1cm4gdGhpcy5fcm9vdFxuXHR9XG5cblx0LyoqXG5cdCAqIEByZWFkb25seVxuXHQgKiBAdHlwZSB7SFRNTERpdkVsZW1lbnR9XG5cdCAqL1xuXHRnZXQgb3ZlcmxheUVsZW1lbnQoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX292ZXJsYXlFbGVtZW50XG5cdH1cblxuXHQvKipcblx0ICogQHJlYWRvbmx5XG5cdCAqIEB0eXBlIHtIVE1MRGl2RWxlbWVudH1cblx0ICovXG5cdGdldCBtZW51RWxlbWVudCgpIHtcblx0XHRyZXR1cm4gdGhpcy5fbWVudUVsZW1lbnRcblx0fVxuXG5cdC8qKlxuXHQgKiBAcmVhZG9ubHlcblx0ICogQHR5cGUge0hUTUxCdXR0b25FbGVtZW50fVxuXHQgKi9cblx0Z2V0IHVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uKCkge1xuXHRcdHJldHVybiB0aGlzLl91bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvblxuXHR9XG5cblx0LyoqXG5cdCAqIEByZWFkb25seVxuXHQgKiBAdHlwZSB7SFRNTERpdkVsZW1lbnR9XG5cdCAqL1xuXHRnZXQgc3RhdHVzRWxlbWVudCgpIHtcblx0XHRyZXR1cm4gdGhpcy5fc3RhdHVzRWxlbWVudFxuXHR9XG5cblx0LyoqXG5cdCAqIEByZWFkb25seVxuXHQgKiBAdHlwZSB7SFRNTEJ1dHRvbkVsZW1lbnR9XG5cdCAqL1xuXHRnZXQgbG9hZFRocmVhZE1lc3NhZ2VzQnV0dG9uKCkge1xuXHRcdHJldHVybiB0aGlzLl9sb2FkVGhyZWFkTWVzc2FnZXNCdXR0b25cblx0fVxuXG5cdC8qKlxuXHQgKiBAcmVhZG9ubHlcblx0ICogQHR5cGUge1Vuc2VuZFN0cmF0ZWd5fVxuXHQgKi9cblx0Z2V0IHN0cmF0ZWd5KCkge1xuXHRcdHJldHVybiB0aGlzLl9zdHJhdGVneVxuXHR9XG5cblx0LyoqXG5cdCAqIEByZWFkb25seVxuXHQgKiBAdHlwZSB7SURNVX1cblx0ICovXG5cdGdldCBpZG11KCkge1xuXHRcdHJldHVybiB0aGlzLl9pZG11XG5cdH1cblxufVxuXG5leHBvcnQgZGVmYXVsdCBVSVxuIiwiLyoqIEBtb2R1bGUgbWFpbiBNYWluIG1vZHVsZSAqL1xuXG5pbXBvcnQgVUkgZnJvbSBcIi4vdWkvdWkuanNcIlxuXG4vKipcbiAqIEBwYXJhbSB7V2luZG93fSB3aW5kb3dcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG1haW4od2luZG93KSB7XG5cdFVJLnJlbmRlcih3aW5kb3cpXG59XG5cbmlmKHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIpIHtcblx0bWFpbih3aW5kb3cpXG59XG4iXSwibmFtZXMiOlsiVUkiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Q0FBQTtBQUNBO0NBQ08sTUFBTSxZQUFZLEdBQUc7Q0FDNUIsQ0FBQyxTQUFTLEVBQUUsU0FBUztDQUNyQixDQUFDLFdBQVcsRUFBRSxXQUFXO0NBQ3pCLEVBQUM7QUFDRDtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FD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
