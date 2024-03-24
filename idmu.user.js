
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
// @version				0.5.19
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
				continue
			}
			const isInView = element.getBoundingClientRect().y > 100;
			if(isInView === false) {
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
			for(let i = startScrollTop;i > 0;i = i - 30 ) {
				if(abortController.signal.aborted) {
					break
				}
				this.lastScrollTop = i;
				uiMessagesWrapperRoot.scrollTop = i;
				uiMessagesWrapperRoot.dispatchEvent(new this.root.Event("scroll"));
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaWRtdS51c2VyLmpzIiwic291cmNlcyI6WyIuLi9zcmMvcnVudGltZS91c2Vyc2NyaXB0L3VpL3N0eWxlL2luc3RhZ3JhbS5qcyIsIi4uL3NyYy9ydW50aW1lL3VzZXJzY3JpcHQvdWkvbWVudS1idXR0b24uanMiLCIuLi9zcmMvcnVudGltZS91c2Vyc2NyaXB0L3VpL21lbnUuanMiLCIuLi9zcmMvZG9tL2FzeW5jLWV2ZW50cy5qcyIsIi4uL3NyYy91aS91aS1jb21wb25lbnQuanMiLCIuLi9zcmMvdWkvZGVmYXVsdC91aS1tZXNzYWdlLmpzIiwiLi4vc3JjL3VpcGkvdWlwaS1tZXNzYWdlLmpzIiwiLi4vc3JjL3VpL3VpLmpzIiwiLi4vc3JjL3VpL2RlZmF1bHQvZG9tLWxvb2t1cC5qcyIsIi4uL3NyYy91aS9kZWZhdWx0L3VpLW1lc3NhZ2VzLXdyYXBwZXIuanMiLCIuLi9zcmMvdWkvZGVmYXVsdC9kZWZhdWx0LXVpLmpzIiwiLi4vc3JjL3VpL2dldC11aS5qcyIsIi4uL3NyYy91aXBpL3VpcGkuanMiLCIuLi9zcmMvaWRtdS9pZG11LmpzIiwiLi4vc3JjL3VpL3Vuc2VuZC1zdHJhdGVneS5qcyIsIi4uL3NyYy91aS9kZWZhdWx0L3Vuc2VuZC1zdHJhdGVneS5qcyIsIi4uL3NyYy9ydW50aW1lL3VzZXJzY3JpcHQvdWkvYWxlcnQuanMiLCIuLi9zcmMvcnVudGltZS91c2Vyc2NyaXB0L3VpL292ZXJsYXkuanMiLCIuLi9zcmMvcnVudGltZS91c2Vyc2NyaXB0L3VpL3VpLmpzIiwiLi4vc3JjL3J1bnRpbWUvdXNlcnNjcmlwdC9tYWluLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKiBAbW9kdWxlIGluc3RhZ3JhbSBIZWxwZXJzIHRvIG1pbWljayBJbnN0YWdyYW0ncyBsb29rIGFuZCBmZWVsICovXG5cbmV4cG9ydCBjb25zdCBCVVRUT05fU1RZTEUgPSB7XG5cdFwiUFJJTUFSWVwiOiBcInByaW1hcnlcIixcblx0XCJTRUNPTkRBUllcIjogXCJzZWNvbmRhcnlcIixcbn1cblxuLyoqXG4gKlxuICogQHBhcmFtIHtIVE1MQnV0dG9uRWxlbWVudH0gYnV0dG9uRWxlbWVudFxuICogQHBhcmFtIHtzdHJpbmd9ICAgICAgICAgICAgc3R5bGVOYW1lXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBhcHBseUJ1dHRvblN0eWxlKGJ1dHRvbkVsZW1lbnQsIHN0eWxlTmFtZSkge1xuXHRidXR0b25FbGVtZW50LnN0eWxlLmZvbnRTaXplID0gXCJ2YXIoLS1zeXN0ZW0tMTQtZm9udC1zaXplKVwiXG5cdGJ1dHRvbkVsZW1lbnQuc3R5bGUuY29sb3IgPSBcIndoaXRlXCJcblx0YnV0dG9uRWxlbWVudC5zdHlsZS5ib3JkZXIgPSBcIjBweFwiXG5cdGJ1dHRvbkVsZW1lbnQuc3R5bGUuYm9yZGVyUmFkaXVzID0gXCI4cHhcIlxuXHRidXR0b25FbGVtZW50LnN0eWxlLnBhZGRpbmcgPSBcIjhweFwiXG5cdGJ1dHRvbkVsZW1lbnQuc3R5bGUuZm9udFdlaWdodCA9IFwiYm9sZFwiXG5cdGJ1dHRvbkVsZW1lbnQuc3R5bGUuY3Vyc29yID0gXCJwb2ludGVyXCJcblx0YnV0dG9uRWxlbWVudC5zdHlsZS5saW5lSGVpZ2h0ID0gXCJ2YXIoLS1zeXN0ZW0tMTQtbGluZS1oZWlnaHQpXCJcblx0aWYoc3R5bGVOYW1lKSB7XG5cdFx0YnV0dG9uRWxlbWVudC5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSBgcmdiKHZhcigtLWlnLSR7c3R5bGVOYW1lfS1idXR0b24pKWBcblx0fVxufVxuIiwiLyoqIEBtb2R1bGUgbWVudS1idXR0b24gSGVscGVycyB0byBjcmVhdGUgYnV0dG9ucyB0aGF0IGNhbiBiZSB1c2VkIGluIElETVUncyBtZW51ICovXG5cbmltcG9ydCB7IGFwcGx5QnV0dG9uU3R5bGUgfSBmcm9tIFwiLi9zdHlsZS9pbnN0YWdyYW0uanNcIlxuXG4vKipcbiAqXG4gKiBAcGFyYW0ge0RvY3VtZW50fSBkb2N1bWVudFxuICogQHBhcmFtIHtzdHJpbmd9ICAgdGV4dFxuICogQHBhcmFtIHtzdHJpbmd9ICAgc3R5bGVOYW1lXG4gKiBAcmV0dXJucyB7SFRNTEJ1dHRvbkVsZW1lbnR9XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVNZW51QnV0dG9uRWxlbWVudChkb2N1bWVudCwgdGV4dCwgc3R5bGVOYW1lKSB7XG5cdGNvbnN0IGJ1dHRvbkVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiYnV0dG9uXCIpXG5cdGJ1dHRvbkVsZW1lbnQudGV4dENvbnRlbnQgPSB0ZXh0XG5cdGFwcGx5QnV0dG9uU3R5bGUoYnV0dG9uRWxlbWVudCwgc3R5bGVOYW1lKVxuXHRidXR0b25FbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJtb3VzZW92ZXJcIiwgKCkgPT4ge1xuXHRcdGJ1dHRvbkVsZW1lbnQuc3R5bGUuZmlsdGVyID0gYGJyaWdodG5lc3MoMS4xNSlgXG5cdH0pXG5cdGJ1dHRvbkVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNlb3V0XCIsICgpID0+IHtcblx0XHRidXR0b25FbGVtZW50LnN0eWxlLmZpbHRlciA9IGBgXG5cdH0pXG5cdHJldHVybiBidXR0b25FbGVtZW50XG59XG4iLCIvKiogQG1vZHVsZSBtZW51IElETVUncyBtYWluIG1lbnUgKi9cblxuLyoqXG4gKiBAcGFyYW0ge0RvY3VtZW50fSBkb2N1bWVudFxuICogQHJldHVybnMge0hUTUxCdXR0b25FbGVtZW50fVxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlTWVudUVsZW1lbnQoZG9jdW1lbnQpIHtcblx0Y29uc3QgbWVudUVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpXG5cdG1lbnVFbGVtZW50LmlkID0gXCJpZG11LW1lbnVcIlxuXHRtZW51RWxlbWVudC5zdHlsZS50b3AgPSBcIjIwcHhcIlxuXHRtZW51RWxlbWVudC5zdHlsZS5yaWdodCA9IFwiNDMwcHhcIlxuXHRtZW51RWxlbWVudC5zdHlsZS5wb3NpdGlvbiA9IFwiZml4ZWRcIlxuXHRtZW51RWxlbWVudC5zdHlsZS56SW5kZXggPSA5OTlcblx0bWVudUVsZW1lbnQuc3R5bGUuZGlzcGxheSA9IFwiZmxleFwiXG5cdG1lbnVFbGVtZW50LnN0eWxlLmdhcCA9IFwiMTBweFwiXG5cdG1lbnVFbGVtZW50LnN0eWxlLnBsYWNlSXRlbXMgPSBcImNlbnRlclwiXG5cdHJldHVybiBtZW51RWxlbWVudFxufVxuIiwiLyoqIEBtb2R1bGUgYXN5bmMtZXZlbnRzIFV0aWxzIG1vZHVsZSBmb3IgZmluZGluZyBlbGVtZW50cyBhc3luY2hyb25vdXNseSBpbiB0aGUgRE9NICovXG5cbi8qKlxuICpcbiAqIEBjYWxsYmFjayBnZXRFbGVtZW50XG4gKiBAcmV0dXJucyB7RWxlbWVudH1cbiAqL1xuXG4vKipcbiAqXG4gKiBAcGFyYW0ge0VsZW1lbnR9IHRhcmdldFxuICogQHBhcmFtIHtnZXRFbGVtZW50fSBnZXRFbGVtZW50XG4gKiBAcGFyYW0ge0Fib3J0Q29udHJvbGxlcn0gYWJvcnRDb250cm9sbGVyXG4gKiBAcmV0dXJucyB7UHJvbWlzZTxFbGVtZW50Pn1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHdhaXRGb3JFbGVtZW50KHRhcmdldCwgZ2V0RWxlbWVudCwgYWJvcnRDb250cm9sbGVyKSB7XG5cdHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cdFx0bGV0IG11dGF0aW9uT2JzZXJ2ZXJcblx0XHRjb25zdCBhYm9ydEhhbmRsZXIgPSAoKSA9PiB7XG5cdFx0XHRpZihtdXRhdGlvbk9ic2VydmVyKSB7XG5cdFx0XHRcdHJlamVjdChuZXcgRE9NRXhjZXB0aW9uKFwiQWJvcnRlZDogRGlzY29ubmVjdGluZyBtdXRhdGlvbiBvYnNlcnZlci4uLlwiLCBcIkFib3J0RXJyb3JcIikpXG5cdFx0XHRcdG11dGF0aW9uT2JzZXJ2ZXIuZGlzY29ubmVjdCgpXG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZWplY3QobmV3IERPTUV4Y2VwdGlvbihcIkFib3J0ZWRcIiwgXCJBYm9ydEVycm9yXCIpKVxuXHRcdFx0fVxuXHRcdH1cblx0XHRhYm9ydENvbnRyb2xsZXIuc2lnbmFsLmFkZEV2ZW50TGlzdGVuZXIoXCJhYm9ydFwiLCBhYm9ydEhhbmRsZXIpXG5cdFx0bGV0IGVsZW1lbnQgPSBnZXRFbGVtZW50KClcblx0XHRpZihlbGVtZW50KSB7XG5cdFx0XHRyZXNvbHZlKGVsZW1lbnQpXG5cdFx0XHRhYm9ydENvbnRyb2xsZXIuc2lnbmFsLnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJhYm9ydFwiLCBhYm9ydEhhbmRsZXIpXG5cdFx0fSBlbHNlIHtcblx0XHRcdG11dGF0aW9uT2JzZXJ2ZXIgPSBuZXcgTXV0YXRpb25PYnNlcnZlcigobXV0YXRpb25zLCBvYnNlcnZlcikgPT4ge1xuXHRcdFx0XHRlbGVtZW50ID0gZ2V0RWxlbWVudChtdXRhdGlvbnMpXG5cdFx0XHRcdGlmKGVsZW1lbnQpIHtcblx0XHRcdFx0XHRvYnNlcnZlci5kaXNjb25uZWN0KClcblx0XHRcdFx0XHRyZXNvbHZlKGVsZW1lbnQpXG5cdFx0XHRcdFx0YWJvcnRDb250cm9sbGVyLnNpZ25hbC5yZW1vdmVFdmVudExpc3RlbmVyKFwiYWJvcnRcIiwgYWJvcnRIYW5kbGVyKVxuXHRcdFx0XHR9XG5cdFx0XHR9KVxuXHRcdFx0bXV0YXRpb25PYnNlcnZlci5vYnNlcnZlKHRhcmdldCwgeyBzdWJ0cmVlOiB0cnVlLCBjaGlsZExpc3Q6dHJ1ZSB9KVxuXHRcdH1cblx0fSlcbn1cblxuLyoqXG4gKlxuICogQHBhcmFtIHtFbGVtZW50fSBjbGlja1RhcmdldFxuICogQHBhcmFtIHtFbGVtZW50fSB0YXJnZXRcbiAqIEBwYXJhbSB7Z2V0RWxlbWVudH0gZ2V0RWxlbWVudFxuICogQHBhcmFtIHtBYm9ydENvbnRyb2xsZXJ9IGFib3J0Q29udHJvbGxlclxuICogQHJldHVybnMge0VsZW1lbnR8UHJvbWlzZTxFbGVtZW50Pn1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNsaWNrRWxlbWVudEFuZFdhaXRGb3IoY2xpY2tUYXJnZXQsIHRhcmdldCwgZ2V0RWxlbWVudCwgYWJvcnRDb250cm9sbGVyKSB7XG5cdGNvbnN0IHByb21pc2UgPSB3YWl0Rm9yRWxlbWVudCh0YXJnZXQsIGdldEVsZW1lbnQsIGFib3J0Q29udHJvbGxlcilcblx0Y2xpY2tUYXJnZXQuY2xpY2soKVxuXHRyZXR1cm4gZ2V0RWxlbWVudCgpIHx8IHByb21pc2Vcbn1cbiIsIi8qKiBAbW9kdWxlIHVpLWNvbXBvbmVudCBCYXNlIGNsYXNzIGZvciBhbnkgZWxlbWVudCB0aGF0IGlzIGEgcGFydCBvZiB0aGUgVUkuICovXG5cbmltcG9ydCB7IHdhaXRGb3JFbGVtZW50LCBjbGlja0VsZW1lbnRBbmRXYWl0Rm9yIH0gZnJvbSBcIi4uL2RvbS9hc3luYy1ldmVudHMuanNcIlxuXG5leHBvcnQgY2xhc3MgVUlDb21wb25lbnQge1xuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHtFbGVtZW50fSByb290XG5cdCAqIEBwYXJhbSB7b2JqZWN0fSBpZGVudGlmaWVyXG5cdCAqL1xuXHRjb25zdHJ1Y3Rvcihyb290LCBpZGVudGlmaWVyPXt9KSB7XG5cdFx0dGhpcy5yb290ID0gcm9vdFxuXHRcdHRoaXMuaWRlbnRpZmllciA9IGlkZW50aWZpZXJcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge0VsZW1lbnR9IHRhcmdldFxuXHQgKiBAcGFyYW0ge2Z1bmN0aW9ufSBnZXRFbGVtZW50XG5cdCAqIEBwYXJhbSB7QWJvcnRDb250cm9sbGVyfSBhYm9ydENvbnRyb2xsZXJcblx0ICogQHJldHVybnMge1Byb21pc2U8RWxlbWVudD59XG5cdCAqL1xuXHR3YWl0Rm9yRWxlbWVudCh0YXJnZXQsIGdldEVsZW1lbnQsIGFib3J0Q29udHJvbGxlcikge1xuXHRcdHJldHVybiBnZXRFbGVtZW50KCkgfHwgd2FpdEZvckVsZW1lbnQodGFyZ2V0LCBnZXRFbGVtZW50LCBhYm9ydENvbnRyb2xsZXIpXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHtFbGVtZW50fSBjbGlja1RhcmdldFxuXHQgKiBAcGFyYW0ge0VsZW1lbnR9IHRhcmdldFxuXHQgKiBAcGFyYW0ge2Z1bmN0aW9ufSBnZXRFbGVtZW50XG5cdCAqIEBwYXJhbSB7QWJvcnRDb250cm9sbGVyfSBhYm9ydENvbnRyb2xsZXJcblx0ICogQHJldHVybnMge1Byb21pc2U8RWxlbWVudD59XG5cdCAqL1xuXHRjbGlja0VsZW1lbnRBbmRXYWl0Rm9yKGNsaWNrVGFyZ2V0LCB0YXJnZXQsIGdldEVsZW1lbnQsIGFib3J0Q29udHJvbGxlcikge1xuXHRcdHJldHVybiBjbGlja0VsZW1lbnRBbmRXYWl0Rm9yKGNsaWNrVGFyZ2V0LCB0YXJnZXQsIGdldEVsZW1lbnQsIGFib3J0Q29udHJvbGxlcilcblx0fVxuXG59XG5cbmV4cG9ydCBkZWZhdWx0IFVJQ29tcG9uZW50XG4iLCIvKiogQG1vZHVsZSB1aS1tZXNzYWdlIFVJIGVsZW1lbnQgcmVwcmVzZW50aW5nIGEgbWVzc2FnZSAqL1xuXG5pbXBvcnQgVUlDb21wb25lbnQgZnJvbSBcIi4uL3VpLWNvbXBvbmVudC5qc1wiXG5cbmNsYXNzIFVJTWVzc2FnZSBleHRlbmRzIFVJQ29tcG9uZW50IHtcblxuXHQvKipcblx0ICogQHBhcmFtIHtBYm9ydENvbnRyb2xsZXJ9IGFib3J0Q29udHJvbGxlclxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZTxIVE1MQnV0dG9uRWxlbWVudD59XG5cdCAqL1xuXHRhc3luYyBzaG93QWN0aW9uc01lbnVCdXR0b24oYWJvcnRDb250cm9sbGVyKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIldvcmtmbG93IHN0ZXAgMSA6IHNob3dBY3Rpb25zTWVudUJ1dHRvblwiLCB0aGlzLnJvb3QpXG5cdFx0dGhpcy5yb290LmRpc3BhdGNoRXZlbnQobmV3IE1vdXNlRXZlbnQoXCJtb3VzZW1vdmVcIiwgeyBidWJibGVzOiB0cnVlIH0pKVxuXHRcdHRoaXMucm9vdC5kaXNwYXRjaEV2ZW50KG5ldyBNb3VzZUV2ZW50KFwibW91c2VvdmVyXCIsIHsgYnViYmxlczogdHJ1ZSB9KSlcblx0XHR0aGlzLnJvb3QuZGlzcGF0Y2hFdmVudChuZXcgTW91c2VFdmVudChcIm1vdXNlbnRlclwiLCB7IGJ1YmJsZXM6IHRydWUgfSkpXG5cdFx0Y29uc3Qgd2FpdEFib3J0Q29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKVxuXHRcdGxldCBwcm9taXNlVGltZW91dFxuXHRcdGxldCByZXNvbHZlVGltZW91dFxuXHRcdGNvbnN0IGFib3J0SGFuZGxlciA9ICgpID0+IHtcblx0XHRcdHdhaXRBYm9ydENvbnRyb2xsZXIuYWJvcnQoKVxuXHRcdFx0Y2xlYXJUaW1lb3V0KHByb21pc2VUaW1lb3V0KVxuXHRcdFx0aWYocmVzb2x2ZVRpbWVvdXQpIHtcblx0XHRcdFx0cmVzb2x2ZVRpbWVvdXQoKVxuXHRcdFx0fVxuXHRcdH1cblx0XHRhYm9ydENvbnRyb2xsZXIuc2lnbmFsLmFkZEV2ZW50TGlzdGVuZXIoXCJhYm9ydFwiLCBhYm9ydEhhbmRsZXIpXG5cdFx0Y29uc3QgYWN0aW9uQnV0dG9uID0gYXdhaXQgUHJvbWlzZS5yYWNlKFtcblx0XHRcdHRoaXMud2FpdEZvckVsZW1lbnQodGhpcy5yb290LCAoKSA9PiB0aGlzLnJvb3QucXVlcnlTZWxlY3RvcihcIlthcmlhLWxhYmVsPU1vcmVdXCIpPy5wYXJlbnROb2RlLCB3YWl0QWJvcnRDb250cm9sbGVyKSxcblx0XHRcdG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcblx0XHRcdFx0cHJvbWlzZVRpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHJlamVjdChcIlRpbWVvdXQgc2hvd0FjdGlvbnNNZW51QnV0dG9uXCIpLCAyMDApXG5cdFx0XHR9KVxuXHRcdF0pXG5cdFx0d2FpdEFib3J0Q29udHJvbGxlci5hYm9ydCgpXG5cdFx0Y2xlYXJUaW1lb3V0KHByb21pc2VUaW1lb3V0KVxuXHRcdHJldHVybiBhY3Rpb25CdXR0b25cblx0fVxuXG5cdC8qKlxuXHQgKiBAcGFyYW0ge0Fib3J0Q29udHJvbGxlcn0gYWJvcnRDb250cm9sbGVyXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlPGJvb2xlYW4+fVxuXHQgKi9cblx0YXN5bmMgaGlkZUFjdGlvbk1lbnVCdXR0b24oYWJvcnRDb250cm9sbGVyKSB7IC8vIEZJWE1FXG5cdFx0Y29uc29sZS5kZWJ1ZyhcImhpZGVBY3Rpb25NZW51QnV0dG9uXCIsIHRoaXMucm9vdClcblx0XHR0aGlzLnJvb3QuZGlzcGF0Y2hFdmVudChuZXcgTW91c2VFdmVudChcIm1vdXNlbW92ZVwiLCB7IGJ1YmJsZXM6IHRydWUgfSkpXG5cdFx0dGhpcy5yb290LmRpc3BhdGNoRXZlbnQobmV3IE1vdXNlRXZlbnQoXCJtb3VzZW91dFwiLCB7IGJ1YmJsZXM6IHRydWUgfSkpXG5cdFx0dGhpcy5yb290LmRpc3BhdGNoRXZlbnQobmV3IE1vdXNlRXZlbnQoXCJtb3VzZWxlYXZlXCIsIHsgYnViYmxlczogdHJ1ZSB9KSlcblx0XHRjb25zdCB3YWl0QWJvcnRDb250cm9sbGVyID0gbmV3IEFib3J0Q29udHJvbGxlcigpXG5cdFx0bGV0IHByb21pc2VUaW1lb3V0XG5cdFx0bGV0IHJlc29sdmVUaW1lb3V0XG5cdFx0Y29uc3QgYWJvcnRIYW5kbGVyID0gKCkgPT4ge1xuXHRcdFx0d2FpdEFib3J0Q29udHJvbGxlci5hYm9ydCgpXG5cdFx0XHRjbGVhclRpbWVvdXQocHJvbWlzZVRpbWVvdXQpXG5cdFx0XHRpZihyZXNvbHZlVGltZW91dCkge1xuXHRcdFx0XHRyZXNvbHZlVGltZW91dCgpXG5cdFx0XHR9XG5cdFx0fVxuXHRcdGFib3J0Q29udHJvbGxlci5zaWduYWwuYWRkRXZlbnRMaXN0ZW5lcihcImFib3J0XCIsIGFib3J0SGFuZGxlcilcblx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCBQcm9taXNlLnJhY2UoW1xuXHRcdFx0dGhpcy53YWl0Rm9yRWxlbWVudCh0aGlzLnJvb3QsICgpID0+IHRoaXMucm9vdC5xdWVyeVNlbGVjdG9yKFwiW2FyaWEtbGFiZWw9TW9yZV1cIikgPT09IG51bGwsIHdhaXRBYm9ydENvbnRyb2xsZXIpLFxuXHRcdFx0bmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuXHRcdFx0XHRyZXNvbHZlVGltZW91dCA9IHJlc29sdmVcblx0XHRcdFx0cHJvbWlzZVRpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHJlamVjdChcIlRpbWVvdXQgaGlkZUFjdGlvbk1lbnVCdXR0b25cIiksIDIwMClcblx0XHRcdH0pXG5cdFx0XSlcblx0XHR3YWl0QWJvcnRDb250cm9sbGVyLmFib3J0KClcblx0XHRjbGVhclRpbWVvdXQocHJvbWlzZVRpbWVvdXQpXG5cdFx0cmV0dXJuIHJlc3VsdFxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7SFRNTEJ1dHRvbkVsZW1lbnR9IGFjdGlvbkJ1dHRvblxuXHQgKiBAcGFyYW0ge0Fib3J0Q29udHJvbGxlcn0gYWJvcnRDb250cm9sbGVyXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlfVxuXHQgKi9cblx0YXN5bmMgb3BlbkFjdGlvbnNNZW51KGFjdGlvbkJ1dHRvbiwgYWJvcnRDb250cm9sbGVyKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIldvcmtmbG93IHN0ZXAgMiA6IENsaWNraW5nIGFjdGlvbkJ1dHRvbiBhbmQgd2FpdGluZyBmb3IgdW5zZW5kIG1lbnUgaXRlbSB0byBhcHBlYXJcIiwgYWN0aW9uQnV0dG9uKVxuXHRcdGNvbnN0IHdhaXRBYm9ydENvbnRyb2xsZXIgPSBuZXcgQWJvcnRDb250cm9sbGVyKClcblx0XHRsZXQgcHJvbWlzZVRpbWVvdXRcblx0XHRsZXQgcmVzb2x2ZVRpbWVvdXRcblx0XHRjb25zdCBhYm9ydEhhbmRsZXIgPSAoKSA9PiB7XG5cdFx0XHR3YWl0QWJvcnRDb250cm9sbGVyLmFib3J0KClcblx0XHRcdGNsZWFyVGltZW91dChwcm9taXNlVGltZW91dClcblx0XHRcdGlmKHJlc29sdmVUaW1lb3V0KSB7XG5cdFx0XHRcdHJlc29sdmVUaW1lb3V0KClcblx0XHRcdH1cblx0XHR9XG5cdFx0YWJvcnRDb250cm9sbGVyLnNpZ25hbC5hZGRFdmVudExpc3RlbmVyKFwiYWJvcnRcIiwgYWJvcnRIYW5kbGVyKVxuXHRcdGNvbnN0IHVuc2VuZEJ1dHRvbiA9IGF3YWl0IFByb21pc2UucmFjZShbXG5cdFx0XHR0aGlzLmNsaWNrRWxlbWVudEFuZFdhaXRGb3IoXG5cdFx0XHRcdGFjdGlvbkJ1dHRvbixcblx0XHRcdFx0dGhpcy5yb290Lm93bmVyRG9jdW1lbnQuYm9keSxcblx0XHRcdFx0KG11dGF0aW9ucykgPT4ge1xuXHRcdFx0XHRcdGlmKG11dGF0aW9ucykge1xuXHRcdFx0XHRcdFx0Y29uc3QgYWRkZWROb2RlcyA9IFsgLi4ubXV0YXRpb25zLm1hcChtdXRhdGlvbiA9PiBbLi4ubXV0YXRpb24uYWRkZWROb2Rlc10pIF0uZmxhdCgpLmZpbHRlcihub2RlID0+IG5vZGUubm9kZVR5cGUgPT09IDEpXG5cdFx0XHRcdFx0XHRjb25zb2xlLmRlYnVnKFwiV29ya2Zsb3cgc3RlcCAyIDogXCIsIGFkZGVkTm9kZXMsIGFkZGVkTm9kZXMuZmluZChub2RlID0+IG5vZGUudGV4dENvbnRlbnQudHJpbSgpLnRvTG9jYWxlTG93ZXJDYXNlKCkgPT09IFwidW5zZW5kXCIpKVxuXHRcdFx0XHRcdFx0Zm9yKGNvbnN0IGFkZGVkTm9kZSBvZiBhZGRlZE5vZGVzKSB7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IG5vZGUgPSBbLi4uYWRkZWROb2RlLnF1ZXJ5U2VsZWN0b3JBbGwoXCJzcGFuLGRpdlwiKV0uZmluZChub2RlID0+IG5vZGUudGV4dENvbnRlbnQudHJpbSgpLnRvTG9jYWxlTG93ZXJDYXNlKCkgPT09IFwidW5zZW5kXCIgJiYgbm9kZS5maXJzdENoaWxkPy5ub2RlVHlwZSA9PT0gMylcblx0XHRcdFx0XHRcdFx0cmV0dXJuIG5vZGVcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0sXG5cdFx0XHRcdHdhaXRBYm9ydENvbnRyb2xsZXJcblx0XHRcdCksXG5cdFx0XHRuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cdFx0XHRcdHByb21pc2VUaW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiByZWplY3QoXCJUaW1lb3V0IG9wZW5BY3Rpb25zTWVudVwiKSwgMjAwKVxuXHRcdFx0fSlcblx0XHRdKVxuXHRcdGNvbnNvbGUuZGVidWcoXCJXb3JrZmxvdyBzdGVwIDIgOiBGb3VuZCB1bnNlbmRCdXR0b25cIiwgdW5zZW5kQnV0dG9uKVxuXHRcdHdhaXRBYm9ydENvbnRyb2xsZXIuYWJvcnQoKVxuXHRcdGNsZWFyVGltZW91dChwcm9taXNlVGltZW91dClcblx0XHRyZXR1cm4gdW5zZW5kQnV0dG9uXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHtIVE1MQnV0dG9uRWxlbWVudH0gYWN0aW9uQnV0dG9uXG5cdCAqIEBwYXJhbSB7SFRNTERpdkVsZW1lbnR9IGFjdGlvbnNNZW51RWxlbWVudFxuXHQgKiBAcGFyYW0ge0Fib3J0Q29udHJvbGxlcn0gYWJvcnRDb250cm9sbGVyXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlPGJvb2xlYW4+fVxuXHQgKi9cblx0YXN5bmMgY2xvc2VBY3Rpb25zTWVudShhY3Rpb25CdXR0b24sIGFjdGlvbnNNZW51RWxlbWVudCwgYWJvcnRDb250cm9sbGVyKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcImNsb3NlQWN0aW9uc01lbnVcIilcblx0XHRjb25zdCB3YWl0QWJvcnRDb250cm9sbGVyID0gbmV3IEFib3J0Q29udHJvbGxlcigpXG5cdFx0bGV0IHByb21pc2VUaW1lb3V0XG5cdFx0bGV0IHJlc29sdmVUaW1lb3V0XG5cdFx0Y29uc3QgYWJvcnRIYW5kbGVyID0gKCkgPT4ge1xuXHRcdFx0d2FpdEFib3J0Q29udHJvbGxlci5hYm9ydCgpXG5cdFx0XHRjbGVhclRpbWVvdXQocHJvbWlzZVRpbWVvdXQpXG5cdFx0XHRpZihyZXNvbHZlVGltZW91dCkge1xuXHRcdFx0XHRyZXNvbHZlVGltZW91dCgpXG5cdFx0XHR9XG5cdFx0fVxuXHRcdGFib3J0Q29udHJvbGxlci5zaWduYWwuYWRkRXZlbnRMaXN0ZW5lcihcImFib3J0XCIsIGFib3J0SGFuZGxlcilcblx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCBQcm9taXNlLnJhY2UoW1xuXHRcdFx0dGhpcy5jbGlja0VsZW1lbnRBbmRXYWl0Rm9yKFxuXHRcdFx0XHRhY3Rpb25CdXR0b24sXG5cdFx0XHRcdHRoaXMucm9vdC5vd25lckRvY3VtZW50LmJvZHksXG5cdFx0XHRcdCgpID0+IHRoaXMucm9vdC5vd25lckRvY3VtZW50LmJvZHkuY29udGFpbnMoYWN0aW9uc01lbnVFbGVtZW50KSA9PT0gZmFsc2UsXG5cdFx0XHRcdGFib3J0Q29udHJvbGxlclxuXHRcdFx0KSxcblx0XHRcdG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcblx0XHRcdFx0cHJvbWlzZVRpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHJlamVjdChcIlRpbWVvdXQgb3BlbkFjdGlvbnNNZW51XCIpLCAyMDApXG5cdFx0XHR9KVxuXHRcdF0pXG5cdFx0d2FpdEFib3J0Q29udHJvbGxlci5hYm9ydCgpXG5cdFx0Y2xlYXJUaW1lb3V0KHByb21pc2VUaW1lb3V0KVxuXHRcdHJldHVybiByZXN1bHQgIT09IG51bGxcblx0fVxuXG5cdC8qKlxuXHQgKiBDbGljayB1bnNlbmQgYnV0dG9uXG5cdCAqIEBwYXJhbSB7SFRNTFNwYW5FbGVtZW50fSB1bnNlbmRCdXR0b25cblx0ICogQHBhcmFtIHtBYm9ydENvbnRyb2xsZXJ9IGFib3J0Q29udHJvbGxlclxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZTxIVE1MQnV0dG9uRWxlbWVudD58UHJvbWlzZTxFcnJvcj59XG5cdCAqL1xuXHRvcGVuQ29uZmlybVVuc2VuZE1vZGFsKHVuc2VuZEJ1dHRvbiwgYWJvcnRDb250cm9sbGVyKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIldvcmtmbG93IHN0ZXAgMyA6IENsaWNraW5nIHVuc2VuZEJ1dHRvbiBhbmQgd2FpdGluZyBmb3IgZGlhbG9nIHRvIGFwcGVhci4uLlwiKVxuXHRcdHJldHVybiB0aGlzLmNsaWNrRWxlbWVudEFuZFdhaXRGb3IoXG5cdFx0XHR1bnNlbmRCdXR0b24sXG5cdFx0XHR0aGlzLnJvb3Qub3duZXJEb2N1bWVudC5ib2R5LFxuXHRcdFx0KCkgPT4gdGhpcy5yb290Lm93bmVyRG9jdW1lbnQucXVlcnlTZWxlY3RvcihcIltyb2xlPWRpYWxvZ10gYnV0dG9uXCIpLFxuXHRcdFx0YWJvcnRDb250cm9sbGVyXG5cdFx0KVxuXHR9XG5cblx0LyoqXG5cdCAqIENsaWNrIHVuc2VuZCBjb25maXJtIGJ1dHRvblxuXHQgKiBAcGFyYW0ge0hUTUxCdXR0b25FbGVtZW50fSBkaWFsb2dCdXR0b25cblx0ICogQHBhcmFtIHtBYm9ydENvbnRyb2xsZXJ9IGFib3J0Q29udHJvbGxlclxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZX1cblx0ICovXG5cdGFzeW5jIGNvbmZpcm1VbnNlbmQoZGlhbG9nQnV0dG9uLCBhYm9ydENvbnRyb2xsZXIpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwiV29ya2Zsb3cgZmluYWwgc3RlcCA6IGNvbmZpcm1VbnNlbmRcIiwgZGlhbG9nQnV0dG9uKVxuXHRcdC8vIHdhaXQgdW50aWwgY29uZmlybSBidXR0b24gaXMgcmVtb3ZlZFxuXHRcdGF3YWl0IHRoaXMuY2xpY2tFbGVtZW50QW5kV2FpdEZvcihcblx0XHRcdGRpYWxvZ0J1dHRvbixcblx0XHRcdHRoaXMucm9vdC5vd25lckRvY3VtZW50LmJvZHksXG5cdFx0XHQoKSA9PiB0aGlzLnJvb3Qub3duZXJEb2N1bWVudC5xdWVyeVNlbGVjdG9yKFwiW3JvbGU9ZGlhbG9nXSBidXR0b25cIikgPT09IG51bGwsXG5cdFx0XHRhYm9ydENvbnRyb2xsZXJcblx0XHQpXG5cdH1cblxufVxuXG5leHBvcnQgZGVmYXVsdCBVSU1lc3NhZ2VcbiIsIi8qKiBAbW9kdWxlIHVpcGktbWVzc2FnZSBBUEkgZm9yIFVJTWVzc2FnZSAqL1xuXG4vLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tdW51c2VkLXZhcnNcbmltcG9ydCBVSU1lc3NhZ2UgZnJvbSBcIi4uL3VpL2RlZmF1bHQvdWktbWVzc2FnZS5qc1wiXG5cbmNsYXNzIEZhaWxlZFdvcmtmbG93RXhjZXB0aW9uIGV4dGVuZHMgRXJyb3Ige31cblxuY2xhc3MgVUlQSU1lc3NhZ2Uge1xuXG5cdC8qKlxuXHQgKiBAcGFyYW0ge1VJTWVzc2FnZX0gdWlNZXNzYWdlXG5cdCAqL1xuXHRjb25zdHJ1Y3Rvcih1aU1lc3NhZ2UpIHtcblx0XHR0aGlzLl91aU1lc3NhZ2UgPSB1aU1lc3NhZ2Vcblx0fVxuXG5cdC8qKlxuXHQgKiBAcGFyYW0ge0Fib3J0Q29udHJvbGxlcn0gYWJvcnRDb250cm9sbGVyXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlPGJvb2xlYW4+fVxuXHQgKi9cblx0YXN5bmMgdW5zZW5kKGFib3J0Q29udHJvbGxlcikgeyAvLyBUT0RPIGFib3J0IFVJUEkgLyB3YWl0Rm9yRWxlbWVudCBldGMuLlxuXHRcdGNvbnNvbGUuZGVidWcoXCJVSVBJTWVzc2FnZSB1bnNlbmRcIilcblx0XHRsZXQgYWN0aW9uQnV0dG9uXG5cdFx0bGV0IHVuc2VuZEJ1dHRvblxuXHRcdHRyeSB7XG5cdFx0XHRhY3Rpb25CdXR0b24gPSBhd2FpdCB0aGlzLnVpTWVzc2FnZS5zaG93QWN0aW9uc01lbnVCdXR0b24oYWJvcnRDb250cm9sbGVyKVxuXHRcdFx0dW5zZW5kQnV0dG9uID0gYXdhaXQgdGhpcy51aU1lc3NhZ2Uub3BlbkFjdGlvbnNNZW51KGFjdGlvbkJ1dHRvbiwgYWJvcnRDb250cm9sbGVyKVxuXHRcdFx0Y29uc29sZS5kZWJ1ZyhcInVuc2VuZEJ1dHRvblwiLCB1bnNlbmRCdXR0b24pXG5cdFx0XHRjb25zdCBkaWFsb2dCdXR0b24gPSBhd2FpdCB0aGlzLnVpTWVzc2FnZS5vcGVuQ29uZmlybVVuc2VuZE1vZGFsKHVuc2VuZEJ1dHRvbiwgYWJvcnRDb250cm9sbGVyKVxuXHRcdFx0YXdhaXQgdGhpcy51aU1lc3NhZ2UuY29uZmlybVVuc2VuZChkaWFsb2dCdXR0b24sIGFib3J0Q29udHJvbGxlcilcblx0XHRcdHRoaXMudWlNZXNzYWdlLnJvb3Quc2V0QXR0cmlidXRlKFwiZGF0YS1pZG11LXVuc2VudFwiLCBcIlwiKVxuXHRcdFx0cmV0dXJuIHRydWVcblx0XHR9IGNhdGNoKGV4KSB7XG5cdFx0XHRjb25zb2xlLmVycm9yKGV4KVxuXHRcdFx0dGhpcy51aU1lc3NhZ2Uucm9vdC5zZXRBdHRyaWJ1dGUoXCJkYXRhLWlkbXUtaWdub3JlXCIsIFwiXCIpXG5cdFx0XHR0aHJvdyBuZXcgRmFpbGVkV29ya2Zsb3dFeGNlcHRpb24oXCJGYWlsZWQgdG8gZXhlY3V0ZSB3b3JrZmxvdyBmb3IgdGhpcyBtZXNzYWdlXCIsIGV4KVxuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBAdHlwZSB7VUlNZXNzYWdlfVxuXHQgKi9cblx0Z2V0IHVpTWVzc2FnZSgpIHtcblx0XHRyZXR1cm4gdGhpcy5fdWlNZXNzYWdlXG5cdH1cblxufVxuZXhwb3J0IHsgRmFpbGVkV29ya2Zsb3dFeGNlcHRpb24gfVxuZXhwb3J0IGRlZmF1bHQgVUlQSU1lc3NhZ2VcbiIsImltcG9ydCBVSUNvbXBvbmVudCBmcm9tIFwiLi91aS1jb21wb25lbnQuanNcIlxuXG4vLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tdW51c2VkLXZhcnNcbmltcG9ydCBVSVBJTWVzc2FnZSBmcm9tIFwiLi4vdWlwaS91aXBpLW1lc3NhZ2UuanNcIlxuXG5jbGFzcyBVSSBleHRlbmRzIFVJQ29tcG9uZW50IHtcblxuXHQvKipcblx0ICpcblx0ICogQGFic3RyYWN0XG5cdCAqIEByZXR1cm5zIHtVSX1cblx0ICovXG5cdHN0YXRpYyBjcmVhdGUoKSB7XG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQGFic3RyYWN0XG5cdCAqIEBwYXJhbSB7QWJvcnRDb250cm9sbGVyfSBhYm9ydENvbnRyb2xsZXJcblx0ICogQHJldHVybnMge1Byb21pc2V9XG5cdCAqL1xuXHRhc3luYyBmZXRjaEFuZFJlbmRlclRocmVhZE5leHRNZXNzYWdlUGFnZShhYm9ydENvbnRyb2xsZXIpIHtcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAYWJzdHJhY3Rcblx0ICogQHJldHVybnMge1Byb21pc2U8VUlQSU1lc3NhZ2U+fVxuXHQgKi9cblx0YXN5bmMgZ2V0TmV4dFVJUElNZXNzYWdlKCkge1xuXHR9XG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgVUlcbiIsIi8qKiBAbW9kdWxlIGRvbS1sb29rdXAgVXRpbHMgbW9kdWxlIGZvciBsb29raW5nIHVwIGVsZW1lbnRzIG9uIHRoZSBkZWZhdWx0IFVJICovXG5cbmltcG9ydCB7IHdhaXRGb3JFbGVtZW50IH0gZnJvbSBcIi4uLy4uL2RvbS9hc3luYy1ldmVudHMuanNcIlxuXG4vKipcbiAqXG4gKiBAcGFyYW0ge0VsZW1lbnR9IHJvb3RcbiAqIEBwYXJhbSB7QWJvcnRDb250cm9sbGVyfSBhYm9ydENvbnRyb2xsZXJcbiAqIEByZXR1cm5zIHtQcm9taXNlPEVsZW1lbnRbXT59XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRGaXJzdFZpc2libGVNZXNzYWdlKHJvb3QsIGFib3J0Q29udHJvbGxlcikge1xuXHRjb25zdCBlbGVtZW50cyA9IFsuLi5yb290LnF1ZXJ5U2VsZWN0b3JBbGwoXCJkaXZbcm9sZT1yb3ddOm5vdChbZGF0YS1pZG11LWlnbm9yZV0pXCIpXVxuXHRlbGVtZW50cy5yZXZlcnNlKClcblx0Zm9yKGNvbnN0IGVsZW1lbnQgb2YgZWxlbWVudHMpIHtcblx0XHRpZihhYm9ydENvbnRyb2xsZXIuc2lnbmFsLmFib3J0ZWQpIHtcblx0XHRcdGJyZWFrXG5cdFx0fVxuXHRcdGNvbnN0IHZpc2liaWxpdHlDaGVjayA9IGVsZW1lbnQuY2hlY2tWaXNpYmlsaXR5KHtcblx0XHRcdHZpc2liaWxpdHlQcm9wZXJ0eTogdHJ1ZSxcblx0XHRcdGNvbnRlbnRWaXNpYmlsaXR5QXV0bzogdHJ1ZSxcblx0XHRcdG9wYWNpdHlQcm9wZXJ0eTogdHJ1ZSxcblx0XHR9KVxuXHRcdGlmKHZpc2liaWxpdHlDaGVjayA9PT0gZmFsc2UpIHtcblx0XHRcdGNvbnRpbnVlXG5cdFx0fVxuXHRcdGNvbnN0IGlzSW5WaWV3ID0gZWxlbWVudC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKS55ID4gMTAwXG5cdFx0aWYoaXNJblZpZXcgPT09IGZhbHNlKSB7XG5cdFx0XHRjb250aW51ZVxuXHRcdH1cblx0XHRlbGVtZW50LnNldEF0dHJpYnV0ZShcImRhdGEtaWRtdS1pZ25vcmVcIiwgXCJcIikgLy8gTmV4dCBpdGVyYXRpb24gc2hvdWxkIG5vdCBpbmNsdWRlIHRoaXMgbWVzc2FnZVxuXHRcdGNvbnNvbGUuZGVidWcoXCJNZXNzYWdlIGluIHZpZXcsIHRlc3Rpbmcgd29ya2Zsb3cuLi5cIiwgZWxlbWVudClcblx0XHRyZXR1cm4gZWxlbWVudFxuXHR9XG59XG5cbi8qKlxuICpcbiAqIEBwYXJhbSB7V2luZG93fSB3aW5kb3dcbiAqIEByZXR1cm5zIHtIVE1MRGl2RWxlbWVudH1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGZpbmRNZXNzYWdlc1dyYXBwZXIod2luZG93KSB7XG5cdHJldHVybiB3aW5kb3cuZG9jdW1lbnQucXVlcnlTZWxlY3RvcihcImRpdltyb2xlPWdyaWRdID4gZGl2ID4gZGl2ID4gZGl2ID4gZGl2XCIpXG59XG5cbi8qKlxuICpcbiAqIEBwYXJhbSB7RWxlbWVudH0gcm9vdFxuICogQHBhcmFtIHtBYm9ydENvbnRyb2xsZXJ9IGFib3J0Q29udHJvbGxlclxuICogQHJldHVybnMge1Byb21pc2U8Ym9vbGVhbj59XG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBsb2FkTW9yZU1lc3NhZ2VzKHJvb3QsIGFib3J0Q29udHJvbGxlcikge1xuXHRjb25zb2xlLmRlYnVnKFwibG9hZE1vcmVNZXNzYWdlcyBsb29raW5nIGZvciBsb2FkZXIuLi4gXCIpXG5cdGxldCBmaW5kTG9hZGVyVGltZW91dFxuXHRsZXQgbG9hZGluZ0VsZW1lbnRcblx0bGV0IHJlc29sdmVUaW1lb3V0XG5cdGNvbnN0IHNjcm9sbEFib3J0Q29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKSAvLyBTZXBhcmF0ZSBhYm9ydENvbnRyb2xsZXIgdG8gc3RvcCBzY3JvbGxpbmcgaWYgd2UgY2FuJ3QgZmluZCB0aGUgbG9hZGVyIGluIDEwc1xuXHRjb25zdCBhYm9ydEhhbmRsZXIgPSAoKSA9PiB7XG5cdFx0c2Nyb2xsQWJvcnRDb250cm9sbGVyLmFib3J0KClcblx0XHRjbGVhclRpbWVvdXQoZmluZExvYWRlclRpbWVvdXQpXG5cdFx0aWYocmVzb2x2ZVRpbWVvdXQpIHtcblx0XHRcdHJlc29sdmVUaW1lb3V0KClcblx0XHR9XG5cdH1cblx0YWJvcnRDb250cm9sbGVyLnNpZ25hbC5hZGRFdmVudExpc3RlbmVyKFwiYWJvcnRcIiwgYWJvcnRIYW5kbGVyKVxuXHRyb290LnNjcm9sbFRvcCA9IDBcblx0dHJ5IHtcblx0XHRsb2FkaW5nRWxlbWVudCA9IGF3YWl0IFByb21pc2UucmFjZShbXG5cdFx0XHR3YWl0Rm9yRWxlbWVudChyb290LCAoKSA9PiB7XG5cdFx0XHRcdGlmKHJvb3QucXVlcnlTZWxlY3RvcihgW3JvbGU9cHJvZ3Jlc3NiYXJdYCkgPT09IG51bGwpIHtcblx0XHRcdFx0XHRyb290LnNjcm9sbFRvcCA9IDBcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gcm9vdC5xdWVyeVNlbGVjdG9yKGBbcm9sZT1wcm9ncmVzc2Jhcl1gKVxuXHRcdFx0fSwgc2Nyb2xsQWJvcnRDb250cm9sbGVyKSxcblx0XHRcdG5ldyBQcm9taXNlKHJlc29sdmUgPT4ge1xuXHRcdFx0XHRyZXNvbHZlVGltZW91dCA9IHJlc29sdmVcblx0XHRcdFx0ZmluZExvYWRlclRpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHsgLy8gVE9ETyBSZXBsYWNlIHdpdGggZmV0Y2ggb3ZlcnJpZGVcblx0XHRcdFx0XHRyZXNvbHZlKClcblx0XHRcdFx0fSwgMTAwMDApIC8vIElETVVfU0NST0xMX0RFVEVDVElPTl9USU1FT1VUXG5cdFx0XHR9KVxuXHRcdF0pXG5cdH0gY2F0Y2goZXgpIHtcblx0XHRjb25zb2xlLmVycm9yKGV4KVxuXHR9XG5cdHNjcm9sbEFib3J0Q29udHJvbGxlci5hYm9ydCgpIC8vIElmIGl0IHRvb2sgbW9yZSB0aGFuIDEwcyBzdG9wIHNjcm9sbGluZ1xuXHRhYm9ydENvbnRyb2xsZXIuc2lnbmFsLnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJhYm9ydFwiLCBhYm9ydEhhbmRsZXIpXG5cdGNsZWFyVGltZW91dChmaW5kTG9hZGVyVGltZW91dClcblx0aWYobG9hZGluZ0VsZW1lbnQgJiYgbG9hZGluZ0VsZW1lbnQgIT09IHRydWUpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwibG9hZE1vcmVNZXNzYWdlczogRm91bmQgbG9hZGVyOyBTdGFuZC1ieSB1bnRpbCBpdCBpcyByZW1vdmVkXCIpXG5cdFx0Y29uc29sZS5kZWJ1ZyhcImxvYWRNb3JlTWVzc2FnZXM6IHNjcm9sbFRvcFwiLCByb290LnNjcm9sbFRvcClcblx0XHRhd2FpdCB3YWl0Rm9yRWxlbWVudChyb290LCAoKSA9PiByb290LnF1ZXJ5U2VsZWN0b3IoYFtyb2xlPXByb2dyZXNzYmFyXWApID09PSBudWxsLCBhYm9ydENvbnRyb2xsZXIpXG5cdH1cblx0Y29uc29sZS5kZWJ1ZyhcImxvYWRNb3JlTWVzc2FnZXM6IExvYWRlciB3YXMgcmVtb3ZlZCwgb2xkZXIgbWVzc2FnZXMgbG9hZGluZyBjb21wbGV0ZWRcIilcblx0Y29uc29sZS5kZWJ1ZyhgbG9hZE1vcmVNZXNzYWdlczogc2Nyb2xsVG9wIGlzICR7cm9vdC5zY3JvbGxUb3B9IHdlICR7cm9vdC5zY3JvbGxUb3AgPT09IDAgPyBcInJlYWNoZWQgbGFzdCBwYWdlXCIgOiBcImRpZCBub3QgcmVhY2ggbGFzdCBwYWdlIGFuZCB3aWxsIGJlZ2luIGxvYWRpbmcgb2xkZXIgbWVzc2FnZXMgc2hvcnRseVwifWAsIClcblx0cmV0dXJuIHJvb3Quc2Nyb2xsVG9wID09PSAwXG59XG4iLCIvKiogQG1vZHVsZSB1aS1tZXNzYWdlcy13cmFwcGVyIFVJIGVsZW1lbnQgcmVwcmVzZW50aW5nIHRoZSBtZXNzYWdlcyB3cmFwcGVyICovXG5cbmltcG9ydCB7IGxvYWRNb3JlTWVzc2FnZXMgfSBmcm9tIFwiLi9kb20tbG9va3VwLmpzXCJcbmltcG9ydCBVSUNvbXBvbmVudCBmcm9tIFwiLi4vdWktY29tcG9uZW50LmpzXCJcblxuY2xhc3MgVUlNZXNzYWdlc1dyYXBwZXIgZXh0ZW5kcyBVSUNvbXBvbmVudCB7XG5cblx0LyoqXG5cdCAqIEBwYXJhbSB7QWJvcnRDb250cm9sbGVyfSBhYm9ydENvbnRyb2xsZXJcblx0ICogQHJldHVybnMge1Byb21pc2V9XG5cdCAqL1xuXHRmZXRjaEFuZFJlbmRlclRocmVhZE5leHRNZXNzYWdlUGFnZShhYm9ydENvbnRyb2xsZXIpIHtcblx0XHRyZXR1cm4gbG9hZE1vcmVNZXNzYWdlcyh0aGlzLnJvb3QsIGFib3J0Q29udHJvbGxlcilcblx0fVxuXG59XG5cbmV4cG9ydCBkZWZhdWx0IFVJTWVzc2FnZXNXcmFwcGVyXG4iLCIvKiogQG1vZHVsZSBkZWZhdWx0LXVpIERlZmF1bHQgVUkgLyBFbmdsaXNoIFVJICovXG5cbmltcG9ydCBVSSBmcm9tIFwiLi4vdWkuanNcIlxuaW1wb3J0IHsgZmluZE1lc3NhZ2VzV3JhcHBlciwgZ2V0Rmlyc3RWaXNpYmxlTWVzc2FnZSB9IGZyb20gXCIuL2RvbS1sb29rdXAuanNcIlxuaW1wb3J0IFVJUElNZXNzYWdlIGZyb20gXCIuLi8uLi91aXBpL3VpcGktbWVzc2FnZS5qc1wiXG5pbXBvcnQgVUlNZXNzYWdlIGZyb20gXCIuL3VpLW1lc3NhZ2UuanNcIlxuaW1wb3J0IFVJTWVzc2FnZXNXcmFwcGVyIGZyb20gXCIuL3VpLW1lc3NhZ2VzLXdyYXBwZXIuanNcIlxuXG5jbGFzcyBEZWZhdWx0VUkgZXh0ZW5kcyBVSSB7XG5cblx0Y29uc3RydWN0b3Iocm9vdCwgaWRlbnRpZmllcj17fSkge1xuXHRcdHN1cGVyKHJvb3QsIGlkZW50aWZpZXIpXG5cdFx0dGhpcy5sYXN0U2Nyb2xsVG9wID0gbnVsbFxuXHR9XG5cblx0LyoqXG5cdCAqIEBwYXJhbSB7V2luZG93fSB3aW5kb3dcblx0ICogQHJldHVybnMge0RlZmF1bHRVSX1cblx0ICovXG5cdHN0YXRpYyBjcmVhdGUod2luZG93KSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIlVJIGNyZWF0ZVwiKVxuXHRcdGNvbnN0IG1lc3NhZ2VzV3JhcHBlckVsZW1lbnQgPSBmaW5kTWVzc2FnZXNXcmFwcGVyKHdpbmRvdylcblx0XHRpZihtZXNzYWdlc1dyYXBwZXJFbGVtZW50ICE9PSBudWxsKSB7XG5cdFx0XHRjb25zb2xlLmRlYnVnKFwiRm91bmQgbWVzc2FnZXNXcmFwcGVyRWxlbWVudFwiLCBtZXNzYWdlc1dyYXBwZXJFbGVtZW50KVxuXHRcdFx0Y29uc3QgdWlNZXNzYWdlc1dyYXBwZXIgPSBuZXcgVUlNZXNzYWdlc1dyYXBwZXIobWVzc2FnZXNXcmFwcGVyRWxlbWVudClcblx0XHRcdHJldHVybiBuZXcgRGVmYXVsdFVJKHdpbmRvdywgeyB1aU1lc3NhZ2VzV3JhcHBlciB9KVxuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCJVbmFibGUgdG8gZmluZCBtZXNzYWdlc1dyYXBwZXJFbGVtZW50XCIpXG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCogQHBhcmFtIHtBYm9ydENvbnRyb2xsZXJ9IGFib3J0Q29udHJvbGxlclxuXHQqIEByZXR1cm5zIHtQcm9taXNlfVxuXHQqL1xuXHRhc3luYyBmZXRjaEFuZFJlbmRlclRocmVhZE5leHRNZXNzYWdlUGFnZShhYm9ydENvbnRyb2xsZXIpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwiVUkgZmV0Y2hBbmRSZW5kZXJUaHJlYWROZXh0TWVzc2FnZVBhZ2VcIilcblx0XHRyZXR1cm4gYXdhaXQgdGhpcy5pZGVudGlmaWVyLnVpTWVzc2FnZXNXcmFwcGVyLmZldGNoQW5kUmVuZGVyVGhyZWFkTmV4dE1lc3NhZ2VQYWdlKGFib3J0Q29udHJvbGxlcilcblx0fVxuXG5cdC8qKlxuXHQgKiBAcGFyYW0ge0Fib3J0Q29udHJvbGxlcn0gYWJvcnRDb250cm9sbGVyXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlPFVJUElNZXNzYWdlPn1cblx0ICovXG5cdGFzeW5jIGdldE5leHRVSVBJTWVzc2FnZShhYm9ydENvbnRyb2xsZXIpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwiVUkgZ2V0TmV4dFVJUElNZXNzYWdlXCIsIHRoaXMubGFzdFNjcm9sbFRvcClcblx0XHRjb25zdCB1aU1lc3NhZ2VzV3JhcHBlclJvb3QgPSB0aGlzLmlkZW50aWZpZXIudWlNZXNzYWdlc1dyYXBwZXIucm9vdFxuXHRcdGNvbnN0IHN0YXJ0U2Nyb2xsVG9wID0gdGhpcy5sYXN0U2Nyb2xsVG9wIHx8IHVpTWVzc2FnZXNXcmFwcGVyUm9vdC5zY3JvbGxIZWlnaHQgLSB1aU1lc3NhZ2VzV3JhcHBlclJvb3QuY2xpZW50SGVpZ2h0XG5cdFx0Zm9yKGxldCBpID0gc3RhcnRTY3JvbGxUb3A7aSA+IDA7aSA9IGkgLSAzMCApIHtcblx0XHRcdGlmKGFib3J0Q29udHJvbGxlci5zaWduYWwuYWJvcnRlZCkge1xuXHRcdFx0XHRicmVha1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5sYXN0U2Nyb2xsVG9wID0gaVxuXHRcdFx0dWlNZXNzYWdlc1dyYXBwZXJSb290LnNjcm9sbFRvcCA9IGlcblx0XHRcdHVpTWVzc2FnZXNXcmFwcGVyUm9vdC5kaXNwYXRjaEV2ZW50KG5ldyB0aGlzLnJvb3QuRXZlbnQoXCJzY3JvbGxcIikpXG5cdFx0XHRhd2FpdCBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgMjApKVxuXHRcdFx0dHJ5IHtcblx0XHRcdFx0Y29uc3QgbWVzc2FnZUVsZW1lbnQgPSBnZXRGaXJzdFZpc2libGVNZXNzYWdlKHVpTWVzc2FnZXNXcmFwcGVyUm9vdCwgYWJvcnRDb250cm9sbGVyKVxuXHRcdFx0XHRpZihtZXNzYWdlRWxlbWVudCkge1xuXHRcdFx0XHRcdGNvbnN0IHVpTWVzc2FnZSA9IG5ldyBVSU1lc3NhZ2UobWVzc2FnZUVsZW1lbnQpXG5cdFx0XHRcdFx0cmV0dXJuIG5ldyBVSVBJTWVzc2FnZSh1aU1lc3NhZ2UpXG5cdFx0XHRcdH1cblx0XHRcdH0gY2F0Y2goZXgpIHtcblx0XHRcdFx0Y29uc29sZS5lcnJvcihleClcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIGZhbHNlIC8vIGVuZCBvZiBzY3JvbGwgcmVhY2hlZFxuXHR9XG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgRGVmYXVsdFVJXG4iLCIvKiogQG1vZHVsZSBnZXQtdWkgVUkgbG9hZGVyIG1vZHVsZS4gQWxsb3cgbG9hZGluZyBvZiBhIGNlcnRhaW4gVUkgYmFzZWQgb24gYSBnaXZlbiBzdHJhdGVneSAobG9jYWxlIGV0Yy4uKVxuICogVGhlcmUgbWlnaHQgYmUgbmVlZCBmb3IgbXVsdGlwbGUgVUkgYXMgSW5zdGFncmFtIG1pZ2h0IHNlcnZlIGRpZmZlcmVudCBhcHBzIGJhc2VkIG9uIGxvY2F0aW9uIGZvciBleGFtcGxlLlxuICogVGhlcmUgaXMgYWxzbyBhIG5lZWQgdG8gaW50ZXJuYXRpb25hbGl6ZSBlYWNoIHVpIHNvIHRoYXQgaXQgZG9lc24ndCBmYWlsIGlmIHdlIGNoYW5nZSB0aGUgbGFuZ3VhZ2UuXG4gKi9cblxuaW1wb3J0IERlZmF1bHRVSSBmcm9tIFwiLi9kZWZhdWx0L2RlZmF1bHQtdWkuanNcIlxuXG4vKipcbiAqXG4gKiBAcmV0dXJucyB7RGVmYXVsdFVJfVxuICovXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBnZXRVSSgpIHtcblx0cmV0dXJuIERlZmF1bHRVSVxufVxuIiwiLyoqIEBtb2R1bGUgdWlwaSBBUEkgZm9yIFVJICovXG5cbmltcG9ydCBnZXRVSSBmcm9tIFwiLi4vdWkvZ2V0LXVpLmpzXCJcblxuLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLXVudXNlZC12YXJzXG5pbXBvcnQgVUkgZnJvbSBcIi4uL3VpL3VpLmpzXCJcbi8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby11bnVzZWQtdmFyc1xuaW1wb3J0IFVJUElNZXNzYWdlIGZyb20gXCIuL3VpcGktbWVzc2FnZS5qc1wiXG5cbi8qKlxuICogVUkgSW50ZXJmYWNlIEFQSVxuICovXG5jbGFzcyBVSVBJIHtcblxuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHtVSX0gdWlcblx0ICovXG5cdGNvbnN0cnVjdG9yKHVpKSB7XG5cdFx0dGhpcy5fdWkgPSB1aVxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7V2luZG93fSB3aW5kb3dcblx0ICogQHJldHVybnMge1VJUEl9XG5cdCAqL1xuXHRzdGF0aWMgY3JlYXRlKHdpbmRvdykge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJVSVBJLmNyZWF0ZVwiKVxuXHRcdGNvbnN0IHVpID0gZ2V0VUkoKS5jcmVhdGUod2luZG93KVxuXHRcdHJldHVybiBuZXcgVUlQSSh1aSlcblx0fVxuXG5cdC8qKlxuXHQgKiBAcGFyYW0ge0Fib3J0Q29udHJvbGxlcn0gYWJvcnRDb250cm9sbGVyXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlfVxuXHQgKi9cblx0ZmV0Y2hBbmRSZW5kZXJUaHJlYWROZXh0TWVzc2FnZVBhZ2UoYWJvcnRDb250cm9sbGVyKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIlVJUEkgZmV0Y2hBbmRSZW5kZXJUaHJlYWROZXh0TWVzc2FnZVBhZ2VcIilcblx0XHRyZXR1cm4gdGhpcy51aS5mZXRjaEFuZFJlbmRlclRocmVhZE5leHRNZXNzYWdlUGFnZShhYm9ydENvbnRyb2xsZXIpXG5cdH1cblxuXHQvKipcblx0ICogQHBhcmFtIHtBYm9ydENvbnRyb2xsZXJ9IGFib3J0Q29udHJvbGxlclxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZTxVSVBJTWVzc2FnZT59XG5cdCAqL1xuXHRnZXROZXh0VUlQSU1lc3NhZ2UoYWJvcnRDb250cm9sbGVyKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIlVJUEkgZ2V0TmV4dFVJUElNZXNzYWdlXCIpXG5cdFx0cmV0dXJuIHRoaXMudWkuZ2V0TmV4dFVJUElNZXNzYWdlKGFib3J0Q29udHJvbGxlcilcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAdHlwZSB7VUl9XG5cdCAqL1xuXHRnZXQgdWkoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX3VpXG5cdH1cblxufVxuXG5leHBvcnQgZGVmYXVsdCBVSVBJXG4iLCIvKiogQG1vZHVsZSBpZG11IEdsb2JhbC9NYWluIEFQSSBmb3IgaW50ZXJhY3Rpbmcgd2l0aCB0aGUgVUkgKi9cblxuaW1wb3J0IFVJUEkgZnJvbSBcIi4uL3VpcGkvdWlwaS5qc1wiXG5cbi8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby11bnVzZWQtdmFyc1xuaW1wb3J0IFVJUElNZXNzYWdlIGZyb20gXCIuLi91aXBpL3VpcGktbWVzc2FnZS5qc1wiXG5cbmNsYXNzIElETVUge1xuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge1dpbmRvd30gd2luZG93XG5cdCAqIEBwYXJhbSB7Y2FsbGJhY2t9IG9uU3RhdHVzVGV4dFxuXHQgKi9cblx0Y29uc3RydWN0b3Iod2luZG93LCBvblN0YXR1c1RleHQpIHtcblx0XHR0aGlzLndpbmRvdyA9IHdpbmRvd1xuXHRcdHRoaXMudWlwaSA9IG51bGxcblx0XHR0aGlzLm9uU3RhdHVzVGV4dCA9IG9uU3RhdHVzVGV4dFxuXHR9XG5cblx0LyoqXG5cdCAqIEBwYXJhbSB7QWJvcnRDb250cm9sbGVyfSBhYm9ydENvbnRyb2xsZXJcblx0ICogQHJldHVybnMge1Byb21pc2U8VUlQSU1lc3NhZ2U+fVxuXHQgKi9cblx0Z2V0TmV4dFVJUElNZXNzYWdlKGFib3J0Q29udHJvbGxlcikge1xuXHRcdHJldHVybiB0aGlzLnVpcGkuZ2V0TmV4dFVJUElNZXNzYWdlKGFib3J0Q29udHJvbGxlcilcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gdGV4dFxuXHQgKi9cblx0c2V0U3RhdHVzVGV4dCh0ZXh0KSB7XG5cdFx0dGhpcy5vblN0YXR1c1RleHQodGV4dClcblx0fVxuXG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7QWJvcnRDb250cm9sbGVyfSBhYm9ydENvbnRyb2xsZXJcblx0ICogQHJldHVybnMge1Byb21pc2V9XG5cdCAqL1xuXHRmZXRjaEFuZFJlbmRlclRocmVhZE5leHRNZXNzYWdlUGFnZShhYm9ydENvbnRyb2xsZXIpIHtcblx0XHRyZXR1cm4gdGhpcy51aXBpLmZldGNoQW5kUmVuZGVyVGhyZWFkTmV4dE1lc3NhZ2VQYWdlKGFib3J0Q29udHJvbGxlcilcblx0fVxuXG5cdC8qKlxuXHQgKiBNYXAgSW5zdGFncmFtIFVJXG5cdCAqL1xuXHRsb2FkVUlQSSgpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwibG9hZFVJUElcIilcblx0XHR0aGlzLnVpcGkgPSBVSVBJLmNyZWF0ZSh0aGlzLndpbmRvdylcblx0fVxuXG5cbn1cbmV4cG9ydCBkZWZhdWx0IElETVVcbiIsIi8qKiBAbW9kdWxlIHVuc2VuZC1zdHJhdGVneSBWYXJpb3VzIHN0cmF0ZWdpZXMgZm9yIHVuc2VuZGluZyBtZXNzYWdlcyAqL1xuXG4vLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tdW51c2VkLXZhcnNcbmltcG9ydCBJRE1VIGZyb20gXCIuLi9pZG11L2lkbXUuanNcIlxuXG5jbGFzcyBVbnNlbmRTdHJhdGVneSB7XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7SURNVX0gaWRtdVxuXHQgKi9cblx0Y29uc3RydWN0b3IoaWRtdSkge1xuXHRcdHRoaXMuX2lkbXUgPSBpZG11XG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQGFic3RyYWN0XG5cdCAqIEByZXR1cm5zIHtib29sZWFufVxuXHQgKi9cblx0aXNSdW5uaW5nKCkge1xuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBhYnN0cmFjdFxuXHQgKi9cblx0c3RvcCgpIHtcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAYWJzdHJhY3Rcblx0ICovXG5cdHJlc2V0KCkge1xuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBhYnN0cmFjdFxuXHQgKi9cblx0YXN5bmMgcnVuKCkge1xuXHR9XG5cblx0LyoqXG5cdCAqIEByZWFkb25seVxuXHQgKiBAdHlwZSB7SURNVX1cblx0ICovXG5cdGdldCBpZG11KCkge1xuXHRcdHJldHVybiB0aGlzLl9pZG11XG5cdH1cblxufVxuXG5leHBvcnQgeyBVbnNlbmRTdHJhdGVneSB9XG4iLCIvKiogQG1vZHVsZSB1bnNlbmQtc3RyYXRlZ3kgVmFyaW91cyBzdHJhdGVnaWVzIGZvciB1bnNlbmRpbmcgbWVzc2FnZXMgKi9cblxuLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLXVudXNlZC12YXJzXG5pbXBvcnQgSURNVSBmcm9tIFwiLi4vLi4vaWRtdS9pZG11LmpzXCJcbmltcG9ydCB7IFVuc2VuZFN0cmF0ZWd5IH0gZnJvbSBcIi4uL3Vuc2VuZC1zdHJhdGVneS5qc1wiXG5cbi8qKlxuICogTG9hZHMgbXVsdGlwbGUgcGFnZXMgYmVmb3JlIHVuc2VuZGluZyBtZXNzYWdlXG4gKi9cbmNsYXNzIERlZmF1bHRTdHJhdGVneSBleHRlbmRzIFVuc2VuZFN0cmF0ZWd5IHtcblxuXHQvKipcblx0ICogQHBhcmFtIHtJRE1VfSBpZG11XG5cdCAqL1xuXHRjb25zdHJ1Y3RvcihpZG11KSB7XG5cdFx0c3VwZXIoaWRtdSlcblx0XHR0aGlzLl9hbGxQYWdlc0xvYWRlZCA9IGZhbHNlXG5cdFx0dGhpcy5fdW5zZW50Q291bnQgPSAwXG5cdFx0dGhpcy5fcGFnZXNMb2FkZWRDb3VudCA9IDBcblx0XHR0aGlzLl9ydW5uaW5nID0gZmFsc2Vcblx0XHR0aGlzLl9hYm9ydENvbnRyb2xsZXIgPSBudWxsXG5cdFx0dGhpcy5fbGFzdFVuc2VuZERhdGUgPSBudWxsXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHJldHVybnMge2Jvb2xlYW59XG5cdCAqL1xuXHRpc1J1bm5pbmcoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX3J1bm5pbmcgJiYgdGhpcy5fYWJvcnRDb250cm9sbGVyICYmIHRoaXMuX2Fib3J0Q29udHJvbGxlci5zaWduYWwuYWJvcnRlZCA9PT0gZmFsc2Vcblx0fVxuXG5cdHN0b3AoKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIkRlZmF1bHRTdHJhdGVneSBzdG9wXCIpXG5cdFx0dGhpcy5pZG11LnNldFN0YXR1c1RleHQoXCJTdG9wcGluZy4uLlwiKVxuXHRcdHRoaXMuX2Fib3J0Q29udHJvbGxlci5hYm9ydCgpXG5cdH1cblxuXHRyZXNldCgpIHtcblx0XHR0aGlzLl9hbGxQYWdlc0xvYWRlZCA9IGZhbHNlXG5cdFx0dGhpcy5fdW5zZW50Q291bnQgPSAwXG5cdFx0dGhpcy5fbGFzdFVuc2VuZERhdGUgPSBudWxsXG5cdFx0dGhpcy5fcGFnZXNMb2FkZWRDb3VudCA9IDBcblx0XHR0aGlzLmlkbXUuc2V0U3RhdHVzVGV4dChcIlJlYWR5XCIpXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHJldHVybnMge1Byb21pc2V9XG5cdCAqL1xuXHRhc3luYyBydW4oKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIkRlZmF1bHRTdHJhdGVneS5ydW4oKVwiKVxuXHRcdHRoaXMuX3Vuc2VudENvdW50ID0gMFxuXHRcdHRoaXMuX3BhZ2VzTG9hZGVkQ291bnQgPSAwXG5cdFx0dGhpcy5fcnVubmluZyA9IHRydWVcblx0XHR0aGlzLl9hYm9ydENvbnRyb2xsZXIgPSBuZXcgQWJvcnRDb250cm9sbGVyKClcblx0XHR0aGlzLmlkbXUubG9hZFVJUEkoKVxuXHRcdHRyeSB7XG5cdFx0XHRpZih0aGlzLl9hbGxQYWdlc0xvYWRlZCkge1xuXHRcdFx0XHRhd2FpdCB0aGlzLiN1bnNlbmROZXh0TWVzc2FnZSgpXG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRhd2FpdCB0aGlzLiNsb2FkTmV4dFBhZ2UoKVxuXHRcdFx0fVxuXHRcdFx0aWYodGhpcy5fYWJvcnRDb250cm9sbGVyLnNpZ25hbC5hYm9ydGVkKSB7XG5cdFx0XHRcdHRoaXMuaWRtdS5zZXRTdGF0dXNUZXh0KGBBYm9ydGVkLiAke3RoaXMuX3Vuc2VudENvdW50fSBtZXNzYWdlKHMpIHVuc2VudC5gKVxuXHRcdFx0XHRjb25zb2xlLmRlYnVnKFwiRGVmYXVsdFN0cmF0ZWd5IGFib3J0ZWRcIilcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuaWRtdS5zZXRTdGF0dXNUZXh0KGBEb25lLiAke3RoaXMuX3Vuc2VudENvdW50fSBtZXNzYWdlKHMpIHVuc2VudC5gKVxuXHRcdFx0XHRjb25zb2xlLmRlYnVnKFwiRGVmYXVsdFN0cmF0ZWd5IGRvbmVcIilcblx0XHRcdH1cblx0XHR9IGNhdGNoKGV4KSB7XG5cdFx0XHRjb25zb2xlLmVycm9yKGV4KVxuXHRcdFx0dGhpcy5pZG11LnNldFN0YXR1c1RleHQoYEVycm9yZWQuICR7dGhpcy5fdW5zZW50Q291bnR9IG1lc3NhZ2UocykgdW5zZW50LmApXG5cdFx0XHRjb25zb2xlLmRlYnVnKFwiRGVmYXVsdFN0cmF0ZWd5IGVycm9yZWRcIilcblx0XHR9XG5cdFx0dGhpcy5fcnVubmluZyA9IGZhbHNlXG5cdH1cblxuXHQvKipcblx0ICogVHJpZXMgdG8gbG9hZCB0aGUgdGhyZWFkIG5leHQgcGFnZVxuXHQgKi9cblx0YXN5bmMgI2xvYWROZXh0UGFnZSgpIHtcblx0XHRpZih0aGlzLl9hYm9ydENvbnRyb2xsZXIuc2lnbmFsLmFib3J0ZWQpIHtcblx0XHRcdHJldHVyblxuXHRcdH1cblx0XHR0aGlzLmlkbXUuc2V0U3RhdHVzVGV4dChcIkxvYWRpbmcgbmV4dCBwYWdlLi4uXCIpXG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IGRvbmUgPSBhd2FpdCB0aGlzLmlkbXUuZmV0Y2hBbmRSZW5kZXJUaHJlYWROZXh0TWVzc2FnZVBhZ2UodGhpcy5fYWJvcnRDb250cm9sbGVyKVxuXHRcdFx0aWYodGhpcy5fYWJvcnRDb250cm9sbGVyLnNpZ25hbC5hYm9ydGVkID09PSBmYWxzZSkge1xuXHRcdFx0XHRpZihkb25lKSB7XG5cdFx0XHRcdFx0dGhpcy5pZG11LnNldFN0YXR1c1RleHQoYEFsbCBwYWdlcyBsb2FkZWQgKCR7dGhpcy5fcGFnZXNMb2FkZWRDb3VudH0gaW4gdG90YWwpLi4uYClcblx0XHRcdFx0XHR0aGlzLl9hbGxQYWdlc0xvYWRlZCA9IHRydWVcblx0XHRcdFx0XHRhd2FpdCB0aGlzLiN1bnNlbmROZXh0TWVzc2FnZSgpXG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dGhpcy5fcGFnZXNMb2FkZWRDb3VudCsrXG5cdFx0XHRcdFx0YXdhaXQgdGhpcy4jbG9hZE5leHRQYWdlKClcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0gY2F0Y2goZXgpIHtcblx0XHRcdGNvbnNvbGUuZXJyb3IoZXgpXG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIFVuc2VuZCBmaXJzdCBtZXNzYWdlIGluIHZpZXdwb3J0XG5cdCAqL1xuXHRhc3luYyAjdW5zZW5kTmV4dE1lc3NhZ2UoKSB7XG5cdFx0aWYodGhpcy5fYWJvcnRDb250cm9sbGVyLnNpZ25hbC5hYm9ydGVkKSB7XG5cdFx0XHRyZXR1cm5cblx0XHR9XG5cdFx0bGV0IGNhblNjcm9sbCA9IHRydWVcblx0XHR0cnkge1xuXHRcdFx0dGhpcy5pZG11LnNldFN0YXR1c1RleHQoXCJSZXRyaWV2aW5nIG5leHQgbWVzc2FnZS4uLlwiKVxuXHRcdFx0Y29uc3QgdWlwaU1lc3NhZ2UgPSBhd2FpdCB0aGlzLmlkbXUuZ2V0TmV4dFVJUElNZXNzYWdlKHRoaXMuX2Fib3J0Q29udHJvbGxlcilcblx0XHRcdGNhblNjcm9sbCA9IHVpcGlNZXNzYWdlICE9PSBmYWxzZVxuXHRcdFx0aWYodWlwaU1lc3NhZ2UpIHtcblx0XHRcdFx0dGhpcy5pZG11LnNldFN0YXR1c1RleHQoXCJVbnNlbmRpbmcgbWVzc2FnZS4uLlwiKVxuXHRcdFx0XHRpZiAodGhpcy5fbGFzdFVuc2VuZERhdGUgIT09IG51bGwpIHtcblx0XHRcdFx0XHRjb25zdCBsYXN0VW5zZW5kRGF0ZURpZmYgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKSAtIHRoaXMuX2xhc3RVbnNlbmREYXRlLmdldFRpbWUoKVxuXHRcdFx0XHRcdGlmKGxhc3RVbnNlbmREYXRlRGlmZiA8IDEwMDApIHtcblx0XHRcdFx0XHRcdHRoaXMuaWRtdS5zZXRTdGF0dXNUZXh0KGBXYWl0aW5nICR7bGFzdFVuc2VuZERhdGVEaWZmfW1zIGJlZm9yZSB1bnNlbmRpbmcgbmV4dCBtZXNzYWdlLi4uYClcblx0XHRcdFx0XHRcdGF3YWl0IG5ldyBQcm9taXNlKHJlc29sdmUgPT4gc2V0VGltZW91dChyZXNvbHZlLCBsYXN0VW5zZW5kRGF0ZURpZmYpKVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRjb25zdCB1bnNlbnQgPSBhd2FpdCB1aXBpTWVzc2FnZS51bnNlbmQodGhpcy5fYWJvcnRDb250cm9sbGVyKVxuXHRcdFx0XHQvLyBpZih1bnNlbnQpIHtcblx0XHRcdFx0dGhpcy5fbGFzdFVuc2VuZERhdGUgPSBuZXcgRGF0ZSgpXG5cdFx0XHRcdHRoaXMuX3Vuc2VudENvdW50Kytcblx0XHRcdFx0Ly8gfVxuXHRcdFx0fVxuXHRcdH0gY2F0Y2goZXgpIHtcblx0XHRcdGNvbnNvbGUuZXJyb3IoZXgpXG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdGlmKGNhblNjcm9sbCkge1xuXHRcdFx0XHRhd2FpdCB0aGlzLiN1bnNlbmROZXh0TWVzc2FnZSgpXG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cbn1cblxuZXhwb3J0IHsgRGVmYXVsdFN0cmF0ZWd5IH1cbiIsIi8qKiBAbW9kdWxlIGFsZXJ0IEFsZXJ0IFVJICovXG5cbi8qKlxuICpcbiAqIEBwYXJhbSB7RG9jdW1lbnR9IGRvY3VtZW50XG4gKiBAcmV0dXJucyB7SFRNTEJ1dHRvbkVsZW1lbnR9XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVBbGVydHNXcmFwcGVyRWxlbWVudChkb2N1bWVudCkge1xuXHRjb25zdCBhbGVydHNXcmFwcGVyRWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIilcblx0YWxlcnRzV3JhcHBlckVsZW1lbnQuaWQgPSBcImlkbXUtYWxlcnRzXCJcblx0YWxlcnRzV3JhcHBlckVsZW1lbnQuc3R5bGUucG9zaXRpb24gPSBcImZpeGVkXCJcblx0YWxlcnRzV3JhcHBlckVsZW1lbnQuc3R5bGUudG9wID0gXCIyMHB4XCJcblx0YWxlcnRzV3JhcHBlckVsZW1lbnQuc3R5bGUucmlnaHQgPSBcIjIwcHhcIlxuXHRhbGVydHNXcmFwcGVyRWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gXCJncmlkXCJcblx0cmV0dXJuIGFsZXJ0c1dyYXBwZXJFbGVtZW50XG59XG5cbi8qKlxuICpcbiAqIEBwYXJhbSB7RG9jdW1lbnR9IGRvY3VtZW50XG4gKiBAcGFyYW0ge3N0cmluZ30gICB0ZXh0XG4gKiBAcmV0dXJucyB7SFRNTEJ1dHRvbkVsZW1lbnR9XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVBbGVydEVsZW1lbnQoZG9jdW1lbnQsIHRleHQpIHtcblx0Y29uc3QgYWxlcnRFbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKVxuXHRhbGVydEVsZW1lbnQudGV4dENvbnRlbnQgPSB0ZXh0XG5cdHJldHVybiBhbGVydEVsZW1lbnRcbn1cbiIsIi8qKiBAbW9kdWxlIG92ZXJsYXkgSURNVSdzIG92ZXJsYXkgKi9cblxuLyoqXG4gKiBAcGFyYW0ge0RvY3VtZW50fSBkb2N1bWVudFxuICogQHJldHVybnMge0hUTUxEaXZFbGVtZW50fVxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlT3ZlcmxheUVsZW1lbnQoZG9jdW1lbnQpIHtcblx0Y29uc3Qgb3ZlcmxheUVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpXG5cdG92ZXJsYXlFbGVtZW50LmlkID0gXCJpZG11LW92ZXJsYXlcIlxuXHRvdmVybGF5RWxlbWVudC50YWJJbmRleCA9IDBcblx0b3ZlcmxheUVsZW1lbnQuc3R5bGUudG9wID0gXCIwXCJcblx0b3ZlcmxheUVsZW1lbnQuc3R5bGUucmlnaHQgPSBcIjBcIlxuXHRvdmVybGF5RWxlbWVudC5zdHlsZS5wb3NpdGlvbiA9IFwiZml4ZWRcIlxuXHRvdmVybGF5RWxlbWVudC5zdHlsZS53aWR0aCA9IFwiMTAwdndcIlxuXHRvdmVybGF5RWxlbWVudC5zdHlsZS5oZWlnaHQgPSBcIjEwMHZoXCJcblx0b3ZlcmxheUVsZW1lbnQuc3R5bGUuekluZGV4ID0gXCI5OThcIlxuXHRvdmVybGF5RWxlbWVudC5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSBcIiMwMDAwMDBkNlwiXG5cdG92ZXJsYXlFbGVtZW50LnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIlxuXHRyZXR1cm4gb3ZlcmxheUVsZW1lbnRcbn1cbiIsIi8qKiBAbW9kdWxlIHVpIElETVUncyBvd24gdWkvb3ZlcmxheVxuICogUHJvdmlkZSBhIGJ1dHRvbiB0byB1bnNlbmQgbWVzc2FnZXNcbiovXG5cbmltcG9ydCB7IGNyZWF0ZU1lbnVCdXR0b25FbGVtZW50IH0gZnJvbSBcIi4vbWVudS1idXR0b24uanNcIlxuaW1wb3J0IHsgY3JlYXRlTWVudUVsZW1lbnQgfSBmcm9tIFwiLi9tZW51LmpzXCJcbmltcG9ydCBJRE1VIGZyb20gXCIuLi8uLi8uLi9pZG11L2lkbXUuanNcIlxuaW1wb3J0IHsgRGVmYXVsdFN0cmF0ZWd5IH0gZnJvbSBcIi4uLy4uLy4uL3VpL2RlZmF1bHQvdW5zZW5kLXN0cmF0ZWd5LmpzXCJcbmltcG9ydCB7IGNyZWF0ZUFsZXJ0c1dyYXBwZXJFbGVtZW50IH0gZnJvbSBcIi4vYWxlcnQuanNcIlxuaW1wb3J0IHsgY3JlYXRlT3ZlcmxheUVsZW1lbnQgfSBmcm9tIFwiLi9vdmVybGF5LmpzXCJcbmltcG9ydCB7IEJVVFRPTl9TVFlMRSB9IGZyb20gXCIuL3N0eWxlL2luc3RhZ3JhbS5qc1wiXG5cbi8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby11bnVzZWQtdmFyc1xuaW1wb3J0IHsgVW5zZW5kU3RyYXRlZ3kgfSBmcm9tIFwiLi4vLi4vLi4vdWkvdW5zZW5kLXN0cmF0ZWd5LmpzXCJcblxuY2xhc3MgVUkge1xuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHtEb2N1bWVudH0gZG9jdW1lbnRcblx0ICogQHBhcmFtIHtIVE1MRGl2RWxlbWVudH0gcm9vdFxuXHQgKiBAcGFyYW0ge0hUTUxEaXZFbGVtZW50fSBvdmVybGF5RWxlbWVudFxuXHQgKiBAcGFyYW0ge0hUTUxEaXZFbGVtZW50fSBtZW51RWxlbWVudFxuXHQgKiBAcGFyYW0ge0hUTUxCdXR0b25FbGVtZW50fSB1bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvblxuXHQgKiBAcGFyYW0ge0hUTUxEaXZFbGVtZW50fSBzdGF0dXNFbGVtZW50XG5cdCAqL1xuXHRjb25zdHJ1Y3Rvcihkb2N1bWVudCwgcm9vdCwgb3ZlcmxheUVsZW1lbnQsIG1lbnVFbGVtZW50LCB1bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbiwgc3RhdHVzRWxlbWVudCkge1xuXHRcdHRoaXMuX2RvY3VtZW50ID0gZG9jdW1lbnRcblx0XHR0aGlzLl9yb290ID0gcm9vdFxuXHRcdHRoaXMuX292ZXJsYXlFbGVtZW50ID0gb3ZlcmxheUVsZW1lbnRcblx0XHR0aGlzLl9tZW51RWxlbWVudCA9IG1lbnVFbGVtZW50XG5cdFx0dGhpcy5fc3RhdHVzRWxlbWVudCA9IHN0YXR1c0VsZW1lbnRcblx0XHR0aGlzLl91bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbiA9IHVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uXG5cdFx0dGhpcy5faWRtdSA9IG5ldyBJRE1VKHRoaXMud2luZG93LCB0aGlzLm9uU3RhdHVzVGV4dC5iaW5kKHRoaXMpKVxuXHRcdHRoaXMuX3N0cmF0ZWd5ID0gbmV3IERlZmF1bHRTdHJhdGVneSh0aGlzLl9pZG11KVxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7d2luZG93fSB3aW5kb3dcblx0ICogQHJldHVybnMge1VJfVxuXHQgKi9cblx0c3RhdGljIHJlbmRlcih3aW5kb3cpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwicmVuZGVyXCIpXG5cdFx0Y29uc3QgdWkgPSBVSS5jcmVhdGUod2luZG93LmRvY3VtZW50KVxuXHRcdHdpbmRvdy5kb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHVpLnJvb3QpXG5cdFx0cmV0dXJuIHVpXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHBhcmFtICAge0RvY3VtZW50fSBkb2N1bWVudFxuXHQgKiBAcmV0dXJucyB7VUl9XG5cdCAqL1xuXHRzdGF0aWMgY3JlYXRlKGRvY3VtZW50KSB7XG5cdFx0Y29uc3Qgcm9vdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIilcblx0XHRyb290LmlkID0gXCJpZG11LXJvb3RcIlxuXHRcdGNvbnN0IG1lbnVFbGVtZW50ID0gY3JlYXRlTWVudUVsZW1lbnQoZG9jdW1lbnQpXG5cdFx0Y29uc3Qgb3ZlcmxheUVsZW1lbnQgPSBjcmVhdGVPdmVybGF5RWxlbWVudChkb2N1bWVudClcblx0XHRjb25zdCBhbGVydHNXcmFwcGVyRWxlbWVudCA9IGNyZWF0ZUFsZXJ0c1dyYXBwZXJFbGVtZW50KGRvY3VtZW50KVxuXHRcdGNvbnN0IHVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uID0gY3JlYXRlTWVudUJ1dHRvbkVsZW1lbnQoZG9jdW1lbnQsIFwiVW5zZW5kIGFsbCBETXNcIiwgQlVUVE9OX1NUWUxFLlBSSU1BUlkpXG5cdFx0Y29uc3Qgc3RhdHVzRWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIilcblx0XHRzdGF0dXNFbGVtZW50LnRleHRDb250ZW50ID0gXCJSZWFkeVwiXG5cdFx0c3RhdHVzRWxlbWVudC5pZCA9IFwiaWRtdS1zdGF0dXNcIlxuXHRcdHN0YXR1c0VsZW1lbnQuc3R5bGUgPSBcIndpZHRoOiAyMDBweFwiXG5cdFx0ZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChvdmVybGF5RWxlbWVudClcblx0XHRkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGFsZXJ0c1dyYXBwZXJFbGVtZW50KVxuXHRcdG1lbnVFbGVtZW50LmFwcGVuZENoaWxkKHVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uKVxuXHRcdG1lbnVFbGVtZW50LmFwcGVuZENoaWxkKHN0YXR1c0VsZW1lbnQpXG5cdFx0cm9vdC5hcHBlbmRDaGlsZChtZW51RWxlbWVudClcblx0XHRjb25zdCB1aSA9IG5ldyBVSShkb2N1bWVudCwgcm9vdCwgb3ZlcmxheUVsZW1lbnQsIG1lbnVFbGVtZW50LCB1bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbiwgc3RhdHVzRWxlbWVudClcblx0XHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKFwia2V5ZG93blwiLCAoZXZlbnQpID0+IHVpLiNvbldpbmRvd0tleUV2ZW50KGV2ZW50KSkgLy8gVE9ETyB0ZXN0XG5cdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcImtleXVwXCIsIChldmVudCkgPT4gdWkuI29uV2luZG93S2V5RXZlbnQoZXZlbnQpKSAvLyBUT0RPIHRlc3Rcblx0XHR1bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKGV2ZW50KSA9PiB1aS4jb25VbnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbkNsaWNrKGV2ZW50KSlcblx0XHR0aGlzLl9tdXRhdGlvbk9ic2VydmVyID0gbmV3IE11dGF0aW9uT2JzZXJ2ZXIoKG11dGF0aW9ucykgPT4gdWkuI29uTXV0YXRpb25zKHVpLCBtdXRhdGlvbnMpKVxuXHRcdHRoaXMuX211dGF0aW9uT2JzZXJ2ZXIub2JzZXJ2ZShkb2N1bWVudC5ib2R5LCB7IGNoaWxkTGlzdDogdHJ1ZSB9KSAvLyBUT0RPIHRlc3Rcblx0XHR1bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbi5kYXRhVGV4dENvbnRlbnQgPSB1bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbi50ZXh0Q29udGVudFxuXHRcdHVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uLmRhdGFCYWNrZ3JvdW5kQ29sb3IgPSB1bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbi5zdHlsZS5iYWNrZ3JvdW5kQ29sb3Jcblx0XHRyZXR1cm4gdWlcblx0fVxuXG5cdGFzeW5jICNzdGFydFVuc2VuZGluZygpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwiVXNlciBhc2tlZCBmb3IgbWVzc2FnZXMgdW5zZW5kaW5nIHRvIHN0YXJ0OyBVSSBpbnRlcmFjdGlvbiB3aWxsIGJlIGRpc2FibGVkIGluIHRoZSBtZWFudGltZVwiKVxuXHRcdDtbLi4udGhpcy5tZW51RWxlbWVudC5xdWVyeVNlbGVjdG9yQWxsKFwiYnV0dG9uXCIpXS5maWx0ZXIoYnV0dG9uID0+IGJ1dHRvbiAhPT0gdGhpcy51bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbikuZm9yRWFjaChidXR0b24gPT4ge1xuXHRcdFx0YnV0dG9uLnN0eWxlLnZpc2liaWxpdHkgPSBcImhpZGRlblwiXG5cdFx0XHRidXR0b24uZGlzYWJsZWQgPSB0cnVlXG5cdFx0fSlcblx0XHR0aGlzLm92ZXJsYXlFbGVtZW50LnN0eWxlLmRpc3BsYXkgPSBcIlwiXG5cdFx0dGhpcy5vdmVybGF5RWxlbWVudC5mb2N1cygpXG5cdFx0dGhpcy51bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbi50ZXh0Q29udGVudCA9IFwiU3RvcCBwcm9jZXNzaW5nXCJcblx0XHR0aGlzLnVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uLnN0eWxlLmJhY2tncm91bmRDb2xvciA9IFwiI0ZBMzgzRVwiXG5cdFx0YXdhaXQgdGhpcy5zdHJhdGVneS5ydW4oKVxuXHRcdHRoaXMuI29uVW5zZW5kaW5nRmluaXNoZWQoKVxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7VUl9IHVpXG5cdCAqL1xuXHQjb25NdXRhdGlvbnModWkpIHtcblx0XHRpZih1aS5yb290Lm93bmVyRG9jdW1lbnQucXVlcnlTZWxlY3RvcihcIltpZF49bW91bnRdID4gZGl2ID4gZGl2ID4gZGl2XCIpICE9PSBudWxsICYmIHVpKSB7XG5cdFx0XHRpZih0aGlzLl9tdXRhdGlvbk9ic2VydmVyKSB7XG5cdFx0XHRcdHRoaXMuX211dGF0aW9uT2JzZXJ2ZXIuZGlzY29ubmVjdCgpXG5cdFx0XHR9XG5cdFx0XHR0aGlzLl9tdXRhdGlvbk9ic2VydmVyID0gbmV3IE11dGF0aW9uT2JzZXJ2ZXIodWkuI29uTXV0YXRpb25zLmJpbmQodGhpcywgdWkpKVxuXHRcdFx0dGhpcy5fbXV0YXRpb25PYnNlcnZlci5vYnNlcnZlKHVpLnJvb3Qub3duZXJEb2N1bWVudC5xdWVyeVNlbGVjdG9yKFwiW2lkXj1tb3VudF0gPiBkaXYgPiBkaXYgPiBkaXZcIiksIHsgY2hpbGRMaXN0OiB0cnVlLCBhdHRyaWJ1dGVzOiB0cnVlIH0pXG5cdFx0fVxuXHRcdGlmKHRoaXMud2luZG93LmxvY2F0aW9uLnBhdGhuYW1lLnN0YXJ0c1dpdGgoXCIvZGlyZWN0L3QvXCIpKSB7XG5cdFx0XHR0aGlzLnN0cmF0ZWd5LnJlc2V0KClcblx0XHRcdHRoaXMucm9vdC5zdHlsZS5kaXNwbGF5ID0gXCJcIlxuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLnJvb3Quc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiXG5cdFx0XHRpZih0aGlzLnN0cmF0ZWd5LmlzUnVubmluZygpKSB7XG5cdFx0XHRcdHRoaXMuc3RyYXRlZ3kuc3RvcCgpXG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7VUl9IHVpXG5cdCAqIEBwYXJhbSB7RXZlbnR9IGV2ZW50XG5cdCAqL1xuXHQjb25VbnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbkNsaWNrKCkge1xuXHRcdGlmKHRoaXMuc3RyYXRlZ3kuaXNSdW5uaW5nKCkpIHtcblx0XHRcdGNvbnNvbGUuZGVidWcoXCJVc2VyIGFza2VkIGZvciBtZXNzYWdlcyB1bnNlbmRpbmcgdG8gc3RvcFwiKVxuXHRcdFx0dGhpcy5zdHJhdGVneS5zdG9wKClcblx0XHRcdHRoaXMuI29uVW5zZW5kaW5nRmluaXNoZWQoKVxuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLiNzdGFydFVuc2VuZGluZygpXG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7RXZlbnR9IGV2ZW50XG5cdCAqIEByZXR1cm5zIHtib29sZWFufVxuXHQgKi9cblx0I29uV2luZG93S2V5RXZlbnQoZXZlbnQpIHtcblx0XHRpZih0aGlzLnN0cmF0ZWd5LmlzUnVubmluZygpKSB7XG5cdFx0XHRjb25zb2xlLmxvZyhcIlVzZXIgaW50ZXJhY3Rpb24gaXMgZGlzYWJsZWQgYXMgdGhlIHVuc2VuZGluZyBpcyBzdGlsbCBydW5uaW5nOyBQbGVhc2Ugc3RvcCB0aGUgZXhlY3V0aW9uIGZpcnN0LlwiKVxuXHRcdFx0ZXZlbnQuc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uKClcblx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KClcblx0XHRcdGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpXG5cdFx0XHR0aGlzLm92ZXJsYXlFbGVtZW50LmZvY3VzKClcblx0XHRcdHJldHVybiBmYWxzZVxuXHRcdH1cblx0fVxuXG5cdCNvblVuc2VuZGluZ0ZpbmlzaGVkKCkge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJyZW5kZXIgb25VbnNlbmRpbmdGaW5pc2hlZFwiKVxuXHRcdDtbLi4udGhpcy5tZW51RWxlbWVudC5xdWVyeVNlbGVjdG9yQWxsKFwiYnV0dG9uXCIpXS5maWx0ZXIoYnV0dG9uID0+IGJ1dHRvbiAhPT0gdGhpcy51bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbikuZm9yRWFjaChidXR0b24gPT4ge1xuXHRcdFx0YnV0dG9uLnN0eWxlLnZpc2liaWxpdHkgPSBcIlwiXG5cdFx0XHRidXR0b24uZGlzYWJsZWQgPSBmYWxzZVxuXHRcdH0pXG5cdFx0dGhpcy51bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbi50ZXh0Q29udGVudCA9IHRoaXMudW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24uZGF0YVRleHRDb250ZW50XG5cdFx0dGhpcy51bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbi5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSB0aGlzLnVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uLmRhdGFCYWNrZ3JvdW5kQ29sb3Jcblx0XHR0aGlzLm92ZXJsYXlFbGVtZW50LnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIlxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0XG5cdCAqL1xuXHRvblN0YXR1c1RleHQodGV4dCkge1xuXHRcdHRoaXMuc3RhdHVzRWxlbWVudC50ZXh0Q29udGVudCA9IHRleHRcblx0fVxuXG5cblxuXHQvKipcblx0ICogQHJlYWRvbmx5XG5cdCAqIEB0eXBlIHtEb2N1bWVudH1cblx0ICovXG5cdGdldCBkb2N1bWVudCgpIHtcblx0XHRyZXR1cm4gdGhpcy5fZG9jdW1lbnRcblx0fVxuXG5cdC8qKlxuXHQgKiBAcmVhZG9ubHlcblx0ICogQHR5cGUge1dpbmRvd31cblx0ICovXG5cdGdldCB3aW5kb3coKSB7XG5cdFx0cmV0dXJuIHRoaXMuX2RvY3VtZW50LmRlZmF1bHRWaWV3XG5cdH1cblxuXHQvKipcblx0ICogQHJlYWRvbmx5XG5cdCAqIEB0eXBlIHtIVE1MRGl2RWxlbWVudH1cblx0ICovXG5cdGdldCByb290KCkge1xuXHRcdHJldHVybiB0aGlzLl9yb290XG5cdH1cblxuXHQvKipcblx0ICogQHJlYWRvbmx5XG5cdCAqIEB0eXBlIHtIVE1MRGl2RWxlbWVudH1cblx0ICovXG5cdGdldCBvdmVybGF5RWxlbWVudCgpIHtcblx0XHRyZXR1cm4gdGhpcy5fb3ZlcmxheUVsZW1lbnRcblx0fVxuXG5cdC8qKlxuXHQgKiBAcmVhZG9ubHlcblx0ICogQHR5cGUge0hUTUxEaXZFbGVtZW50fVxuXHQgKi9cblx0Z2V0IG1lbnVFbGVtZW50KCkge1xuXHRcdHJldHVybiB0aGlzLl9tZW51RWxlbWVudFxuXHR9XG5cblx0LyoqXG5cdCAqIEByZWFkb25seVxuXHQgKiBAdHlwZSB7SFRNTEJ1dHRvbkVsZW1lbnR9XG5cdCAqL1xuXHRnZXQgdW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24oKSB7XG5cdFx0cmV0dXJuIHRoaXMuX3Vuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uXG5cdH1cblxuXHQvKipcblx0ICogQHJlYWRvbmx5XG5cdCAqIEB0eXBlIHtIVE1MRGl2RWxlbWVudH1cblx0ICovXG5cdGdldCBzdGF0dXNFbGVtZW50KCkge1xuXHRcdHJldHVybiB0aGlzLl9zdGF0dXNFbGVtZW50XG5cdH1cblxuXHQvKipcblx0ICogQHJlYWRvbmx5XG5cdCAqIEB0eXBlIHtIVE1MQnV0dG9uRWxlbWVudH1cblx0ICovXG5cdGdldCBsb2FkVGhyZWFkTWVzc2FnZXNCdXR0b24oKSB7XG5cdFx0cmV0dXJuIHRoaXMuX2xvYWRUaHJlYWRNZXNzYWdlc0J1dHRvblxuXHR9XG5cblx0LyoqXG5cdCAqIEByZWFkb25seVxuXHQgKiBAdHlwZSB7VW5zZW5kU3RyYXRlZ3l9XG5cdCAqL1xuXHRnZXQgc3RyYXRlZ3koKSB7XG5cdFx0cmV0dXJuIHRoaXMuX3N0cmF0ZWd5XG5cdH1cblxuXHQvKipcblx0ICogQHJlYWRvbmx5XG5cdCAqIEB0eXBlIHtJRE1VfVxuXHQgKi9cblx0Z2V0IGlkbXUoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX2lkbXVcblx0fVxuXG59XG5cbmV4cG9ydCBkZWZhdWx0IFVJXG4iLCIvKiogQG1vZHVsZSBtYWluIE1haW4gbW9kdWxlICovXG5cbmltcG9ydCBVSSBmcm9tIFwiLi91aS91aS5qc1wiXG5cbi8qKlxuICogQHBhcmFtIHtXaW5kb3d9IHdpbmRvd1xuICovXG5leHBvcnQgZnVuY3Rpb24gbWFpbih3aW5kb3cpIHtcblx0VUkucmVuZGVyKHdpbmRvdylcbn1cblxuaWYodHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIikge1xuXHRtYWluKHdpbmRvdylcbn1cbiJdLCJuYW1lcyI6WyJVSSJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQUFBO0FBQ0E7Q0FDTyxNQUFNLFlBQVksR0FBRztDQUM1QixDQUFDLFNBQVMsRUFBRSxTQUFTO0NBQ3JCLENBQUMsV0FBVyxFQUFFLFdBQVc7Q0FDekIsRUFBQztBQUNEO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNPLFNBQVMsZ0JBQWdCLENBQUMsYUFBYSxFQUFFLFNBQVMsRUFBRTtDQUMzRCxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsUUFBUSxHQUFHLDZCQUE0QjtDQUM1RCxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsS0FBSyxHQUFHLFFBQU87Q0FDcEMsQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxNQUFLO0NBQ25DLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxZQUFZLEdBQUcsTUFBSztDQUN6QyxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsT0FBTyxHQUFHLE1BQUs7Q0FDcEMsQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLFVBQVUsR0FBRyxPQUFNO0NBQ3hDLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxNQUFNLEdBQUcsVUFBUztDQUN2QyxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsVUFBVSxHQUFHLCtCQUE4QjtDQUNoRSxDQUFDLEdBQUcsU0FBUyxFQUFFO0NBQ2YsRUFBRSxhQUFhLENBQUMsS0FBSyxDQUFDLGVBQWUsR0FBRyxDQUFDLGFBQWEsRUFBRSxTQUFTLENBQUMsU0FBUyxFQUFDO0NBQzVFLEVBQUU7Q0FDRjs7Q0N4QkE7QUFDQTtBQUVBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDTyxTQUFTLHVCQUF1QixDQUFDLFFBQVEsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFO0NBQ25FLENBQUMsTUFBTSxhQUFhLEdBQUcsUUFBUSxDQUFDLGFBQWEsQ0FBQyxRQUFRLEVBQUM7Q0FDdkQsQ0FBQyxhQUFhLENBQUMsV0FBVyxHQUFHLEtBQUk7Q0FDakMsQ0FBQyxnQkFBZ0IsQ0FBQyxhQUFhLEVBQUUsU0FBUyxFQUFDO0NBQzNDLENBQUMsYUFBYSxDQUFDLGdCQUFnQixDQUFDLFdBQVcsRUFBRSxNQUFNO0NBQ25ELEVBQUUsYUFBYSxDQUFDLEtBQUssQ0FBQyxNQUFNLEdBQUcsQ0FBQyxnQkFBZ0IsRUFBQztDQUNqRCxFQUFFLEVBQUM7Q0FDSCxDQUFDLGFBQWEsQ0FBQyxnQkFBZ0IsQ0FBQyxVQUFVLEVBQUUsTUFBTTtDQUNsRCxFQUFFLGFBQWEsQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBQztDQUNqQyxFQUFFLEVBQUM7Q0FDSCxDQUFDLE9BQU8sYUFBYTtDQUNyQjs7Q0N0QkE7QUFDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ08sU0FBUyxpQkFBaUIsQ0FBQyxRQUFRLEVBQUU7Q0FDNUMsQ0FBQyxNQUFNLFdBQVcsR0FBRyxRQUFRLENBQUMsYUFBYSxDQUFDLEtBQUssRUFBQztDQUNsRCxDQUFDLFdBQVcsQ0FBQyxFQUFFLEdBQUcsWUFBVztDQUM3QixDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsR0FBRyxHQUFHLE9BQU07Q0FDL0IsQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLEtBQUssR0FBRyxRQUFPO0NBQ2xDLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxRQUFRLEdBQUcsUUFBTztDQUNyQyxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLElBQUc7Q0FDL0IsQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLE9BQU8sR0FBRyxPQUFNO0NBQ25DLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxHQUFHLEdBQUcsT0FBTTtDQUMvQixDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsVUFBVSxHQUFHLFNBQVE7Q0FDeEMsQ0FBQyxPQUFPLFdBQVc7Q0FDbkI7O0NDakJBO0FBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0FBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNPLFNBQVMsY0FBYyxDQUFDLE1BQU0sRUFBRSxVQUFVLEVBQUUsZUFBZSxFQUFFO0NBQ3BFLENBQUMsT0FBTyxJQUFJLE9BQU8sQ0FBQyxDQUFDLE9BQU8sRUFBRSxNQUFNLEtBQUs7Q0FDekMsRUFBRSxJQUFJLGlCQUFnQjtDQUN0QixFQUFFLE1BQU0sWUFBWSxHQUFHLE1BQU07Q0FDN0IsR0FBRyxHQUFHLGdCQUFnQixFQUFFO0NBQ3hCLElBQUksTUFBTSxDQUFDLElBQUksWUFBWSxDQUFDLDZDQUE2QyxFQUFFLFlBQVksQ0FBQyxFQUFDO0NBQ3pGLElBQUksZ0JBQWdCLENBQUMsVUFBVSxHQUFFO0NBQ2pDLElBQUksTUFBTTtDQUNWLElBQUksTUFBTSxDQUFDLElBQUksWUFBWSxDQUFDLFNBQVMsRUFBRSxZQUFZLENBQUMsRUFBQztDQUNyRCxJQUFJO0NBQ0osSUFBRztDQUNILEVBQUUsZUFBZSxDQUFDLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxPQUFPLEVBQUUsWUFBWSxFQUFDO0NBQ2hFLEVBQUUsSUFBSSxPQUFPLEdBQUcsVUFBVSxHQUFFO0NBQzVCLEVBQUUsR0FBRyxPQUFPLEVBQUU7Q0FDZCxHQUFHLE9BQU8sQ0FBQyxPQUFPLEVBQUM7Q0FDbkIsR0FBRyxlQUFlLENBQUMsTUFBTSxDQUFDLG1CQUFtQixDQUFDLE9BQU8sRUFBRSxZQUFZLEVBQUM7Q0FDcEUsR0FBRyxNQUFNO0NBQ1QsR0FBRyxnQkFBZ0IsR0FBRyxJQUFJLGdCQUFnQixDQUFDLENBQUMsU0FBUyxFQUFFLFFBQVEsS0FBSztDQUNwRSxJQUFJLE9BQU8sR0FBRyxVQUFVLENBQUMsU0FBUyxFQUFDO0NBQ25DLElBQUksR0FBRyxPQUFPLEVBQUU7Q0FDaEIsS0FBSyxRQUFRLENBQUMsVUFBVSxHQUFFO0NBQzFCLEtBQUssT0FBTyxDQUFDLE9BQU8sRUFBQztDQUNyQixLQUFLLGVBQWUsQ0FBQyxNQUFNLENBQUMsbUJBQW1CLENBQUMsT0FBTyxFQUFFLFlBQVksRUFBQztDQUN0RSxLQUFLO0NBQ0wsSUFBSSxFQUFDO0NBQ0wsR0FBRyxnQkFBZ0IsQ0FBQyxPQUFPLENBQUMsTUFBTSxFQUFFLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxTQUFTLENBQUMsSUFBSSxFQUFFLEVBQUM7Q0FDdEUsR0FBRztDQUNILEVBQUUsQ0FBQztDQUNILENBQUM7QUFDRDtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDTyxTQUFTLHNCQUFzQixDQUFDLFdBQVcsRUFBRSxNQUFNLEVBQUUsVUFBVSxFQUFFLGVBQWUsRUFBRTtDQUN6RixDQUFDLE1BQU0sT0FBTyxHQUFHLGNBQWMsQ0FBQyxNQUFNLEVBQUUsVUFBVSxFQUFFLGVBQWUsRUFBQztDQUNwRSxDQUFDLFdBQVcsQ0FBQyxLQUFLLEdBQUU7Q0FDcEIsQ0FBQyxPQUFPLFVBQVUsRUFBRSxJQUFJLE9BQU87Q0FDL0I7O0NDekRBO0FBQ0E7QUFFQTtDQUNPLE1BQU0sV0FBVyxDQUFDO0NBQ3pCO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLFdBQVcsQ0FBQyxJQUFJLEVBQUUsVUFBVSxDQUFDLEVBQUUsRUFBRTtDQUNsQyxFQUFFLElBQUksQ0FBQyxJQUFJLEdBQUcsS0FBSTtDQUNsQixFQUFFLElBQUksQ0FBQyxVQUFVLEdBQUcsV0FBVTtDQUM5QixFQUFFO0FBQ0Y7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsY0FBYyxDQUFDLE1BQU0sRUFBRSxVQUFVLEVBQUUsZUFBZSxFQUFFO0NBQ3JELEVBQUUsT0FBTyxVQUFVLEVBQUUsSUFBSSxjQUFjLENBQUMsTUFBTSxFQUFFLFVBQVUsRUFBRSxlQUFlLENBQUM7Q0FDNUUsRUFBRTtBQUNGO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsc0JBQXNCLENBQUMsV0FBVyxFQUFFLE1BQU0sRUFBRSxVQUFVLEVBQUUsZUFBZSxFQUFFO0NBQzFFLEVBQUUsT0FBTyxzQkFBc0IsQ0FBQyxXQUFXLEVBQUUsTUFBTSxFQUFFLFVBQVUsRUFBRSxlQUFlLENBQUM7Q0FDakYsRUFBRTtBQUNGO0NBQ0E7O0NDdENBO0FBQ0E7QUFFQTtDQUNBLE1BQU0sU0FBUyxTQUFTLFdBQVcsQ0FBQztBQUNwQztDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsQ0FBQyxNQUFNLHFCQUFxQixDQUFDLGVBQWUsRUFBRTtDQUM5QyxFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMseUNBQXlDLEVBQUUsSUFBSSxDQUFDLElBQUksRUFBQztDQUNyRSxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksVUFBVSxDQUFDLFdBQVcsRUFBRSxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsQ0FBQyxFQUFDO0NBQ3pFLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxVQUFVLENBQUMsV0FBVyxFQUFFLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxDQUFDLEVBQUM7Q0FDekUsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxXQUFXLEVBQUUsRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLENBQUMsRUFBQztDQUN6RSxFQUFFLE1BQU0sbUJBQW1CLEdBQUcsSUFBSSxlQUFlLEdBQUU7Q0FDbkQsRUFBRSxJQUFJLGVBQWM7Q0FFcEIsRUFBRSxNQUFNLFlBQVksR0FBRyxNQUFNO0NBQzdCLEdBQUcsbUJBQW1CLENBQUMsS0FBSyxHQUFFO0NBQzlCLEdBQUcsWUFBWSxDQUFDLGNBQWMsRUFBQztDQUkvQixJQUFHO0NBQ0gsRUFBRSxlQUFlLENBQUMsTUFBTSxDQUFDLGdCQUFnQixDQUFDLE9BQU8sRUFBRSxZQUFZLEVBQUM7Q0FDaEUsRUFBRSxNQUFNLFlBQVksR0FBRyxNQUFNLE9BQU8sQ0FBQyxJQUFJLENBQUM7Q0FDMUMsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsTUFBTSxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxtQkFBbUIsQ0FBQyxFQUFFLFVBQVUsRUFBRSxtQkFBbUIsQ0FBQztDQUN0SCxHQUFHLElBQUksT0FBTyxDQUFDLENBQUMsT0FBTyxFQUFFLE1BQU0sS0FBSztDQUNwQyxJQUFJLGNBQWMsR0FBRyxVQUFVLENBQUMsTUFBTSxNQUFNLENBQUMsK0JBQStCLENBQUMsRUFBRSxHQUFHLEVBQUM7Q0FDbkYsSUFBSSxDQUFDO0NBQ0wsR0FBRyxFQUFDO0NBQ0osRUFBRSxtQkFBbUIsQ0FBQyxLQUFLLEdBQUU7Q0FDN0IsRUFBRSxZQUFZLENBQUMsY0FBYyxFQUFDO0NBQzlCLEVBQUUsT0FBTyxZQUFZO0NBQ3JCLEVBQUU7QUFDRjtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsQ0FBQyxNQUFNLG9CQUFvQixDQUFDLGVBQWUsRUFBRTtDQUM3QyxFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMsc0JBQXNCLEVBQUUsSUFBSSxDQUFDLElBQUksRUFBQztDQUNsRCxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksVUFBVSxDQUFDLFdBQVcsRUFBRSxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsQ0FBQyxFQUFDO0NBQ3pFLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxVQUFVLENBQUMsVUFBVSxFQUFFLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxDQUFDLEVBQUM7Q0FDeEUsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxZQUFZLEVBQUUsRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLENBQUMsRUFBQztDQUMxRSxFQUFFLE1BQU0sbUJBQW1CLEdBQUcsSUFBSSxlQUFlLEdBQUU7Q0FDbkQsRUFBRSxJQUFJLGVBQWM7Q0FDcEIsRUFBRSxJQUFJLGVBQWM7Q0FDcEIsRUFBRSxNQUFNLFlBQVksR0FBRyxNQUFNO0NBQzdCLEdBQUcsbUJBQW1CLENBQUMsS0FBSyxHQUFFO0NBQzlCLEdBQUcsWUFBWSxDQUFDLGNBQWMsRUFBQztDQUMvQixHQUFHLEdBQUcsY0FBYyxFQUFFO0NBQ3RCLElBQUksY0FBYyxHQUFFO0NBQ3BCLElBQUk7Q0FDSixJQUFHO0NBQ0gsRUFBRSxlQUFlLENBQUMsTUFBTSxDQUFDLGdCQUFnQixDQUFDLE9BQU8sRUFBRSxZQUFZLEVBQUM7Q0FDaEUsRUFBRSxNQUFNLE1BQU0sR0FBRyxNQUFNLE9BQU8sQ0FBQyxJQUFJLENBQUM7Q0FDcEMsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsTUFBTSxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxtQkFBbUIsQ0FBQyxLQUFLLElBQUksRUFBRSxtQkFBbUIsQ0FBQztDQUNuSCxHQUFHLElBQUksT0FBTyxDQUFDLENBQUMsT0FBTyxFQUFFLE1BQU0sS0FBSztDQUNwQyxJQUFJLGNBQWMsR0FBRyxRQUFPO0NBQzVCLElBQUksY0FBYyxHQUFHLFVBQVUsQ0FBQyxNQUFNLE1BQU0sQ0FBQyw4QkFBOEIsQ0FBQyxFQUFFLEdBQUcsRUFBQztDQUNsRixJQUFJLENBQUM7Q0FDTCxHQUFHLEVBQUM7Q0FDSixFQUFFLG1CQUFtQixDQUFDLEtBQUssR0FBRTtDQUM3QixFQUFFLFlBQVksQ0FBQyxjQUFjLEVBQUM7Q0FDOUIsRUFBRSxPQUFPLE1BQU07Q0FDZixFQUFFO0FBQ0Y7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLE1BQU0sZUFBZSxDQUFDLFlBQVksRUFBRSxlQUFlLEVBQUU7Q0FDdEQsRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLG9GQUFvRixFQUFFLFlBQVksRUFBQztDQUNuSCxFQUFFLE1BQU0sbUJBQW1CLEdBQUcsSUFBSSxlQUFlLEdBQUU7Q0FDbkQsRUFBRSxJQUFJLGVBQWM7Q0FFcEIsRUFBRSxNQUFNLFlBQVksR0FBRyxNQUFNO0NBQzdCLEdBQUcsbUJBQW1CLENBQUMsS0FBSyxHQUFFO0NBQzlCLEdBQUcsWUFBWSxDQUFDLGNBQWMsRUFBQztDQUkvQixJQUFHO0NBQ0gsRUFBRSxlQUFlLENBQUMsTUFBTSxDQUFDLGdCQUFnQixDQUFDLE9BQU8sRUFBRSxZQUFZLEVBQUM7Q0FDaEUsRUFBRSxNQUFNLFlBQVksR0FBRyxNQUFNLE9BQU8sQ0FBQyxJQUFJLENBQUM7Q0FDMUMsR0FBRyxJQUFJLENBQUMsc0JBQXNCO0NBQzlCLElBQUksWUFBWTtDQUNoQixJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUk7Q0FDaEMsSUFBSSxDQUFDLFNBQVMsS0FBSztDQUNuQixLQUFLLEdBQUcsU0FBUyxFQUFFO0NBQ25CLE1BQU0sTUFBTSxVQUFVLEdBQUcsRUFBRSxHQUFHLFNBQVMsQ0FBQyxHQUFHLENBQUMsUUFBUSxJQUFJLENBQUMsR0FBRyxRQUFRLENBQUMsVUFBVSxDQUFDLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLElBQUksSUFBSSxDQUFDLFFBQVEsS0FBSyxDQUFDLEVBQUM7Q0FDOUgsTUFBTSxPQUFPLENBQUMsS0FBSyxDQUFDLG9CQUFvQixFQUFFLFVBQVUsRUFBRSxVQUFVLENBQUMsSUFBSSxDQUFDLElBQUksSUFBSSxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksRUFBRSxDQUFDLGlCQUFpQixFQUFFLEtBQUssUUFBUSxDQUFDLEVBQUM7Q0FDeEksTUFBTSxJQUFJLE1BQU0sU0FBUyxJQUFJLFVBQVUsRUFBRTtDQUN6QyxPQUFPLE1BQU0sSUFBSSxHQUFHLENBQUMsR0FBRyxTQUFTLENBQUMsZ0JBQWdCLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxJQUFJLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxFQUFFLENBQUMsaUJBQWlCLEVBQUUsS0FBSyxRQUFRLElBQUksSUFBSSxDQUFDLFVBQVUsRUFBRSxRQUFRLEtBQUssQ0FBQyxFQUFDO0NBQ3pLLE9BQU8sT0FBTyxJQUFJO0NBQ2xCLE9BQU87Q0FDUCxNQUFNO0NBQ04sS0FBSztDQUNMLElBQUksbUJBQW1CO0NBQ3ZCLElBQUk7Q0FDSixHQUFHLElBQUksT0FBTyxDQUFDLENBQUMsT0FBTyxFQUFFLE1BQU0sS0FBSztDQUNwQyxJQUFJLGNBQWMsR0FBRyxVQUFVLENBQUMsTUFBTSxNQUFNLENBQUMseUJBQXlCLENBQUMsRUFBRSxHQUFHLEVBQUM7Q0FDN0UsSUFBSSxDQUFDO0NBQ0wsR0FBRyxFQUFDO0NBQ0osRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLHNDQUFzQyxFQUFFLFlBQVksRUFBQztDQUNyRSxFQUFFLG1CQUFtQixDQUFDLEtBQUssR0FBRTtDQUM3QixFQUFFLFlBQVksQ0FBQyxjQUFjLEVBQUM7Q0FDOUIsRUFBRSxPQUFPLFlBQVk7Q0FDckIsRUFBRTtBQUNGO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLE1BQU0sZ0JBQWdCLENBQUMsWUFBWSxFQUFFLGtCQUFrQixFQUFFLGVBQWUsRUFBRTtDQUMzRSxFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMsa0JBQWtCLEVBQUM7Q0FDbkMsRUFBRSxNQUFNLG1CQUFtQixHQUFHLElBQUksZUFBZSxHQUFFO0NBQ25ELEVBQUUsSUFBSSxlQUFjO0NBRXBCLEVBQUUsTUFBTSxZQUFZLEdBQUcsTUFBTTtDQUM3QixHQUFHLG1CQUFtQixDQUFDLEtBQUssR0FBRTtDQUM5QixHQUFHLFlBQVksQ0FBQyxjQUFjLEVBQUM7Q0FJL0IsSUFBRztDQUNILEVBQUUsZUFBZSxDQUFDLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxPQUFPLEVBQUUsWUFBWSxFQUFDO0NBQ2hFLEVBQUUsTUFBTSxNQUFNLEdBQUcsTUFBTSxPQUFPLENBQUMsSUFBSSxDQUFDO0NBQ3BDLEdBQUcsSUFBSSxDQUFDLHNCQUFzQjtDQUM5QixJQUFJLFlBQVk7Q0FDaEIsSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJO0NBQ2hDLElBQUksTUFBTSxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLGtCQUFrQixDQUFDLEtBQUssS0FBSztDQUM3RSxJQUFJLGVBQWU7Q0FDbkIsSUFBSTtDQUNKLEdBQUcsSUFBSSxPQUFPLENBQUMsQ0FBQyxPQUFPLEVBQUUsTUFBTSxLQUFLO0NBQ3BDLElBQUksY0FBYyxHQUFHLFVBQVUsQ0FBQyxNQUFNLE1BQU0sQ0FBQyx5QkFBeUIsQ0FBQyxFQUFFLEdBQUcsRUFBQztDQUM3RSxJQUFJLENBQUM7Q0FDTCxHQUFHLEVBQUM7Q0FDSixFQUFFLG1CQUFtQixDQUFDLEtBQUssR0FBRTtDQUM3QixFQUFFLFlBQVksQ0FBQyxjQUFjLEVBQUM7Q0FDOUIsRUFBRSxPQUFPLE1BQU0sS0FBSyxJQUFJO0NBQ3hCLEVBQUU7QUFDRjtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsc0JBQXNCLENBQUMsWUFBWSxFQUFFLGVBQWUsRUFBRTtDQUN2RCxFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMsNkVBQTZFLEVBQUM7Q0FDOUYsRUFBRSxPQUFPLElBQUksQ0FBQyxzQkFBc0I7Q0FDcEMsR0FBRyxZQUFZO0NBQ2YsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJO0NBQy9CLEdBQUcsTUFBTSxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxhQUFhLENBQUMsc0JBQXNCLENBQUM7Q0FDdEUsR0FBRyxlQUFlO0NBQ2xCLEdBQUc7Q0FDSCxFQUFFO0FBQ0Y7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLE1BQU0sYUFBYSxDQUFDLFlBQVksRUFBRSxlQUFlLEVBQUU7Q0FDcEQsRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLHFDQUFxQyxFQUFFLFlBQVksRUFBQztDQUNwRTtDQUNBLEVBQUUsTUFBTSxJQUFJLENBQUMsc0JBQXNCO0NBQ25DLEdBQUcsWUFBWTtDQUNmLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSTtDQUMvQixHQUFHLE1BQU0sSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsYUFBYSxDQUFDLHNCQUFzQixDQUFDLEtBQUssSUFBSTtDQUMvRSxHQUFHLGVBQWU7Q0FDbEIsSUFBRztDQUNILEVBQUU7QUFDRjtDQUNBOztDQ3ZMQTtBQUNBO0FBR0E7Q0FDQSxNQUFNLHVCQUF1QixTQUFTLEtBQUssQ0FBQyxFQUFFO0FBQzlDO0NBQ0EsTUFBTSxXQUFXLENBQUM7QUFDbEI7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLFdBQVcsQ0FBQyxTQUFTLEVBQUU7Q0FDeEIsRUFBRSxJQUFJLENBQUMsVUFBVSxHQUFHLFVBQVM7Q0FDN0IsRUFBRTtBQUNGO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLE1BQU0sTUFBTSxDQUFDLGVBQWUsRUFBRTtDQUMvQixFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMsb0JBQW9CLEVBQUM7Q0FDckMsRUFBRSxJQUFJLGFBQVk7Q0FDbEIsRUFBRSxJQUFJLGFBQVk7Q0FDbEIsRUFBRSxJQUFJO0NBQ04sR0FBRyxZQUFZLEdBQUcsTUFBTSxJQUFJLENBQUMsU0FBUyxDQUFDLHFCQUFxQixDQUFDLGVBQWUsRUFBQztDQUM3RSxHQUFHLFlBQVksR0FBRyxNQUFNLElBQUksQ0FBQyxTQUFTLENBQUMsZUFBZSxDQUFDLFlBQVksRUFBRSxlQUFlLEVBQUM7Q0FDckYsR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDLGNBQWMsRUFBRSxZQUFZLEVBQUM7Q0FDOUMsR0FBRyxNQUFNLFlBQVksR0FBRyxNQUFNLElBQUksQ0FBQyxTQUFTLENBQUMsc0JBQXNCLENBQUMsWUFBWSxFQUFFLGVBQWUsRUFBQztDQUNsRyxHQUFHLE1BQU0sSUFBSSxDQUFDLFNBQVMsQ0FBQyxhQUFhLENBQUMsWUFBWSxFQUFFLGVBQWUsRUFBQztDQUNwRSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxrQkFBa0IsRUFBRSxFQUFFLEVBQUM7Q0FDM0QsR0FBRyxPQUFPLElBQUk7Q0FDZCxHQUFHLENBQUMsTUFBTSxFQUFFLEVBQUU7Q0FDZCxHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUMsRUFBRSxFQUFDO0NBQ3BCLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLGtCQUFrQixFQUFFLEVBQUUsRUFBQztDQUMzRCxHQUFHLE1BQU0sSUFBSSx1QkFBdUIsQ0FBQyw2Q0FBNkMsRUFBRSxFQUFFLENBQUM7Q0FDdkYsR0FBRztDQUNILEVBQUU7QUFDRjtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsSUFBSSxTQUFTLEdBQUc7Q0FDakIsRUFBRSxPQUFPLElBQUksQ0FBQyxVQUFVO0NBQ3hCLEVBQUU7QUFDRjtDQUNBOztZQ3pDQSxNQUFNLEVBQUUsU0FBUyxXQUFXLENBQUM7QUFDN0I7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsQ0FBQyxPQUFPLE1BQU0sR0FBRztDQUNqQixFQUFFO0FBQ0Y7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLE1BQU0sbUNBQW1DLENBQUMsZUFBZSxFQUFFO0NBQzVELEVBQUU7QUFDRjtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLE1BQU0sa0JBQWtCLEdBQUc7Q0FDNUIsRUFBRTtBQUNGO0NBQ0E7O0NDaENBO0FBQ0E7QUFFQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNPLFNBQVMsc0JBQXNCLENBQUMsSUFBSSxFQUFFLGVBQWUsRUFBRTtDQUM5RCxDQUFDLE1BQU0sUUFBUSxHQUFHLENBQUMsR0FBRyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsdUNBQXVDLENBQUMsRUFBQztDQUNyRixDQUFDLFFBQVEsQ0FBQyxPQUFPLEdBQUU7Q0FDbkIsQ0FBQyxJQUFJLE1BQU0sT0FBTyxJQUFJLFFBQVEsRUFBRTtDQUNoQyxFQUFFLEdBQUcsZUFBZSxDQUFDLE1BQU0sQ0FBQyxPQUFPLEVBQUU7Q0FDckMsR0FBRyxLQUFLO0NBQ1IsR0FBRztDQUNILEVBQUUsTUFBTSxlQUFlLEdBQUcsT0FBTyxDQUFDLGVBQWUsQ0FBQztDQUNsRCxHQUFHLGtCQUFrQixFQUFFLElBQUk7Q0FDM0IsR0FBRyxxQkFBcUIsRUFBRSxJQUFJO0NBQzlCLEdBQUcsZUFBZSxFQUFFLElBQUk7Q0FDeEIsR0FBRyxFQUFDO0NBQ0osRUFBRSxHQUFHLGVBQWUsS0FBSyxLQUFLLEVBQUU7Q0FDaEMsR0FBRyxRQUFRO0NBQ1gsR0FBRztDQUNILEVBQUUsTUFBTSxRQUFRLEdBQUcsT0FBTyxDQUFDLHFCQUFxQixFQUFFLENBQUMsQ0FBQyxHQUFHLElBQUc7Q0FDMUQsRUFBRSxHQUFHLFFBQVEsS0FBSyxLQUFLLEVBQUU7Q0FDekIsR0FBRyxRQUFRO0NBQ1gsR0FBRztDQUNILEVBQUUsT0FBTyxDQUFDLFlBQVksQ0FBQyxrQkFBa0IsRUFBRSxFQUFFLEVBQUM7Q0FDOUMsRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLHNDQUFzQyxFQUFFLE9BQU8sRUFBQztDQUNoRSxFQUFFLE9BQU8sT0FBTztDQUNoQixFQUFFO0NBQ0YsQ0FBQztBQUNEO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNPLFNBQVMsbUJBQW1CLENBQUMsTUFBTSxFQUFFO0NBQzVDLENBQUMsT0FBTyxNQUFNLENBQUMsUUFBUSxDQUFDLGFBQWEsQ0FBQyx3Q0FBd0MsQ0FBQztDQUMvRSxDQUFDO0FBQ0Q7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDTyxlQUFlLGdCQUFnQixDQUFDLElBQUksRUFBRSxlQUFlLEVBQUU7Q0FDOUQsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLHlDQUF5QyxFQUFDO0NBQ3pELENBQUMsSUFBSSxrQkFBaUI7Q0FDdEIsQ0FBQyxJQUFJLGVBQWM7Q0FDbkIsQ0FBQyxJQUFJLGVBQWM7Q0FDbkIsQ0FBQyxNQUFNLHFCQUFxQixHQUFHLElBQUksZUFBZSxHQUFFO0NBQ3BELENBQUMsTUFBTSxZQUFZLEdBQUcsTUFBTTtDQUM1QixFQUFFLHFCQUFxQixDQUFDLEtBQUssR0FBRTtDQUMvQixFQUFFLFlBQVksQ0FBQyxpQkFBaUIsRUFBQztDQUNqQyxFQUFFLEdBQUcsY0FBYyxFQUFFO0NBQ3JCLEdBQUcsY0FBYyxHQUFFO0NBQ25CLEdBQUc7Q0FDSCxHQUFFO0NBQ0YsQ0FBQyxlQUFlLENBQUMsTUFBTSxDQUFDLGdCQUFnQixDQUFDLE9BQU8sRUFBRSxZQUFZLEVBQUM7Q0FDL0QsQ0FBQyxJQUFJLENBQUMsU0FBUyxHQUFHLEVBQUM7Q0FDbkIsQ0FBQyxJQUFJO0NBQ0wsRUFBRSxjQUFjLEdBQUcsTUFBTSxPQUFPLENBQUMsSUFBSSxDQUFDO0NBQ3RDLEdBQUcsY0FBYyxDQUFDLElBQUksRUFBRSxNQUFNO0NBQzlCLElBQUksR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxLQUFLLElBQUksRUFBRTtDQUMxRCxLQUFLLElBQUksQ0FBQyxTQUFTLEdBQUcsRUFBQztDQUN2QixLQUFLO0NBQ0wsSUFBSSxPQUFPLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO0NBQ25ELElBQUksRUFBRSxxQkFBcUIsQ0FBQztDQUM1QixHQUFHLElBQUksT0FBTyxDQUFDLE9BQU8sSUFBSTtDQUMxQixJQUFJLGNBQWMsR0FBRyxRQUFPO0NBQzVCLElBQUksaUJBQWlCLEdBQUcsVUFBVSxDQUFDLE1BQU07Q0FDekMsS0FBSyxPQUFPLEdBQUU7Q0FDZCxLQUFLLEVBQUUsS0FBSyxFQUFDO0NBQ2IsSUFBSSxDQUFDO0NBQ0wsR0FBRyxFQUFDO0NBQ0osRUFBRSxDQUFDLE1BQU0sRUFBRSxFQUFFO0NBQ2IsRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLEVBQUUsRUFBQztDQUNuQixFQUFFO0NBQ0YsQ0FBQyxxQkFBcUIsQ0FBQyxLQUFLLEdBQUU7Q0FDOUIsQ0FBQyxlQUFlLENBQUMsTUFBTSxDQUFDLG1CQUFtQixDQUFDLE9BQU8sRUFBRSxZQUFZLEVBQUM7Q0FDbEUsQ0FBQyxZQUFZLENBQUMsaUJBQWlCLEVBQUM7Q0FDaEMsQ0FBQyxHQUFHLGNBQWMsSUFBSSxjQUFjLEtBQUssSUFBSSxFQUFFO0NBQy9DLEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyw4REFBOEQsRUFBQztDQUMvRSxFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMsNkJBQTZCLEVBQUUsSUFBSSxDQUFDLFNBQVMsRUFBQztDQUM5RCxFQUFFLE1BQU0sY0FBYyxDQUFDLElBQUksRUFBRSxNQUFNLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLEtBQUssSUFBSSxFQUFFLGVBQWUsRUFBQztDQUN0RyxFQUFFO0NBQ0YsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLHdFQUF3RSxFQUFDO0NBQ3hGLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLCtCQUErQixFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxTQUFTLEtBQUssQ0FBQyxHQUFHLG1CQUFtQixHQUFHLHVFQUF1RSxDQUFDLENBQUMsSUFBRztDQUMvTCxDQUFDLE9BQU8sSUFBSSxDQUFDLFNBQVMsS0FBSyxDQUFDO0NBQzVCOztDQzlGQTtBQUNBO0FBR0E7Q0FDQSxNQUFNLGlCQUFpQixTQUFTLFdBQVcsQ0FBQztBQUM1QztDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsQ0FBQyxtQ0FBbUMsQ0FBQyxlQUFlLEVBQUU7Q0FDdEQsRUFBRSxPQUFPLGdCQUFnQixDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsZUFBZSxDQUFDO0NBQ3JELEVBQUU7QUFDRjtDQUNBOztDQ2ZBO0FBQ0E7QUFNQTtDQUNBLE1BQU0sU0FBUyxTQUFTQSxJQUFFLENBQUM7QUFDM0I7Q0FDQSxDQUFDLFdBQVcsQ0FBQyxJQUFJLEVBQUUsVUFBVSxDQUFDLEVBQUUsRUFBRTtDQUNsQyxFQUFFLEtBQUssQ0FBQyxJQUFJLEVBQUUsVUFBVSxFQUFDO0NBQ3pCLEVBQUUsSUFBSSxDQUFDLGFBQWEsR0FBRyxLQUFJO0NBQzNCLEVBQUU7QUFDRjtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsQ0FBQyxPQUFPLE1BQU0sQ0FBQyxNQUFNLEVBQUU7Q0FDdkIsRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLFdBQVcsRUFBQztDQUM1QixFQUFFLE1BQU0sc0JBQXNCLEdBQUcsbUJBQW1CLENBQUMsTUFBTSxFQUFDO0NBQzVELEVBQUUsR0FBRyxzQkFBc0IsS0FBSyxJQUFJLEVBQUU7Q0FDdEMsR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDLDhCQUE4QixFQUFFLHNCQUFzQixFQUFDO0NBQ3hFLEdBQUcsTUFBTSxpQkFBaUIsR0FBRyxJQUFJLGlCQUFpQixDQUFDLHNCQUFzQixFQUFDO0NBQzFFLEdBQUcsT0FBTyxJQUFJLFNBQVMsQ0FBQyxNQUFNLEVBQUUsRUFBRSxpQkFBaUIsRUFBRSxDQUFDO0NBQ3RELEdBQUcsTUFBTTtDQUNULEdBQUcsTUFBTSxJQUFJLEtBQUssQ0FBQyx1Q0FBdUMsQ0FBQztDQUMzRCxHQUFHO0NBQ0gsRUFBRTtBQUNGO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLE1BQU0sbUNBQW1DLENBQUMsZUFBZSxFQUFFO0NBQzVELEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyx3Q0FBd0MsRUFBQztDQUN6RCxFQUFFLE9BQU8sTUFBTSxJQUFJLENBQUMsVUFBVSxDQUFDLGlCQUFpQixDQUFDLG1DQUFtQyxDQUFDLGVBQWUsQ0FBQztDQUNyRyxFQUFFO0FBQ0Y7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsTUFBTSxrQkFBa0IsQ0FBQyxlQUFlLEVBQUU7Q0FDM0MsRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLHVCQUF1QixFQUFFLElBQUksQ0FBQyxhQUFhLEVBQUM7Q0FDNUQsRUFBRSxNQUFNLHFCQUFxQixHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsaUJBQWlCLENBQUMsS0FBSTtDQUN0RSxFQUFFLE1BQU0sY0FBYyxHQUFHLElBQUksQ0FBQyxhQUFhLElBQUkscUJBQXFCLENBQUMsWUFBWSxHQUFHLHFCQUFxQixDQUFDLGFBQVk7Q0FDdEgsRUFBRSxJQUFJLElBQUksQ0FBQyxHQUFHLGNBQWMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxHQUFHO0NBQ2hELEdBQUcsR0FBRyxlQUFlLENBQUMsTUFBTSxDQUFDLE9BQU8sRUFBRTtDQUN0QyxJQUFJLEtBQUs7Q0FDVCxJQUFJO0NBQ0osR0FBRyxJQUFJLENBQUMsYUFBYSxHQUFHLEVBQUM7Q0FDekIsR0FBRyxxQkFBcUIsQ0FBQyxTQUFTLEdBQUcsRUFBQztDQUN0QyxHQUFHLHFCQUFxQixDQUFDLGFBQWEsQ0FBQyxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxFQUFDO0NBQ3JFLEdBQUcsTUFBTSxJQUFJLE9BQU8sQ0FBQyxPQUFPLElBQUksVUFBVSxDQUFDLE9BQU8sRUFBRSxFQUFFLENBQUMsRUFBQztDQUN4RCxHQUFHLElBQUk7Q0FDUCxJQUFJLE1BQU0sY0FBYyxHQUFHLHNCQUFzQixDQUFDLHFCQUFxQixFQUFFLGVBQWUsRUFBQztDQUN6RixJQUFJLEdBQUcsY0FBYyxFQUFFO0NBQ3ZCLEtBQUssTUFBTSxTQUFTLEdBQUcsSUFBSSxTQUFTLENBQUMsY0FBYyxFQUFDO0NBQ3BELEtBQUssT0FBTyxJQUFJLFdBQVcsQ0FBQyxTQUFTLENBQUM7Q0FDdEMsS0FBSztDQUNMLElBQUksQ0FBQyxNQUFNLEVBQUUsRUFBRTtDQUNmLElBQUksT0FBTyxDQUFDLEtBQUssQ0FBQyxFQUFFLEVBQUM7Q0FDckIsSUFBSTtDQUNKLEdBQUc7Q0FDSCxFQUFFLE9BQU8sS0FBSztDQUNkLEVBQUU7QUFDRjtDQUNBOztDQ3JFQTtDQUNBO0NBQ0E7Q0FDQTtBQUNBO0FBRUE7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNlLFNBQVMsS0FBSyxHQUFHO0NBQ2hDLENBQUMsT0FBTyxTQUFTO0NBQ2pCOztDQ2JBO0FBQ0E7QUFPQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLE1BQU0sSUFBSSxDQUFDO0FBQ1g7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsV0FBVyxDQUFDLEVBQUUsRUFBRTtDQUNqQixFQUFFLElBQUksQ0FBQyxHQUFHLEdBQUcsR0FBRTtDQUNmLEVBQUU7QUFDRjtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLE9BQU8sTUFBTSxDQUFDLE1BQU0sRUFBRTtDQUN2QixFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMsYUFBYSxFQUFDO0NBQzlCLEVBQUUsTUFBTSxFQUFFLEdBQUcsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBQztDQUNuQyxFQUFFLE9BQU8sSUFBSSxJQUFJLENBQUMsRUFBRSxDQUFDO0NBQ3JCLEVBQUU7QUFDRjtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsQ0FBQyxtQ0FBbUMsQ0FBQyxlQUFlLEVBQUU7Q0FDdEQsRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLDBDQUEwQyxFQUFDO0NBQzNELEVBQUUsT0FBTyxJQUFJLENBQUMsRUFBRSxDQUFDLG1DQUFtQyxDQUFDLGVBQWUsQ0FBQztDQUNyRSxFQUFFO0FBQ0Y7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsa0JBQWtCLENBQUMsZUFBZSxFQUFFO0NBQ3JDLEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyx5QkFBeUIsRUFBQztDQUMxQyxFQUFFLE9BQU8sSUFBSSxDQUFDLEVBQUUsQ0FBQyxrQkFBa0IsQ0FBQyxlQUFlLENBQUM7Q0FDcEQsRUFBRTtBQUNGO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLElBQUksRUFBRSxHQUFHO0NBQ1YsRUFBRSxPQUFPLElBQUksQ0FBQyxHQUFHO0NBQ2pCLEVBQUU7QUFDRjtDQUNBOztDQzNEQTtBQUNBO0FBS0E7Q0FDQSxNQUFNLElBQUksQ0FBQztBQUNYO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsV0FBVyxDQUFDLE1BQU0sRUFBRSxZQUFZLEVBQUU7Q0FDbkMsRUFBRSxJQUFJLENBQUMsTUFBTSxHQUFHLE9BQU07Q0FDdEIsRUFBRSxJQUFJLENBQUMsSUFBSSxHQUFHLEtBQUk7Q0FDbEIsRUFBRSxJQUFJLENBQUMsWUFBWSxHQUFHLGFBQVk7Q0FDbEMsRUFBRTtBQUNGO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLGtCQUFrQixDQUFDLGVBQWUsRUFBRTtDQUNyQyxFQUFFLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxlQUFlLENBQUM7Q0FDdEQsRUFBRTtBQUNGO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLGFBQWEsQ0FBQyxJQUFJLEVBQUU7Q0FDckIsRUFBRSxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksRUFBQztDQUN6QixFQUFFO0FBQ0Y7QUFDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLG1DQUFtQyxDQUFDLGVBQWUsRUFBRTtDQUN0RCxFQUFFLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQyxtQ0FBbUMsQ0FBQyxlQUFlLENBQUM7Q0FDdkUsRUFBRTtBQUNGO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsQ0FBQyxRQUFRLEdBQUc7Q0FDWixFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMsVUFBVSxFQUFDO0NBQzNCLEVBQUUsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUM7Q0FDdEMsRUFBRTtBQUNGO0FBQ0E7Q0FDQTs7Q0N2REE7QUFDQTtBQUdBO0NBQ0EsTUFBTSxjQUFjLENBQUM7QUFDckI7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsV0FBVyxDQUFDLElBQUksRUFBRTtDQUNuQixFQUFFLElBQUksQ0FBQyxLQUFLLEdBQUcsS0FBSTtDQUNuQixFQUFFO0FBQ0Y7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsQ0FBQyxTQUFTLEdBQUc7Q0FDYixFQUFFO0FBQ0Y7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsSUFBSSxHQUFHO0NBQ1IsRUFBRTtBQUNGO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLEtBQUssR0FBRztDQUNULEVBQUU7QUFDRjtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsQ0FBQyxNQUFNLEdBQUcsR0FBRztDQUNiLEVBQUU7QUFDRjtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsQ0FBQyxJQUFJLElBQUksR0FBRztDQUNaLEVBQUUsT0FBTyxJQUFJLENBQUMsS0FBSztDQUNuQixFQUFFO0FBQ0Y7Q0FDQTs7Q0NwREE7QUFDQTtBQUlBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsTUFBTSxlQUFlLFNBQVMsY0FBYyxDQUFDO0FBQzdDO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsQ0FBQyxXQUFXLENBQUMsSUFBSSxFQUFFO0NBQ25CLEVBQUUsS0FBSyxDQUFDLElBQUksRUFBQztDQUNiLEVBQUUsSUFBSSxDQUFDLGVBQWUsR0FBRyxNQUFLO0NBQzlCLEVBQUUsSUFBSSxDQUFDLFlBQVksR0FBRyxFQUFDO0NBQ3ZCLEVBQUUsSUFBSSxDQUFDLGlCQUFpQixHQUFHLEVBQUM7Q0FDNUIsRUFBRSxJQUFJLENBQUMsUUFBUSxHQUFHLE1BQUs7Q0FDdkIsRUFBRSxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsS0FBSTtDQUM5QixFQUFFLElBQUksQ0FBQyxlQUFlLEdBQUcsS0FBSTtDQUM3QixFQUFFO0FBQ0Y7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsU0FBUyxHQUFHO0NBQ2IsRUFBRSxPQUFPLElBQUksQ0FBQyxRQUFRLElBQUksSUFBSSxDQUFDLGdCQUFnQixJQUFJLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxNQUFNLENBQUMsT0FBTyxLQUFLLEtBQUs7Q0FDakcsRUFBRTtBQUNGO0NBQ0EsQ0FBQyxJQUFJLEdBQUc7Q0FDUixFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMsc0JBQXNCLEVBQUM7Q0FDdkMsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxhQUFhLEVBQUM7Q0FDeEMsRUFBRSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxHQUFFO0NBQy9CLEVBQUU7QUFDRjtDQUNBLENBQUMsS0FBSyxHQUFHO0NBQ1QsRUFBRSxJQUFJLENBQUMsZUFBZSxHQUFHLE1BQUs7Q0FDOUIsRUFBRSxJQUFJLENBQUMsWUFBWSxHQUFHLEVBQUM7Q0FDdkIsRUFBRSxJQUFJLENBQUMsZUFBZSxHQUFHLEtBQUk7Q0FDN0IsRUFBRSxJQUFJLENBQUMsaUJBQWlCLEdBQUcsRUFBQztDQUM1QixFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLE9BQU8sRUFBQztDQUNsQyxFQUFFO0FBQ0Y7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsTUFBTSxHQUFHLEdBQUc7Q0FDYixFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMsdUJBQXVCLEVBQUM7Q0FDeEMsRUFBRSxJQUFJLENBQUMsWUFBWSxHQUFHLEVBQUM7Q0FDdkIsRUFBRSxJQUFJLENBQUMsaUJBQWlCLEdBQUcsRUFBQztDQUM1QixFQUFFLElBQUksQ0FBQyxRQUFRLEdBQUcsS0FBSTtDQUN0QixFQUFFLElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxJQUFJLGVBQWUsR0FBRTtDQUMvQyxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxHQUFFO0NBQ3RCLEVBQUUsSUFBSTtDQUNOLEdBQUcsR0FBRyxJQUFJLENBQUMsZUFBZSxFQUFFO0NBQzVCLElBQUksTUFBTSxJQUFJLENBQUMsa0JBQWtCLEdBQUU7Q0FDbkMsSUFBSSxNQUFNO0NBQ1YsSUFBSSxNQUFNLElBQUksQ0FBQyxhQUFhLEdBQUU7Q0FDOUIsSUFBSTtDQUNKLEdBQUcsR0FBRyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsTUFBTSxDQUFDLE9BQU8sRUFBRTtDQUM1QyxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxZQUFZLENBQUMsbUJBQW1CLENBQUMsRUFBQztDQUMvRSxJQUFJLE9BQU8sQ0FBQyxLQUFLLENBQUMseUJBQXlCLEVBQUM7Q0FDNUMsSUFBSSxNQUFNO0NBQ1YsSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsWUFBWSxDQUFDLG1CQUFtQixDQUFDLEVBQUM7Q0FDNUUsSUFBSSxPQUFPLENBQUMsS0FBSyxDQUFDLHNCQUFzQixFQUFDO0NBQ3pDLElBQUk7Q0FDSixHQUFHLENBQUMsTUFBTSxFQUFFLEVBQUU7Q0FDZCxHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUMsRUFBRSxFQUFDO0NBQ3BCLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLFlBQVksQ0FBQyxtQkFBbUIsQ0FBQyxFQUFDO0NBQzlFLEdBQUcsT0FBTyxDQUFDLEtBQUssQ0FBQyx5QkFBeUIsRUFBQztDQUMzQyxHQUFHO0NBQ0gsRUFBRSxJQUFJLENBQUMsUUFBUSxHQUFHLE1BQUs7Q0FDdkIsRUFBRTtBQUNGO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsQ0FBQyxNQUFNLGFBQWEsR0FBRztDQUN2QixFQUFFLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLE1BQU0sQ0FBQyxPQUFPLEVBQUU7Q0FDM0MsR0FBRyxNQUFNO0NBQ1QsR0FBRztDQUNILEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsc0JBQXNCLEVBQUM7Q0FDakQsRUFBRSxJQUFJO0NBQ04sR0FBRyxNQUFNLElBQUksR0FBRyxNQUFNLElBQUksQ0FBQyxJQUFJLENBQUMsbUNBQW1DLENBQUMsSUFBSSxDQUFDLGdCQUFnQixFQUFDO0NBQzFGLEdBQUcsR0FBRyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsTUFBTSxDQUFDLE9BQU8sS0FBSyxLQUFLLEVBQUU7Q0FDdEQsSUFBSSxHQUFHLElBQUksRUFBRTtDQUNiLEtBQUssSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxrQkFBa0IsRUFBRSxJQUFJLENBQUMsaUJBQWlCLENBQUMsYUFBYSxDQUFDLEVBQUM7Q0FDeEYsS0FBSyxJQUFJLENBQUMsZUFBZSxHQUFHLEtBQUk7Q0FDaEMsS0FBSyxNQUFNLElBQUksQ0FBQyxrQkFBa0IsR0FBRTtDQUNwQyxLQUFLLE1BQU07Q0FDWCxLQUFLLElBQUksQ0FBQyxpQkFBaUIsR0FBRTtDQUM3QixLQUFLLE1BQU0sSUFBSSxDQUFDLGFBQWEsR0FBRTtDQUMvQixLQUFLO0NBQ0wsSUFBSTtDQUNKLEdBQUcsQ0FBQyxNQUFNLEVBQUUsRUFBRTtDQUNkLEdBQUcsT0FBTyxDQUFDLEtBQUssQ0FBQyxFQUFFLEVBQUM7Q0FDcEIsR0FBRztDQUNILEVBQUU7QUFDRjtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsTUFBTSxrQkFBa0IsR0FBRztDQUM1QixFQUFFLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLE1BQU0sQ0FBQyxPQUFPLEVBQUU7Q0FDM0MsR0FBRyxNQUFNO0NBQ1QsR0FBRztDQUNILEVBQUUsSUFBSSxTQUFTLEdBQUcsS0FBSTtDQUN0QixFQUFFLElBQUk7Q0FDTixHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLDRCQUE0QixFQUFDO0NBQ3hELEdBQUcsTUFBTSxXQUFXLEdBQUcsTUFBTSxJQUFJLENBQUMsSUFBSSxDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FBQyxnQkFBZ0IsRUFBQztDQUNoRixHQUFHLFNBQVMsR0FBRyxXQUFXLEtBQUssTUFBSztDQUNwQyxHQUFHLEdBQUcsV0FBVyxFQUFFO0NBQ25CLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsc0JBQXNCLEVBQUM7Q0FDbkQsSUFBSSxJQUFJLElBQUksQ0FBQyxlQUFlLEtBQUssSUFBSSxFQUFFO0NBQ3ZDLEtBQUssTUFBTSxrQkFBa0IsR0FBRyxJQUFJLElBQUksRUFBRSxDQUFDLE9BQU8sRUFBRSxHQUFHLElBQUksQ0FBQyxlQUFlLENBQUMsT0FBTyxHQUFFO0NBQ3JGLEtBQUssR0FBRyxrQkFBa0IsR0FBRyxJQUFJLEVBQUU7Q0FDbkMsTUFBTSxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDLFFBQVEsRUFBRSxrQkFBa0IsQ0FBQyxtQ0FBbUMsQ0FBQyxFQUFDO0NBQ2pHLE1BQU0sTUFBTSxJQUFJLE9BQU8sQ0FBQyxPQUFPLElBQUksVUFBVSxDQUFDLE9BQU8sRUFBRSxrQkFBa0IsQ0FBQyxFQUFDO0NBQzNFLE1BQU07Q0FDTixLQUFLO0NBQ0wsSUFBSSxNQUFNLE1BQU0sR0FBRyxNQUFNLFdBQVcsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLGdCQUFnQixFQUFDO0NBQ2xFO0NBQ0EsSUFBSSxJQUFJLENBQUMsZUFBZSxHQUFHLElBQUksSUFBSSxHQUFFO0NBQ3JDLElBQUksSUFBSSxDQUFDLFlBQVksR0FBRTtDQUN2QjtDQUNBLElBQUk7Q0FDSixHQUFHLENBQUMsTUFBTSxFQUFFLEVBQUU7Q0FDZCxHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUMsRUFBRSxFQUFDO0NBQ3BCLEdBQUcsU0FBUztDQUNaLEdBQUcsR0FBRyxTQUFTLEVBQUU7Q0FDakIsSUFBSSxNQUFNLElBQUksQ0FBQyxrQkFBa0IsR0FBRTtDQUNuQyxJQUFJO0NBQ0osR0FBRztDQUNILEVBQUU7QUFDRjtDQUNBOztDQzNJQTtBQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNPLFNBQVMsMEJBQTBCLENBQUMsUUFBUSxFQUFFO0NBQ3JELENBQUMsTUFBTSxvQkFBb0IsR0FBRyxRQUFRLENBQUMsYUFBYSxDQUFDLEtBQUssRUFBQztDQUMzRCxDQUFDLG9CQUFvQixDQUFDLEVBQUUsR0FBRyxjQUFhO0NBQ3hDLENBQUMsb0JBQW9CLENBQUMsS0FBSyxDQUFDLFFBQVEsR0FBRyxRQUFPO0NBQzlDLENBQUMsb0JBQW9CLENBQUMsS0FBSyxDQUFDLEdBQUcsR0FBRyxPQUFNO0NBQ3hDLENBQUMsb0JBQW9CLENBQUMsS0FBSyxDQUFDLEtBQUssR0FBRyxPQUFNO0NBQzFDLENBQUMsb0JBQW9CLENBQUMsS0FBSyxDQUFDLE9BQU8sR0FBRyxPQUFNO0NBQzVDLENBQUMsT0FBTyxvQkFBb0I7Q0FDNUI7O0NDZkE7QUFDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ08sU0FBUyxvQkFBb0IsQ0FBQyxRQUFRLEVBQUU7Q0FDL0MsQ0FBQyxNQUFNLGNBQWMsR0FBRyxRQUFRLENBQUMsYUFBYSxDQUFDLEtBQUssRUFBQztDQUNyRCxDQUFDLGNBQWMsQ0FBQyxFQUFFLEdBQUcsZUFBYztDQUNuQyxDQUFDLGNBQWMsQ0FBQyxRQUFRLEdBQUcsRUFBQztDQUM1QixDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsR0FBRyxHQUFHLElBQUc7Q0FDL0IsQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLEtBQUssR0FBRyxJQUFHO0NBQ2pDLENBQUMsY0FBYyxDQUFDLEtBQUssQ0FBQyxRQUFRLEdBQUcsUUFBTztDQUN4QyxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsS0FBSyxHQUFHLFFBQU87Q0FDckMsQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxRQUFPO0NBQ3RDLENBQUMsY0FBYyxDQUFDLEtBQUssQ0FBQyxNQUFNLEdBQUcsTUFBSztDQUNwQyxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsZUFBZSxHQUFHLFlBQVc7Q0FDbkQsQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLE9BQU8sR0FBRyxPQUFNO0NBQ3RDLENBQUMsT0FBTyxjQUFjO0NBQ3RCOztDQ25CQTtDQUNBO0NBQ0E7QUFDQTtBQVdBO0NBQ0EsTUFBTSxFQUFFLENBQUM7Q0FDVDtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLFdBQVcsQ0FBQyxRQUFRLEVBQUUsSUFBSSxFQUFFLGNBQWMsRUFBRSxXQUFXLEVBQUUsMEJBQTBCLEVBQUUsYUFBYSxFQUFFO0NBQ3JHLEVBQUUsSUFBSSxDQUFDLFNBQVMsR0FBRyxTQUFRO0NBQzNCLEVBQUUsSUFBSSxDQUFDLEtBQUssR0FBRyxLQUFJO0NBQ25CLEVBQUUsSUFBSSxDQUFDLGVBQWUsR0FBRyxlQUFjO0NBQ3ZDLEVBQUUsSUFBSSxDQUFDLFlBQVksR0FBRyxZQUFXO0NBQ2pDLEVBQUUsSUFBSSxDQUFDLGNBQWMsR0FBRyxjQUFhO0NBQ3JDLEVBQUUsSUFBSSxDQUFDLDJCQUEyQixHQUFHLDJCQUEwQjtDQUMvRCxFQUFFLElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBQztDQUNsRSxFQUFFLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxlQUFlLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBQztDQUNsRCxFQUFFO0FBQ0Y7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsQ0FBQyxPQUFPLE1BQU0sQ0FBQyxNQUFNLEVBQUU7Q0FDdkIsRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLFFBQVEsRUFBQztDQUN6QixFQUFFLE1BQU0sRUFBRSxHQUFHLEVBQUUsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLFFBQVEsRUFBQztDQUN2QyxFQUFFLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxFQUFFLENBQUMsSUFBSSxFQUFDO0NBQzNDLEVBQUUsT0FBTyxFQUFFO0NBQ1gsRUFBRTtBQUNGO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsT0FBTyxNQUFNLENBQUMsUUFBUSxFQUFFO0NBQ3pCLEVBQUUsTUFBTSxJQUFJLEdBQUcsUUFBUSxDQUFDLGFBQWEsQ0FBQyxLQUFLLEVBQUM7Q0FDNUMsRUFBRSxJQUFJLENBQUMsRUFBRSxHQUFHLFlBQVc7Q0FDdkIsRUFBRSxNQUFNLFdBQVcsR0FBRyxpQkFBaUIsQ0FBQyxRQUFRLEVBQUM7Q0FDakQsRUFBRSxNQUFNLGNBQWMsR0FBRyxvQkFBb0IsQ0FBQyxRQUFRLEVBQUM7Q0FDdkQsRUFBRSxNQUFNLG9CQUFvQixHQUFHLDBCQUEwQixDQUFDLFFBQVEsRUFBQztDQUNuRSxFQUFFLE1BQU0sMEJBQTBCLEdBQUcsdUJBQXVCLENBQUMsUUFBUSxFQUFFLGdCQUFnQixFQUFFLFlBQVksQ0FBQyxPQUFPLEVBQUM7Q0FDOUcsRUFBRSxNQUFNLGFBQWEsR0FBRyxRQUFRLENBQUMsYUFBYSxDQUFDLEtBQUssRUFBQztDQUNyRCxFQUFFLGFBQWEsQ0FBQyxXQUFXLEdBQUcsUUFBTztDQUNyQyxFQUFFLGFBQWEsQ0FBQyxFQUFFLEdBQUcsY0FBYTtDQUNsQyxFQUFFLGFBQWEsQ0FBQyxLQUFLLEdBQUcsZUFBYztDQUN0QyxFQUFFLFFBQVEsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLGNBQWMsRUFBQztDQUMzQyxFQUFFLFFBQVEsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLG9CQUFvQixFQUFDO0NBQ2pELEVBQUUsV0FBVyxDQUFDLFdBQVcsQ0FBQywwQkFBMEIsRUFBQztDQUNyRCxFQUFFLFdBQVcsQ0FBQyxXQUFXLENBQUMsYUFBYSxFQUFDO0NBQ3hDLEVBQUUsSUFBSSxDQUFDLFdBQVcsQ0FBQyxXQUFXLEVBQUM7Q0FDL0IsRUFBRSxNQUFNLEVBQUUsR0FBRyxJQUFJLEVBQUUsQ0FBQyxRQUFRLEVBQUUsSUFBSSxFQUFFLGNBQWMsRUFBRSxXQUFXLEVBQUUsMEJBQTBCLEVBQUUsYUFBYSxFQUFDO0NBQzNHLEVBQUUsUUFBUSxDQUFDLGdCQUFnQixDQUFDLFNBQVMsRUFBRSxDQUFDLEtBQUssS0FBSyxFQUFFLENBQUMsaUJBQWlCLENBQUMsS0FBSyxDQUFDLEVBQUM7Q0FDOUUsRUFBRSxRQUFRLENBQUMsZ0JBQWdCLENBQUMsT0FBTyxFQUFFLENBQUMsS0FBSyxLQUFLLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxLQUFLLENBQUMsRUFBQztDQUM1RSxFQUFFLDBCQUEwQixDQUFDLGdCQUFnQixDQUFDLE9BQU8sRUFBRSxDQUFDLEtBQUssS0FBSyxFQUFFLENBQUMsa0NBQWtDLENBQUMsS0FBSyxDQUFDLEVBQUM7Q0FDL0csRUFBRSxJQUFJLENBQUMsaUJBQWlCLEdBQUcsSUFBSSxnQkFBZ0IsQ0FBQyxDQUFDLFNBQVMsS0FBSyxFQUFFLENBQUMsWUFBWSxDQUFDLEVBQUUsRUFBRSxTQUFTLENBQUMsRUFBQztDQUM5RixFQUFFLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsRUFBQztDQUNwRSxFQUFFLDBCQUEwQixDQUFDLGVBQWUsR0FBRywwQkFBMEIsQ0FBQyxZQUFXO0NBQ3JGLEVBQUUsMEJBQTBCLENBQUMsbUJBQW1CLEdBQUcsMEJBQTBCLENBQUMsS0FBSyxDQUFDLGdCQUFlO0NBQ25HLEVBQUUsT0FBTyxFQUFFO0NBQ1gsRUFBRTtBQUNGO0NBQ0EsQ0FBQyxNQUFNLGVBQWUsR0FBRztDQUN6QixFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMsNkZBQTZGLENBQUM7Q0FDOUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxnQkFBZ0IsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxNQUFNLElBQUksTUFBTSxLQUFLLElBQUksQ0FBQywwQkFBMEIsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxNQUFNLElBQUk7Q0FDbkksR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDLFVBQVUsR0FBRyxTQUFRO0NBQ3JDLEdBQUcsTUFBTSxDQUFDLFFBQVEsR0FBRyxLQUFJO0NBQ3pCLEdBQUcsRUFBQztDQUNKLEVBQUUsSUFBSSxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsT0FBTyxHQUFHLEdBQUU7Q0FDeEMsRUFBRSxJQUFJLENBQUMsY0FBYyxDQUFDLEtBQUssR0FBRTtDQUM3QixFQUFFLElBQUksQ0FBQywwQkFBMEIsQ0FBQyxXQUFXLEdBQUcsa0JBQWlCO0NBQ2pFLEVBQUUsSUFBSSxDQUFDLDBCQUEwQixDQUFDLEtBQUssQ0FBQyxlQUFlLEdBQUcsVUFBUztDQUNuRSxFQUFFLE1BQU0sSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLEdBQUU7Q0FDM0IsRUFBRSxJQUFJLENBQUMsb0JBQW9CLEdBQUU7Q0FDN0IsRUFBRTtBQUNGO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLFlBQVksQ0FBQyxFQUFFLEVBQUU7Q0FDbEIsRUFBRSxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLGFBQWEsQ0FBQywrQkFBK0IsQ0FBQyxLQUFLLElBQUksSUFBSSxFQUFFLEVBQUU7Q0FDMUYsR0FBRyxHQUFHLElBQUksQ0FBQyxpQkFBaUIsRUFBRTtDQUM5QixJQUFJLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxVQUFVLEdBQUU7Q0FDdkMsSUFBSTtDQUNKLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixHQUFHLElBQUksZ0JBQWdCLENBQUMsRUFBRSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxFQUFDO0NBQ2hGLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxhQUFhLENBQUMsK0JBQStCLENBQUMsRUFBRSxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsVUFBVSxFQUFFLElBQUksRUFBRSxFQUFDO0NBQzlJLEdBQUc7Q0FDSCxFQUFFLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxZQUFZLENBQUMsRUFBRTtDQUM3RCxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsS0FBSyxHQUFFO0NBQ3hCLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxHQUFHLEdBQUU7Q0FDL0IsR0FBRyxNQUFNO0NBQ1QsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLEdBQUcsT0FBTTtDQUNuQyxHQUFHLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxTQUFTLEVBQUUsRUFBRTtDQUNqQyxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxHQUFFO0NBQ3hCLElBQUk7Q0FDSixHQUFHO0NBQ0gsRUFBRTtBQUNGO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsa0NBQWtDLEdBQUc7Q0FDdEMsRUFBRSxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsU0FBUyxFQUFFLEVBQUU7Q0FDaEMsR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDLDJDQUEyQyxFQUFDO0NBQzdELEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEdBQUU7Q0FDdkIsR0FBRyxJQUFJLENBQUMsb0JBQW9CLEdBQUU7Q0FDOUIsR0FBRyxNQUFNO0NBQ1QsR0FBRyxJQUFJLENBQUMsZUFBZSxHQUFFO0NBQ3pCLEdBQUc7Q0FDSCxFQUFFO0FBQ0Y7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsQ0FBQyxpQkFBaUIsQ0FBQyxLQUFLLEVBQUU7Q0FDMUIsRUFBRSxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsU0FBUyxFQUFFLEVBQUU7Q0FDaEMsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLGtHQUFrRyxFQUFDO0NBQ2xILEdBQUcsS0FBSyxDQUFDLHdCQUF3QixHQUFFO0NBQ25DLEdBQUcsS0FBSyxDQUFDLGNBQWMsR0FBRTtDQUN6QixHQUFHLEtBQUssQ0FBQyxlQUFlLEdBQUU7Q0FDMUIsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLEtBQUssR0FBRTtDQUM5QixHQUFHLE9BQU8sS0FBSztDQUNmLEdBQUc7Q0FDSCxFQUFFO0FBQ0Y7Q0FDQSxDQUFDLG9CQUFvQixHQUFHO0NBQ3hCLEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyw0QkFBNEIsQ0FBQztDQUM3QyxHQUFHLENBQUMsR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLGdCQUFnQixDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLE1BQU0sSUFBSSxNQUFNLEtBQUssSUFBSSxDQUFDLDBCQUEwQixDQUFDLENBQUMsT0FBTyxDQUFDLE1BQU0sSUFBSTtDQUNuSSxHQUFHLE1BQU0sQ0FBQyxLQUFLLENBQUMsVUFBVSxHQUFHLEdBQUU7Q0FDL0IsR0FBRyxNQUFNLENBQUMsUUFBUSxHQUFHLE1BQUs7Q0FDMUIsR0FBRyxFQUFDO0NBQ0osRUFBRSxJQUFJLENBQUMsMEJBQTBCLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQywwQkFBMEIsQ0FBQyxnQkFBZTtDQUMvRixFQUFFLElBQUksQ0FBQywwQkFBMEIsQ0FBQyxLQUFLLENBQUMsZUFBZSxHQUFHLElBQUksQ0FBQywwQkFBMEIsQ0FBQyxvQkFBbUI7Q0FDN0csRUFBRSxJQUFJLENBQUMsY0FBYyxDQUFDLEtBQUssQ0FBQyxPQUFPLEdBQUcsT0FBTTtDQUM1QyxFQUFFO0FBQ0Y7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsWUFBWSxDQUFDLElBQUksRUFBRTtDQUNwQixFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsV0FBVyxHQUFHLEtBQUk7Q0FDdkMsRUFBRTtBQUNGO0FBQ0E7QUFDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsQ0FBQyxJQUFJLFFBQVEsR0FBRztDQUNoQixFQUFFLE9BQU8sSUFBSSxDQUFDLFNBQVM7Q0FDdkIsRUFBRTtBQUNGO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLElBQUksTUFBTSxHQUFHO0NBQ2QsRUFBRSxPQUFPLElBQUksQ0FBQyxTQUFTLENBQUMsV0FBVztDQUNuQyxFQUFFO0FBQ0Y7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsSUFBSSxJQUFJLEdBQUc7Q0FDWixFQUFFLE9BQU8sSUFBSSxDQUFDLEtBQUs7Q0FDbkIsRUFBRTtBQUNGO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLElBQUksY0FBYyxHQUFHO0NBQ3RCLEVBQUUsT0FBTyxJQUFJLENBQUMsZUFBZTtDQUM3QixFQUFFO0FBQ0Y7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsSUFBSSxXQUFXLEdBQUc7Q0FDbkIsRUFBRSxPQUFPLElBQUksQ0FBQyxZQUFZO0NBQzFCLEVBQUU7QUFDRjtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsQ0FBQyxJQUFJLDBCQUEwQixHQUFHO0NBQ2xDLEVBQUUsT0FBTyxJQUFJLENBQUMsMkJBQTJCO0NBQ3pDLEVBQUU7QUFDRjtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsQ0FBQyxJQUFJLGFBQWEsR0FBRztDQUNyQixFQUFFLE9BQU8sSUFBSSxDQUFDLGNBQWM7Q0FDNUIsRUFBRTtBQUNGO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLElBQUksd0JBQXdCLEdBQUc7Q0FDaEMsRUFBRSxPQUFPLElBQUksQ0FBQyx5QkFBeUI7Q0FDdkMsRUFBRTtBQUNGO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLElBQUksUUFBUSxHQUFHO0NBQ2hCLEVBQUUsT0FBTyxJQUFJLENBQUMsU0FBUztDQUN2QixFQUFFO0FBQ0Y7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsSUFBSSxJQUFJLEdBQUc7Q0FDWixFQUFFLE9BQU8sSUFBSSxDQUFDLEtBQUs7Q0FDbkIsRUFBRTtBQUNGO0NBQ0E7O0NDelBBO0FBQ0E7QUFFQTtDQUNBO0NBQ0E7Q0FDQTtDQUNPLFNBQVMsSUFBSSxDQUFDLE1BQU0sRUFBRTtDQUM3QixDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFDO0NBQ2xCLENBQUM7QUFDRDtDQUNBLEdBQUcsT0FBTyxNQUFNLEtBQUssV0FBVyxFQUFFO0NBQ2xDLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBQztDQUNiOzs7Ozs7Ozs7OyJ9
