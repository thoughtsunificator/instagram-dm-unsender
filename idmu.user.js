
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
// @version				0.7.1
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
	 * Run a callback on DOM mutation (addedNode) that tests whether a specific element was found (or was not found)
	 * When the callback returns true the promise is resolved
	 * @param {Element} target
	 * @param {getElement} getElement
	 * @param {AbortController} abortController
	 * @returns {Promise<Element>}
	 * @example
	 * waitForElement(
	 *		body,
	 *		() => body.contains(document.querySelector("button#foo")),
	 *		abortController
	 *	)
	 */
	function waitForElement(target, getElement, abortController) {
		return new Promise((resolve, reject) => {
			let mutationObserver;
			const abortHandler = () => {
				if(mutationObserver) {
					mutationObserver.disconnect();
				}
				reject(new Error(`waitForElement aborted: ${abortController.signal.reason}`));
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
				mutationObserver.observe(target, { subtree: true, childList: true });
			}
		})
	}

	/**
	 * Click target and run waitForElement
	 * @param {Element} clickTarget
	 * @param {Element} target
	 * @param {getElement} getElement
	 * @param {AbortController} abortController
	 * @returns {Element|Promise<Element>}
	 * @example
	 * In this case clicking "#foo" button would make "#bar" appear
	 * clickElementAndWaitFor(
	 *		document.querySelector("#foo"),
	 *		body,
	 *		() => body.contains(document.querySelector("#bar")),
	 *		abortController
	 *	)
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
		 * Alias of dom/async-events#waitForElement
		 * @param {Element} target
		 * @param {function} getElement
		 * @param {AbortController} abortController
		 * @returns {Promise<Element>}
		 */
		waitForElement(target, getElement, abortController) {
			return getElement() || waitForElement(target, getElement, abortController)
		}

		/**
		 * Alias of dom/async-events#clickElementAndWaitFor
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

	/** Locale-independent patterns for the "Unsend" menu item */
	const UNSEND_TEXT_VARIANTS = [
		"unsend",        // English
		"annulla invio", // Italian
		"retirar",       // Portuguese
		"deshacer",      // Spanish
		"retirer",       // French
		"zurücknehmen",  // German
	];


	/** Represents the description text that is associated with the "..." button that reveals the actions menu */
	const LABEL_PATTERNS = [
		"[aria-label^='See more options for message']",
		"[aria-label*='more options']",
		"[aria-label*='More']",
		"[aria-label*='Altre opzioni']",
		"[aria-label*='opzioni']",
		"[aria-label*='opciones']",
		"[aria-label*='options']",
	];

	/** @module ui-message UI element representing a message */


	/**
	 * Dispatches pointer and mouse hover events on a target element.
	 * Instagram's React uses pointer events internally; mouse events alone are insufficient.
	 *
	 * @param {Element} target
	 */
	function dispatchHoverIn(target) {
		const rect = target.getBoundingClientRect();
		const opts = {
			bubbles: true,
			cancelable: true,
			clientX: rect.x + rect.width / 2,
			clientY: rect.y + rect.height / 2,
			pointerId: 1,
			pointerType: "mouse",
		};
		target.dispatchEvent(new PointerEvent("pointerenter", { ...opts, bubbles: false }));
		target.dispatchEvent(new PointerEvent("pointerover", opts));
		target.dispatchEvent(new PointerEvent("pointermove", opts));
		target.dispatchEvent(new MouseEvent("mouseenter", { ...opts, bubbles: false }));
		target.dispatchEvent(new MouseEvent("mouseover", opts));
		target.dispatchEvent(new MouseEvent("mousemove", opts));
	}

	/**
	 * Dispatches pointer and mouse leave events on a target element.
	 *
	 * @param {Element} target
	 */
	function dispatchHoverOut(target) {
		const rect = target.getBoundingClientRect();
		const opts = {
			bubbles: true,
			cancelable: true,
			clientX: rect.x + rect.width / 2,
			clientY: rect.y + rect.height / 2,
			pointerId: 1,
			pointerType: "mouse",
		};
		target.dispatchEvent(new PointerEvent("pointerout", opts));
		target.dispatchEvent(new PointerEvent("pointerleave", { ...opts, bubbles: false }));
		target.dispatchEvent(new MouseEvent("mouseout", opts));
		target.dispatchEvent(new MouseEvent("mouseleave", { ...opts, bubbles: false }));
	}

	class UIMessage extends UIComponent {

		/**
		 * Dismiss any stale dialog or dropdown left from a previous failed workflow.
		 */
		_dismissStaleOverlays() {
			const doc = this.root.ownerDocument;
			// Close stale confirmation dialogs
			const staleDialog = doc.querySelector("[role=dialog]");
			if (staleDialog) {
				console.debug("Dismissing stale dialog");
				const closeBtn = staleDialog.querySelector("button");
				if (closeBtn) closeBtn.click();
			}
			// Close stale dropdown menus by pressing Escape
			const activeMenu = doc.querySelector("[role=menu], [role=listbox]");
			if (activeMenu) {
				console.debug("Dismissing stale menu via Escape");
				doc.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
			}
		}

		/**
		 * Find the action button within the message row.
		 * Instagram moved aria-label from the button div to a nested SVG/title.
		 * Any match (SVG or div) is walked up to the nearest [role=button] ancestor.
		 *
		 * @param {Element} scope
		 * @returns {Element|null}
		 */
		_findActionButton(scope) {
			for (const sel of LABEL_PATTERNS) {
				const el = scope.querySelector(sel);
				if (el) {
					// Always resolve to a clickable button container
					const btn = el.closest("[role=button]") || el.closest("button");
					if (btn && scope.contains(btn)) return btn
					// el itself is already a button-like element
					if (el.tagName === "BUTTON" || el.getAttribute("role") === "button") return el
				}
			}

			// Fallback: any role=button with aria-haspopup=menu inside the message row
			return scope.querySelector("[role=button][aria-haspopup=menu]")
		}

		/**
		 * @param {AbortController} abortController
		 * @returns {Promise<HTMLButtonElement>}
		 */
		async showActionsMenuButton(abortController) {
			console.debug("Workflow step 1 : showActionsMenuButton", this.root);
			this._dismissStaleOverlays();

			// Collect all hoverable ancestors from root down to the message bubble.
			// Instagram React listens at intermediate levels (role=group, flex-end wrapper).
			const hoverTargets = [this.root];
			const collectTargets = (el, depth) => {
				if (depth > 8) return
				for (const child of el.children) {
					hoverTargets.push(child);
					collectTargets(child, depth + 1);
				}
			};
			collectTargets(this.root, 0);

			// Try up to 3 times — hover events can be flaky
			for (let attempt = 0; attempt < 3; attempt++) {
				if (abortController.signal.aborted) return null

				for (const target of hoverTargets) {
					dispatchHoverIn(target);
				}

				await new Promise(resolve => setTimeout(resolve, 100));

				const btn = this._findActionButton(this.root);
				if (btn) {
					console.debug("Workflow step 1 : found action button on attempt", attempt, btn);
					return btn
				}

				console.debug("Workflow step 1 : attempt", attempt, "no button found, retrying...");
				dispatchHoverOut(this.root);
				await new Promise(resolve => setTimeout(resolve, 50));
			}

			// Final fallback: use waitForElement with extended timeout
			const waitAbortController = new AbortController();
			let promiseTimeout;
			const abortHandler = () => {
				waitAbortController.abort("showActionsMenuButton step was aborted by the parent process");
				clearTimeout(promiseTimeout);
			};
			abortController.signal.addEventListener("abort", abortHandler);

			for (const target of hoverTargets) {
				dispatchHoverIn(target);
			}

			try {
				const actionButton = await Promise.race([
					this.waitForElement(
						this.root,
						() => this._findActionButton(this.root),
						waitAbortController
					),
					new Promise((resolve, reject) => {
						promiseTimeout = setTimeout(() => reject("Timeout showActionsMenuButton"), 3000);
					})
				]);

				if (actionButton) {
					return actionButton
				}
				return actionButton
			} finally {
				waitAbortController.abort(); // Aborting without reason because the reason is the error itself
				clearTimeout(promiseTimeout);
				abortController.signal.removeEventListener("abort", abortHandler);
			}
		}

		/**
		 * @param {AbortController} abortController
		 * @returns {Promise<boolean>}
		 */
		async hideActionMenuButton(abortController) {
			console.debug("hideActionMenuButton", this.root);
			dispatchHoverOut(this.root);

			const noneEl = this.root.querySelector("[role=none]");
			if (noneEl) {
				dispatchHoverOut(noneEl);
			}

			const waitAbortController = new AbortController();
			let promiseTimeout;
			let resolveTimeout;
			const abortHandler = () => {
				waitAbortController.abort("hideActionMenuButton step was aborted by the parent process");
				clearTimeout(promiseTimeout);
				if (resolveTimeout) {
					resolveTimeout();
				}
			};
			abortController.signal.addEventListener("abort", abortHandler);

			try {
				const result = await Promise.race([
					this.waitForElement(
						this.root,
						() => this._findActionButton(this.root) === null,
						waitAbortController
					),
					new Promise((resolve, reject) => {
						resolveTimeout = resolve;
						promiseTimeout = setTimeout(() => reject("Timeout hideActionMenuButton"), 500);
					})
				]);
				return result
			} finally {
				waitAbortController.abort(); // Aborting without reason because the reason is the error itself
				clearTimeout(promiseTimeout);
				abortController.signal.removeEventListener("abort", abortHandler);
			}
		}

		/**
		 * Opens the actions menu by clicking the action button and waiting for the "Unsend" item.
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
				waitAbortController.abort("openActionsMenu step was aborted by the parent process");
				clearTimeout(promiseTimeout);
			};
			abortController.signal.addEventListener("abort", abortHandler);

			/** Check if text matches any known "Unsend" variant */
			const isUnsendText = (text) => {
				const normalized = text.trim().toLocaleLowerCase();
				return UNSEND_TEXT_VARIANTS.some(v => normalized === v)
			};

			try {
				const unsendButton = await Promise.race([
					this.clickElementAndWaitFor(
						actionButton,
						this.root.ownerDocument.body,
						(mutations) => {
							if (mutations) {
								const addedNodes = [...mutations.map(mutation => [...mutation.addedNodes])].flat().filter(node => node.nodeType === 1);
								for (const addedNode of addedNodes) {
									const node = [...addedNode.querySelectorAll("span,div")].find(node => isUnsendText(node.textContent) && node.firstChild?.nodeType === 3);
									if (node) {
										console.debug("Workflow step 2 : found unsend node via mutation", node);
										return node
									}
								}
							}
							// Fallback: scan the whole document for an unsend menu item already present
							const allSpans = this.root.ownerDocument.querySelectorAll("[role=menu] span, [role=menu] div, [role=menuitem] span, [role=menuitem] div");
							for (const span of allSpans) {
								if (isUnsendText(span.textContent) && span.firstChild?.nodeType === 3) {
									console.debug("Workflow step 2 : found unsend node via document scan", span);
									return span
								}
							}
						},
						waitAbortController
					),
					new Promise((resolve, reject) => {
						promiseTimeout = setTimeout(() => reject("Timeout openActionsMenu"), 3000);
					})
				]);

				console.debug("Workflow step 2 : Found unsendButton", unsendButton);
				return unsendButton
			} finally {
				waitAbortController.abort(); // Aborting without reason because the reason is the error itself
				clearTimeout(promiseTimeout);
				abortController.signal.removeEventListener("abort", abortHandler);
			}
		}

		/**
		 * Closes the actions menu.
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
				waitAbortController.abort("closeActionsMenu step was aborted by the parent process");
				clearTimeout(promiseTimeout);
			};
			abortController.signal.addEventListener("abort", abortHandler);

			try {
				const result = await Promise.race([
					this.clickElementAndWaitFor(
						actionButton,
						this.root.ownerDocument.body,
						() => this.root.ownerDocument.body.contains(actionsMenuElement) === false,
						abortController
					),
					new Promise((resolve, reject) => {
						promiseTimeout = setTimeout(() => reject("Timeout closeActionsMenu"), 500);
					})
				]);
				return result !== null
			} finally {
				waitAbortController.abort();
				clearTimeout(promiseTimeout);
				abortController.signal.removeEventListener("abort", abortHandler);
			}
		}

		/**
		 * Click unsend button and wait for the confirmation dialog.
		 *
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
		 * Click unsend confirm button in the modal dialog.
		 *
		 * @param {HTMLButtonElement} dialogButton
		 * @param {AbortController} abortController
		 * @returns {Promise}
		 */
		async confirmUnsend(dialogButton, abortController) {
			console.debug("Workflow final step : confirmUnsend", dialogButton);
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
		async unsend(abortController) {
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
				// Dismiss any open overlay so the next message starts clean
				try {
					const doc = this.uiMessage.root.ownerDocument;
					doc.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
					await new Promise(resolve => setTimeout(resolve, 200));
					// If dialog is still open, press Escape again
					if (doc.querySelector("[role=dialog]")) {
						doc.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
						await new Promise(resolve => setTimeout(resolve, 200));
					}
				} catch (error) {
					console.error(error);
				}
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
	 * Finds the scrollable messages container inside the conversation panel.
	 * Instagram removed role="grid" — we now locate the container via aria-label
	 * and walk into its scrollable child.
	 *
	 * @param {Window} window
	 * @returns {HTMLDivElement|null}
	 */
	function findMessagesWrapper(window) {
		const conversation = window.document.querySelector("[aria-label^='Conversation']");
		if (!conversation) {
			return null
		}
		const scrollable = findScrollableChild(conversation, window);
		if (!scrollable) {
			return null
		}
		return scrollable
	}

	/**
	 * Recursively finds the first scrollable descendant of a given element.
	 *
	 * @param {Element} parent
	 * @param {Window} window
	 * @returns {HTMLDivElement|null}
	 */
	function findScrollableChild(parent, window) {
		for (const child of parent.children) {
			const style = window.getComputedStyle(child);
			if (
				(style.overflowY === "auto" || style.overflowY === "scroll") &&
				child.scrollHeight > child.clientHeight
			) {
				return child
			}
			const found = findScrollableChild(child, window);
			if (found) {
				return found
			}
		}
		return null
	}

	/**
	 * Returns the inner container that holds individual message row divs.
	 * Traverses wrapper layers to find the div with the most children (the message list).
	 *
	 * @param {Element} scrollable
	 * @returns {HTMLDivElement}
	 */
	function getMessagesInnerContainer(scrollable) {
		// Instagram wraps messages in several nested divs.
		// Strategy: find the deepest descendant (within 3 levels) that has the most children,
		// since the actual messages container has many direct children (one per message row).
		let best = scrollable;
		let bestCount = scrollable.children.length;

		function search(el, depth) {
			if (depth > 3) return
			for (const child of el.children) {
				if (child.children.length > bestCount) {
					best = child;
					bestCount = child.children.length;
				}
				search(child, depth + 1);
			}
		}

		search(scrollable, 0);
		return best
	}

	/**
	 * Determines whether a message element was sent by the current user.
	 * Instagram aligns sent messages to the right using flexbox (justify-content: flex-end).
	 *
	 * @param {Element} element
	 * @param {Window} window
	 * @returns {boolean}
	 */
	function isSentByCurrentUser(element, window) {
		// BFS through all descendants up to depth 8.
		// Instagram places justify-content: flex-end on a nested div (depth ~5)
		// that may be on any child branch, not just the first-child path.
		const queue = [{ el: element, depth: 0 }];
		while (queue.length > 0) {
			const { el, depth } = queue.shift();
			const s = window.getComputedStyle(el);
			if (s.justifyContent === "flex-end") {
				return true
			}
			if (depth < 8) {
				for (const child of el.children) {
					queue.push({ el: child, depth: depth + 1 });
				}
			}
		}
		return false
	}

	/**
	 * Gets the first visible message sent by the current user that hasn't been processed yet.
	 *
	 * @param {Element} root - The scrollable messages wrapper
	 * @param {AbortController} abortController
	 * @param {Window} window
	 * @returns {Element|undefined}
	 */
	function getFirstVisibleMessage(root, abortController, window) {
		const innerContainer = getMessagesInnerContainer(root);
		if (!innerContainer) {
			console.debug("getFirstVisibleMessage: no inner container found");
			return
		}

		const elements = [...innerContainer.children]
			.filter(d => {
				if (d.hasAttribute("data-idmu-ignore")) return false
				if (d.hasAttribute("data-idmu-unsent")) return false
				// Must contain message content indicators
				const hasMessageContent = d.querySelector("[role=none]") || d.querySelector("[role=presentation]");
				if (!hasMessageContent) return false
				return isSentByCurrentUser(d, window)
			});

		elements.reverse();
		if(elements.length >= 1) {
			console.debug("getFirstVisibleMessage", elements.length, "candidate elements");
		} else {
			console.debug("getFirstVisibleMessage: no candidate elements found");
		}

		for (const element of elements) {
			if (abortController.signal.aborted) {
				console.debug("abortController interupted the message filtering process: stopping...");
				break
			}
			const visibilityCheck = element.checkVisibility({
				visibilityProperty: true,
				contentVisibilityAuto: true,
				opacityProperty: true,
			});
			if (visibilityCheck === false) {
				console.debug("visibilityCheck", visibilityCheck);
				continue
			}
			const rect = element.getBoundingClientRect();
			// Check if element is at least partially in viewport.
			// For tall elements (images, long text), rect.y can be negative
			// while the element is still visible. Use bottom edge instead.
			if (rect.y + rect.height < 0 || rect.height === 0) {
				console.debug("isInView failed", rect.y, rect.height);
				continue
			}
			element.setAttribute("data-idmu-ignore", "");
			console.debug("Message in view, testing workflow...", element);
			return element
		}
	}

	/**
	 * Scrolls to top to trigger loading of older messages.
	 * Handles both normal and column-reverse layouts.
	 *
	 * In column-reverse (Instagram's current layout):
	 *   scrollTop=0 is the BOTTOM (newest messages)
	 *   scrollTop=-(scrollHeight-clientHeight) is the TOP (oldest messages)
	 *
	 * @param {Element} root
	 * @param {AbortController} abortController
	 * @returns {Promise<boolean>}
	 */
	async function loadMoreMessages(root, abortController) {
		console.debug("loadMoreMessages looking for loader... ");
		const scrollAbortController = new AbortController();
		let findLoaderTimeout;
		let resolveTimeout;
		const abortHandler = () => {
			scrollAbortController.abort("abortHandler was aborted");
			clearTimeout(findLoaderTimeout);
			if (resolveTimeout) {
				resolveTimeout();
			}
		};
		abortController.signal.addEventListener("abort", abortHandler);

		// Detect column-reverse layout
		const style = root.ownerDocument.defaultView.getComputedStyle(root);
		const isReversed = style.flexDirection === "column-reverse";
		// In column-reverse, "scroll to top" means most negative scrollTop
		const scrollToTopValue = isReversed
			? -(root.scrollHeight - root.clientHeight)
			: 0;
		// In column-reverse, "at top" means scrollTop is at or near minimum
		const isAtTop = () => isReversed
			? root.scrollTop <= scrollToTopValue + 5
			: root.scrollTop === 0;

		const beforeScroll = root.scrollTop;
		const beforeHeight = root.scrollHeight;
		root.scrollTop = scrollToTopValue;

		// Helper: find a visible loader within the scrollable root's viewport
		const findVisibleLoader = () => {
			const bars = root.querySelectorAll("[role=progressbar]");
			for (const bar of bars) {
				const rect = bar.getBoundingClientRect();
				const rootRect = root.getBoundingClientRect();
				// Must be within root's horizontal+vertical bounds and have dimensions
				if (rect.height > 0 && rect.y >= rootRect.y - 100 && rect.y <= rootRect.y + rootRect.height + 100) {
					return bar
				}
			}
			return null
		};

		// Short chat: everything fits in viewport, nothing to load
		const noScrollNeeded = isReversed
			? beforeScroll === 0 && root.scrollHeight <= root.clientHeight + 50
			: beforeScroll === 0 && root.scrollHeight <= root.clientHeight + 50;
		if (noScrollNeeded) {
			console.debug("loadMoreMessages: chat fits in viewport, marking as done");
			abortController.signal.removeEventListener("abort", abortHandler);
			return true
		}

		// Already at top after scrolling: wait briefly for new content, then check
		if (isAtTop()) {
			// Give Instagram a moment to start loading older messages
			await new Promise(resolve => setTimeout(resolve, 500));

			// Check if a visible loader appeared
			const loader = findVisibleLoader();
			if (loader) {
				console.debug("loadMoreMessages: Found visible loader after scroll; waiting for removal (max 5s)");
				await Promise.race([
					waitForElement(root, () => findVisibleLoader() === null, abortController),
					new Promise(resolve => setTimeout(resolve, 5000))
				]);
				abortController.signal.removeEventListener("abort", abortHandler);
				const grew = root.scrollHeight > beforeHeight;
				console.debug(`loadMoreMessages: loader phase done, content ${grew ? "grew" : "did not grow"}`);
				return !grew
			}

			// No loader appeared — check if scrollHeight grew (new content loaded without spinner)
			const grew = root.scrollHeight > beforeHeight;
			if (!grew) {
				console.debug("loadMoreMessages: at top, no loader, no new content — reached last page");
				abortController.signal.removeEventListener("abort", abortHandler);
				return true
			}
		}

		// Fallback: wait for progressbar to appear (with shorter timeout)
		let loadingElement;
		try {
			loadingElement = await Promise.race([
				waitForElement(root, () => {
					if (findVisibleLoader() === null) {
						root.scrollTop = scrollToTopValue;
					}
					return findVisibleLoader()
				}, scrollAbortController),
				new Promise(resolve => {
					resolveTimeout = resolve;
					findLoaderTimeout = setTimeout(() => {
						resolve();
					}, 3000);
				})
			]);
		} catch (ex) {
			console.error(ex);
		}
		scrollAbortController.abort("Scrolling took too much time. Timeout after 10s");
		abortController.signal.removeEventListener("abort", abortHandler);
		clearTimeout(findLoaderTimeout);
		if (loadingElement && loadingElement !== true) {
			console.debug("loadMoreMessages: Found loader; Stand-by until it is removed (max 5s)");
			await Promise.race([
				waitForElement(root, () => findVisibleLoader() === null, abortController),
				new Promise(resolve => setTimeout(resolve, 5000))
			]);
		}
		const atTop = isAtTop();
		console.debug(`loadMoreMessages: scrollTop is ${root.scrollTop} — ${atTop ? "reached last page" : "not last page"}`);
		return atTop
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

		constructor(root, identifier = {}) {
			super(root, identifier);
			this.lastScrollTop = null;
		}

		/**
		 * @param {Window} window
		 * @returns {DefaultUI}
		 */
		static create(window) {
			console.debug("UI create: Looking for messagesWrapperElement");
			const messagesWrapperElement = findMessagesWrapper(window);
			if (messagesWrapperElement !== null) {
				console.debug("Found messagesWrapperElement", messagesWrapperElement);
				const uiMessagesWrapper = new UIMessagesWrapper(messagesWrapperElement);
				return new DefaultUI(window, { uiMessagesWrapper })
			} else {
				throw new Error("Unable to find messagesWrapperElement. The query selector might be out of date.")
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
		 * Scroll until a (visible) message is found and return it.
		 *
		 * Instagram uses flex-direction: column-reverse on the messages container.
		 * This means scrollTop=0 is the BOTTOM (newest messages) and scrolling to
		 * older messages requires NEGATIVE scrollTop values.
		 * In normal (non-reversed) layouts, scrollTop=0 is the top and the max is positive.
		 *
		 * This method detects the layout direction and scrolls accordingly.
		 *
		 * @param {AbortController} abortController
		 * @returns {Promise<UIPIMessage|false>}
		 */
		async getNextUIPIMessage(abortController) {
			console.debug("UI getNextUIPIMessage", this.lastScrollTop);
			const uiMessagesWrapperRoot = this.identifier.uiMessagesWrapper.root;

			// Detect column-reverse: scrollTop can go negative
			const style = this.root.getComputedStyle
				? this.root.getComputedStyle(uiMessagesWrapperRoot)
				: uiMessagesWrapperRoot.ownerDocument.defaultView.getComputedStyle(uiMessagesWrapperRoot);
			const isReversed = style.flexDirection === "column-reverse";

			// Pre-check: try finding a message at the current scroll position without scrolling.
			// This catches messages already visible in viewport (common for short conversations
			// and after unsending when the DOM shrinks).
			try {
				const messageElement = getFirstVisibleMessage(uiMessagesWrapperRoot, abortController, this.root);
				if (messageElement) {
					console.debug("getNextUIPIMessage: found message without scrolling");
					const uiMessage = new UIMessage(messageElement);
					return new UIPIMessage(uiMessage)
				}
			} catch (ex) {
				console.error(ex);
			}

			// Allow up to 3 full passes; covers cases where DOM shrinks after unsends
			for (let pass = 0; pass < 3; pass++) {
				if (abortController.signal.aborted) {
					console.debug("abortController interupted the scrolling: stopping...");
					return false
				}

				if (isReversed) {
					// column-reverse: scrollTop ranges from 0 (bottom/newest) to negative (top/oldest)
					const minScroll = -(uiMessagesWrapperRoot.scrollHeight - uiMessagesWrapperRoot.clientHeight);
					const startPos = (pass === 0 && this.lastScrollTop !== null)
						? Math.max(this.lastScrollTop, minScroll)
						: 0; // Start from bottom (newest)

					// Use smaller increments for short conversations to avoid overshooting
					const totalRange = Math.abs(minScroll);
					const step = totalRange < 500 ? 30 : 150;

					console.debug(`getNextUIPIMessage [reversed] pass=${pass}, startPos=${startPos}, minScroll=${minScroll}, step=${step}`);

					for (let i = startPos; i >= minScroll; i = i - step) {
						if (abortController.signal.aborted) {
							console.debug("abortController interupted the scrolling: stopping...");
							return false
						}
						this.lastScrollTop = i;
						uiMessagesWrapperRoot.scrollTop = i;
						uiMessagesWrapperRoot.dispatchEvent(new this.root.Event("scroll"));
						await new Promise(resolve => setTimeout(resolve, 5));
						try {
							const messageElement = getFirstVisibleMessage(uiMessagesWrapperRoot, abortController, this.root);
							if (messageElement) {
								const uiMessage = new UIMessage(messageElement);
								return new UIPIMessage(uiMessage)
							}
						} catch (ex) {
							console.error(ex);
						}
					}
				} else {
					// Normal layout: scrollTop ranges from 0 (top) to positive max (bottom)
					const maxScroll = uiMessagesWrapperRoot.scrollHeight - uiMessagesWrapperRoot.clientHeight;
					const startScrollTop = (pass === 0 && this.lastScrollTop !== null)
						? Math.min(this.lastScrollTop, maxScroll)
						: maxScroll;

					// Use smaller increments for short conversations
					const step = maxScroll < 500 ? 30 : 150;

					console.debug(`getNextUIPIMessage pass=${pass}, startScrollTop=${startScrollTop}, maxScroll=${maxScroll}, step=${step}`);

					for (let i = Math.max(1, startScrollTop); i > 0; i = i - step) {
						if (abortController.signal.aborted) {
							console.debug("abortController interupted the scrolling: stopping...");
							return false
						}
						this.lastScrollTop = i;
						uiMessagesWrapperRoot.scrollTop = i;
						uiMessagesWrapperRoot.dispatchEvent(new this.root.Event("scroll"));
						await new Promise(resolve => setTimeout(resolve, 5));
						try {
							const messageElement = getFirstVisibleMessage(uiMessagesWrapperRoot, abortController, this.root);
							if (messageElement) {
								const uiMessage = new UIMessage(messageElement);
								return new UIPIMessage(uiMessage)
							}
						} catch (ex) {
							console.error(ex);
						}
					}
				}

				// Reached the end without finding a message.
				// Reset for a fresh pass (DOM may have shrunk after unsends).
				this.lastScrollTop = null;
				console.debug(`getNextUIPIMessage: pass ${pass} found nothing, retrying`);
			}

			console.debug("getNextUIPIMessage: exhausted all passes, no messages left");
			return false
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
	 * Loads all pages first, then unsends messages from bottom to top.
	 * For short conversations (all messages fit in viewport), skips page loading entirely.
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
			this._consecutiveFailures = 0;
		}

		/**
		 * @returns {boolean}
		 */
		isRunning() {
			return this._running && this._abortController && this._abortController.signal.aborted === false
		}

		stop() {
			console.debug("DefaultStrategy stop");
			this.idmu.setStatusText("Stopping...");
			this._abortController.abort("DefaultStrategy stopped");
		}

		reset() {
			this._allPagesLoaded = false;
			this._unsentCount = 0;
			this._lastUnsendDate = null;
			this._pagesLoadedCount = 0;
			this._consecutiveFailures = 0;
			this.idmu.setStatusText("Ready");
		}

		/**
		 * @returns {Promise}
		 */
		async run() {
			console.debug("DefaultStrategy.run()");
			this._unsentCount = 0;
			this._pagesLoadedCount = 0;
			this._consecutiveFailures = 0;
			this._running = true;
			this._abortController = new AbortController();
			// Clear stale ignore markers from previous runs so messages can be retried
			this.idmu.window.document.querySelectorAll("[data-idmu-ignore]").forEach(el => {
				el.removeAttribute("data-idmu-ignore");
			});
			this.idmu.loadUIPI();
			try {
				if (this._allPagesLoaded) {
					await this.#unsendNextMessage();
				} else {
					await this.#loadNextPage();
				}

				// Race condition: on first page load, Instagram's React may not have
				// finished hydrating message components (role attributes missing).
				// If we found nothing, wait and re-scan up to 3 times.
				if (this._unsentCount === 0 && !this._abortController.signal.aborted) {
					for (let retry = 1; retry <= 3; retry++) {
						this.idmu.setStatusText(`No messages detected, retrying (${retry}/3)...`);
						console.debug(`DefaultStrategy: 0 messages found, retry ${retry}/3`);
						await new Promise(resolve => setTimeout(resolve, 2000));
						if (this._abortController.signal.aborted) break
						// Reset for fresh scan
						this._allPagesLoaded = false;
						this._consecutiveFailures = 0;
						this.idmu.window.document.querySelectorAll("[data-idmu-ignore]").forEach(el => {
							el.removeAttribute("data-idmu-ignore");
						});
						this.idmu.loadUIPI();
						await this.#loadNextPage();
						if (this._unsentCount > 0 || this._abortController.signal.aborted) break
					}
				}

				if (this._abortController.signal.aborted) {
					this.idmu.setStatusText(`Aborted. ${this._unsentCount} message(s) unsent.`);
					console.debug("DefaultStrategy aborted");
				} else {
					this.idmu.setStatusText(`Done. ${this._unsentCount} message(s) unsent.`);
					console.debug("DefaultStrategy done");
				}
			} catch (ex) {
				console.error(ex);
				this.idmu.setStatusText(`Errored. ${this._unsentCount} message(s) unsent.`);
				console.debug("DefaultStrategy errored");
			}
			this._running = false;
		}

		/**
		 * Tries to load the thread next page.
		 * If loadMoreMessages returns true (no more pages), moves to unsending.
		 */
		async #loadNextPage() {
			if (this._abortController.signal.aborted) {
				console.debug("abortController interupted the loading of next page: stopping...");
				return
			}
			this.idmu.setStatusText("Loading next page...");
			try {
				const done = await this.idmu.fetchAndRenderThreadNextMessagePage(this._abortController);
				if (this._abortController.signal.aborted === false) {
					if (done) {
						this.idmu.setStatusText(`All pages loaded (${this._pagesLoadedCount} in total). Unsending...`);
						this._allPagesLoaded = true;
						await this.#unsendNextMessage();
					} else {
						this._pagesLoadedCount++;
						await this.#loadNextPage();
					}
				} else {
					console.debug("abortController interupted the loading of next page: stopping...");
				}
			} catch (ex) {
				console.error(ex);
			}
		}

		/**
		 * Unsend first message in viewport.
		 * Uses adaptive delays: fast baseline (1-2s) with exponential backoff on rate limit detection.
		 */
		async #unsendNextMessage() {
			if (this._abortController.signal.aborted) {
				console.debug("abortController interupted the unsending of next message: stopping...");
				return
			}
			if (this._consecutiveFailures >= 5) {
				this.idmu.setStatusText(`Stopped: ${this._consecutiveFailures} consecutive failures. ${this._unsentCount} message(s) unsent.`);
				console.debug("DefaultStrategy stopping due to consecutive failures");
				return
			}
			let canScroll = true;
			let msgElement = null;
			try {
				this.idmu.setStatusText(`Retrieving next message... (${this._unsentCount} unsent so far)`);
				const uipiMessage = await this.idmu.getNextUIPIMessage(this._abortController);
				canScroll = uipiMessage !== false;
				if (uipiMessage) {
					this.idmu.setStatusText(`Unsending message... (${this._unsentCount + 1})`);

					// Adaptive delay: 1-2s randomized baseline between unsends
					if (this._lastUnsendDate !== null) {
						const elapsed = Date.now() - this._lastUnsendDate.getTime();
						const minDelay = 1000 + Math.floor(Math.random() * 1000); // 1-2s
						if (elapsed < minDelay) {
							const waitMs = minDelay - elapsed;
							this.idmu.setStatusText(`Waiting ${(waitMs / 1000).toFixed(1)}s... (${this._unsentCount} unsent so far)`);
							await new Promise(resolve => setTimeout(resolve, waitMs));
						}
					}

					if (this._abortController.signal.aborted) return

					msgElement = uipiMessage.uiMessage.root;
					const unsent = await uipiMessage.unsend(this._abortController);

					if (unsent) {
						// Verify the message actually disappeared from DOM (server accepted the mutation)
						await new Promise(resolve => setTimeout(resolve, 800));
						const stillInDOM = msgElement.isConnected && !msgElement.hasAttribute("data-idmu-unsent");
						if (stillInDOM) {
							// Server likely rejected — the message reappeared after optimistic removal
							console.debug("DefaultStrategy: message still in DOM after unsend, possible rate limit");
							msgElement.removeAttribute("data-idmu-ignore");
							this._consecutiveFailures++;
							const backoffMs = Math.min(60000, 5000 * Math.pow(2, this._consecutiveFailures - 1));
							this.idmu.setStatusText(`Rate limit detected. Backing off ${(backoffMs / 1000).toFixed(0)}s... (${this._unsentCount} unsent)`);
							await new Promise(resolve => setTimeout(resolve, backoffMs));
						} else {
							this._lastUnsendDate = new Date();
							this._unsentCount++;
							this._consecutiveFailures = 0;
							// DOM shrunk after removal; reset scroll for fresh scan
							if (this.idmu.uipi && this.idmu.uipi.ui) {
								this.idmu.uipi.ui.lastScrollTop = null;
							}
						}
					} else {
						// Unsend workflow returned false — allow retry on next pass
						console.debug("DefaultStrategy: unsend returned false, removing ignore marker for retry");
						msgElement.removeAttribute("data-idmu-ignore");
						this._consecutiveFailures++;
					}
				}
			} catch (ex) {
				console.error(ex);
				// Remove ignore marker so this message can be retried
				if (msgElement) {
					msgElement.removeAttribute("data-idmu-ignore");
				}
				this._consecutiveFailures++;
				const backoffMs = Math.min(60000, 3000 * Math.pow(2, this._consecutiveFailures - 1));
				this.idmu.setStatusText(`Workflow failed (${this._consecutiveFailures}/5), retrying in ${(backoffMs / 1000).toFixed(0)}s... (${this._unsentCount} unsent)`);
				await new Promise(resolve => setTimeout(resolve, backoffMs));
			} finally {
				if (canScroll && this._abortController && !this._abortController.signal.aborted) {
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
			try {
				await this.strategy.run();
			} catch(error) {
				console.error(error);
				if(this.strategy.isRunning()) {
					this.strategy.stop();
				}
				this.statusElement.innerHTML = `<span style="color: red">An error occured, <a href="https://github.com/thoughtsunificator/instagram-dm-unsender/issues/new?template=bug_report.md">please open an issue</a></span>`;
			} finally {
				this.#onUnsendingFinished();
			}
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaWRtdS51c2VyLmpzIiwic291cmNlcyI6WyIuLi9zcmMvcnVudGltZS91c2Vyc2NyaXB0L29zZC9zdHlsZS9pbnN0YWdyYW0uanMiLCIuLi9zcmMvcnVudGltZS91c2Vyc2NyaXB0L29zZC9tZW51LWJ1dHRvbi5qcyIsIi4uL3NyYy9ydW50aW1lL3VzZXJzY3JpcHQvb3NkL21lbnUuanMiLCIuLi9zcmMvZG9tL2FzeW5jLWV2ZW50cy5qcyIsIi4uL3NyYy91aS91aS1jb21wb25lbnQuanMiLCIuLi9zcmMvdWkvZGVmYXVsdC9zdHJpbmdzLmpzIiwiLi4vc3JjL3VpL2RlZmF1bHQvdWktbWVzc2FnZS5qcyIsIi4uL3NyYy91aXBpL3VpcGktbWVzc2FnZS5qcyIsIi4uL3NyYy91aS91aS5qcyIsIi4uL3NyYy91aS9kZWZhdWx0L2RvbS1sb29rdXAuanMiLCIuLi9zcmMvdWkvZGVmYXVsdC91aS1tZXNzYWdlcy13cmFwcGVyLmpzIiwiLi4vc3JjL3VpL2RlZmF1bHQvZGVmYXVsdC11aS5qcyIsIi4uL3NyYy91aS9nZXQtdWkuanMiLCIuLi9zcmMvdWlwaS91aXBpLmpzIiwiLi4vc3JjL2lkbXUvaWRtdS5qcyIsIi4uL3NyYy91aS91bnNlbmQtc3RyYXRlZ3kuanMiLCIuLi9zcmMvdWkvZGVmYXVsdC91bnNlbmQtc3RyYXRlZ3kuanMiLCIuLi9zcmMvcnVudGltZS91c2Vyc2NyaXB0L29zZC9hbGVydC5qcyIsIi4uL3NyYy9ydW50aW1lL3VzZXJzY3JpcHQvb3NkL292ZXJsYXkuanMiLCIuLi9zcmMvcnVudGltZS91c2Vyc2NyaXB0L29zZC9vc2QuanMiLCIuLi9zcmMvcnVudGltZS91c2Vyc2NyaXB0L21haW4uanMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqIEBtb2R1bGUgaW5zdGFncmFtIEhlbHBlcnMgdG8gbWltaWNrIEluc3RhZ3JhbSdzIGxvb2sgYW5kIGZlZWwgKi9cblxuZXhwb3J0IGNvbnN0IEJVVFRPTl9TVFlMRSA9IHtcblx0XCJQUklNQVJZXCI6IFwicHJpbWFyeVwiLFxuXHRcIlNFQ09OREFSWVwiOiBcInNlY29uZGFyeVwiLFxufVxuXG4vKipcbiAqXG4gKiBAcGFyYW0ge0hUTUxCdXR0b25FbGVtZW50fSBidXR0b25FbGVtZW50XG4gKiBAcGFyYW0ge3N0cmluZ30gICAgICAgICAgICBzdHlsZU5hbWVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGFwcGx5QnV0dG9uU3R5bGUoYnV0dG9uRWxlbWVudCwgc3R5bGVOYW1lKSB7XG5cdGJ1dHRvbkVsZW1lbnQuc3R5bGUuZm9udFNpemUgPSBcInZhcigtLXN5c3RlbS0xNC1mb250LXNpemUpXCJcblx0YnV0dG9uRWxlbWVudC5zdHlsZS5jb2xvciA9IFwid2hpdGVcIlxuXHRidXR0b25FbGVtZW50LnN0eWxlLmJvcmRlciA9IFwiMHB4XCJcblx0YnV0dG9uRWxlbWVudC5zdHlsZS5ib3JkZXJSYWRpdXMgPSBcIjhweFwiXG5cdGJ1dHRvbkVsZW1lbnQuc3R5bGUucGFkZGluZyA9IFwiOHB4XCJcblx0YnV0dG9uRWxlbWVudC5zdHlsZS5mb250V2VpZ2h0ID0gXCJib2xkXCJcblx0YnV0dG9uRWxlbWVudC5zdHlsZS5jdXJzb3IgPSBcInBvaW50ZXJcIlxuXHRidXR0b25FbGVtZW50LnN0eWxlLmxpbmVIZWlnaHQgPSBcInZhcigtLXN5c3RlbS0xNC1saW5lLWhlaWdodClcIlxuXHRpZihzdHlsZU5hbWUpIHtcblx0XHRidXR0b25FbGVtZW50LnN0eWxlLmJhY2tncm91bmRDb2xvciA9IGByZ2IodmFyKC0taWctJHtzdHlsZU5hbWV9LWJ1dHRvbikpYFxuXHR9XG59XG4iLCIvKiogQG1vZHVsZSBtZW51LWJ1dHRvbiBIZWxwZXJzIHRvIGNyZWF0ZSBidXR0b25zIHRoYXQgY2FuIGJlIHVzZWQgaW4gSURNVSdzIG1lbnUgKi9cblxuaW1wb3J0IHsgYXBwbHlCdXR0b25TdHlsZSB9IGZyb20gXCIuL3N0eWxlL2luc3RhZ3JhbS5qc1wiXG5cbi8qKlxuICpcbiAqIEBwYXJhbSB7RG9jdW1lbnR9IGRvY3VtZW50XG4gKiBAcGFyYW0ge3N0cmluZ30gICB0ZXh0XG4gKiBAcGFyYW0ge3N0cmluZ30gICBzdHlsZU5hbWVcbiAqIEByZXR1cm5zIHtIVE1MQnV0dG9uRWxlbWVudH1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZU1lbnVCdXR0b25FbGVtZW50KGRvY3VtZW50LCB0ZXh0LCBzdHlsZU5hbWUpIHtcblx0Y29uc3QgYnV0dG9uRWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJidXR0b25cIilcblx0YnV0dG9uRWxlbWVudC50ZXh0Q29udGVudCA9IHRleHRcblx0YXBwbHlCdXR0b25TdHlsZShidXR0b25FbGVtZW50LCBzdHlsZU5hbWUpXG5cdGJ1dHRvbkVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNlb3ZlclwiLCAoKSA9PiB7XG5cdFx0YnV0dG9uRWxlbWVudC5zdHlsZS5maWx0ZXIgPSBgYnJpZ2h0bmVzcygxLjE1KWBcblx0fSlcblx0YnV0dG9uRWxlbWVudC5hZGRFdmVudExpc3RlbmVyKFwibW91c2VvdXRcIiwgKCkgPT4ge1xuXHRcdGJ1dHRvbkVsZW1lbnQuc3R5bGUuZmlsdGVyID0gYGBcblx0fSlcblx0cmV0dXJuIGJ1dHRvbkVsZW1lbnRcbn1cbiIsIi8qKiBAbW9kdWxlIG1lbnUgSURNVSdzIG1haW4gbWVudSAqL1xuXG4vKipcbiAqIEBwYXJhbSB7RG9jdW1lbnR9IGRvY3VtZW50XG4gKiBAcmV0dXJucyB7SFRNTEJ1dHRvbkVsZW1lbnR9XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVNZW51RWxlbWVudChkb2N1bWVudCkge1xuXHRjb25zdCBtZW51RWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIilcblx0bWVudUVsZW1lbnQuaWQgPSBcImlkbXUtbWVudVwiXG5cdG1lbnVFbGVtZW50LnN0eWxlLnRvcCA9IFwiMjBweFwiXG5cdG1lbnVFbGVtZW50LnN0eWxlLnJpZ2h0ID0gXCI0MzBweFwiXG5cdG1lbnVFbGVtZW50LnN0eWxlLnBvc2l0aW9uID0gXCJmaXhlZFwiXG5cdG1lbnVFbGVtZW50LnN0eWxlLnpJbmRleCA9IDk5OVxuXHRtZW51RWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gXCJmbGV4XCJcblx0bWVudUVsZW1lbnQuc3R5bGUuZ2FwID0gXCIxMHB4XCJcblx0bWVudUVsZW1lbnQuc3R5bGUucGxhY2VJdGVtcyA9IFwiY2VudGVyXCJcblx0cmV0dXJuIG1lbnVFbGVtZW50XG59XG4iLCIvKiogQG1vZHVsZSBhc3luYy1ldmVudHMgVXRpbHMgbW9kdWxlIGZvciBmaW5kaW5nIGVsZW1lbnRzIGFzeW5jaHJvbm91c2x5IGluIHRoZSBET00gKi9cblxuLyoqXG4gKlxuICogQGNhbGxiYWNrIGdldEVsZW1lbnRcbiAqIEByZXR1cm5zIHtFbGVtZW50fVxuICovXG5cbi8qKlxuICogUnVuIGEgY2FsbGJhY2sgb24gRE9NIG11dGF0aW9uIChhZGRlZE5vZGUpIHRoYXQgdGVzdHMgd2hldGhlciBhIHNwZWNpZmljIGVsZW1lbnQgd2FzIGZvdW5kIChvciB3YXMgbm90IGZvdW5kKVxuICogV2hlbiB0aGUgY2FsbGJhY2sgcmV0dXJucyB0cnVlIHRoZSBwcm9taXNlIGlzIHJlc29sdmVkXG4gKiBAcGFyYW0ge0VsZW1lbnR9IHRhcmdldFxuICogQHBhcmFtIHtnZXRFbGVtZW50fSBnZXRFbGVtZW50XG4gKiBAcGFyYW0ge0Fib3J0Q29udHJvbGxlcn0gYWJvcnRDb250cm9sbGVyXG4gKiBAcmV0dXJucyB7UHJvbWlzZTxFbGVtZW50Pn1cbiAqIEBleGFtcGxlXG4gKiB3YWl0Rm9yRWxlbWVudChcbiAqXHRcdGJvZHksXG4gKlx0XHQoKSA9PiBib2R5LmNvbnRhaW5zKGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCJidXR0b24jZm9vXCIpKSxcbiAqXHRcdGFib3J0Q29udHJvbGxlclxuICpcdClcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHdhaXRGb3JFbGVtZW50KHRhcmdldCwgZ2V0RWxlbWVudCwgYWJvcnRDb250cm9sbGVyKSB7XG5cdHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cdFx0bGV0IG11dGF0aW9uT2JzZXJ2ZXJcblx0XHRjb25zdCBhYm9ydEhhbmRsZXIgPSAoKSA9PiB7XG5cdFx0XHRpZihtdXRhdGlvbk9ic2VydmVyKSB7XG5cdFx0XHRcdG11dGF0aW9uT2JzZXJ2ZXIuZGlzY29ubmVjdCgpXG5cdFx0XHR9XG5cdFx0XHRyZWplY3QobmV3IEVycm9yKGB3YWl0Rm9yRWxlbWVudCBhYm9ydGVkOiAke2Fib3J0Q29udHJvbGxlci5zaWduYWwucmVhc29ufWApKVxuXHRcdH1cblx0XHRhYm9ydENvbnRyb2xsZXIuc2lnbmFsLmFkZEV2ZW50TGlzdGVuZXIoXCJhYm9ydFwiLCBhYm9ydEhhbmRsZXIpXG5cdFx0bGV0IGVsZW1lbnQgPSBnZXRFbGVtZW50KClcblx0XHRpZihlbGVtZW50KSB7XG5cdFx0XHRyZXNvbHZlKGVsZW1lbnQpXG5cdFx0XHRhYm9ydENvbnRyb2xsZXIuc2lnbmFsLnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJhYm9ydFwiLCBhYm9ydEhhbmRsZXIpXG5cdFx0fSBlbHNlIHtcblx0XHRcdG11dGF0aW9uT2JzZXJ2ZXIgPSBuZXcgTXV0YXRpb25PYnNlcnZlcigobXV0YXRpb25zLCBvYnNlcnZlcikgPT4ge1xuXHRcdFx0XHRlbGVtZW50ID0gZ2V0RWxlbWVudChtdXRhdGlvbnMpXG5cdFx0XHRcdGlmKGVsZW1lbnQpIHtcblx0XHRcdFx0XHRvYnNlcnZlci5kaXNjb25uZWN0KClcblx0XHRcdFx0XHRyZXNvbHZlKGVsZW1lbnQpXG5cdFx0XHRcdFx0YWJvcnRDb250cm9sbGVyLnNpZ25hbC5yZW1vdmVFdmVudExpc3RlbmVyKFwiYWJvcnRcIiwgYWJvcnRIYW5kbGVyKVxuXHRcdFx0XHR9XG5cdFx0XHR9KVxuXHRcdFx0bXV0YXRpb25PYnNlcnZlci5vYnNlcnZlKHRhcmdldCwgeyBzdWJ0cmVlOiB0cnVlLCBjaGlsZExpc3Q6IHRydWUgfSlcblx0XHR9XG5cdH0pXG59XG5cbi8qKlxuICogQ2xpY2sgdGFyZ2V0IGFuZCBydW4gd2FpdEZvckVsZW1lbnRcbiAqIEBwYXJhbSB7RWxlbWVudH0gY2xpY2tUYXJnZXRcbiAqIEBwYXJhbSB7RWxlbWVudH0gdGFyZ2V0XG4gKiBAcGFyYW0ge2dldEVsZW1lbnR9IGdldEVsZW1lbnRcbiAqIEBwYXJhbSB7QWJvcnRDb250cm9sbGVyfSBhYm9ydENvbnRyb2xsZXJcbiAqIEByZXR1cm5zIHtFbGVtZW50fFByb21pc2U8RWxlbWVudD59XG4gKiBAZXhhbXBsZVxuICogSW4gdGhpcyBjYXNlIGNsaWNraW5nIFwiI2Zvb1wiIGJ1dHRvbiB3b3VsZCBtYWtlIFwiI2JhclwiIGFwcGVhclxuICogY2xpY2tFbGVtZW50QW5kV2FpdEZvcihcbiAqXHRcdGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCIjZm9vXCIpLFxuICpcdFx0Ym9keSxcbiAqXHRcdCgpID0+IGJvZHkuY29udGFpbnMoZG9jdW1lbnQucXVlcnlTZWxlY3RvcihcIiNiYXJcIikpLFxuICpcdFx0YWJvcnRDb250cm9sbGVyXG4gKlx0KVxuICovXG5leHBvcnQgZnVuY3Rpb24gY2xpY2tFbGVtZW50QW5kV2FpdEZvcihjbGlja1RhcmdldCwgdGFyZ2V0LCBnZXRFbGVtZW50LCBhYm9ydENvbnRyb2xsZXIpIHtcblx0Y29uc3QgcHJvbWlzZSA9IHdhaXRGb3JFbGVtZW50KHRhcmdldCwgZ2V0RWxlbWVudCwgYWJvcnRDb250cm9sbGVyKVxuXHRjbGlja1RhcmdldC5jbGljaygpXG5cdHJldHVybiBnZXRFbGVtZW50KCkgfHwgcHJvbWlzZVxufVxuIiwiLyoqIEBtb2R1bGUgdWktY29tcG9uZW50IEJhc2UgY2xhc3MgZm9yIGFueSBlbGVtZW50IHRoYXQgaXMgYSBwYXJ0IG9mIHRoZSBVSS4gKi9cblxuaW1wb3J0IHsgd2FpdEZvckVsZW1lbnQsIGNsaWNrRWxlbWVudEFuZFdhaXRGb3IgfSBmcm9tIFwiLi4vZG9tL2FzeW5jLWV2ZW50cy5qc1wiXG5cbi8qKlxuICpcbiAqIEBhYnN0cmFjdFxuICovXG5jbGFzcyBVSUNvbXBvbmVudCB7XG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge0VsZW1lbnR9IHJvb3Rcblx0ICogQHBhcmFtIHtvYmplY3R9IGlkZW50aWZpZXJcblx0ICovXG5cdGNvbnN0cnVjdG9yKHJvb3QsIGlkZW50aWZpZXI9e30pIHtcblx0XHR0aGlzLnJvb3QgPSByb290XG5cdFx0dGhpcy5pZGVudGlmaWVyID0gaWRlbnRpZmllclxuXHR9XG5cblx0LyoqXG5cdCAqIEFsaWFzIG9mIGRvbS9hc3luYy1ldmVudHMjd2FpdEZvckVsZW1lbnRcblx0ICogQHBhcmFtIHtFbGVtZW50fSB0YXJnZXRcblx0ICogQHBhcmFtIHtmdW5jdGlvbn0gZ2V0RWxlbWVudFxuXHQgKiBAcGFyYW0ge0Fib3J0Q29udHJvbGxlcn0gYWJvcnRDb250cm9sbGVyXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlPEVsZW1lbnQ+fVxuXHQgKi9cblx0d2FpdEZvckVsZW1lbnQodGFyZ2V0LCBnZXRFbGVtZW50LCBhYm9ydENvbnRyb2xsZXIpIHtcblx0XHRyZXR1cm4gZ2V0RWxlbWVudCgpIHx8IHdhaXRGb3JFbGVtZW50KHRhcmdldCwgZ2V0RWxlbWVudCwgYWJvcnRDb250cm9sbGVyKVxuXHR9XG5cblx0LyoqXG5cdCAqIEFsaWFzIG9mIGRvbS9hc3luYy1ldmVudHMjY2xpY2tFbGVtZW50QW5kV2FpdEZvclxuXHQgKiBAcGFyYW0ge0VsZW1lbnR9IGNsaWNrVGFyZ2V0XG5cdCAqIEBwYXJhbSB7RWxlbWVudH0gdGFyZ2V0XG5cdCAqIEBwYXJhbSB7ZnVuY3Rpb259IGdldEVsZW1lbnRcblx0ICogQHBhcmFtIHtBYm9ydENvbnRyb2xsZXJ9IGFib3J0Q29udHJvbGxlclxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZTxFbGVtZW50Pn1cblx0ICovXG5cdGNsaWNrRWxlbWVudEFuZFdhaXRGb3IoY2xpY2tUYXJnZXQsIHRhcmdldCwgZ2V0RWxlbWVudCwgYWJvcnRDb250cm9sbGVyKSB7XG5cdFx0cmV0dXJuIGNsaWNrRWxlbWVudEFuZFdhaXRGb3IoY2xpY2tUYXJnZXQsIHRhcmdldCwgZ2V0RWxlbWVudCwgYWJvcnRDb250cm9sbGVyKVxuXHR9XG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgVUlDb21wb25lbnRcbiIsImV4cG9ydCB7XG5cdFVOU0VORF9URVhUX1ZBUklBTlRTLFxuXHRMQUJFTF9QQVRURVJOU1xufVxuXG4vKiogTG9jYWxlLWluZGVwZW5kZW50IHBhdHRlcm5zIGZvciB0aGUgXCJVbnNlbmRcIiBtZW51IGl0ZW0gKi9cbmNvbnN0IFVOU0VORF9URVhUX1ZBUklBTlRTID0gW1xuXHRcInVuc2VuZFwiLCAgICAgICAgLy8gRW5nbGlzaFxuXHRcImFubnVsbGEgaW52aW9cIiwgLy8gSXRhbGlhblxuXHRcInJldGlyYXJcIiwgICAgICAgLy8gUG9ydHVndWVzZVxuXHRcImRlc2hhY2VyXCIsICAgICAgLy8gU3BhbmlzaFxuXHRcInJldGlyZXJcIiwgICAgICAgLy8gRnJlbmNoXG5cdFwienVyw7xja25laG1lblwiLCAgLy8gR2VybWFuXG5dXG5cblxuLyoqIFJlcHJlc2VudHMgdGhlIGRlc2NyaXB0aW9uIHRleHQgdGhhdCBpcyBhc3NvY2lhdGVkIHdpdGggdGhlIFwiLi4uXCIgYnV0dG9uIHRoYXQgcmV2ZWFscyB0aGUgYWN0aW9ucyBtZW51ICovXG5jb25zdCBMQUJFTF9QQVRURVJOUyA9IFtcblx0XCJbYXJpYS1sYWJlbF49J1NlZSBtb3JlIG9wdGlvbnMgZm9yIG1lc3NhZ2UnXVwiLFxuXHRcIlthcmlhLWxhYmVsKj0nbW9yZSBvcHRpb25zJ11cIixcblx0XCJbYXJpYS1sYWJlbCo9J01vcmUnXVwiLFxuXHRcIlthcmlhLWxhYmVsKj0nQWx0cmUgb3B6aW9uaSddXCIsXG5cdFwiW2FyaWEtbGFiZWwqPSdvcHppb25pJ11cIixcblx0XCJbYXJpYS1sYWJlbCo9J29wY2lvbmVzJ11cIixcblx0XCJbYXJpYS1sYWJlbCo9J29wdGlvbnMnXVwiLFxuXVxuXG4iLCIvKiogQG1vZHVsZSB1aS1tZXNzYWdlIFVJIGVsZW1lbnQgcmVwcmVzZW50aW5nIGEgbWVzc2FnZSAqL1xuXG5pbXBvcnQgVUlDb21wb25lbnQgZnJvbSBcIi4uL3VpLWNvbXBvbmVudC5qc1wiXG5cbmltcG9ydCAqIGFzIHN0cmluZ3MgZnJvbSBcIi4vc3RyaW5ncy5qc1wiXG5cbi8qKlxuICogRGlzcGF0Y2hlcyBwb2ludGVyIGFuZCBtb3VzZSBob3ZlciBldmVudHMgb24gYSB0YXJnZXQgZWxlbWVudC5cbiAqIEluc3RhZ3JhbSdzIFJlYWN0IHVzZXMgcG9pbnRlciBldmVudHMgaW50ZXJuYWxseTsgbW91c2UgZXZlbnRzIGFsb25lIGFyZSBpbnN1ZmZpY2llbnQuXG4gKlxuICogQHBhcmFtIHtFbGVtZW50fSB0YXJnZXRcbiAqL1xuZnVuY3Rpb24gZGlzcGF0Y2hIb3ZlckluKHRhcmdldCkge1xuXHRjb25zdCByZWN0ID0gdGFyZ2V0LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpXG5cdGNvbnN0IG9wdHMgPSB7XG5cdFx0YnViYmxlczogdHJ1ZSxcblx0XHRjYW5jZWxhYmxlOiB0cnVlLFxuXHRcdGNsaWVudFg6IHJlY3QueCArIHJlY3Qud2lkdGggLyAyLFxuXHRcdGNsaWVudFk6IHJlY3QueSArIHJlY3QuaGVpZ2h0IC8gMixcblx0XHRwb2ludGVySWQ6IDEsXG5cdFx0cG9pbnRlclR5cGU6IFwibW91c2VcIixcblx0fVxuXHR0YXJnZXQuZGlzcGF0Y2hFdmVudChuZXcgUG9pbnRlckV2ZW50KFwicG9pbnRlcmVudGVyXCIsIHsgLi4ub3B0cywgYnViYmxlczogZmFsc2UgfSkpXG5cdHRhcmdldC5kaXNwYXRjaEV2ZW50KG5ldyBQb2ludGVyRXZlbnQoXCJwb2ludGVyb3ZlclwiLCBvcHRzKSlcblx0dGFyZ2V0LmRpc3BhdGNoRXZlbnQobmV3IFBvaW50ZXJFdmVudChcInBvaW50ZXJtb3ZlXCIsIG9wdHMpKVxuXHR0YXJnZXQuZGlzcGF0Y2hFdmVudChuZXcgTW91c2VFdmVudChcIm1vdXNlZW50ZXJcIiwgeyAuLi5vcHRzLCBidWJibGVzOiBmYWxzZSB9KSlcblx0dGFyZ2V0LmRpc3BhdGNoRXZlbnQobmV3IE1vdXNlRXZlbnQoXCJtb3VzZW92ZXJcIiwgb3B0cykpXG5cdHRhcmdldC5kaXNwYXRjaEV2ZW50KG5ldyBNb3VzZUV2ZW50KFwibW91c2Vtb3ZlXCIsIG9wdHMpKVxufVxuXG4vKipcbiAqIERpc3BhdGNoZXMgcG9pbnRlciBhbmQgbW91c2UgbGVhdmUgZXZlbnRzIG9uIGEgdGFyZ2V0IGVsZW1lbnQuXG4gKlxuICogQHBhcmFtIHtFbGVtZW50fSB0YXJnZXRcbiAqL1xuZnVuY3Rpb24gZGlzcGF0Y2hIb3Zlck91dCh0YXJnZXQpIHtcblx0Y29uc3QgcmVjdCA9IHRhcmdldC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKVxuXHRjb25zdCBvcHRzID0ge1xuXHRcdGJ1YmJsZXM6IHRydWUsXG5cdFx0Y2FuY2VsYWJsZTogdHJ1ZSxcblx0XHRjbGllbnRYOiByZWN0LnggKyByZWN0LndpZHRoIC8gMixcblx0XHRjbGllbnRZOiByZWN0LnkgKyByZWN0LmhlaWdodCAvIDIsXG5cdFx0cG9pbnRlcklkOiAxLFxuXHRcdHBvaW50ZXJUeXBlOiBcIm1vdXNlXCIsXG5cdH1cblx0dGFyZ2V0LmRpc3BhdGNoRXZlbnQobmV3IFBvaW50ZXJFdmVudChcInBvaW50ZXJvdXRcIiwgb3B0cykpXG5cdHRhcmdldC5kaXNwYXRjaEV2ZW50KG5ldyBQb2ludGVyRXZlbnQoXCJwb2ludGVybGVhdmVcIiwgeyAuLi5vcHRzLCBidWJibGVzOiBmYWxzZSB9KSlcblx0dGFyZ2V0LmRpc3BhdGNoRXZlbnQobmV3IE1vdXNlRXZlbnQoXCJtb3VzZW91dFwiLCBvcHRzKSlcblx0dGFyZ2V0LmRpc3BhdGNoRXZlbnQobmV3IE1vdXNlRXZlbnQoXCJtb3VzZWxlYXZlXCIsIHsgLi4ub3B0cywgYnViYmxlczogZmFsc2UgfSkpXG59XG5cbmNsYXNzIFVJTWVzc2FnZSBleHRlbmRzIFVJQ29tcG9uZW50IHtcblxuXHQvKipcblx0ICogRGlzbWlzcyBhbnkgc3RhbGUgZGlhbG9nIG9yIGRyb3Bkb3duIGxlZnQgZnJvbSBhIHByZXZpb3VzIGZhaWxlZCB3b3JrZmxvdy5cblx0ICovXG5cdF9kaXNtaXNzU3RhbGVPdmVybGF5cygpIHtcblx0XHRjb25zdCBkb2MgPSB0aGlzLnJvb3Qub3duZXJEb2N1bWVudFxuXHRcdC8vIENsb3NlIHN0YWxlIGNvbmZpcm1hdGlvbiBkaWFsb2dzXG5cdFx0Y29uc3Qgc3RhbGVEaWFsb2cgPSBkb2MucXVlcnlTZWxlY3RvcihcIltyb2xlPWRpYWxvZ11cIilcblx0XHRpZiAoc3RhbGVEaWFsb2cpIHtcblx0XHRcdGNvbnNvbGUuZGVidWcoXCJEaXNtaXNzaW5nIHN0YWxlIGRpYWxvZ1wiKVxuXHRcdFx0Y29uc3QgY2xvc2VCdG4gPSBzdGFsZURpYWxvZy5xdWVyeVNlbGVjdG9yKFwiYnV0dG9uXCIpXG5cdFx0XHRpZiAoY2xvc2VCdG4pIGNsb3NlQnRuLmNsaWNrKClcblx0XHR9XG5cdFx0Ly8gQ2xvc2Ugc3RhbGUgZHJvcGRvd24gbWVudXMgYnkgcHJlc3NpbmcgRXNjYXBlXG5cdFx0Y29uc3QgYWN0aXZlTWVudSA9IGRvYy5xdWVyeVNlbGVjdG9yKFwiW3JvbGU9bWVudV0sIFtyb2xlPWxpc3Rib3hdXCIpXG5cdFx0aWYgKGFjdGl2ZU1lbnUpIHtcblx0XHRcdGNvbnNvbGUuZGVidWcoXCJEaXNtaXNzaW5nIHN0YWxlIG1lbnUgdmlhIEVzY2FwZVwiKVxuXHRcdFx0ZG9jLmJvZHkuZGlzcGF0Y2hFdmVudChuZXcgS2V5Ym9hcmRFdmVudChcImtleWRvd25cIiwgeyBrZXk6IFwiRXNjYXBlXCIsIGJ1YmJsZXM6IHRydWUgfSkpXG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIEZpbmQgdGhlIGFjdGlvbiBidXR0b24gd2l0aGluIHRoZSBtZXNzYWdlIHJvdy5cblx0ICogSW5zdGFncmFtIG1vdmVkIGFyaWEtbGFiZWwgZnJvbSB0aGUgYnV0dG9uIGRpdiB0byBhIG5lc3RlZCBTVkcvdGl0bGUuXG5cdCAqIEFueSBtYXRjaCAoU1ZHIG9yIGRpdikgaXMgd2Fsa2VkIHVwIHRvIHRoZSBuZWFyZXN0IFtyb2xlPWJ1dHRvbl0gYW5jZXN0b3IuXG5cdCAqXG5cdCAqIEBwYXJhbSB7RWxlbWVudH0gc2NvcGVcblx0ICogQHJldHVybnMge0VsZW1lbnR8bnVsbH1cblx0ICovXG5cdF9maW5kQWN0aW9uQnV0dG9uKHNjb3BlKSB7XG5cdFx0Zm9yIChjb25zdCBzZWwgb2Ygc3RyaW5ncy5MQUJFTF9QQVRURVJOUykge1xuXHRcdFx0Y29uc3QgZWwgPSBzY29wZS5xdWVyeVNlbGVjdG9yKHNlbClcblx0XHRcdGlmIChlbCkge1xuXHRcdFx0XHQvLyBBbHdheXMgcmVzb2x2ZSB0byBhIGNsaWNrYWJsZSBidXR0b24gY29udGFpbmVyXG5cdFx0XHRcdGNvbnN0IGJ0biA9IGVsLmNsb3Nlc3QoXCJbcm9sZT1idXR0b25dXCIpIHx8IGVsLmNsb3Nlc3QoXCJidXR0b25cIilcblx0XHRcdFx0aWYgKGJ0biAmJiBzY29wZS5jb250YWlucyhidG4pKSByZXR1cm4gYnRuXG5cdFx0XHRcdC8vIGVsIGl0c2VsZiBpcyBhbHJlYWR5IGEgYnV0dG9uLWxpa2UgZWxlbWVudFxuXHRcdFx0XHRpZiAoZWwudGFnTmFtZSA9PT0gXCJCVVRUT05cIiB8fCBlbC5nZXRBdHRyaWJ1dGUoXCJyb2xlXCIpID09PSBcImJ1dHRvblwiKSByZXR1cm4gZWxcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBGYWxsYmFjazogYW55IHJvbGU9YnV0dG9uIHdpdGggYXJpYS1oYXNwb3B1cD1tZW51IGluc2lkZSB0aGUgbWVzc2FnZSByb3dcblx0XHRyZXR1cm4gc2NvcGUucXVlcnlTZWxlY3RvcihcIltyb2xlPWJ1dHRvbl1bYXJpYS1oYXNwb3B1cD1tZW51XVwiKVxuXHR9XG5cblx0LyoqXG5cdCAqIEBwYXJhbSB7QWJvcnRDb250cm9sbGVyfSBhYm9ydENvbnRyb2xsZXJcblx0ICogQHJldHVybnMge1Byb21pc2U8SFRNTEJ1dHRvbkVsZW1lbnQ+fVxuXHQgKi9cblx0YXN5bmMgc2hvd0FjdGlvbnNNZW51QnV0dG9uKGFib3J0Q29udHJvbGxlcikge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJXb3JrZmxvdyBzdGVwIDEgOiBzaG93QWN0aW9uc01lbnVCdXR0b25cIiwgdGhpcy5yb290KVxuXHRcdHRoaXMuX2Rpc21pc3NTdGFsZU92ZXJsYXlzKClcblxuXHRcdC8vIENvbGxlY3QgYWxsIGhvdmVyYWJsZSBhbmNlc3RvcnMgZnJvbSByb290IGRvd24gdG8gdGhlIG1lc3NhZ2UgYnViYmxlLlxuXHRcdC8vIEluc3RhZ3JhbSBSZWFjdCBsaXN0ZW5zIGF0IGludGVybWVkaWF0ZSBsZXZlbHMgKHJvbGU9Z3JvdXAsIGZsZXgtZW5kIHdyYXBwZXIpLlxuXHRcdGNvbnN0IGhvdmVyVGFyZ2V0cyA9IFt0aGlzLnJvb3RdXG5cdFx0Y29uc3QgY29sbGVjdFRhcmdldHMgPSAoZWwsIGRlcHRoKSA9PiB7XG5cdFx0XHRpZiAoZGVwdGggPiA4KSByZXR1cm5cblx0XHRcdGZvciAoY29uc3QgY2hpbGQgb2YgZWwuY2hpbGRyZW4pIHtcblx0XHRcdFx0aG92ZXJUYXJnZXRzLnB1c2goY2hpbGQpXG5cdFx0XHRcdGNvbGxlY3RUYXJnZXRzKGNoaWxkLCBkZXB0aCArIDEpXG5cdFx0XHR9XG5cdFx0fVxuXHRcdGNvbGxlY3RUYXJnZXRzKHRoaXMucm9vdCwgMClcblxuXHRcdC8vIFRyeSB1cCB0byAzIHRpbWVzIOKAlCBob3ZlciBldmVudHMgY2FuIGJlIGZsYWt5XG5cdFx0Zm9yIChsZXQgYXR0ZW1wdCA9IDA7IGF0dGVtcHQgPCAzOyBhdHRlbXB0KyspIHtcblx0XHRcdGlmIChhYm9ydENvbnRyb2xsZXIuc2lnbmFsLmFib3J0ZWQpIHJldHVybiBudWxsXG5cblx0XHRcdGZvciAoY29uc3QgdGFyZ2V0IG9mIGhvdmVyVGFyZ2V0cykge1xuXHRcdFx0XHRkaXNwYXRjaEhvdmVySW4odGFyZ2V0KVxuXHRcdFx0fVxuXG5cdFx0XHRhd2FpdCBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgMTAwKSlcblxuXHRcdFx0Y29uc3QgYnRuID0gdGhpcy5fZmluZEFjdGlvbkJ1dHRvbih0aGlzLnJvb3QpXG5cdFx0XHRpZiAoYnRuKSB7XG5cdFx0XHRcdGNvbnNvbGUuZGVidWcoXCJXb3JrZmxvdyBzdGVwIDEgOiBmb3VuZCBhY3Rpb24gYnV0dG9uIG9uIGF0dGVtcHRcIiwgYXR0ZW1wdCwgYnRuKVxuXHRcdFx0XHRyZXR1cm4gYnRuXG5cdFx0XHR9XG5cblx0XHRcdGNvbnNvbGUuZGVidWcoXCJXb3JrZmxvdyBzdGVwIDEgOiBhdHRlbXB0XCIsIGF0dGVtcHQsIFwibm8gYnV0dG9uIGZvdW5kLCByZXRyeWluZy4uLlwiKVxuXHRcdFx0ZGlzcGF0Y2hIb3Zlck91dCh0aGlzLnJvb3QpXG5cdFx0XHRhd2FpdCBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgNTApKVxuXHRcdH1cblxuXHRcdC8vIEZpbmFsIGZhbGxiYWNrOiB1c2Ugd2FpdEZvckVsZW1lbnQgd2l0aCBleHRlbmRlZCB0aW1lb3V0XG5cdFx0Y29uc3Qgd2FpdEFib3J0Q29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKVxuXHRcdGxldCBwcm9taXNlVGltZW91dFxuXHRcdGNvbnN0IGFib3J0SGFuZGxlciA9ICgpID0+IHtcblx0XHRcdHdhaXRBYm9ydENvbnRyb2xsZXIuYWJvcnQoXCJzaG93QWN0aW9uc01lbnVCdXR0b24gc3RlcCB3YXMgYWJvcnRlZCBieSB0aGUgcGFyZW50IHByb2Nlc3NcIilcblx0XHRcdGNsZWFyVGltZW91dChwcm9taXNlVGltZW91dClcblx0XHR9XG5cdFx0YWJvcnRDb250cm9sbGVyLnNpZ25hbC5hZGRFdmVudExpc3RlbmVyKFwiYWJvcnRcIiwgYWJvcnRIYW5kbGVyKVxuXG5cdFx0Zm9yIChjb25zdCB0YXJnZXQgb2YgaG92ZXJUYXJnZXRzKSB7XG5cdFx0XHRkaXNwYXRjaEhvdmVySW4odGFyZ2V0KVxuXHRcdH1cblxuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBhY3Rpb25CdXR0b24gPSBhd2FpdCBQcm9taXNlLnJhY2UoW1xuXHRcdFx0XHR0aGlzLndhaXRGb3JFbGVtZW50KFxuXHRcdFx0XHRcdHRoaXMucm9vdCxcblx0XHRcdFx0XHQoKSA9PiB0aGlzLl9maW5kQWN0aW9uQnV0dG9uKHRoaXMucm9vdCksXG5cdFx0XHRcdFx0d2FpdEFib3J0Q29udHJvbGxlclxuXHRcdFx0XHQpLFxuXHRcdFx0XHRuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cdFx0XHRcdFx0cHJvbWlzZVRpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHJlamVjdChcIlRpbWVvdXQgc2hvd0FjdGlvbnNNZW51QnV0dG9uXCIpLCAzMDAwKVxuXHRcdFx0XHR9KVxuXHRcdFx0XSlcblxuXHRcdFx0aWYgKGFjdGlvbkJ1dHRvbikge1xuXHRcdFx0XHRyZXR1cm4gYWN0aW9uQnV0dG9uXG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gYWN0aW9uQnV0dG9uXG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdHdhaXRBYm9ydENvbnRyb2xsZXIuYWJvcnQoKSAvLyBBYm9ydGluZyB3aXRob3V0IHJlYXNvbiBiZWNhdXNlIHRoZSByZWFzb24gaXMgdGhlIGVycm9yIGl0c2VsZlxuXHRcdFx0Y2xlYXJUaW1lb3V0KHByb21pc2VUaW1lb3V0KVxuXHRcdFx0YWJvcnRDb250cm9sbGVyLnNpZ25hbC5yZW1vdmVFdmVudExpc3RlbmVyKFwiYWJvcnRcIiwgYWJvcnRIYW5kbGVyKVxuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBAcGFyYW0ge0Fib3J0Q29udHJvbGxlcn0gYWJvcnRDb250cm9sbGVyXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlPGJvb2xlYW4+fVxuXHQgKi9cblx0YXN5bmMgaGlkZUFjdGlvbk1lbnVCdXR0b24oYWJvcnRDb250cm9sbGVyKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcImhpZGVBY3Rpb25NZW51QnV0dG9uXCIsIHRoaXMucm9vdClcblx0XHRkaXNwYXRjaEhvdmVyT3V0KHRoaXMucm9vdClcblxuXHRcdGNvbnN0IG5vbmVFbCA9IHRoaXMucm9vdC5xdWVyeVNlbGVjdG9yKFwiW3JvbGU9bm9uZV1cIilcblx0XHRpZiAobm9uZUVsKSB7XG5cdFx0XHRkaXNwYXRjaEhvdmVyT3V0KG5vbmVFbClcblx0XHR9XG5cblx0XHRjb25zdCB3YWl0QWJvcnRDb250cm9sbGVyID0gbmV3IEFib3J0Q29udHJvbGxlcigpXG5cdFx0bGV0IHByb21pc2VUaW1lb3V0XG5cdFx0bGV0IHJlc29sdmVUaW1lb3V0XG5cdFx0Y29uc3QgYWJvcnRIYW5kbGVyID0gKCkgPT4ge1xuXHRcdFx0d2FpdEFib3J0Q29udHJvbGxlci5hYm9ydChcImhpZGVBY3Rpb25NZW51QnV0dG9uIHN0ZXAgd2FzIGFib3J0ZWQgYnkgdGhlIHBhcmVudCBwcm9jZXNzXCIpXG5cdFx0XHRjbGVhclRpbWVvdXQocHJvbWlzZVRpbWVvdXQpXG5cdFx0XHRpZiAocmVzb2x2ZVRpbWVvdXQpIHtcblx0XHRcdFx0cmVzb2x2ZVRpbWVvdXQoKVxuXHRcdFx0fVxuXHRcdH1cblx0XHRhYm9ydENvbnRyb2xsZXIuc2lnbmFsLmFkZEV2ZW50TGlzdGVuZXIoXCJhYm9ydFwiLCBhYm9ydEhhbmRsZXIpXG5cblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgUHJvbWlzZS5yYWNlKFtcblx0XHRcdFx0dGhpcy53YWl0Rm9yRWxlbWVudChcblx0XHRcdFx0XHR0aGlzLnJvb3QsXG5cdFx0XHRcdFx0KCkgPT4gdGhpcy5fZmluZEFjdGlvbkJ1dHRvbih0aGlzLnJvb3QpID09PSBudWxsLFxuXHRcdFx0XHRcdHdhaXRBYm9ydENvbnRyb2xsZXJcblx0XHRcdFx0KSxcblx0XHRcdFx0bmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuXHRcdFx0XHRcdHJlc29sdmVUaW1lb3V0ID0gcmVzb2x2ZVxuXHRcdFx0XHRcdHByb21pc2VUaW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiByZWplY3QoXCJUaW1lb3V0IGhpZGVBY3Rpb25NZW51QnV0dG9uXCIpLCA1MDApXG5cdFx0XHRcdH0pXG5cdFx0XHRdKVxuXHRcdFx0cmV0dXJuIHJlc3VsdFxuXHRcdH0gZmluYWxseSB7XG5cdFx0XHR3YWl0QWJvcnRDb250cm9sbGVyLmFib3J0KCkgLy8gQWJvcnRpbmcgd2l0aG91dCByZWFzb24gYmVjYXVzZSB0aGUgcmVhc29uIGlzIHRoZSBlcnJvciBpdHNlbGZcblx0XHRcdGNsZWFyVGltZW91dChwcm9taXNlVGltZW91dClcblx0XHRcdGFib3J0Q29udHJvbGxlci5zaWduYWwucmVtb3ZlRXZlbnRMaXN0ZW5lcihcImFib3J0XCIsIGFib3J0SGFuZGxlcilcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogT3BlbnMgdGhlIGFjdGlvbnMgbWVudSBieSBjbGlja2luZyB0aGUgYWN0aW9uIGJ1dHRvbiBhbmQgd2FpdGluZyBmb3IgdGhlIFwiVW5zZW5kXCIgaXRlbS5cblx0ICpcblx0ICogQHBhcmFtIHtIVE1MQnV0dG9uRWxlbWVudH0gYWN0aW9uQnV0dG9uXG5cdCAqIEBwYXJhbSB7QWJvcnRDb250cm9sbGVyfSBhYm9ydENvbnRyb2xsZXJcblx0ICogQHJldHVybnMge1Byb21pc2V9XG5cdCAqL1xuXHRhc3luYyBvcGVuQWN0aW9uc01lbnUoYWN0aW9uQnV0dG9uLCBhYm9ydENvbnRyb2xsZXIpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwiV29ya2Zsb3cgc3RlcCAyIDogQ2xpY2tpbmcgYWN0aW9uQnV0dG9uIGFuZCB3YWl0aW5nIGZvciB1bnNlbmQgbWVudSBpdGVtIHRvIGFwcGVhclwiLCBhY3Rpb25CdXR0b24pXG5cdFx0Y29uc3Qgd2FpdEFib3J0Q29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKVxuXHRcdGxldCBwcm9taXNlVGltZW91dFxuXHRcdGxldCByZXNvbHZlVGltZW91dFxuXHRcdGNvbnN0IGFib3J0SGFuZGxlciA9ICgpID0+IHtcblx0XHRcdHdhaXRBYm9ydENvbnRyb2xsZXIuYWJvcnQoXCJvcGVuQWN0aW9uc01lbnUgc3RlcCB3YXMgYWJvcnRlZCBieSB0aGUgcGFyZW50IHByb2Nlc3NcIilcblx0XHRcdGNsZWFyVGltZW91dChwcm9taXNlVGltZW91dClcblx0XHRcdGlmIChyZXNvbHZlVGltZW91dCkge1xuXHRcdFx0XHRyZXNvbHZlVGltZW91dCgpXG5cdFx0XHR9XG5cdFx0fVxuXHRcdGFib3J0Q29udHJvbGxlci5zaWduYWwuYWRkRXZlbnRMaXN0ZW5lcihcImFib3J0XCIsIGFib3J0SGFuZGxlcilcblxuXHRcdC8qKiBDaGVjayBpZiB0ZXh0IG1hdGNoZXMgYW55IGtub3duIFwiVW5zZW5kXCIgdmFyaWFudCAqL1xuXHRcdGNvbnN0IGlzVW5zZW5kVGV4dCA9ICh0ZXh0KSA9PiB7XG5cdFx0XHRjb25zdCBub3JtYWxpemVkID0gdGV4dC50cmltKCkudG9Mb2NhbGVMb3dlckNhc2UoKVxuXHRcdFx0cmV0dXJuIHN0cmluZ3MuVU5TRU5EX1RFWFRfVkFSSUFOVFMuc29tZSh2ID0+IG5vcm1hbGl6ZWQgPT09IHYpXG5cdFx0fVxuXG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IHVuc2VuZEJ1dHRvbiA9IGF3YWl0IFByb21pc2UucmFjZShbXG5cdFx0XHRcdHRoaXMuY2xpY2tFbGVtZW50QW5kV2FpdEZvcihcblx0XHRcdFx0XHRhY3Rpb25CdXR0b24sXG5cdFx0XHRcdFx0dGhpcy5yb290Lm93bmVyRG9jdW1lbnQuYm9keSxcblx0XHRcdFx0XHQobXV0YXRpb25zKSA9PiB7XG5cdFx0XHRcdFx0XHRpZiAobXV0YXRpb25zKSB7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IGFkZGVkTm9kZXMgPSBbLi4ubXV0YXRpb25zLm1hcChtdXRhdGlvbiA9PiBbLi4ubXV0YXRpb24uYWRkZWROb2Rlc10pXS5mbGF0KCkuZmlsdGVyKG5vZGUgPT4gbm9kZS5ub2RlVHlwZSA9PT0gMSlcblx0XHRcdFx0XHRcdFx0Zm9yIChjb25zdCBhZGRlZE5vZGUgb2YgYWRkZWROb2Rlcykge1xuXHRcdFx0XHRcdFx0XHRcdGNvbnN0IG5vZGUgPSBbLi4uYWRkZWROb2RlLnF1ZXJ5U2VsZWN0b3JBbGwoXCJzcGFuLGRpdlwiKV0uZmluZChub2RlID0+IGlzVW5zZW5kVGV4dChub2RlLnRleHRDb250ZW50KSAmJiBub2RlLmZpcnN0Q2hpbGQ/Lm5vZGVUeXBlID09PSAzKVxuXHRcdFx0XHRcdFx0XHRcdGlmIChub2RlKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRjb25zb2xlLmRlYnVnKFwiV29ya2Zsb3cgc3RlcCAyIDogZm91bmQgdW5zZW5kIG5vZGUgdmlhIG11dGF0aW9uXCIsIG5vZGUpXG5cdFx0XHRcdFx0XHRcdFx0XHRyZXR1cm4gbm9kZVxuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0Ly8gRmFsbGJhY2s6IHNjYW4gdGhlIHdob2xlIGRvY3VtZW50IGZvciBhbiB1bnNlbmQgbWVudSBpdGVtIGFscmVhZHkgcHJlc2VudFxuXHRcdFx0XHRcdFx0Y29uc3QgYWxsU3BhbnMgPSB0aGlzLnJvb3Qub3duZXJEb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKFwiW3JvbGU9bWVudV0gc3BhbiwgW3JvbGU9bWVudV0gZGl2LCBbcm9sZT1tZW51aXRlbV0gc3BhbiwgW3JvbGU9bWVudWl0ZW1dIGRpdlwiKVxuXHRcdFx0XHRcdFx0Zm9yIChjb25zdCBzcGFuIG9mIGFsbFNwYW5zKSB7XG5cdFx0XHRcdFx0XHRcdGlmIChpc1Vuc2VuZFRleHQoc3Bhbi50ZXh0Q29udGVudCkgJiYgc3Bhbi5maXJzdENoaWxkPy5ub2RlVHlwZSA9PT0gMykge1xuXHRcdFx0XHRcdFx0XHRcdGNvbnNvbGUuZGVidWcoXCJXb3JrZmxvdyBzdGVwIDIgOiBmb3VuZCB1bnNlbmQgbm9kZSB2aWEgZG9jdW1lbnQgc2NhblwiLCBzcGFuKVxuXHRcdFx0XHRcdFx0XHRcdHJldHVybiBzcGFuXG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHdhaXRBYm9ydENvbnRyb2xsZXJcblx0XHRcdFx0KSxcblx0XHRcdFx0bmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuXHRcdFx0XHRcdHByb21pc2VUaW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiByZWplY3QoXCJUaW1lb3V0IG9wZW5BY3Rpb25zTWVudVwiKSwgMzAwMClcblx0XHRcdFx0fSlcblx0XHRcdF0pXG5cblx0XHRcdGNvbnNvbGUuZGVidWcoXCJXb3JrZmxvdyBzdGVwIDIgOiBGb3VuZCB1bnNlbmRCdXR0b25cIiwgdW5zZW5kQnV0dG9uKVxuXHRcdFx0cmV0dXJuIHVuc2VuZEJ1dHRvblxuXHRcdH0gZmluYWxseSB7XG5cdFx0XHR3YWl0QWJvcnRDb250cm9sbGVyLmFib3J0KCkgLy8gQWJvcnRpbmcgd2l0aG91dCByZWFzb24gYmVjYXVzZSB0aGUgcmVhc29uIGlzIHRoZSBlcnJvciBpdHNlbGZcblx0XHRcdGNsZWFyVGltZW91dChwcm9taXNlVGltZW91dClcblx0XHRcdGFib3J0Q29udHJvbGxlci5zaWduYWwucmVtb3ZlRXZlbnRMaXN0ZW5lcihcImFib3J0XCIsIGFib3J0SGFuZGxlcilcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogQ2xvc2VzIHRoZSBhY3Rpb25zIG1lbnUuXG5cdCAqXG5cdCAqIEBwYXJhbSB7SFRNTEJ1dHRvbkVsZW1lbnR9IGFjdGlvbkJ1dHRvblxuXHQgKiBAcGFyYW0ge0hUTUxEaXZFbGVtZW50fSBhY3Rpb25zTWVudUVsZW1lbnRcblx0ICogQHBhcmFtIHtBYm9ydENvbnRyb2xsZXJ9IGFib3J0Q29udHJvbGxlclxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZTxib29sZWFuPn1cblx0ICovXG5cdGFzeW5jIGNsb3NlQWN0aW9uc01lbnUoYWN0aW9uQnV0dG9uLCBhY3Rpb25zTWVudUVsZW1lbnQsIGFib3J0Q29udHJvbGxlcikge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJjbG9zZUFjdGlvbnNNZW51XCIpXG5cdFx0Y29uc3Qgd2FpdEFib3J0Q29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKVxuXHRcdGxldCBwcm9taXNlVGltZW91dFxuXHRcdGxldCByZXNvbHZlVGltZW91dFxuXHRcdGNvbnN0IGFib3J0SGFuZGxlciA9ICgpID0+IHtcblx0XHRcdHdhaXRBYm9ydENvbnRyb2xsZXIuYWJvcnQoXCJjbG9zZUFjdGlvbnNNZW51IHN0ZXAgd2FzIGFib3J0ZWQgYnkgdGhlIHBhcmVudCBwcm9jZXNzXCIpXG5cdFx0XHRjbGVhclRpbWVvdXQocHJvbWlzZVRpbWVvdXQpXG5cdFx0XHRpZiAocmVzb2x2ZVRpbWVvdXQpIHtcblx0XHRcdFx0cmVzb2x2ZVRpbWVvdXQoKVxuXHRcdFx0fVxuXHRcdH1cblx0XHRhYm9ydENvbnRyb2xsZXIuc2lnbmFsLmFkZEV2ZW50TGlzdGVuZXIoXCJhYm9ydFwiLCBhYm9ydEhhbmRsZXIpXG5cblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgUHJvbWlzZS5yYWNlKFtcblx0XHRcdFx0dGhpcy5jbGlja0VsZW1lbnRBbmRXYWl0Rm9yKFxuXHRcdFx0XHRcdGFjdGlvbkJ1dHRvbixcblx0XHRcdFx0XHR0aGlzLnJvb3Qub3duZXJEb2N1bWVudC5ib2R5LFxuXHRcdFx0XHRcdCgpID0+IHRoaXMucm9vdC5vd25lckRvY3VtZW50LmJvZHkuY29udGFpbnMoYWN0aW9uc01lbnVFbGVtZW50KSA9PT0gZmFsc2UsXG5cdFx0XHRcdFx0YWJvcnRDb250cm9sbGVyXG5cdFx0XHRcdCksXG5cdFx0XHRcdG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcblx0XHRcdFx0XHRwcm9taXNlVGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4gcmVqZWN0KFwiVGltZW91dCBjbG9zZUFjdGlvbnNNZW51XCIpLCA1MDApXG5cdFx0XHRcdH0pXG5cdFx0XHRdKVxuXHRcdFx0cmV0dXJuIHJlc3VsdCAhPT0gbnVsbFxuXHRcdH0gZmluYWxseSB7XG5cdFx0XHR3YWl0QWJvcnRDb250cm9sbGVyLmFib3J0KClcblx0XHRcdGNsZWFyVGltZW91dChwcm9taXNlVGltZW91dClcblx0XHRcdGFib3J0Q29udHJvbGxlci5zaWduYWwucmVtb3ZlRXZlbnRMaXN0ZW5lcihcImFib3J0XCIsIGFib3J0SGFuZGxlcilcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogQ2xpY2sgdW5zZW5kIGJ1dHRvbiBhbmQgd2FpdCBmb3IgdGhlIGNvbmZpcm1hdGlvbiBkaWFsb2cuXG5cdCAqXG5cdCAqIEBwYXJhbSB7SFRNTFNwYW5FbGVtZW50fSB1bnNlbmRCdXR0b25cblx0ICogQHBhcmFtIHtBYm9ydENvbnRyb2xsZXJ9IGFib3J0Q29udHJvbGxlclxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZTxIVE1MQnV0dG9uRWxlbWVudD58UHJvbWlzZTxFcnJvcj59XG5cdCAqL1xuXHRvcGVuQ29uZmlybVVuc2VuZE1vZGFsKHVuc2VuZEJ1dHRvbiwgYWJvcnRDb250cm9sbGVyKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIldvcmtmbG93IHN0ZXAgMyA6IENsaWNraW5nIHVuc2VuZEJ1dHRvbiBhbmQgd2FpdGluZyBmb3IgZGlhbG9nIHRvIGFwcGVhci4uLlwiKVxuXHRcdHJldHVybiB0aGlzLmNsaWNrRWxlbWVudEFuZFdhaXRGb3IoXG5cdFx0XHR1bnNlbmRCdXR0b24sXG5cdFx0XHR0aGlzLnJvb3Qub3duZXJEb2N1bWVudC5ib2R5LFxuXHRcdFx0KCkgPT4gdGhpcy5yb290Lm93bmVyRG9jdW1lbnQucXVlcnlTZWxlY3RvcihcIltyb2xlPWRpYWxvZ10gYnV0dG9uXCIpLFxuXHRcdFx0YWJvcnRDb250cm9sbGVyXG5cdFx0KVxuXHR9XG5cblx0LyoqXG5cdCAqIENsaWNrIHVuc2VuZCBjb25maXJtIGJ1dHRvbiBpbiB0aGUgbW9kYWwgZGlhbG9nLlxuXHQgKlxuXHQgKiBAcGFyYW0ge0hUTUxCdXR0b25FbGVtZW50fSBkaWFsb2dCdXR0b25cblx0ICogQHBhcmFtIHtBYm9ydENvbnRyb2xsZXJ9IGFib3J0Q29udHJvbGxlclxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZX1cblx0ICovXG5cdGFzeW5jIGNvbmZpcm1VbnNlbmQoZGlhbG9nQnV0dG9uLCBhYm9ydENvbnRyb2xsZXIpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwiV29ya2Zsb3cgZmluYWwgc3RlcCA6IGNvbmZpcm1VbnNlbmRcIiwgZGlhbG9nQnV0dG9uKVxuXHRcdGF3YWl0IHRoaXMuY2xpY2tFbGVtZW50QW5kV2FpdEZvcihcblx0XHRcdGRpYWxvZ0J1dHRvbixcblx0XHRcdHRoaXMucm9vdC5vd25lckRvY3VtZW50LmJvZHksXG5cdFx0XHQoKSA9PiB0aGlzLnJvb3Qub3duZXJEb2N1bWVudC5xdWVyeVNlbGVjdG9yKFwiW3JvbGU9ZGlhbG9nXSBidXR0b25cIikgPT09IG51bGwsXG5cdFx0XHRhYm9ydENvbnRyb2xsZXJcblx0XHQpXG5cdH1cblxufVxuXG5leHBvcnQgZGVmYXVsdCBVSU1lc3NhZ2VcbiIsIi8qKiBAbW9kdWxlIHVpcGktbWVzc2FnZSBBUEkgZm9yIFVJTWVzc2FnZSAqL1xuXG4vKiBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tdW51c2VkLXZhcnMgKi9cbmltcG9ydCBVSU1lc3NhZ2UgZnJvbSBcIi4uL3VpL2RlZmF1bHQvdWktbWVzc2FnZS5qc1wiXG5cbmNsYXNzIEZhaWxlZFdvcmtmbG93RXhjZXB0aW9uIGV4dGVuZHMgRXJyb3Ige31cblxuY2xhc3MgVUlQSU1lc3NhZ2Uge1xuXG5cdC8qKlxuXHQgKiBAcGFyYW0ge1VJTWVzc2FnZX0gdWlNZXNzYWdlXG5cdCAqL1xuXHRjb25zdHJ1Y3Rvcih1aU1lc3NhZ2UpIHtcblx0XHR0aGlzLl91aU1lc3NhZ2UgPSB1aU1lc3NhZ2Vcblx0fVxuXG5cdC8qKlxuXHQgKiBAcGFyYW0ge0Fib3J0Q29udHJvbGxlcn0gYWJvcnRDb250cm9sbGVyXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlPGJvb2xlYW4+fVxuXHQgKi9cblx0YXN5bmMgdW5zZW5kKGFib3J0Q29udHJvbGxlcikge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJVSVBJTWVzc2FnZSB1bnNlbmRcIilcblx0XHRsZXQgYWN0aW9uQnV0dG9uXG5cdFx0bGV0IHVuc2VuZEJ1dHRvblxuXHRcdHRyeSB7XG5cdFx0XHRhY3Rpb25CdXR0b24gPSBhd2FpdCB0aGlzLnVpTWVzc2FnZS5zaG93QWN0aW9uc01lbnVCdXR0b24oYWJvcnRDb250cm9sbGVyKVxuXHRcdFx0dW5zZW5kQnV0dG9uID0gYXdhaXQgdGhpcy51aU1lc3NhZ2Uub3BlbkFjdGlvbnNNZW51KGFjdGlvbkJ1dHRvbiwgYWJvcnRDb250cm9sbGVyKVxuXHRcdFx0Y29uc29sZS5kZWJ1ZyhcInVuc2VuZEJ1dHRvblwiLCB1bnNlbmRCdXR0b24pXG5cdFx0XHRjb25zdCBkaWFsb2dCdXR0b24gPSBhd2FpdCB0aGlzLnVpTWVzc2FnZS5vcGVuQ29uZmlybVVuc2VuZE1vZGFsKHVuc2VuZEJ1dHRvbiwgYWJvcnRDb250cm9sbGVyKVxuXHRcdFx0YXdhaXQgdGhpcy51aU1lc3NhZ2UuY29uZmlybVVuc2VuZChkaWFsb2dCdXR0b24sIGFib3J0Q29udHJvbGxlcilcblx0XHRcdHRoaXMudWlNZXNzYWdlLnJvb3Quc2V0QXR0cmlidXRlKFwiZGF0YS1pZG11LXVuc2VudFwiLCBcIlwiKVxuXHRcdFx0cmV0dXJuIHRydWVcblx0XHR9IGNhdGNoKGV4KSB7XG5cdFx0XHRjb25zb2xlLmVycm9yKGV4KVxuXHRcdFx0dGhpcy51aU1lc3NhZ2Uucm9vdC5zZXRBdHRyaWJ1dGUoXCJkYXRhLWlkbXUtaWdub3JlXCIsIFwiXCIpXG5cdFx0XHQvLyBEaXNtaXNzIGFueSBvcGVuIG92ZXJsYXkgc28gdGhlIG5leHQgbWVzc2FnZSBzdGFydHMgY2xlYW5cblx0XHRcdHRyeSB7XG5cdFx0XHRcdGNvbnN0IGRvYyA9IHRoaXMudWlNZXNzYWdlLnJvb3Qub3duZXJEb2N1bWVudFxuXHRcdFx0XHRkb2MuYm9keS5kaXNwYXRjaEV2ZW50KG5ldyBLZXlib2FyZEV2ZW50KFwia2V5ZG93blwiLCB7IGtleTogXCJFc2NhcGVcIiwgYnViYmxlczogdHJ1ZSB9KSlcblx0XHRcdFx0YXdhaXQgbmV3IFByb21pc2UocmVzb2x2ZSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIDIwMCkpXG5cdFx0XHRcdC8vIElmIGRpYWxvZyBpcyBzdGlsbCBvcGVuLCBwcmVzcyBFc2NhcGUgYWdhaW5cblx0XHRcdFx0aWYgKGRvYy5xdWVyeVNlbGVjdG9yKFwiW3JvbGU9ZGlhbG9nXVwiKSkge1xuXHRcdFx0XHRcdGRvYy5ib2R5LmRpc3BhdGNoRXZlbnQobmV3IEtleWJvYXJkRXZlbnQoXCJrZXlkb3duXCIsIHsga2V5OiBcIkVzY2FwZVwiLCBidWJibGVzOiB0cnVlIH0pKVxuXHRcdFx0XHRcdGF3YWl0IG5ldyBQcm9taXNlKHJlc29sdmUgPT4gc2V0VGltZW91dChyZXNvbHZlLCAyMDApKVxuXHRcdFx0XHR9XG5cdFx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0XHRjb25zb2xlLmVycm9yKGVycm9yKVxuXHRcdFx0fVxuXHRcdFx0dGhyb3cgbmV3IEZhaWxlZFdvcmtmbG93RXhjZXB0aW9uKFwiRmFpbGVkIHRvIGV4ZWN1dGUgd29ya2Zsb3cgZm9yIHRoaXMgbWVzc2FnZVwiLCBleClcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogQHR5cGUge1VJTWVzc2FnZX1cblx0ICovXG5cdGdldCB1aU1lc3NhZ2UoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX3VpTWVzc2FnZVxuXHR9XG5cbn1cbmV4cG9ydCB7IEZhaWxlZFdvcmtmbG93RXhjZXB0aW9uIH1cbmV4cG9ydCBkZWZhdWx0IFVJUElNZXNzYWdlXG4iLCJpbXBvcnQgVUlDb21wb25lbnQgZnJvbSBcIi4vdWktY29tcG9uZW50LmpzXCJcblxuLyogZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLXVudXNlZC12YXJzICovXG5pbXBvcnQgVUlQSU1lc3NhZ2UgZnJvbSBcIi4uL3VpcGkvdWlwaS1tZXNzYWdlLmpzXCJcblxuLyoqXG4gKlxuICogQGFic3RyYWN0XG4gKi9cbmNsYXNzIFVJIGV4dGVuZHMgVUlDb21wb25lbnQge1xuXG5cdC8qKlxuXHQgKlxuXHQgKiBAYWJzdHJhY3Rcblx0ICogQHJldHVybnMge1VJfVxuXHQgKi9cblx0c3RhdGljIGNyZWF0ZSgpIHtcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAYWJzdHJhY3Rcblx0ICogQHBhcmFtIHtBYm9ydENvbnRyb2xsZXJ9IGFib3J0Q29udHJvbGxlclxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZX1cblx0ICovXG5cdC8qIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby11bnVzZWQtdmFycyAqL1xuXHRhc3luYyBmZXRjaEFuZFJlbmRlclRocmVhZE5leHRNZXNzYWdlUGFnZShhYm9ydENvbnRyb2xsZXIpIHtcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAYWJzdHJhY3Rcblx0ICogQHJldHVybnMge1Byb21pc2U8VUlQSU1lc3NhZ2U+fVxuXHQgKi9cblx0YXN5bmMgZ2V0TmV4dFVJUElNZXNzYWdlKCkge1xuXHR9XG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgVUlcbiIsIi8qKiBAbW9kdWxlIGRvbS1sb29rdXAgVXRpbHMgbW9kdWxlIGZvciBsb29raW5nIHVwIGVsZW1lbnRzIG9uIHRoZSBkZWZhdWx0IFVJICovXG5cbmltcG9ydCB7IHdhaXRGb3JFbGVtZW50IH0gZnJvbSBcIi4uLy4uL2RvbS9hc3luYy1ldmVudHMuanNcIlxuXG4vKipcbiAqIEZpbmRzIHRoZSBzY3JvbGxhYmxlIG1lc3NhZ2VzIGNvbnRhaW5lciBpbnNpZGUgdGhlIGNvbnZlcnNhdGlvbiBwYW5lbC5cbiAqIEluc3RhZ3JhbSByZW1vdmVkIHJvbGU9XCJncmlkXCIg4oCUIHdlIG5vdyBsb2NhdGUgdGhlIGNvbnRhaW5lciB2aWEgYXJpYS1sYWJlbFxuICogYW5kIHdhbGsgaW50byBpdHMgc2Nyb2xsYWJsZSBjaGlsZC5cbiAqXG4gKiBAcGFyYW0ge1dpbmRvd30gd2luZG93XG4gKiBAcmV0dXJucyB7SFRNTERpdkVsZW1lbnR8bnVsbH1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGZpbmRNZXNzYWdlc1dyYXBwZXIod2luZG93KSB7XG5cdGNvbnN0IGNvbnZlcnNhdGlvbiA9IHdpbmRvdy5kb2N1bWVudC5xdWVyeVNlbGVjdG9yKFwiW2FyaWEtbGFiZWxePSdDb252ZXJzYXRpb24nXVwiKVxuXHRpZiAoIWNvbnZlcnNhdGlvbikge1xuXHRcdHJldHVybiBudWxsXG5cdH1cblx0Y29uc3Qgc2Nyb2xsYWJsZSA9IGZpbmRTY3JvbGxhYmxlQ2hpbGQoY29udmVyc2F0aW9uLCB3aW5kb3cpXG5cdGlmICghc2Nyb2xsYWJsZSkge1xuXHRcdHJldHVybiBudWxsXG5cdH1cblx0cmV0dXJuIHNjcm9sbGFibGVcbn1cblxuLyoqXG4gKiBSZWN1cnNpdmVseSBmaW5kcyB0aGUgZmlyc3Qgc2Nyb2xsYWJsZSBkZXNjZW5kYW50IG9mIGEgZ2l2ZW4gZWxlbWVudC5cbiAqXG4gKiBAcGFyYW0ge0VsZW1lbnR9IHBhcmVudFxuICogQHBhcmFtIHtXaW5kb3d9IHdpbmRvd1xuICogQHJldHVybnMge0hUTUxEaXZFbGVtZW50fG51bGx9XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBmaW5kU2Nyb2xsYWJsZUNoaWxkKHBhcmVudCwgd2luZG93KSB7XG5cdGZvciAoY29uc3QgY2hpbGQgb2YgcGFyZW50LmNoaWxkcmVuKSB7XG5cdFx0Y29uc3Qgc3R5bGUgPSB3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZShjaGlsZClcblx0XHRpZiAoXG5cdFx0XHQoc3R5bGUub3ZlcmZsb3dZID09PSBcImF1dG9cIiB8fCBzdHlsZS5vdmVyZmxvd1kgPT09IFwic2Nyb2xsXCIpICYmXG5cdFx0XHRjaGlsZC5zY3JvbGxIZWlnaHQgPiBjaGlsZC5jbGllbnRIZWlnaHRcblx0XHQpIHtcblx0XHRcdHJldHVybiBjaGlsZFxuXHRcdH1cblx0XHRjb25zdCBmb3VuZCA9IGZpbmRTY3JvbGxhYmxlQ2hpbGQoY2hpbGQsIHdpbmRvdylcblx0XHRpZiAoZm91bmQpIHtcblx0XHRcdHJldHVybiBmb3VuZFxuXHRcdH1cblx0fVxuXHRyZXR1cm4gbnVsbFxufVxuXG4vKipcbiAqIFJldHVybnMgdGhlIGlubmVyIGNvbnRhaW5lciB0aGF0IGhvbGRzIGluZGl2aWR1YWwgbWVzc2FnZSByb3cgZGl2cy5cbiAqIFRyYXZlcnNlcyB3cmFwcGVyIGxheWVycyB0byBmaW5kIHRoZSBkaXYgd2l0aCB0aGUgbW9zdCBjaGlsZHJlbiAodGhlIG1lc3NhZ2UgbGlzdCkuXG4gKlxuICogQHBhcmFtIHtFbGVtZW50fSBzY3JvbGxhYmxlXG4gKiBAcmV0dXJucyB7SFRNTERpdkVsZW1lbnR9XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRNZXNzYWdlc0lubmVyQ29udGFpbmVyKHNjcm9sbGFibGUpIHtcblx0Ly8gSW5zdGFncmFtIHdyYXBzIG1lc3NhZ2VzIGluIHNldmVyYWwgbmVzdGVkIGRpdnMuXG5cdC8vIFN0cmF0ZWd5OiBmaW5kIHRoZSBkZWVwZXN0IGRlc2NlbmRhbnQgKHdpdGhpbiAzIGxldmVscykgdGhhdCBoYXMgdGhlIG1vc3QgY2hpbGRyZW4sXG5cdC8vIHNpbmNlIHRoZSBhY3R1YWwgbWVzc2FnZXMgY29udGFpbmVyIGhhcyBtYW55IGRpcmVjdCBjaGlsZHJlbiAob25lIHBlciBtZXNzYWdlIHJvdykuXG5cdGxldCBiZXN0ID0gc2Nyb2xsYWJsZVxuXHRsZXQgYmVzdENvdW50ID0gc2Nyb2xsYWJsZS5jaGlsZHJlbi5sZW5ndGhcblxuXHRmdW5jdGlvbiBzZWFyY2goZWwsIGRlcHRoKSB7XG5cdFx0aWYgKGRlcHRoID4gMykgcmV0dXJuXG5cdFx0Zm9yIChjb25zdCBjaGlsZCBvZiBlbC5jaGlsZHJlbikge1xuXHRcdFx0aWYgKGNoaWxkLmNoaWxkcmVuLmxlbmd0aCA+IGJlc3RDb3VudCkge1xuXHRcdFx0XHRiZXN0ID0gY2hpbGRcblx0XHRcdFx0YmVzdENvdW50ID0gY2hpbGQuY2hpbGRyZW4ubGVuZ3RoXG5cdFx0XHR9XG5cdFx0XHRzZWFyY2goY2hpbGQsIGRlcHRoICsgMSlcblx0XHR9XG5cdH1cblxuXHRzZWFyY2goc2Nyb2xsYWJsZSwgMClcblx0cmV0dXJuIGJlc3Rcbn1cblxuLyoqXG4gKiBEZXRlcm1pbmVzIHdoZXRoZXIgYSBtZXNzYWdlIGVsZW1lbnQgd2FzIHNlbnQgYnkgdGhlIGN1cnJlbnQgdXNlci5cbiAqIEluc3RhZ3JhbSBhbGlnbnMgc2VudCBtZXNzYWdlcyB0byB0aGUgcmlnaHQgdXNpbmcgZmxleGJveCAoanVzdGlmeS1jb250ZW50OiBmbGV4LWVuZCkuXG4gKlxuICogQHBhcmFtIHtFbGVtZW50fSBlbGVtZW50XG4gKiBAcGFyYW0ge1dpbmRvd30gd2luZG93XG4gKiBAcmV0dXJucyB7Ym9vbGVhbn1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzU2VudEJ5Q3VycmVudFVzZXIoZWxlbWVudCwgd2luZG93KSB7XG5cdC8vIEJGUyB0aHJvdWdoIGFsbCBkZXNjZW5kYW50cyB1cCB0byBkZXB0aCA4LlxuXHQvLyBJbnN0YWdyYW0gcGxhY2VzIGp1c3RpZnktY29udGVudDogZmxleC1lbmQgb24gYSBuZXN0ZWQgZGl2IChkZXB0aCB+NSlcblx0Ly8gdGhhdCBtYXkgYmUgb24gYW55IGNoaWxkIGJyYW5jaCwgbm90IGp1c3QgdGhlIGZpcnN0LWNoaWxkIHBhdGguXG5cdGNvbnN0IHF1ZXVlID0gW3sgZWw6IGVsZW1lbnQsIGRlcHRoOiAwIH1dXG5cdHdoaWxlIChxdWV1ZS5sZW5ndGggPiAwKSB7XG5cdFx0Y29uc3QgeyBlbCwgZGVwdGggfSA9IHF1ZXVlLnNoaWZ0KClcblx0XHRjb25zdCBzID0gd2luZG93LmdldENvbXB1dGVkU3R5bGUoZWwpXG5cdFx0aWYgKHMuanVzdGlmeUNvbnRlbnQgPT09IFwiZmxleC1lbmRcIikge1xuXHRcdFx0cmV0dXJuIHRydWVcblx0XHR9XG5cdFx0aWYgKGRlcHRoIDwgOCkge1xuXHRcdFx0Zm9yIChjb25zdCBjaGlsZCBvZiBlbC5jaGlsZHJlbikge1xuXHRcdFx0XHRxdWV1ZS5wdXNoKHsgZWw6IGNoaWxkLCBkZXB0aDogZGVwdGggKyAxIH0pXG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cdHJldHVybiBmYWxzZVxufVxuXG4vKipcbiAqIEdldHMgdGhlIGZpcnN0IHZpc2libGUgbWVzc2FnZSBzZW50IGJ5IHRoZSBjdXJyZW50IHVzZXIgdGhhdCBoYXNuJ3QgYmVlbiBwcm9jZXNzZWQgeWV0LlxuICpcbiAqIEBwYXJhbSB7RWxlbWVudH0gcm9vdCAtIFRoZSBzY3JvbGxhYmxlIG1lc3NhZ2VzIHdyYXBwZXJcbiAqIEBwYXJhbSB7QWJvcnRDb250cm9sbGVyfSBhYm9ydENvbnRyb2xsZXJcbiAqIEBwYXJhbSB7V2luZG93fSB3aW5kb3dcbiAqIEByZXR1cm5zIHtFbGVtZW50fHVuZGVmaW5lZH1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldEZpcnN0VmlzaWJsZU1lc3NhZ2Uocm9vdCwgYWJvcnRDb250cm9sbGVyLCB3aW5kb3cpIHtcblx0Y29uc3QgaW5uZXJDb250YWluZXIgPSBnZXRNZXNzYWdlc0lubmVyQ29udGFpbmVyKHJvb3QpXG5cdGlmICghaW5uZXJDb250YWluZXIpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwiZ2V0Rmlyc3RWaXNpYmxlTWVzc2FnZTogbm8gaW5uZXIgY29udGFpbmVyIGZvdW5kXCIpXG5cdFx0cmV0dXJuXG5cdH1cblxuXHRjb25zdCBlbGVtZW50cyA9IFsuLi5pbm5lckNvbnRhaW5lci5jaGlsZHJlbl1cblx0XHQuZmlsdGVyKGQgPT4ge1xuXHRcdFx0aWYgKGQuaGFzQXR0cmlidXRlKFwiZGF0YS1pZG11LWlnbm9yZVwiKSkgcmV0dXJuIGZhbHNlXG5cdFx0XHRpZiAoZC5oYXNBdHRyaWJ1dGUoXCJkYXRhLWlkbXUtdW5zZW50XCIpKSByZXR1cm4gZmFsc2Vcblx0XHRcdC8vIE11c3QgY29udGFpbiBtZXNzYWdlIGNvbnRlbnQgaW5kaWNhdG9yc1xuXHRcdFx0Y29uc3QgaGFzTWVzc2FnZUNvbnRlbnQgPSBkLnF1ZXJ5U2VsZWN0b3IoXCJbcm9sZT1ub25lXVwiKSB8fCBkLnF1ZXJ5U2VsZWN0b3IoXCJbcm9sZT1wcmVzZW50YXRpb25dXCIpXG5cdFx0XHRpZiAoIWhhc01lc3NhZ2VDb250ZW50KSByZXR1cm4gZmFsc2Vcblx0XHRcdHJldHVybiBpc1NlbnRCeUN1cnJlbnRVc2VyKGQsIHdpbmRvdylcblx0XHR9KVxuXG5cdGVsZW1lbnRzLnJldmVyc2UoKVxuXHRpZihlbGVtZW50cy5sZW5ndGggPj0gMSkge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJnZXRGaXJzdFZpc2libGVNZXNzYWdlXCIsIGVsZW1lbnRzLmxlbmd0aCwgXCJjYW5kaWRhdGUgZWxlbWVudHNcIilcblx0fSBlbHNlIHtcblx0XHRjb25zb2xlLmRlYnVnKFwiZ2V0Rmlyc3RWaXNpYmxlTWVzc2FnZTogbm8gY2FuZGlkYXRlIGVsZW1lbnRzIGZvdW5kXCIpXG5cdH1cblxuXHRmb3IgKGNvbnN0IGVsZW1lbnQgb2YgZWxlbWVudHMpIHtcblx0XHRpZiAoYWJvcnRDb250cm9sbGVyLnNpZ25hbC5hYm9ydGVkKSB7XG5cdFx0XHRjb25zb2xlLmRlYnVnKFwiYWJvcnRDb250cm9sbGVyIGludGVydXB0ZWQgdGhlIG1lc3NhZ2UgZmlsdGVyaW5nIHByb2Nlc3M6IHN0b3BwaW5nLi4uXCIpXG5cdFx0XHRicmVha1xuXHRcdH1cblx0XHRjb25zdCB2aXNpYmlsaXR5Q2hlY2sgPSBlbGVtZW50LmNoZWNrVmlzaWJpbGl0eSh7XG5cdFx0XHR2aXNpYmlsaXR5UHJvcGVydHk6IHRydWUsXG5cdFx0XHRjb250ZW50VmlzaWJpbGl0eUF1dG86IHRydWUsXG5cdFx0XHRvcGFjaXR5UHJvcGVydHk6IHRydWUsXG5cdFx0fSlcblx0XHRpZiAodmlzaWJpbGl0eUNoZWNrID09PSBmYWxzZSkge1xuXHRcdFx0Y29uc29sZS5kZWJ1ZyhcInZpc2liaWxpdHlDaGVja1wiLCB2aXNpYmlsaXR5Q2hlY2spXG5cdFx0XHRjb250aW51ZVxuXHRcdH1cblx0XHRjb25zdCByZWN0ID0gZWxlbWVudC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKVxuXHRcdC8vIENoZWNrIGlmIGVsZW1lbnQgaXMgYXQgbGVhc3QgcGFydGlhbGx5IGluIHZpZXdwb3J0LlxuXHRcdC8vIEZvciB0YWxsIGVsZW1lbnRzIChpbWFnZXMsIGxvbmcgdGV4dCksIHJlY3QueSBjYW4gYmUgbmVnYXRpdmVcblx0XHQvLyB3aGlsZSB0aGUgZWxlbWVudCBpcyBzdGlsbCB2aXNpYmxlLiBVc2UgYm90dG9tIGVkZ2UgaW5zdGVhZC5cblx0XHRpZiAocmVjdC55ICsgcmVjdC5oZWlnaHQgPCAwIHx8IHJlY3QuaGVpZ2h0ID09PSAwKSB7XG5cdFx0XHRjb25zb2xlLmRlYnVnKFwiaXNJblZpZXcgZmFpbGVkXCIsIHJlY3QueSwgcmVjdC5oZWlnaHQpXG5cdFx0XHRjb250aW51ZVxuXHRcdH1cblx0XHRlbGVtZW50LnNldEF0dHJpYnV0ZShcImRhdGEtaWRtdS1pZ25vcmVcIiwgXCJcIilcblx0XHRjb25zb2xlLmRlYnVnKFwiTWVzc2FnZSBpbiB2aWV3LCB0ZXN0aW5nIHdvcmtmbG93Li4uXCIsIGVsZW1lbnQpXG5cdFx0cmV0dXJuIGVsZW1lbnRcblx0fVxufVxuXG4vKipcbiAqIFNjcm9sbHMgdG8gdG9wIHRvIHRyaWdnZXIgbG9hZGluZyBvZiBvbGRlciBtZXNzYWdlcy5cbiAqIEhhbmRsZXMgYm90aCBub3JtYWwgYW5kIGNvbHVtbi1yZXZlcnNlIGxheW91dHMuXG4gKlxuICogSW4gY29sdW1uLXJldmVyc2UgKEluc3RhZ3JhbSdzIGN1cnJlbnQgbGF5b3V0KTpcbiAqICAgc2Nyb2xsVG9wPTAgaXMgdGhlIEJPVFRPTSAobmV3ZXN0IG1lc3NhZ2VzKVxuICogICBzY3JvbGxUb3A9LShzY3JvbGxIZWlnaHQtY2xpZW50SGVpZ2h0KSBpcyB0aGUgVE9QIChvbGRlc3QgbWVzc2FnZXMpXG4gKlxuICogQHBhcmFtIHtFbGVtZW50fSByb290XG4gKiBAcGFyYW0ge0Fib3J0Q29udHJvbGxlcn0gYWJvcnRDb250cm9sbGVyXG4gKiBAcmV0dXJucyB7UHJvbWlzZTxib29sZWFuPn1cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGxvYWRNb3JlTWVzc2FnZXMocm9vdCwgYWJvcnRDb250cm9sbGVyKSB7XG5cdGNvbnNvbGUuZGVidWcoXCJsb2FkTW9yZU1lc3NhZ2VzIGxvb2tpbmcgZm9yIGxvYWRlci4uLiBcIilcblx0Y29uc3Qgc2Nyb2xsQWJvcnRDb250cm9sbGVyID0gbmV3IEFib3J0Q29udHJvbGxlcigpXG5cdGxldCBmaW5kTG9hZGVyVGltZW91dFxuXHRsZXQgcmVzb2x2ZVRpbWVvdXRcblx0Y29uc3QgYWJvcnRIYW5kbGVyID0gKCkgPT4ge1xuXHRcdHNjcm9sbEFib3J0Q29udHJvbGxlci5hYm9ydChcImFib3J0SGFuZGxlciB3YXMgYWJvcnRlZFwiKVxuXHRcdGNsZWFyVGltZW91dChmaW5kTG9hZGVyVGltZW91dClcblx0XHRpZiAocmVzb2x2ZVRpbWVvdXQpIHtcblx0XHRcdHJlc29sdmVUaW1lb3V0KClcblx0XHR9XG5cdH1cblx0YWJvcnRDb250cm9sbGVyLnNpZ25hbC5hZGRFdmVudExpc3RlbmVyKFwiYWJvcnRcIiwgYWJvcnRIYW5kbGVyKVxuXG5cdC8vIERldGVjdCBjb2x1bW4tcmV2ZXJzZSBsYXlvdXRcblx0Y29uc3Qgc3R5bGUgPSByb290Lm93bmVyRG9jdW1lbnQuZGVmYXVsdFZpZXcuZ2V0Q29tcHV0ZWRTdHlsZShyb290KVxuXHRjb25zdCBpc1JldmVyc2VkID0gc3R5bGUuZmxleERpcmVjdGlvbiA9PT0gXCJjb2x1bW4tcmV2ZXJzZVwiXG5cdC8vIEluIGNvbHVtbi1yZXZlcnNlLCBcInNjcm9sbCB0byB0b3BcIiBtZWFucyBtb3N0IG5lZ2F0aXZlIHNjcm9sbFRvcFxuXHRjb25zdCBzY3JvbGxUb1RvcFZhbHVlID0gaXNSZXZlcnNlZFxuXHRcdD8gLShyb290LnNjcm9sbEhlaWdodCAtIHJvb3QuY2xpZW50SGVpZ2h0KVxuXHRcdDogMFxuXHQvLyBJbiBjb2x1bW4tcmV2ZXJzZSwgXCJhdCB0b3BcIiBtZWFucyBzY3JvbGxUb3AgaXMgYXQgb3IgbmVhciBtaW5pbXVtXG5cdGNvbnN0IGlzQXRUb3AgPSAoKSA9PiBpc1JldmVyc2VkXG5cdFx0PyByb290LnNjcm9sbFRvcCA8PSBzY3JvbGxUb1RvcFZhbHVlICsgNVxuXHRcdDogcm9vdC5zY3JvbGxUb3AgPT09IDBcblxuXHRjb25zdCBiZWZvcmVTY3JvbGwgPSByb290LnNjcm9sbFRvcFxuXHRjb25zdCBiZWZvcmVIZWlnaHQgPSByb290LnNjcm9sbEhlaWdodFxuXHRyb290LnNjcm9sbFRvcCA9IHNjcm9sbFRvVG9wVmFsdWVcblxuXHQvLyBIZWxwZXI6IGZpbmQgYSB2aXNpYmxlIGxvYWRlciB3aXRoaW4gdGhlIHNjcm9sbGFibGUgcm9vdCdzIHZpZXdwb3J0XG5cdGNvbnN0IGZpbmRWaXNpYmxlTG9hZGVyID0gKCkgPT4ge1xuXHRcdGNvbnN0IGJhcnMgPSByb290LnF1ZXJ5U2VsZWN0b3JBbGwoXCJbcm9sZT1wcm9ncmVzc2Jhcl1cIilcblx0XHRmb3IgKGNvbnN0IGJhciBvZiBiYXJzKSB7XG5cdFx0XHRjb25zdCByZWN0ID0gYmFyLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpXG5cdFx0XHRjb25zdCByb290UmVjdCA9IHJvb3QuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KClcblx0XHRcdC8vIE11c3QgYmUgd2l0aGluIHJvb3QncyBob3Jpem9udGFsK3ZlcnRpY2FsIGJvdW5kcyBhbmQgaGF2ZSBkaW1lbnNpb25zXG5cdFx0XHRpZiAocmVjdC5oZWlnaHQgPiAwICYmIHJlY3QueSA+PSByb290UmVjdC55IC0gMTAwICYmIHJlY3QueSA8PSByb290UmVjdC55ICsgcm9vdFJlY3QuaGVpZ2h0ICsgMTAwKSB7XG5cdFx0XHRcdHJldHVybiBiYXJcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIG51bGxcblx0fVxuXG5cdC8vIFNob3J0IGNoYXQ6IGV2ZXJ5dGhpbmcgZml0cyBpbiB2aWV3cG9ydCwgbm90aGluZyB0byBsb2FkXG5cdGNvbnN0IG5vU2Nyb2xsTmVlZGVkID0gaXNSZXZlcnNlZFxuXHRcdD8gYmVmb3JlU2Nyb2xsID09PSAwICYmIHJvb3Quc2Nyb2xsSGVpZ2h0IDw9IHJvb3QuY2xpZW50SGVpZ2h0ICsgNTBcblx0XHQ6IGJlZm9yZVNjcm9sbCA9PT0gMCAmJiByb290LnNjcm9sbEhlaWdodCA8PSByb290LmNsaWVudEhlaWdodCArIDUwXG5cdGlmIChub1Njcm9sbE5lZWRlZCkge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJsb2FkTW9yZU1lc3NhZ2VzOiBjaGF0IGZpdHMgaW4gdmlld3BvcnQsIG1hcmtpbmcgYXMgZG9uZVwiKVxuXHRcdGFib3J0Q29udHJvbGxlci5zaWduYWwucmVtb3ZlRXZlbnRMaXN0ZW5lcihcImFib3J0XCIsIGFib3J0SGFuZGxlcilcblx0XHRyZXR1cm4gdHJ1ZVxuXHR9XG5cblx0Ly8gQWxyZWFkeSBhdCB0b3AgYWZ0ZXIgc2Nyb2xsaW5nOiB3YWl0IGJyaWVmbHkgZm9yIG5ldyBjb250ZW50LCB0aGVuIGNoZWNrXG5cdGlmIChpc0F0VG9wKCkpIHtcblx0XHQvLyBHaXZlIEluc3RhZ3JhbSBhIG1vbWVudCB0byBzdGFydCBsb2FkaW5nIG9sZGVyIG1lc3NhZ2VzXG5cdFx0YXdhaXQgbmV3IFByb21pc2UocmVzb2x2ZSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIDUwMCkpXG5cblx0XHQvLyBDaGVjayBpZiBhIHZpc2libGUgbG9hZGVyIGFwcGVhcmVkXG5cdFx0Y29uc3QgbG9hZGVyID0gZmluZFZpc2libGVMb2FkZXIoKVxuXHRcdGlmIChsb2FkZXIpIHtcblx0XHRcdGNvbnNvbGUuZGVidWcoXCJsb2FkTW9yZU1lc3NhZ2VzOiBGb3VuZCB2aXNpYmxlIGxvYWRlciBhZnRlciBzY3JvbGw7IHdhaXRpbmcgZm9yIHJlbW92YWwgKG1heCA1cylcIilcblx0XHRcdGF3YWl0IFByb21pc2UucmFjZShbXG5cdFx0XHRcdHdhaXRGb3JFbGVtZW50KHJvb3QsICgpID0+IGZpbmRWaXNpYmxlTG9hZGVyKCkgPT09IG51bGwsIGFib3J0Q29udHJvbGxlciksXG5cdFx0XHRcdG5ldyBQcm9taXNlKHJlc29sdmUgPT4gc2V0VGltZW91dChyZXNvbHZlLCA1MDAwKSlcblx0XHRcdF0pXG5cdFx0XHRhYm9ydENvbnRyb2xsZXIuc2lnbmFsLnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJhYm9ydFwiLCBhYm9ydEhhbmRsZXIpXG5cdFx0XHRjb25zdCBncmV3ID0gcm9vdC5zY3JvbGxIZWlnaHQgPiBiZWZvcmVIZWlnaHRcblx0XHRcdGNvbnNvbGUuZGVidWcoYGxvYWRNb3JlTWVzc2FnZXM6IGxvYWRlciBwaGFzZSBkb25lLCBjb250ZW50ICR7Z3JldyA/IFwiZ3Jld1wiIDogXCJkaWQgbm90IGdyb3dcIn1gKVxuXHRcdFx0cmV0dXJuICFncmV3XG5cdFx0fVxuXG5cdFx0Ly8gTm8gbG9hZGVyIGFwcGVhcmVkIOKAlCBjaGVjayBpZiBzY3JvbGxIZWlnaHQgZ3JldyAobmV3IGNvbnRlbnQgbG9hZGVkIHdpdGhvdXQgc3Bpbm5lcilcblx0XHRjb25zdCBncmV3ID0gcm9vdC5zY3JvbGxIZWlnaHQgPiBiZWZvcmVIZWlnaHRcblx0XHRpZiAoIWdyZXcpIHtcblx0XHRcdGNvbnNvbGUuZGVidWcoXCJsb2FkTW9yZU1lc3NhZ2VzOiBhdCB0b3AsIG5vIGxvYWRlciwgbm8gbmV3IGNvbnRlbnQg4oCUIHJlYWNoZWQgbGFzdCBwYWdlXCIpXG5cdFx0XHRhYm9ydENvbnRyb2xsZXIuc2lnbmFsLnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJhYm9ydFwiLCBhYm9ydEhhbmRsZXIpXG5cdFx0XHRyZXR1cm4gdHJ1ZVxuXHRcdH1cblx0fVxuXG5cdC8vIEZhbGxiYWNrOiB3YWl0IGZvciBwcm9ncmVzc2JhciB0byBhcHBlYXIgKHdpdGggc2hvcnRlciB0aW1lb3V0KVxuXHRsZXQgbG9hZGluZ0VsZW1lbnRcblx0dHJ5IHtcblx0XHRsb2FkaW5nRWxlbWVudCA9IGF3YWl0IFByb21pc2UucmFjZShbXG5cdFx0XHR3YWl0Rm9yRWxlbWVudChyb290LCAoKSA9PiB7XG5cdFx0XHRcdGlmIChmaW5kVmlzaWJsZUxvYWRlcigpID09PSBudWxsKSB7XG5cdFx0XHRcdFx0cm9vdC5zY3JvbGxUb3AgPSBzY3JvbGxUb1RvcFZhbHVlXG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIGZpbmRWaXNpYmxlTG9hZGVyKClcblx0XHRcdH0sIHNjcm9sbEFib3J0Q29udHJvbGxlciksXG5cdFx0XHRuZXcgUHJvbWlzZShyZXNvbHZlID0+IHtcblx0XHRcdFx0cmVzb2x2ZVRpbWVvdXQgPSByZXNvbHZlXG5cdFx0XHRcdGZpbmRMb2FkZXJUaW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiB7XG5cdFx0XHRcdFx0cmVzb2x2ZSgpXG5cdFx0XHRcdH0sIDMwMDApXG5cdFx0XHR9KVxuXHRcdF0pXG5cdH0gY2F0Y2ggKGV4KSB7XG5cdFx0Y29uc29sZS5lcnJvcihleClcblx0fVxuXHRzY3JvbGxBYm9ydENvbnRyb2xsZXIuYWJvcnQoXCJTY3JvbGxpbmcgdG9vayB0b28gbXVjaCB0aW1lLiBUaW1lb3V0IGFmdGVyIDEwc1wiKVxuXHRhYm9ydENvbnRyb2xsZXIuc2lnbmFsLnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJhYm9ydFwiLCBhYm9ydEhhbmRsZXIpXG5cdGNsZWFyVGltZW91dChmaW5kTG9hZGVyVGltZW91dClcblx0aWYgKGxvYWRpbmdFbGVtZW50ICYmIGxvYWRpbmdFbGVtZW50ICE9PSB0cnVlKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcImxvYWRNb3JlTWVzc2FnZXM6IEZvdW5kIGxvYWRlcjsgU3RhbmQtYnkgdW50aWwgaXQgaXMgcmVtb3ZlZCAobWF4IDVzKVwiKVxuXHRcdGF3YWl0IFByb21pc2UucmFjZShbXG5cdFx0XHR3YWl0Rm9yRWxlbWVudChyb290LCAoKSA9PiBmaW5kVmlzaWJsZUxvYWRlcigpID09PSBudWxsLCBhYm9ydENvbnRyb2xsZXIpLFxuXHRcdFx0bmV3IFByb21pc2UocmVzb2x2ZSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIDUwMDApKVxuXHRcdF0pXG5cdH1cblx0Y29uc3QgYXRUb3AgPSBpc0F0VG9wKClcblx0Y29uc29sZS5kZWJ1ZyhgbG9hZE1vcmVNZXNzYWdlczogc2Nyb2xsVG9wIGlzICR7cm9vdC5zY3JvbGxUb3B9IOKAlCAke2F0VG9wID8gXCJyZWFjaGVkIGxhc3QgcGFnZVwiIDogXCJub3QgbGFzdCBwYWdlXCJ9YClcblx0cmV0dXJuIGF0VG9wXG59XG4iLCIvKiogQG1vZHVsZSB1aS1tZXNzYWdlcy13cmFwcGVyIFVJIGVsZW1lbnQgcmVwcmVzZW50aW5nIHRoZSBtZXNzYWdlcyB3cmFwcGVyICovXG5cbmltcG9ydCB7IGxvYWRNb3JlTWVzc2FnZXMgfSBmcm9tIFwiLi9kb20tbG9va3VwLmpzXCJcbmltcG9ydCBVSUNvbXBvbmVudCBmcm9tIFwiLi4vdWktY29tcG9uZW50LmpzXCJcblxuY2xhc3MgVUlNZXNzYWdlc1dyYXBwZXIgZXh0ZW5kcyBVSUNvbXBvbmVudCB7XG5cblx0LyoqXG5cdCAqIEBwYXJhbSB7QWJvcnRDb250cm9sbGVyfSBhYm9ydENvbnRyb2xsZXJcblx0ICogQHJldHVybnMge1Byb21pc2V9XG5cdCAqL1xuXHRmZXRjaEFuZFJlbmRlclRocmVhZE5leHRNZXNzYWdlUGFnZShhYm9ydENvbnRyb2xsZXIpIHtcblx0XHRyZXR1cm4gbG9hZE1vcmVNZXNzYWdlcyh0aGlzLnJvb3QsIGFib3J0Q29udHJvbGxlcilcblx0fVxuXG59XG5cbmV4cG9ydCBkZWZhdWx0IFVJTWVzc2FnZXNXcmFwcGVyXG4iLCIvKiogQG1vZHVsZSBkZWZhdWx0LXVpIERlZmF1bHQgVUkgLyBFbmdsaXNoIFVJICovXG5cbmltcG9ydCBVSSBmcm9tIFwiLi4vdWkuanNcIlxuaW1wb3J0IHsgZmluZE1lc3NhZ2VzV3JhcHBlciwgZ2V0Rmlyc3RWaXNpYmxlTWVzc2FnZSB9IGZyb20gXCIuL2RvbS1sb29rdXAuanNcIlxuaW1wb3J0IFVJUElNZXNzYWdlIGZyb20gXCIuLi8uLi91aXBpL3VpcGktbWVzc2FnZS5qc1wiXG5pbXBvcnQgVUlNZXNzYWdlIGZyb20gXCIuL3VpLW1lc3NhZ2UuanNcIlxuaW1wb3J0IFVJTWVzc2FnZXNXcmFwcGVyIGZyb20gXCIuL3VpLW1lc3NhZ2VzLXdyYXBwZXIuanNcIlxuXG5jbGFzcyBEZWZhdWx0VUkgZXh0ZW5kcyBVSSB7XG5cblx0Y29uc3RydWN0b3Iocm9vdCwgaWRlbnRpZmllciA9IHt9KSB7XG5cdFx0c3VwZXIocm9vdCwgaWRlbnRpZmllcilcblx0XHR0aGlzLmxhc3RTY3JvbGxUb3AgPSBudWxsXG5cdH1cblxuXHQvKipcblx0ICogQHBhcmFtIHtXaW5kb3d9IHdpbmRvd1xuXHQgKiBAcmV0dXJucyB7RGVmYXVsdFVJfVxuXHQgKi9cblx0c3RhdGljIGNyZWF0ZSh3aW5kb3cpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwiVUkgY3JlYXRlOiBMb29raW5nIGZvciBtZXNzYWdlc1dyYXBwZXJFbGVtZW50XCIpXG5cdFx0Y29uc3QgbWVzc2FnZXNXcmFwcGVyRWxlbWVudCA9IGZpbmRNZXNzYWdlc1dyYXBwZXIod2luZG93KVxuXHRcdGlmIChtZXNzYWdlc1dyYXBwZXJFbGVtZW50ICE9PSBudWxsKSB7XG5cdFx0XHRjb25zb2xlLmRlYnVnKFwiRm91bmQgbWVzc2FnZXNXcmFwcGVyRWxlbWVudFwiLCBtZXNzYWdlc1dyYXBwZXJFbGVtZW50KVxuXHRcdFx0Y29uc3QgdWlNZXNzYWdlc1dyYXBwZXIgPSBuZXcgVUlNZXNzYWdlc1dyYXBwZXIobWVzc2FnZXNXcmFwcGVyRWxlbWVudClcblx0XHRcdHJldHVybiBuZXcgRGVmYXVsdFVJKHdpbmRvdywgeyB1aU1lc3NhZ2VzV3JhcHBlciB9KVxuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCJVbmFibGUgdG8gZmluZCBtZXNzYWdlc1dyYXBwZXJFbGVtZW50LiBUaGUgcXVlcnkgc2VsZWN0b3IgbWlnaHQgYmUgb3V0IG9mIGRhdGUuXCIpXG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIEBwYXJhbSB7QWJvcnRDb250cm9sbGVyfSBhYm9ydENvbnRyb2xsZXJcblx0ICogQHJldHVybnMge1Byb21pc2V9XG5cdCAqL1xuXHRhc3luYyBmZXRjaEFuZFJlbmRlclRocmVhZE5leHRNZXNzYWdlUGFnZShhYm9ydENvbnRyb2xsZXIpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwiVUkgZmV0Y2hBbmRSZW5kZXJUaHJlYWROZXh0TWVzc2FnZVBhZ2VcIilcblx0XHRyZXR1cm4gYXdhaXQgdGhpcy5pZGVudGlmaWVyLnVpTWVzc2FnZXNXcmFwcGVyLmZldGNoQW5kUmVuZGVyVGhyZWFkTmV4dE1lc3NhZ2VQYWdlKGFib3J0Q29udHJvbGxlcilcblx0fVxuXG5cdC8qKlxuXHQgKiBTY3JvbGwgdW50aWwgYSAodmlzaWJsZSkgbWVzc2FnZSBpcyBmb3VuZCBhbmQgcmV0dXJuIGl0LlxuXHQgKlxuXHQgKiBJbnN0YWdyYW0gdXNlcyBmbGV4LWRpcmVjdGlvbjogY29sdW1uLXJldmVyc2Ugb24gdGhlIG1lc3NhZ2VzIGNvbnRhaW5lci5cblx0ICogVGhpcyBtZWFucyBzY3JvbGxUb3A9MCBpcyB0aGUgQk9UVE9NIChuZXdlc3QgbWVzc2FnZXMpIGFuZCBzY3JvbGxpbmcgdG9cblx0ICogb2xkZXIgbWVzc2FnZXMgcmVxdWlyZXMgTkVHQVRJVkUgc2Nyb2xsVG9wIHZhbHVlcy5cblx0ICogSW4gbm9ybWFsIChub24tcmV2ZXJzZWQpIGxheW91dHMsIHNjcm9sbFRvcD0wIGlzIHRoZSB0b3AgYW5kIHRoZSBtYXggaXMgcG9zaXRpdmUuXG5cdCAqXG5cdCAqIFRoaXMgbWV0aG9kIGRldGVjdHMgdGhlIGxheW91dCBkaXJlY3Rpb24gYW5kIHNjcm9sbHMgYWNjb3JkaW5nbHkuXG5cdCAqXG5cdCAqIEBwYXJhbSB7QWJvcnRDb250cm9sbGVyfSBhYm9ydENvbnRyb2xsZXJcblx0ICogQHJldHVybnMge1Byb21pc2U8VUlQSU1lc3NhZ2V8ZmFsc2U+fVxuXHQgKi9cblx0YXN5bmMgZ2V0TmV4dFVJUElNZXNzYWdlKGFib3J0Q29udHJvbGxlcikge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJVSSBnZXROZXh0VUlQSU1lc3NhZ2VcIiwgdGhpcy5sYXN0U2Nyb2xsVG9wKVxuXHRcdGNvbnN0IHVpTWVzc2FnZXNXcmFwcGVyUm9vdCA9IHRoaXMuaWRlbnRpZmllci51aU1lc3NhZ2VzV3JhcHBlci5yb290XG5cblx0XHQvLyBEZXRlY3QgY29sdW1uLXJldmVyc2U6IHNjcm9sbFRvcCBjYW4gZ28gbmVnYXRpdmVcblx0XHRjb25zdCBzdHlsZSA9IHRoaXMucm9vdC5nZXRDb21wdXRlZFN0eWxlXG5cdFx0XHQ/IHRoaXMucm9vdC5nZXRDb21wdXRlZFN0eWxlKHVpTWVzc2FnZXNXcmFwcGVyUm9vdClcblx0XHRcdDogdWlNZXNzYWdlc1dyYXBwZXJSb290Lm93bmVyRG9jdW1lbnQuZGVmYXVsdFZpZXcuZ2V0Q29tcHV0ZWRTdHlsZSh1aU1lc3NhZ2VzV3JhcHBlclJvb3QpXG5cdFx0Y29uc3QgaXNSZXZlcnNlZCA9IHN0eWxlLmZsZXhEaXJlY3Rpb24gPT09IFwiY29sdW1uLXJldmVyc2VcIlxuXG5cdFx0Ly8gUHJlLWNoZWNrOiB0cnkgZmluZGluZyBhIG1lc3NhZ2UgYXQgdGhlIGN1cnJlbnQgc2Nyb2xsIHBvc2l0aW9uIHdpdGhvdXQgc2Nyb2xsaW5nLlxuXHRcdC8vIFRoaXMgY2F0Y2hlcyBtZXNzYWdlcyBhbHJlYWR5IHZpc2libGUgaW4gdmlld3BvcnQgKGNvbW1vbiBmb3Igc2hvcnQgY29udmVyc2F0aW9uc1xuXHRcdC8vIGFuZCBhZnRlciB1bnNlbmRpbmcgd2hlbiB0aGUgRE9NIHNocmlua3MpLlxuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBtZXNzYWdlRWxlbWVudCA9IGdldEZpcnN0VmlzaWJsZU1lc3NhZ2UodWlNZXNzYWdlc1dyYXBwZXJSb290LCBhYm9ydENvbnRyb2xsZXIsIHRoaXMucm9vdClcblx0XHRcdGlmIChtZXNzYWdlRWxlbWVudCkge1xuXHRcdFx0XHRjb25zb2xlLmRlYnVnKFwiZ2V0TmV4dFVJUElNZXNzYWdlOiBmb3VuZCBtZXNzYWdlIHdpdGhvdXQgc2Nyb2xsaW5nXCIpXG5cdFx0XHRcdGNvbnN0IHVpTWVzc2FnZSA9IG5ldyBVSU1lc3NhZ2UobWVzc2FnZUVsZW1lbnQpXG5cdFx0XHRcdHJldHVybiBuZXcgVUlQSU1lc3NhZ2UodWlNZXNzYWdlKVxuXHRcdFx0fVxuXHRcdH0gY2F0Y2ggKGV4KSB7XG5cdFx0XHRjb25zb2xlLmVycm9yKGV4KVxuXHRcdH1cblxuXHRcdC8vIEFsbG93IHVwIHRvIDMgZnVsbCBwYXNzZXM7IGNvdmVycyBjYXNlcyB3aGVyZSBET00gc2hyaW5rcyBhZnRlciB1bnNlbmRzXG5cdFx0Zm9yIChsZXQgcGFzcyA9IDA7IHBhc3MgPCAzOyBwYXNzKyspIHtcblx0XHRcdGlmIChhYm9ydENvbnRyb2xsZXIuc2lnbmFsLmFib3J0ZWQpIHtcblx0XHRcdFx0Y29uc29sZS5kZWJ1ZyhcImFib3J0Q29udHJvbGxlciBpbnRlcnVwdGVkIHRoZSBzY3JvbGxpbmc6IHN0b3BwaW5nLi4uXCIpXG5cdFx0XHRcdHJldHVybiBmYWxzZVxuXHRcdFx0fVxuXG5cdFx0XHRpZiAoaXNSZXZlcnNlZCkge1xuXHRcdFx0XHQvLyBjb2x1bW4tcmV2ZXJzZTogc2Nyb2xsVG9wIHJhbmdlcyBmcm9tIDAgKGJvdHRvbS9uZXdlc3QpIHRvIG5lZ2F0aXZlICh0b3Avb2xkZXN0KVxuXHRcdFx0XHRjb25zdCBtaW5TY3JvbGwgPSAtKHVpTWVzc2FnZXNXcmFwcGVyUm9vdC5zY3JvbGxIZWlnaHQgLSB1aU1lc3NhZ2VzV3JhcHBlclJvb3QuY2xpZW50SGVpZ2h0KVxuXHRcdFx0XHRjb25zdCBzdGFydFBvcyA9IChwYXNzID09PSAwICYmIHRoaXMubGFzdFNjcm9sbFRvcCAhPT0gbnVsbClcblx0XHRcdFx0XHQ/IE1hdGgubWF4KHRoaXMubGFzdFNjcm9sbFRvcCwgbWluU2Nyb2xsKVxuXHRcdFx0XHRcdDogMCAvLyBTdGFydCBmcm9tIGJvdHRvbSAobmV3ZXN0KVxuXG5cdFx0XHRcdC8vIFVzZSBzbWFsbGVyIGluY3JlbWVudHMgZm9yIHNob3J0IGNvbnZlcnNhdGlvbnMgdG8gYXZvaWQgb3ZlcnNob290aW5nXG5cdFx0XHRcdGNvbnN0IHRvdGFsUmFuZ2UgPSBNYXRoLmFicyhtaW5TY3JvbGwpXG5cdFx0XHRcdGNvbnN0IHN0ZXAgPSB0b3RhbFJhbmdlIDwgNTAwID8gMzAgOiAxNTBcblxuXHRcdFx0XHRjb25zb2xlLmRlYnVnKGBnZXROZXh0VUlQSU1lc3NhZ2UgW3JldmVyc2VkXSBwYXNzPSR7cGFzc30sIHN0YXJ0UG9zPSR7c3RhcnRQb3N9LCBtaW5TY3JvbGw9JHttaW5TY3JvbGx9LCBzdGVwPSR7c3RlcH1gKVxuXG5cdFx0XHRcdGZvciAobGV0IGkgPSBzdGFydFBvczsgaSA+PSBtaW5TY3JvbGw7IGkgPSBpIC0gc3RlcCkge1xuXHRcdFx0XHRcdGlmIChhYm9ydENvbnRyb2xsZXIuc2lnbmFsLmFib3J0ZWQpIHtcblx0XHRcdFx0XHRcdGNvbnNvbGUuZGVidWcoXCJhYm9ydENvbnRyb2xsZXIgaW50ZXJ1cHRlZCB0aGUgc2Nyb2xsaW5nOiBzdG9wcGluZy4uLlwiKVxuXHRcdFx0XHRcdFx0cmV0dXJuIGZhbHNlXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHRoaXMubGFzdFNjcm9sbFRvcCA9IGlcblx0XHRcdFx0XHR1aU1lc3NhZ2VzV3JhcHBlclJvb3Quc2Nyb2xsVG9wID0gaVxuXHRcdFx0XHRcdHVpTWVzc2FnZXNXcmFwcGVyUm9vdC5kaXNwYXRjaEV2ZW50KG5ldyB0aGlzLnJvb3QuRXZlbnQoXCJzY3JvbGxcIikpXG5cdFx0XHRcdFx0YXdhaXQgbmV3IFByb21pc2UocmVzb2x2ZSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIDUpKVxuXHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHRjb25zdCBtZXNzYWdlRWxlbWVudCA9IGdldEZpcnN0VmlzaWJsZU1lc3NhZ2UodWlNZXNzYWdlc1dyYXBwZXJSb290LCBhYm9ydENvbnRyb2xsZXIsIHRoaXMucm9vdClcblx0XHRcdFx0XHRcdGlmIChtZXNzYWdlRWxlbWVudCkge1xuXHRcdFx0XHRcdFx0XHRjb25zdCB1aU1lc3NhZ2UgPSBuZXcgVUlNZXNzYWdlKG1lc3NhZ2VFbGVtZW50KVxuXHRcdFx0XHRcdFx0XHRyZXR1cm4gbmV3IFVJUElNZXNzYWdlKHVpTWVzc2FnZSlcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9IGNhdGNoIChleCkge1xuXHRcdFx0XHRcdFx0Y29uc29sZS5lcnJvcihleClcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdC8vIE5vcm1hbCBsYXlvdXQ6IHNjcm9sbFRvcCByYW5nZXMgZnJvbSAwICh0b3ApIHRvIHBvc2l0aXZlIG1heCAoYm90dG9tKVxuXHRcdFx0XHRjb25zdCBtYXhTY3JvbGwgPSB1aU1lc3NhZ2VzV3JhcHBlclJvb3Quc2Nyb2xsSGVpZ2h0IC0gdWlNZXNzYWdlc1dyYXBwZXJSb290LmNsaWVudEhlaWdodFxuXHRcdFx0XHRjb25zdCBzdGFydFNjcm9sbFRvcCA9IChwYXNzID09PSAwICYmIHRoaXMubGFzdFNjcm9sbFRvcCAhPT0gbnVsbClcblx0XHRcdFx0XHQ/IE1hdGgubWluKHRoaXMubGFzdFNjcm9sbFRvcCwgbWF4U2Nyb2xsKVxuXHRcdFx0XHRcdDogbWF4U2Nyb2xsXG5cblx0XHRcdFx0Ly8gVXNlIHNtYWxsZXIgaW5jcmVtZW50cyBmb3Igc2hvcnQgY29udmVyc2F0aW9uc1xuXHRcdFx0XHRjb25zdCBzdGVwID0gbWF4U2Nyb2xsIDwgNTAwID8gMzAgOiAxNTBcblxuXHRcdFx0XHRjb25zb2xlLmRlYnVnKGBnZXROZXh0VUlQSU1lc3NhZ2UgcGFzcz0ke3Bhc3N9LCBzdGFydFNjcm9sbFRvcD0ke3N0YXJ0U2Nyb2xsVG9wfSwgbWF4U2Nyb2xsPSR7bWF4U2Nyb2xsfSwgc3RlcD0ke3N0ZXB9YClcblxuXHRcdFx0XHRmb3IgKGxldCBpID0gTWF0aC5tYXgoMSwgc3RhcnRTY3JvbGxUb3ApOyBpID4gMDsgaSA9IGkgLSBzdGVwKSB7XG5cdFx0XHRcdFx0aWYgKGFib3J0Q29udHJvbGxlci5zaWduYWwuYWJvcnRlZCkge1xuXHRcdFx0XHRcdFx0Y29uc29sZS5kZWJ1ZyhcImFib3J0Q29udHJvbGxlciBpbnRlcnVwdGVkIHRoZSBzY3JvbGxpbmc6IHN0b3BwaW5nLi4uXCIpXG5cdFx0XHRcdFx0XHRyZXR1cm4gZmFsc2Vcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0dGhpcy5sYXN0U2Nyb2xsVG9wID0gaVxuXHRcdFx0XHRcdHVpTWVzc2FnZXNXcmFwcGVyUm9vdC5zY3JvbGxUb3AgPSBpXG5cdFx0XHRcdFx0dWlNZXNzYWdlc1dyYXBwZXJSb290LmRpc3BhdGNoRXZlbnQobmV3IHRoaXMucm9vdC5FdmVudChcInNjcm9sbFwiKSlcblx0XHRcdFx0XHRhd2FpdCBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgNSkpXG5cdFx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRcdGNvbnN0IG1lc3NhZ2VFbGVtZW50ID0gZ2V0Rmlyc3RWaXNpYmxlTWVzc2FnZSh1aU1lc3NhZ2VzV3JhcHBlclJvb3QsIGFib3J0Q29udHJvbGxlciwgdGhpcy5yb290KVxuXHRcdFx0XHRcdFx0aWYgKG1lc3NhZ2VFbGVtZW50KSB7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IHVpTWVzc2FnZSA9IG5ldyBVSU1lc3NhZ2UobWVzc2FnZUVsZW1lbnQpXG5cdFx0XHRcdFx0XHRcdHJldHVybiBuZXcgVUlQSU1lc3NhZ2UodWlNZXNzYWdlKVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0gY2F0Y2ggKGV4KSB7XG5cdFx0XHRcdFx0XHRjb25zb2xlLmVycm9yKGV4KVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHQvLyBSZWFjaGVkIHRoZSBlbmQgd2l0aG91dCBmaW5kaW5nIGEgbWVzc2FnZS5cblx0XHRcdC8vIFJlc2V0IGZvciBhIGZyZXNoIHBhc3MgKERPTSBtYXkgaGF2ZSBzaHJ1bmsgYWZ0ZXIgdW5zZW5kcykuXG5cdFx0XHR0aGlzLmxhc3RTY3JvbGxUb3AgPSBudWxsXG5cdFx0XHRjb25zb2xlLmRlYnVnKGBnZXROZXh0VUlQSU1lc3NhZ2U6IHBhc3MgJHtwYXNzfSBmb3VuZCBub3RoaW5nLCByZXRyeWluZ2ApXG5cdFx0fVxuXG5cdFx0Y29uc29sZS5kZWJ1ZyhcImdldE5leHRVSVBJTWVzc2FnZTogZXhoYXVzdGVkIGFsbCBwYXNzZXMsIG5vIG1lc3NhZ2VzIGxlZnRcIilcblx0XHRyZXR1cm4gZmFsc2Vcblx0fVxuXG59XG5cbmV4cG9ydCBkZWZhdWx0IERlZmF1bHRVSVxuIiwiLyoqIEBtb2R1bGUgZ2V0LXVpIFVJIGxvYWRlciBtb2R1bGUuIEFsbG93IGxvYWRpbmcgb2YgYSBjZXJ0YWluIFVJIGJhc2VkIG9uIGEgZ2l2ZW4gc3RyYXRlZ3kgKGxvY2FsZSBldGMuLilcbiAqIFRoZXJlIG1pZ2h0IGJlIG5lZWQgZm9yIG11bHRpcGxlIFVJIGFzIEluc3RhZ3JhbSBtaWdodCBzZXJ2ZSBkaWZmZXJlbnQgYXBwcyBiYXNlZCBvbiBsb2NhdGlvbiBmb3IgZXhhbXBsZS5cbiAqIFRoZXJlIGlzIGFsc28gYSBuZWVkIHRvIGludGVybmF0aW9uYWxpemUgZWFjaCB1aSBzbyB0aGF0IGl0IGRvZXNuJ3QgZmFpbCBpZiB3ZSBjaGFuZ2UgdGhlIGxhbmd1YWdlLlxuICovXG5cbmltcG9ydCBEZWZhdWx0VUkgZnJvbSBcIi4vZGVmYXVsdC9kZWZhdWx0LXVpLmpzXCJcbi8qIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby11bnVzZWQtdmFycyAqL1xuaW1wb3J0IFVJIGZyb20gXCIuL3VpLmpzXCJcblxuLyoqXG4gKlxuICogQHJldHVybnMge1VJfVxuICovXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBnZXRVSSgpIHtcblx0cmV0dXJuIERlZmF1bHRVSVxufVxuIiwiLyoqIEBtb2R1bGUgdWlwaSBBUEkgZm9yIFVJICovXG5cbmltcG9ydCBnZXRVSSBmcm9tIFwiLi4vdWkvZ2V0LXVpLmpzXCJcblxuLyogZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLXVudXNlZC12YXJzICovXG5pbXBvcnQgVUkgZnJvbSBcIi4uL3VpL3VpLmpzXCJcbi8qIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby11bnVzZWQtdmFycyAqL1xuaW1wb3J0IFVJUElNZXNzYWdlIGZyb20gXCIuL3VpcGktbWVzc2FnZS5qc1wiXG5cbi8qKlxuICogVUkgSW50ZXJmYWNlIEFQSVxuICovXG5jbGFzcyBVSVBJIHtcblxuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHtVSX0gdWlcblx0ICovXG5cdGNvbnN0cnVjdG9yKHVpKSB7XG5cdFx0dGhpcy5fdWkgPSB1aVxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7V2luZG93fSB3aW5kb3dcblx0ICogQHJldHVybnMge1VJUEl9XG5cdCAqL1xuXHRzdGF0aWMgY3JlYXRlKHdpbmRvdykge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJVSVBJLmNyZWF0ZVwiKVxuXHRcdGNvbnN0IHVpID0gZ2V0VUkoKS5jcmVhdGUod2luZG93KVxuXHRcdHJldHVybiBuZXcgVUlQSSh1aSlcblx0fVxuXG5cdC8qKlxuXHQgKiBAcGFyYW0ge0Fib3J0Q29udHJvbGxlcn0gYWJvcnRDb250cm9sbGVyXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlfVxuXHQgKi9cblx0ZmV0Y2hBbmRSZW5kZXJUaHJlYWROZXh0TWVzc2FnZVBhZ2UoYWJvcnRDb250cm9sbGVyKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIlVJUEkgZmV0Y2hBbmRSZW5kZXJUaHJlYWROZXh0TWVzc2FnZVBhZ2VcIilcblx0XHRyZXR1cm4gdGhpcy51aS5mZXRjaEFuZFJlbmRlclRocmVhZE5leHRNZXNzYWdlUGFnZShhYm9ydENvbnRyb2xsZXIpXG5cdH1cblxuXHQvKipcblx0ICogQHBhcmFtIHtBYm9ydENvbnRyb2xsZXJ9IGFib3J0Q29udHJvbGxlclxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZTxVSVBJTWVzc2FnZT59XG5cdCAqL1xuXHRnZXROZXh0VUlQSU1lc3NhZ2UoYWJvcnRDb250cm9sbGVyKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIlVJUEkgZ2V0TmV4dFVJUElNZXNzYWdlXCIpXG5cdFx0cmV0dXJuIHRoaXMudWkuZ2V0TmV4dFVJUElNZXNzYWdlKGFib3J0Q29udHJvbGxlcilcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAdHlwZSB7VUl9XG5cdCAqL1xuXHRnZXQgdWkoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX3VpXG5cdH1cblxufVxuXG5leHBvcnQgZGVmYXVsdCBVSVBJXG4iLCIvKiogQG1vZHVsZSBpZG11IEdsb2JhbC9NYWluIEFQSSBmb3IgaW50ZXJhY3Rpbmcgd2l0aCB0aGUgVUkgKi9cblxuaW1wb3J0IFVJUEkgZnJvbSBcIi4uL3VpcGkvdWlwaS5qc1wiXG4vKiBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tdW51c2VkLXZhcnMgKi9cbmltcG9ydCBVSVBJTWVzc2FnZSBmcm9tIFwiLi4vdWlwaS91aXBpLW1lc3NhZ2UuanNcIlxuXG5jbGFzcyBJRE1VIHtcblxuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHtXaW5kb3d9IHdpbmRvd1xuXHQgKiBAcGFyYW0ge2NhbGxiYWNrfSBvblN0YXR1c1RleHRcblx0ICovXG5cdGNvbnN0cnVjdG9yKHdpbmRvdywgb25TdGF0dXNUZXh0KSB7XG5cdFx0dGhpcy53aW5kb3cgPSB3aW5kb3dcblx0XHR0aGlzLnVpcGkgPSBudWxsXG5cdFx0dGhpcy5vblN0YXR1c1RleHQgPSBvblN0YXR1c1RleHRcblx0fVxuXG5cdC8qKlxuXHQgKiBAcGFyYW0ge0Fib3J0Q29udHJvbGxlcn0gYWJvcnRDb250cm9sbGVyXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlPFVJUElNZXNzYWdlPn1cblx0ICovXG5cdGdldE5leHRVSVBJTWVzc2FnZShhYm9ydENvbnRyb2xsZXIpIHtcblx0XHRyZXR1cm4gdGhpcy51aXBpLmdldE5leHRVSVBJTWVzc2FnZShhYm9ydENvbnRyb2xsZXIpXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHtzdHJpbmd9IHRleHRcblx0ICovXG5cdHNldFN0YXR1c1RleHQodGV4dCkge1xuXHRcdHRoaXMub25TdGF0dXNUZXh0KHRleHQpXG5cdH1cblxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge0Fib3J0Q29udHJvbGxlcn0gYWJvcnRDb250cm9sbGVyXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlfVxuXHQgKi9cblx0ZmV0Y2hBbmRSZW5kZXJUaHJlYWROZXh0TWVzc2FnZVBhZ2UoYWJvcnRDb250cm9sbGVyKSB7XG5cdFx0cmV0dXJuIHRoaXMudWlwaS5mZXRjaEFuZFJlbmRlclRocmVhZE5leHRNZXNzYWdlUGFnZShhYm9ydENvbnRyb2xsZXIpXG5cdH1cblxuXHQvKipcblx0ICogTWFwIEluc3RhZ3JhbSBVSVxuXHQgKi9cblx0bG9hZFVJUEkoKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcImxvYWRVSVBJXCIpXG5cdFx0dGhpcy51aXBpID0gVUlQSS5jcmVhdGUodGhpcy53aW5kb3cpXG5cdH1cblxuXG59XG5leHBvcnQgZGVmYXVsdCBJRE1VXG4iLCIvKiogQG1vZHVsZSB1bnNlbmQtc3RyYXRlZ3kgVmFyaW91cyBzdHJhdGVnaWVzIGZvciB1bnNlbmRpbmcgbWVzc2FnZXMgKi9cblxuLyogZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLXVudXNlZC12YXJzICovXG5pbXBvcnQgSURNVSBmcm9tIFwiLi4vaWRtdS9pZG11LmpzXCJcblxuLyoqXG4gKlxuICogQGFic3RyYWN0XG4gKi9cbmNsYXNzIFVuc2VuZFN0cmF0ZWd5IHtcblxuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHtJRE1VfSBpZG11XG5cdCAqL1xuXHRjb25zdHJ1Y3RvcihpZG11KSB7XG5cdFx0dGhpcy5faWRtdSA9IGlkbXVcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAYWJzdHJhY3Rcblx0ICogQHJldHVybnMge2Jvb2xlYW59XG5cdCAqL1xuXHRpc1J1bm5pbmcoKSB7XG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQGFic3RyYWN0XG5cdCAqL1xuXHRzdG9wKCkge1xuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBhYnN0cmFjdFxuXHQgKi9cblx0cmVzZXQoKSB7XG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQGFic3RyYWN0XG5cdCAqL1xuXHRhc3luYyBydW4oKSB7XG5cdH1cblxuXHQvKipcblx0ICogQHJlYWRvbmx5XG5cdCAqIEB0eXBlIHtJRE1VfVxuXHQgKi9cblx0Z2V0IGlkbXUoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX2lkbXVcblx0fVxuXG59XG5cbmV4cG9ydCB7IFVuc2VuZFN0cmF0ZWd5IH1cbiIsIi8qKiBAbW9kdWxlIHVuc2VuZC1zdHJhdGVneSBWYXJpb3VzIHN0cmF0ZWdpZXMgZm9yIHVuc2VuZGluZyBtZXNzYWdlcyAqL1xuXG4vKiBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tdW51c2VkLXZhcnMgKi9cbmltcG9ydCBJRE1VIGZyb20gXCIuLi8uLi9pZG11L2lkbXUuanNcIlxuaW1wb3J0IHsgVW5zZW5kU3RyYXRlZ3kgfSBmcm9tIFwiLi4vdW5zZW5kLXN0cmF0ZWd5LmpzXCJcblxuLyoqXG4gKiBMb2FkcyBhbGwgcGFnZXMgZmlyc3QsIHRoZW4gdW5zZW5kcyBtZXNzYWdlcyBmcm9tIGJvdHRvbSB0byB0b3AuXG4gKiBGb3Igc2hvcnQgY29udmVyc2F0aW9ucyAoYWxsIG1lc3NhZ2VzIGZpdCBpbiB2aWV3cG9ydCksIHNraXBzIHBhZ2UgbG9hZGluZyBlbnRpcmVseS5cbiAqL1xuY2xhc3MgRGVmYXVsdFN0cmF0ZWd5IGV4dGVuZHMgVW5zZW5kU3RyYXRlZ3kge1xuXG5cdC8qKlxuXHQgKiBAcGFyYW0ge0lETVV9IGlkbXVcblx0ICovXG5cdGNvbnN0cnVjdG9yKGlkbXUpIHtcblx0XHRzdXBlcihpZG11KVxuXHRcdHRoaXMuX2FsbFBhZ2VzTG9hZGVkID0gZmFsc2Vcblx0XHR0aGlzLl91bnNlbnRDb3VudCA9IDBcblx0XHR0aGlzLl9wYWdlc0xvYWRlZENvdW50ID0gMFxuXHRcdHRoaXMuX3J1bm5pbmcgPSBmYWxzZVxuXHRcdHRoaXMuX2Fib3J0Q29udHJvbGxlciA9IG51bGxcblx0XHR0aGlzLl9sYXN0VW5zZW5kRGF0ZSA9IG51bGxcblx0XHR0aGlzLl9jb25zZWN1dGl2ZUZhaWx1cmVzID0gMFxuXHR9XG5cblx0LyoqXG5cdCAqIEByZXR1cm5zIHtib29sZWFufVxuXHQgKi9cblx0aXNSdW5uaW5nKCkge1xuXHRcdHJldHVybiB0aGlzLl9ydW5uaW5nICYmIHRoaXMuX2Fib3J0Q29udHJvbGxlciAmJiB0aGlzLl9hYm9ydENvbnRyb2xsZXIuc2lnbmFsLmFib3J0ZWQgPT09IGZhbHNlXG5cdH1cblxuXHRzdG9wKCkge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJEZWZhdWx0U3RyYXRlZ3kgc3RvcFwiKVxuXHRcdHRoaXMuaWRtdS5zZXRTdGF0dXNUZXh0KFwiU3RvcHBpbmcuLi5cIilcblx0XHR0aGlzLl9hYm9ydENvbnRyb2xsZXIuYWJvcnQoXCJEZWZhdWx0U3RyYXRlZ3kgc3RvcHBlZFwiKVxuXHR9XG5cblx0cmVzZXQoKSB7XG5cdFx0dGhpcy5fYWxsUGFnZXNMb2FkZWQgPSBmYWxzZVxuXHRcdHRoaXMuX3Vuc2VudENvdW50ID0gMFxuXHRcdHRoaXMuX2xhc3RVbnNlbmREYXRlID0gbnVsbFxuXHRcdHRoaXMuX3BhZ2VzTG9hZGVkQ291bnQgPSAwXG5cdFx0dGhpcy5fY29uc2VjdXRpdmVGYWlsdXJlcyA9IDBcblx0XHR0aGlzLmlkbXUuc2V0U3RhdHVzVGV4dChcIlJlYWR5XCIpXG5cdH1cblxuXHQvKipcblx0ICogQHJldHVybnMge1Byb21pc2V9XG5cdCAqL1xuXHRhc3luYyBydW4oKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIkRlZmF1bHRTdHJhdGVneS5ydW4oKVwiKVxuXHRcdHRoaXMuX3Vuc2VudENvdW50ID0gMFxuXHRcdHRoaXMuX3BhZ2VzTG9hZGVkQ291bnQgPSAwXG5cdFx0dGhpcy5fY29uc2VjdXRpdmVGYWlsdXJlcyA9IDBcblx0XHR0aGlzLl9ydW5uaW5nID0gdHJ1ZVxuXHRcdHRoaXMuX2Fib3J0Q29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKVxuXHRcdC8vIENsZWFyIHN0YWxlIGlnbm9yZSBtYXJrZXJzIGZyb20gcHJldmlvdXMgcnVucyBzbyBtZXNzYWdlcyBjYW4gYmUgcmV0cmllZFxuXHRcdHRoaXMuaWRtdS53aW5kb3cuZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChcIltkYXRhLWlkbXUtaWdub3JlXVwiKS5mb3JFYWNoKGVsID0+IHtcblx0XHRcdGVsLnJlbW92ZUF0dHJpYnV0ZShcImRhdGEtaWRtdS1pZ25vcmVcIilcblx0XHR9KVxuXHRcdHRoaXMuaWRtdS5sb2FkVUlQSSgpXG5cdFx0dHJ5IHtcblx0XHRcdGlmICh0aGlzLl9hbGxQYWdlc0xvYWRlZCkge1xuXHRcdFx0XHRhd2FpdCB0aGlzLiN1bnNlbmROZXh0TWVzc2FnZSgpXG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRhd2FpdCB0aGlzLiNsb2FkTmV4dFBhZ2UoKVxuXHRcdFx0fVxuXG5cdFx0XHQvLyBSYWNlIGNvbmRpdGlvbjogb24gZmlyc3QgcGFnZSBsb2FkLCBJbnN0YWdyYW0ncyBSZWFjdCBtYXkgbm90IGhhdmVcblx0XHRcdC8vIGZpbmlzaGVkIGh5ZHJhdGluZyBtZXNzYWdlIGNvbXBvbmVudHMgKHJvbGUgYXR0cmlidXRlcyBtaXNzaW5nKS5cblx0XHRcdC8vIElmIHdlIGZvdW5kIG5vdGhpbmcsIHdhaXQgYW5kIHJlLXNjYW4gdXAgdG8gMyB0aW1lcy5cblx0XHRcdGlmICh0aGlzLl91bnNlbnRDb3VudCA9PT0gMCAmJiAhdGhpcy5fYWJvcnRDb250cm9sbGVyLnNpZ25hbC5hYm9ydGVkKSB7XG5cdFx0XHRcdGZvciAobGV0IHJldHJ5ID0gMTsgcmV0cnkgPD0gMzsgcmV0cnkrKykge1xuXHRcdFx0XHRcdHRoaXMuaWRtdS5zZXRTdGF0dXNUZXh0KGBObyBtZXNzYWdlcyBkZXRlY3RlZCwgcmV0cnlpbmcgKCR7cmV0cnl9LzMpLi4uYClcblx0XHRcdFx0XHRjb25zb2xlLmRlYnVnKGBEZWZhdWx0U3RyYXRlZ3k6IDAgbWVzc2FnZXMgZm91bmQsIHJldHJ5ICR7cmV0cnl9LzNgKVxuXHRcdFx0XHRcdGF3YWl0IG5ldyBQcm9taXNlKHJlc29sdmUgPT4gc2V0VGltZW91dChyZXNvbHZlLCAyMDAwKSlcblx0XHRcdFx0XHRpZiAodGhpcy5fYWJvcnRDb250cm9sbGVyLnNpZ25hbC5hYm9ydGVkKSBicmVha1xuXHRcdFx0XHRcdC8vIFJlc2V0IGZvciBmcmVzaCBzY2FuXG5cdFx0XHRcdFx0dGhpcy5fYWxsUGFnZXNMb2FkZWQgPSBmYWxzZVxuXHRcdFx0XHRcdHRoaXMuX2NvbnNlY3V0aXZlRmFpbHVyZXMgPSAwXG5cdFx0XHRcdFx0dGhpcy5pZG11LndpbmRvdy5kb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKFwiW2RhdGEtaWRtdS1pZ25vcmVdXCIpLmZvckVhY2goZWwgPT4ge1xuXHRcdFx0XHRcdFx0ZWwucmVtb3ZlQXR0cmlidXRlKFwiZGF0YS1pZG11LWlnbm9yZVwiKVxuXHRcdFx0XHRcdH0pXG5cdFx0XHRcdFx0dGhpcy5pZG11LmxvYWRVSVBJKClcblx0XHRcdFx0XHRhd2FpdCB0aGlzLiNsb2FkTmV4dFBhZ2UoKVxuXHRcdFx0XHRcdGlmICh0aGlzLl91bnNlbnRDb3VudCA+IDAgfHwgdGhpcy5fYWJvcnRDb250cm9sbGVyLnNpZ25hbC5hYm9ydGVkKSBicmVha1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGlmICh0aGlzLl9hYm9ydENvbnRyb2xsZXIuc2lnbmFsLmFib3J0ZWQpIHtcblx0XHRcdFx0dGhpcy5pZG11LnNldFN0YXR1c1RleHQoYEFib3J0ZWQuICR7dGhpcy5fdW5zZW50Q291bnR9IG1lc3NhZ2UocykgdW5zZW50LmApXG5cdFx0XHRcdGNvbnNvbGUuZGVidWcoXCJEZWZhdWx0U3RyYXRlZ3kgYWJvcnRlZFwiKVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5pZG11LnNldFN0YXR1c1RleHQoYERvbmUuICR7dGhpcy5fdW5zZW50Q291bnR9IG1lc3NhZ2UocykgdW5zZW50LmApXG5cdFx0XHRcdGNvbnNvbGUuZGVidWcoXCJEZWZhdWx0U3RyYXRlZ3kgZG9uZVwiKVxuXHRcdFx0fVxuXHRcdH0gY2F0Y2ggKGV4KSB7XG5cdFx0XHRjb25zb2xlLmVycm9yKGV4KVxuXHRcdFx0dGhpcy5pZG11LnNldFN0YXR1c1RleHQoYEVycm9yZWQuICR7dGhpcy5fdW5zZW50Q291bnR9IG1lc3NhZ2UocykgdW5zZW50LmApXG5cdFx0XHRjb25zb2xlLmRlYnVnKFwiRGVmYXVsdFN0cmF0ZWd5IGVycm9yZWRcIilcblx0XHR9XG5cdFx0dGhpcy5fcnVubmluZyA9IGZhbHNlXG5cdH1cblxuXHQvKipcblx0ICogVHJpZXMgdG8gbG9hZCB0aGUgdGhyZWFkIG5leHQgcGFnZS5cblx0ICogSWYgbG9hZE1vcmVNZXNzYWdlcyByZXR1cm5zIHRydWUgKG5vIG1vcmUgcGFnZXMpLCBtb3ZlcyB0byB1bnNlbmRpbmcuXG5cdCAqL1xuXHRhc3luYyAjbG9hZE5leHRQYWdlKCkge1xuXHRcdGlmICh0aGlzLl9hYm9ydENvbnRyb2xsZXIuc2lnbmFsLmFib3J0ZWQpIHtcblx0XHRcdGNvbnNvbGUuZGVidWcoXCJhYm9ydENvbnRyb2xsZXIgaW50ZXJ1cHRlZCB0aGUgbG9hZGluZyBvZiBuZXh0IHBhZ2U6IHN0b3BwaW5nLi4uXCIpXG5cdFx0XHRyZXR1cm5cblx0XHR9XG5cdFx0dGhpcy5pZG11LnNldFN0YXR1c1RleHQoXCJMb2FkaW5nIG5leHQgcGFnZS4uLlwiKVxuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBkb25lID0gYXdhaXQgdGhpcy5pZG11LmZldGNoQW5kUmVuZGVyVGhyZWFkTmV4dE1lc3NhZ2VQYWdlKHRoaXMuX2Fib3J0Q29udHJvbGxlcilcblx0XHRcdGlmICh0aGlzLl9hYm9ydENvbnRyb2xsZXIuc2lnbmFsLmFib3J0ZWQgPT09IGZhbHNlKSB7XG5cdFx0XHRcdGlmIChkb25lKSB7XG5cdFx0XHRcdFx0dGhpcy5pZG11LnNldFN0YXR1c1RleHQoYEFsbCBwYWdlcyBsb2FkZWQgKCR7dGhpcy5fcGFnZXNMb2FkZWRDb3VudH0gaW4gdG90YWwpLiBVbnNlbmRpbmcuLi5gKVxuXHRcdFx0XHRcdHRoaXMuX2FsbFBhZ2VzTG9hZGVkID0gdHJ1ZVxuXHRcdFx0XHRcdGF3YWl0IHRoaXMuI3Vuc2VuZE5leHRNZXNzYWdlKClcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR0aGlzLl9wYWdlc0xvYWRlZENvdW50Kytcblx0XHRcdFx0XHRhd2FpdCB0aGlzLiNsb2FkTmV4dFBhZ2UoKVxuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjb25zb2xlLmRlYnVnKFwiYWJvcnRDb250cm9sbGVyIGludGVydXB0ZWQgdGhlIGxvYWRpbmcgb2YgbmV4dCBwYWdlOiBzdG9wcGluZy4uLlwiKVxuXHRcdFx0fVxuXHRcdH0gY2F0Y2ggKGV4KSB7XG5cdFx0XHRjb25zb2xlLmVycm9yKGV4KVxuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBVbnNlbmQgZmlyc3QgbWVzc2FnZSBpbiB2aWV3cG9ydC5cblx0ICogVXNlcyBhZGFwdGl2ZSBkZWxheXM6IGZhc3QgYmFzZWxpbmUgKDEtMnMpIHdpdGggZXhwb25lbnRpYWwgYmFja29mZiBvbiByYXRlIGxpbWl0IGRldGVjdGlvbi5cblx0ICovXG5cdGFzeW5jICN1bnNlbmROZXh0TWVzc2FnZSgpIHtcblx0XHRpZiAodGhpcy5fYWJvcnRDb250cm9sbGVyLnNpZ25hbC5hYm9ydGVkKSB7XG5cdFx0XHRjb25zb2xlLmRlYnVnKFwiYWJvcnRDb250cm9sbGVyIGludGVydXB0ZWQgdGhlIHVuc2VuZGluZyBvZiBuZXh0IG1lc3NhZ2U6IHN0b3BwaW5nLi4uXCIpXG5cdFx0XHRyZXR1cm5cblx0XHR9XG5cdFx0aWYgKHRoaXMuX2NvbnNlY3V0aXZlRmFpbHVyZXMgPj0gNSkge1xuXHRcdFx0dGhpcy5pZG11LnNldFN0YXR1c1RleHQoYFN0b3BwZWQ6ICR7dGhpcy5fY29uc2VjdXRpdmVGYWlsdXJlc30gY29uc2VjdXRpdmUgZmFpbHVyZXMuICR7dGhpcy5fdW5zZW50Q291bnR9IG1lc3NhZ2UocykgdW5zZW50LmApXG5cdFx0XHRjb25zb2xlLmRlYnVnKFwiRGVmYXVsdFN0cmF0ZWd5IHN0b3BwaW5nIGR1ZSB0byBjb25zZWN1dGl2ZSBmYWlsdXJlc1wiKVxuXHRcdFx0cmV0dXJuXG5cdFx0fVxuXHRcdGxldCBjYW5TY3JvbGwgPSB0cnVlXG5cdFx0bGV0IG1zZ0VsZW1lbnQgPSBudWxsXG5cdFx0dHJ5IHtcblx0XHRcdHRoaXMuaWRtdS5zZXRTdGF0dXNUZXh0KGBSZXRyaWV2aW5nIG5leHQgbWVzc2FnZS4uLiAoJHt0aGlzLl91bnNlbnRDb3VudH0gdW5zZW50IHNvIGZhcilgKVxuXHRcdFx0Y29uc3QgdWlwaU1lc3NhZ2UgPSBhd2FpdCB0aGlzLmlkbXUuZ2V0TmV4dFVJUElNZXNzYWdlKHRoaXMuX2Fib3J0Q29udHJvbGxlcilcblx0XHRcdGNhblNjcm9sbCA9IHVpcGlNZXNzYWdlICE9PSBmYWxzZVxuXHRcdFx0aWYgKHVpcGlNZXNzYWdlKSB7XG5cdFx0XHRcdHRoaXMuaWRtdS5zZXRTdGF0dXNUZXh0KGBVbnNlbmRpbmcgbWVzc2FnZS4uLiAoJHt0aGlzLl91bnNlbnRDb3VudCArIDF9KWApXG5cblx0XHRcdFx0Ly8gQWRhcHRpdmUgZGVsYXk6IDEtMnMgcmFuZG9taXplZCBiYXNlbGluZSBiZXR3ZWVuIHVuc2VuZHNcblx0XHRcdFx0aWYgKHRoaXMuX2xhc3RVbnNlbmREYXRlICE9PSBudWxsKSB7XG5cdFx0XHRcdFx0Y29uc3QgZWxhcHNlZCA9IERhdGUubm93KCkgLSB0aGlzLl9sYXN0VW5zZW5kRGF0ZS5nZXRUaW1lKClcblx0XHRcdFx0XHRjb25zdCBtaW5EZWxheSA9IDEwMDAgKyBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiAxMDAwKSAvLyAxLTJzXG5cdFx0XHRcdFx0aWYgKGVsYXBzZWQgPCBtaW5EZWxheSkge1xuXHRcdFx0XHRcdFx0Y29uc3Qgd2FpdE1zID0gbWluRGVsYXkgLSBlbGFwc2VkXG5cdFx0XHRcdFx0XHR0aGlzLmlkbXUuc2V0U3RhdHVzVGV4dChgV2FpdGluZyAkeyh3YWl0TXMgLyAxMDAwKS50b0ZpeGVkKDEpfXMuLi4gKCR7dGhpcy5fdW5zZW50Q291bnR9IHVuc2VudCBzbyBmYXIpYClcblx0XHRcdFx0XHRcdGF3YWl0IG5ldyBQcm9taXNlKHJlc29sdmUgPT4gc2V0VGltZW91dChyZXNvbHZlLCB3YWl0TXMpKVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmICh0aGlzLl9hYm9ydENvbnRyb2xsZXIuc2lnbmFsLmFib3J0ZWQpIHJldHVyblxuXG5cdFx0XHRcdG1zZ0VsZW1lbnQgPSB1aXBpTWVzc2FnZS51aU1lc3NhZ2Uucm9vdFxuXHRcdFx0XHRjb25zdCB1bnNlbnQgPSBhd2FpdCB1aXBpTWVzc2FnZS51bnNlbmQodGhpcy5fYWJvcnRDb250cm9sbGVyKVxuXG5cdFx0XHRcdGlmICh1bnNlbnQpIHtcblx0XHRcdFx0XHQvLyBWZXJpZnkgdGhlIG1lc3NhZ2UgYWN0dWFsbHkgZGlzYXBwZWFyZWQgZnJvbSBET00gKHNlcnZlciBhY2NlcHRlZCB0aGUgbXV0YXRpb24pXG5cdFx0XHRcdFx0YXdhaXQgbmV3IFByb21pc2UocmVzb2x2ZSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIDgwMCkpXG5cdFx0XHRcdFx0Y29uc3Qgc3RpbGxJbkRPTSA9IG1zZ0VsZW1lbnQuaXNDb25uZWN0ZWQgJiYgIW1zZ0VsZW1lbnQuaGFzQXR0cmlidXRlKFwiZGF0YS1pZG11LXVuc2VudFwiKVxuXHRcdFx0XHRcdGlmIChzdGlsbEluRE9NKSB7XG5cdFx0XHRcdFx0XHQvLyBTZXJ2ZXIgbGlrZWx5IHJlamVjdGVkIOKAlCB0aGUgbWVzc2FnZSByZWFwcGVhcmVkIGFmdGVyIG9wdGltaXN0aWMgcmVtb3ZhbFxuXHRcdFx0XHRcdFx0Y29uc29sZS5kZWJ1ZyhcIkRlZmF1bHRTdHJhdGVneTogbWVzc2FnZSBzdGlsbCBpbiBET00gYWZ0ZXIgdW5zZW5kLCBwb3NzaWJsZSByYXRlIGxpbWl0XCIpXG5cdFx0XHRcdFx0XHRtc2dFbGVtZW50LnJlbW92ZUF0dHJpYnV0ZShcImRhdGEtaWRtdS1pZ25vcmVcIilcblx0XHRcdFx0XHRcdHRoaXMuX2NvbnNlY3V0aXZlRmFpbHVyZXMrK1xuXHRcdFx0XHRcdFx0Y29uc3QgYmFja29mZk1zID0gTWF0aC5taW4oNjAwMDAsIDUwMDAgKiBNYXRoLnBvdygyLCB0aGlzLl9jb25zZWN1dGl2ZUZhaWx1cmVzIC0gMSkpXG5cdFx0XHRcdFx0XHR0aGlzLmlkbXUuc2V0U3RhdHVzVGV4dChgUmF0ZSBsaW1pdCBkZXRlY3RlZC4gQmFja2luZyBvZmYgJHsoYmFja29mZk1zIC8gMTAwMCkudG9GaXhlZCgwKX1zLi4uICgke3RoaXMuX3Vuc2VudENvdW50fSB1bnNlbnQpYClcblx0XHRcdFx0XHRcdGF3YWl0IG5ldyBQcm9taXNlKHJlc29sdmUgPT4gc2V0VGltZW91dChyZXNvbHZlLCBiYWNrb2ZmTXMpKVxuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHR0aGlzLl9sYXN0VW5zZW5kRGF0ZSA9IG5ldyBEYXRlKClcblx0XHRcdFx0XHRcdHRoaXMuX3Vuc2VudENvdW50Kytcblx0XHRcdFx0XHRcdHRoaXMuX2NvbnNlY3V0aXZlRmFpbHVyZXMgPSAwXG5cdFx0XHRcdFx0XHQvLyBET00gc2hydW5rIGFmdGVyIHJlbW92YWw7IHJlc2V0IHNjcm9sbCBmb3IgZnJlc2ggc2NhblxuXHRcdFx0XHRcdFx0aWYgKHRoaXMuaWRtdS51aXBpICYmIHRoaXMuaWRtdS51aXBpLnVpKSB7XG5cdFx0XHRcdFx0XHRcdHRoaXMuaWRtdS51aXBpLnVpLmxhc3RTY3JvbGxUb3AgPSBudWxsXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdC8vIFVuc2VuZCB3b3JrZmxvdyByZXR1cm5lZCBmYWxzZSDigJQgYWxsb3cgcmV0cnkgb24gbmV4dCBwYXNzXG5cdFx0XHRcdFx0Y29uc29sZS5kZWJ1ZyhcIkRlZmF1bHRTdHJhdGVneTogdW5zZW5kIHJldHVybmVkIGZhbHNlLCByZW1vdmluZyBpZ25vcmUgbWFya2VyIGZvciByZXRyeVwiKVxuXHRcdFx0XHRcdG1zZ0VsZW1lbnQucmVtb3ZlQXR0cmlidXRlKFwiZGF0YS1pZG11LWlnbm9yZVwiKVxuXHRcdFx0XHRcdHRoaXMuX2NvbnNlY3V0aXZlRmFpbHVyZXMrK1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSBjYXRjaCAoZXgpIHtcblx0XHRcdGNvbnNvbGUuZXJyb3IoZXgpXG5cdFx0XHQvLyBSZW1vdmUgaWdub3JlIG1hcmtlciBzbyB0aGlzIG1lc3NhZ2UgY2FuIGJlIHJldHJpZWRcblx0XHRcdGlmIChtc2dFbGVtZW50KSB7XG5cdFx0XHRcdG1zZ0VsZW1lbnQucmVtb3ZlQXR0cmlidXRlKFwiZGF0YS1pZG11LWlnbm9yZVwiKVxuXHRcdFx0fVxuXHRcdFx0dGhpcy5fY29uc2VjdXRpdmVGYWlsdXJlcysrXG5cdFx0XHRjb25zdCBiYWNrb2ZmTXMgPSBNYXRoLm1pbig2MDAwMCwgMzAwMCAqIE1hdGgucG93KDIsIHRoaXMuX2NvbnNlY3V0aXZlRmFpbHVyZXMgLSAxKSlcblx0XHRcdHRoaXMuaWRtdS5zZXRTdGF0dXNUZXh0KGBXb3JrZmxvdyBmYWlsZWQgKCR7dGhpcy5fY29uc2VjdXRpdmVGYWlsdXJlc30vNSksIHJldHJ5aW5nIGluICR7KGJhY2tvZmZNcyAvIDEwMDApLnRvRml4ZWQoMCl9cy4uLiAoJHt0aGlzLl91bnNlbnRDb3VudH0gdW5zZW50KWApXG5cdFx0XHRhd2FpdCBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgYmFja29mZk1zKSlcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0aWYgKGNhblNjcm9sbCAmJiB0aGlzLl9hYm9ydENvbnRyb2xsZXIgJiYgIXRoaXMuX2Fib3J0Q29udHJvbGxlci5zaWduYWwuYWJvcnRlZCkge1xuXHRcdFx0XHRhd2FpdCB0aGlzLiN1bnNlbmROZXh0TWVzc2FnZSgpXG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cbn1cblxuZXhwb3J0IHsgRGVmYXVsdFN0cmF0ZWd5IH1cbiIsIi8qKiBAbW9kdWxlIGFsZXJ0IEFsZXJ0IFVJICovXG5cbi8qKlxuICpcbiAqIEBwYXJhbSB7RG9jdW1lbnR9IGRvY3VtZW50XG4gKiBAcmV0dXJucyB7SFRNTEJ1dHRvbkVsZW1lbnR9XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVBbGVydHNXcmFwcGVyRWxlbWVudChkb2N1bWVudCkge1xuXHRjb25zdCBhbGVydHNXcmFwcGVyRWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIilcblx0YWxlcnRzV3JhcHBlckVsZW1lbnQuaWQgPSBcImlkbXUtYWxlcnRzXCJcblx0YWxlcnRzV3JhcHBlckVsZW1lbnQuc3R5bGUucG9zaXRpb24gPSBcImZpeGVkXCJcblx0YWxlcnRzV3JhcHBlckVsZW1lbnQuc3R5bGUudG9wID0gXCIyMHB4XCJcblx0YWxlcnRzV3JhcHBlckVsZW1lbnQuc3R5bGUucmlnaHQgPSBcIjIwcHhcIlxuXHRhbGVydHNXcmFwcGVyRWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gXCJncmlkXCJcblx0cmV0dXJuIGFsZXJ0c1dyYXBwZXJFbGVtZW50XG59XG5cbi8qKlxuICpcbiAqIEBwYXJhbSB7RG9jdW1lbnR9IGRvY3VtZW50XG4gKiBAcGFyYW0ge3N0cmluZ30gICB0ZXh0XG4gKiBAcmV0dXJucyB7SFRNTEJ1dHRvbkVsZW1lbnR9XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVBbGVydEVsZW1lbnQoZG9jdW1lbnQsIHRleHQpIHtcblx0Y29uc3QgYWxlcnRFbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKVxuXHRhbGVydEVsZW1lbnQudGV4dENvbnRlbnQgPSB0ZXh0XG5cdHJldHVybiBhbGVydEVsZW1lbnRcbn1cbiIsIi8qKiBAbW9kdWxlIG92ZXJsYXkgSURNVSdzIG92ZXJsYXkgKi9cblxuLyoqXG4gKiBAcGFyYW0ge0RvY3VtZW50fSBkb2N1bWVudFxuICogQHJldHVybnMge0hUTUxEaXZFbGVtZW50fVxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlT3ZlcmxheUVsZW1lbnQoZG9jdW1lbnQpIHtcblx0Y29uc3Qgb3ZlcmxheUVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpXG5cdG92ZXJsYXlFbGVtZW50LmlkID0gXCJpZG11LW92ZXJsYXlcIlxuXHRvdmVybGF5RWxlbWVudC50YWJJbmRleCA9IDBcblx0b3ZlcmxheUVsZW1lbnQuc3R5bGUudG9wID0gXCIwXCJcblx0b3ZlcmxheUVsZW1lbnQuc3R5bGUucmlnaHQgPSBcIjBcIlxuXHRvdmVybGF5RWxlbWVudC5zdHlsZS5wb3NpdGlvbiA9IFwiZml4ZWRcIlxuXHRvdmVybGF5RWxlbWVudC5zdHlsZS53aWR0aCA9IFwiMTAwdndcIlxuXHRvdmVybGF5RWxlbWVudC5zdHlsZS5oZWlnaHQgPSBcIjEwMHZoXCJcblx0b3ZlcmxheUVsZW1lbnQuc3R5bGUuekluZGV4ID0gXCI5OThcIlxuXHRvdmVybGF5RWxlbWVudC5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSBcIiMwMDAwMDBkNlwiXG5cdG92ZXJsYXlFbGVtZW50LnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIlxuXHRyZXR1cm4gb3ZlcmxheUVsZW1lbnRcbn1cbiIsIi8qKiBAbW9kdWxlIHVpIElETVUncyBvd24gdWkvb3ZlcmxheVxuICogUHJvdmlkZSBhIGJ1dHRvbiB0byB1bnNlbmQgbWVzc2FnZXNcbiAqL1xuXG5pbXBvcnQgeyBjcmVhdGVNZW51QnV0dG9uRWxlbWVudCB9IGZyb20gXCIuL21lbnUtYnV0dG9uLmpzXCJcbmltcG9ydCB7IGNyZWF0ZU1lbnVFbGVtZW50IH0gZnJvbSBcIi4vbWVudS5qc1wiXG5pbXBvcnQgSURNVSBmcm9tIFwiLi4vLi4vLi4vaWRtdS9pZG11LmpzXCJcbmltcG9ydCB7IERlZmF1bHRTdHJhdGVneSB9IGZyb20gXCIuLi8uLi8uLi91aS9kZWZhdWx0L3Vuc2VuZC1zdHJhdGVneS5qc1wiXG5pbXBvcnQgeyBjcmVhdGVBbGVydHNXcmFwcGVyRWxlbWVudCB9IGZyb20gXCIuL2FsZXJ0LmpzXCJcbmltcG9ydCB7IGNyZWF0ZU92ZXJsYXlFbGVtZW50IH0gZnJvbSBcIi4vb3ZlcmxheS5qc1wiXG5pbXBvcnQgeyBCVVRUT05fU1RZTEUgfSBmcm9tIFwiLi9zdHlsZS9pbnN0YWdyYW0uanNcIlxuLyogZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLXVudXNlZC12YXJzICovXG5pbXBvcnQgeyBVbnNlbmRTdHJhdGVneSB9IGZyb20gXCIuLi8uLi8uLi91aS91bnNlbmQtc3RyYXRlZ3kuanNcIlxuXG5jbGFzcyBPU0Qge1xuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHtEb2N1bWVudH0gZG9jdW1lbnRcblx0ICogQHBhcmFtIHtIVE1MRGl2RWxlbWVudH0gcm9vdFxuXHQgKiBAcGFyYW0ge0hUTUxEaXZFbGVtZW50fSBvdmVybGF5RWxlbWVudFxuXHQgKiBAcGFyYW0ge0hUTUxEaXZFbGVtZW50fSBtZW51RWxlbWVudFxuXHQgKiBAcGFyYW0ge0hUTUxCdXR0b25FbGVtZW50fSB1bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvblxuXHQgKiBAcGFyYW0ge0hUTUxEaXZFbGVtZW50fSBzdGF0dXNFbGVtZW50XG5cdCAqL1xuXHRjb25zdHJ1Y3Rvcihkb2N1bWVudCwgcm9vdCwgb3ZlcmxheUVsZW1lbnQsIG1lbnVFbGVtZW50LCB1bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbiwgc3RhdHVzRWxlbWVudCkge1xuXHRcdHRoaXMuX2RvY3VtZW50ID0gZG9jdW1lbnRcblx0XHR0aGlzLl9yb290ID0gcm9vdFxuXHRcdHRoaXMuX292ZXJsYXlFbGVtZW50ID0gb3ZlcmxheUVsZW1lbnRcblx0XHR0aGlzLl9tZW51RWxlbWVudCA9IG1lbnVFbGVtZW50XG5cdFx0dGhpcy5fc3RhdHVzRWxlbWVudCA9IHN0YXR1c0VsZW1lbnRcblx0XHR0aGlzLl91bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbiA9IHVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uXG5cdFx0dGhpcy5faWRtdSA9IG5ldyBJRE1VKHRoaXMud2luZG93LCB0aGlzLm9uU3RhdHVzVGV4dC5iaW5kKHRoaXMpKVxuXHRcdHRoaXMuX3N0cmF0ZWd5ID0gbmV3IERlZmF1bHRTdHJhdGVneSh0aGlzLl9pZG11KSAvLyBUT0RPIG1vdmUgb3V0XG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHt3aW5kb3d9IHdpbmRvd1xuXHQgKiBAcmV0dXJucyB7T1NEfVxuXHQgKi9cblx0c3RhdGljIHJlbmRlcih3aW5kb3cpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwicmVuZGVyXCIpXG5cdFx0Y29uc3QgdWkgPSBPU0QuY3JlYXRlKHdpbmRvdy5kb2N1bWVudClcblx0XHR3aW5kb3cuZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCh1aS5yb290KVxuXHRcdHJldHVybiB1aVxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSAgIHtEb2N1bWVudH0gZG9jdW1lbnRcblx0ICogQHJldHVybnMge09TRH1cblx0ICovXG5cdHN0YXRpYyBjcmVhdGUoZG9jdW1lbnQpIHtcblx0XHRjb25zdCByb290ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKVxuXHRcdHJvb3QuaWQgPSBcImlkbXUtcm9vdFwiXG5cdFx0Y29uc3QgbWVudUVsZW1lbnQgPSBjcmVhdGVNZW51RWxlbWVudChkb2N1bWVudClcblx0XHRjb25zdCBvdmVybGF5RWxlbWVudCA9IGNyZWF0ZU92ZXJsYXlFbGVtZW50KGRvY3VtZW50KVxuXHRcdGNvbnN0IGFsZXJ0c1dyYXBwZXJFbGVtZW50ID0gY3JlYXRlQWxlcnRzV3JhcHBlckVsZW1lbnQoZG9jdW1lbnQpXG5cdFx0Y29uc3QgdW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24gPSBjcmVhdGVNZW51QnV0dG9uRWxlbWVudChkb2N1bWVudCwgXCJVbnNlbmQgYWxsIERNc1wiLCBCVVRUT05fU1RZTEUuUFJJTUFSWSlcblx0XHRjb25zdCBzdGF0dXNFbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKVxuXHRcdHN0YXR1c0VsZW1lbnQudGV4dENvbnRlbnQgPSBcIlJlYWR5XCJcblx0XHRzdGF0dXNFbGVtZW50LmlkID0gXCJpZG11LXN0YXR1c1wiXG5cdFx0c3RhdHVzRWxlbWVudC5zdHlsZSA9IFwid2lkdGg6IDIwMHB4XCJcblx0XHRkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKG92ZXJsYXlFbGVtZW50KVxuXHRcdGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoYWxlcnRzV3JhcHBlckVsZW1lbnQpXG5cdFx0bWVudUVsZW1lbnQuYXBwZW5kQ2hpbGQodW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24pXG5cdFx0bWVudUVsZW1lbnQuYXBwZW5kQ2hpbGQoc3RhdHVzRWxlbWVudClcblx0XHRyb290LmFwcGVuZENoaWxkKG1lbnVFbGVtZW50KVxuXHRcdGNvbnN0IHVpID0gbmV3IE9TRChkb2N1bWVudCwgcm9vdCwgb3ZlcmxheUVsZW1lbnQsIG1lbnVFbGVtZW50LCB1bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbiwgc3RhdHVzRWxlbWVudClcblx0XHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKFwia2V5ZG93blwiLCAoZXZlbnQpID0+IHVpLiNvbldpbmRvd0tleUV2ZW50KGV2ZW50KSkgLy8gVE9ETyB0ZXN0XG5cdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcImtleXVwXCIsIChldmVudCkgPT4gdWkuI29uV2luZG93S2V5RXZlbnQoZXZlbnQpKSAvLyBUT0RPIHRlc3Rcblx0XHR1bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKGV2ZW50KSA9PiB1aS4jb25VbnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbkNsaWNrKGV2ZW50KSlcblx0XHR1aS5fbXV0YXRpb25PYnNlcnZlciA9IG5ldyBNdXRhdGlvbk9ic2VydmVyKChtdXRhdGlvbnMpID0+IHVpLiNvbk11dGF0aW9ucyh1aSwgbXV0YXRpb25zKSlcblx0XHR1aS5fbXV0YXRpb25PYnNlcnZlci5vYnNlcnZlKGRvY3VtZW50LmJvZHksIHsgY2hpbGRMaXN0OiB0cnVlIH0pIC8vIFRPRE8gdGVzdFxuXHRcdHVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uLmRhdGFUZXh0Q29udGVudCA9IHVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uLnRleHRDb250ZW50XG5cdFx0dW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24uZGF0YUJhY2tncm91bmRDb2xvciA9IHVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uLnN0eWxlLmJhY2tncm91bmRDb2xvclxuXHRcdHJldHVybiB1aVxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0XG5cdCAqL1xuXHRvblN0YXR1c1RleHQodGV4dCkge1xuXHRcdHRoaXMuc3RhdHVzRWxlbWVudC50ZXh0Q29udGVudCA9IHRleHRcblx0fVxuXG5cdGFzeW5jICNzdGFydFVuc2VuZGluZygpIHtcblx0XHQ7Wy4uLnRoaXMubWVudUVsZW1lbnQucXVlcnlTZWxlY3RvckFsbChcImJ1dHRvblwiKV0uZmlsdGVyKGJ1dHRvbiA9PiBidXR0b24gIT09IHRoaXMudW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24pLmZvckVhY2goYnV0dG9uID0+IHtcblx0XHRcdGJ1dHRvbi5zdHlsZS52aXNpYmlsaXR5ID0gXCJoaWRkZW5cIlxuXHRcdFx0YnV0dG9uLmRpc2FibGVkID0gdHJ1ZVxuXHRcdH0pXG5cdFx0dGhpcy5vdmVybGF5RWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gXCJcIlxuXHRcdHRoaXMub3ZlcmxheUVsZW1lbnQuZm9jdXMoKVxuXHRcdHRoaXMudW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24udGV4dENvbnRlbnQgPSBcIlN0b3AgcHJvY2Vzc2luZ1wiXG5cdFx0dGhpcy51bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbi5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSBcIiNGQTM4M0VcIlxuXHRcdHRoaXMuc3RhdHVzRWxlbWVudC5zdHlsZS5jb2xvciA9IFwid2hpdGVcIlxuXHRcdHRoaXMuX211dGF0aW9uT2JzZXJ2ZXIuZGlzY29ubmVjdCgpXG5cdFx0dHJ5IHtcblx0XHRcdGF3YWl0IHRoaXMuc3RyYXRlZ3kucnVuKClcblx0XHR9IGNhdGNoKGVycm9yKSB7XG5cdFx0XHRjb25zb2xlLmVycm9yKGVycm9yKVxuXHRcdFx0aWYodGhpcy5zdHJhdGVneS5pc1J1bm5pbmcoKSkge1xuXHRcdFx0XHR0aGlzLnN0cmF0ZWd5LnN0b3AoKVxuXHRcdFx0fVxuXHRcdFx0dGhpcy5zdGF0dXNFbGVtZW50LmlubmVySFRNTCA9IGA8c3BhbiBzdHlsZT1cImNvbG9yOiByZWRcIj5BbiBlcnJvciBvY2N1cmVkLCA8YSBocmVmPVwiaHR0cHM6Ly9naXRodWIuY29tL3Rob3VnaHRzdW5pZmljYXRvci9pbnN0YWdyYW0tZG0tdW5zZW5kZXIvaXNzdWVzL25ldz90ZW1wbGF0ZT1idWdfcmVwb3J0Lm1kXCI+cGxlYXNlIG9wZW4gYW4gaXNzdWU8L2E+PC9zcGFuPmBcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0dGhpcy4jb25VbnNlbmRpbmdGaW5pc2hlZCgpXG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7T1NEfSB1aVxuXHQgKi9cblx0I29uTXV0YXRpb25zKHVpKSB7XG5cdFx0aWYodWkucm9vdC5vd25lckRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCJbaWRePW1vdW50XSA+IGRpdiA+IGRpdiA+IGRpdlwiKSAhPT0gbnVsbCAmJiB1aSkge1xuXHRcdFx0aWYodGhpcy5fbXV0YXRpb25PYnNlcnZlcikge1xuXHRcdFx0XHR0aGlzLl9tdXRhdGlvbk9ic2VydmVyLmRpc2Nvbm5lY3QoKVxuXHRcdFx0fVxuXHRcdFx0dGhpcy5fbXV0YXRpb25PYnNlcnZlciA9IG5ldyBNdXRhdGlvbk9ic2VydmVyKHVpLiNvbk11dGF0aW9ucy5iaW5kKHRoaXMsIHVpKSlcblx0XHRcdHRoaXMuX211dGF0aW9uT2JzZXJ2ZXIub2JzZXJ2ZSh1aS5yb290Lm93bmVyRG9jdW1lbnQucXVlcnlTZWxlY3RvcihcIltpZF49bW91bnRdID4gZGl2ID4gZGl2ID4gZGl2XCIpLCB7IGNoaWxkTGlzdDogdHJ1ZSwgYXR0cmlidXRlczogdHJ1ZSB9KVxuXHRcdH1cblx0XHRpZih0aGlzLndpbmRvdy5sb2NhdGlvbi5wYXRobmFtZS5zdGFydHNXaXRoKFwiL2RpcmVjdC90L1wiKSkge1xuXHRcdFx0aWYoIXRoaXMuc3RyYXRlZ3kuaXNSdW5uaW5nKCkpIHtcblx0XHRcdFx0dGhpcy5zdHJhdGVneS5yZXNldCgpXG5cdFx0XHR9XG5cdFx0XHR0aGlzLnJvb3Quc3R5bGUuZGlzcGxheSA9IFwiXCJcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5yb290LnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIlxuXHRcdFx0aWYodGhpcy5zdHJhdGVneS5pc1J1bm5pbmcoKSkge1xuXHRcdFx0XHR0aGlzLnN0cmF0ZWd5LnN0b3AoKVxuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge09TRH0gdWlcblx0ICogQHBhcmFtIHtFdmVudH0gZXZlbnRcblx0ICovXG5cdCNvblVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uQ2xpY2soKSB7XG5cdFx0aWYodGhpcy5zdHJhdGVneS5pc1J1bm5pbmcoKSkge1xuXHRcdFx0Y29uc29sZS5kZWJ1ZyhcIlVzZXIgYXNrZWQgZm9yIG1lc3NhZ2VzIHVuc2VuZGluZyB0byBzdG9wXCIpXG5cdFx0XHR0aGlzLnN0cmF0ZWd5LnN0b3AoKVxuXHRcdFx0dGhpcy4jb25VbnNlbmRpbmdGaW5pc2hlZCgpXG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnNvbGUuZGVidWcoXCJVc2VyIGFza2VkIGZvciBtZXNzYWdlcyB1bnNlbmRpbmcgdG8gc3RhcnQ7IFVJIGludGVyYWN0aW9uIHdpbGwgYmUgZGlzYWJsZWQgaW4gdGhlIG1lYW50aW1lXCIpXG5cdFx0XHR0aGlzLiNzdGFydFVuc2VuZGluZygpXG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7RXZlbnR9IGV2ZW50XG5cdCAqIEByZXR1cm5zIHtib29sZWFufVxuXHQgKi9cblx0I29uV2luZG93S2V5RXZlbnQoZXZlbnQpIHtcblx0XHRpZih0aGlzLnN0cmF0ZWd5LmlzUnVubmluZygpKSB7XG5cdFx0XHRjb25zb2xlLmxvZyhcIlVzZXIgaW50ZXJhY3Rpb24gaXMgZGlzYWJsZWQgYXMgdGhlIHVuc2VuZGluZyBpcyBzdGlsbCBydW5uaW5nOyBQbGVhc2Ugc3RvcCB0aGUgZXhlY3V0aW9uIGZpcnN0LlwiKVxuXHRcdFx0ZXZlbnQuc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uKClcblx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KClcblx0XHRcdGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpXG5cdFx0XHR0aGlzLm92ZXJsYXlFbGVtZW50LmZvY3VzKClcblx0XHRcdHJldHVybiBmYWxzZVxuXHRcdH1cblx0fVxuXG5cdCNvblVuc2VuZGluZ0ZpbmlzaGVkKCkge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJyZW5kZXIgb25VbnNlbmRpbmdGaW5pc2hlZFwiKVxuXHRcdDtbLi4udGhpcy5tZW51RWxlbWVudC5xdWVyeVNlbGVjdG9yQWxsKFwiYnV0dG9uXCIpXS5maWx0ZXIoYnV0dG9uID0+IGJ1dHRvbiAhPT0gdGhpcy51bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbikuZm9yRWFjaChidXR0b24gPT4ge1xuXHRcdFx0YnV0dG9uLnN0eWxlLnZpc2liaWxpdHkgPSBcIlwiXG5cdFx0XHRidXR0b24uZGlzYWJsZWQgPSBmYWxzZVxuXHRcdH0pXG5cdFx0dGhpcy51bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbi50ZXh0Q29udGVudCA9IHRoaXMudW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24uZGF0YVRleHRDb250ZW50XG5cdFx0dGhpcy51bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbi5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSB0aGlzLnVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uLmRhdGFCYWNrZ3JvdW5kQ29sb3Jcblx0XHR0aGlzLm92ZXJsYXlFbGVtZW50LnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIlxuXHRcdHRoaXMuc3RhdHVzRWxlbWVudC5zdHlsZS5jb2xvciA9IFwiXCJcblx0XHR0aGlzLl9tdXRhdGlvbk9ic2VydmVyLm9ic2VydmUodGhpcy5fZG9jdW1lbnQuYm9keSwgeyBjaGlsZExpc3Q6IHRydWUgfSkgLy8gVE9ETyB0ZXN0XG5cdH1cblxuXHQvKipcblx0ICogQHJlYWRvbmx5XG5cdCAqIEB0eXBlIHtEb2N1bWVudH1cblx0ICovXG5cdGdldCBkb2N1bWVudCgpIHtcblx0XHRyZXR1cm4gdGhpcy5fZG9jdW1lbnRcblx0fVxuXG5cdC8qKlxuXHQgKiBAcmVhZG9ubHlcblx0ICogQHR5cGUge1dpbmRvd31cblx0ICovXG5cdGdldCB3aW5kb3coKSB7XG5cdFx0cmV0dXJuIHRoaXMuX2RvY3VtZW50LmRlZmF1bHRWaWV3XG5cdH1cblxuXHQvKipcblx0ICogQHJlYWRvbmx5XG5cdCAqIEB0eXBlIHtIVE1MRGl2RWxlbWVudH1cblx0ICovXG5cdGdldCByb290KCkge1xuXHRcdHJldHVybiB0aGlzLl9yb290XG5cdH1cblxuXHQvKipcblx0ICogQHJlYWRvbmx5XG5cdCAqIEB0eXBlIHtIVE1MRGl2RWxlbWVudH1cblx0ICovXG5cdGdldCBvdmVybGF5RWxlbWVudCgpIHtcblx0XHRyZXR1cm4gdGhpcy5fb3ZlcmxheUVsZW1lbnRcblx0fVxuXG5cdC8qKlxuXHQgKiBAcmVhZG9ubHlcblx0ICogQHR5cGUge0hUTUxEaXZFbGVtZW50fVxuXHQgKi9cblx0Z2V0IG1lbnVFbGVtZW50KCkge1xuXHRcdHJldHVybiB0aGlzLl9tZW51RWxlbWVudFxuXHR9XG5cblx0LyoqXG5cdCAqIEByZWFkb25seVxuXHQgKiBAdHlwZSB7SFRNTEJ1dHRvbkVsZW1lbnR9XG5cdCAqL1xuXHRnZXQgdW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24oKSB7XG5cdFx0cmV0dXJuIHRoaXMuX3Vuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uXG5cdH1cblxuXHQvKipcblx0ICogQHJlYWRvbmx5XG5cdCAqIEB0eXBlIHtIVE1MRGl2RWxlbWVudH1cblx0ICovXG5cdGdldCBzdGF0dXNFbGVtZW50KCkge1xuXHRcdHJldHVybiB0aGlzLl9zdGF0dXNFbGVtZW50XG5cdH1cblxuXHQvKipcblx0ICogQHJlYWRvbmx5XG5cdCAqIEB0eXBlIHtVbnNlbmRTdHJhdGVneX1cblx0ICovXG5cdGdldCBzdHJhdGVneSgpIHsgLy8gVE9ETyBtb3ZlIG91dFxuXHRcdHJldHVybiB0aGlzLl9zdHJhdGVneVxuXHR9XG5cblx0LyoqXG5cdCAqIEByZWFkb25seVxuXHQgKiBAdHlwZSB7SURNVX1cblx0ICovXG5cdGdldCBpZG11KCkge1xuXHRcdHJldHVybiB0aGlzLl9pZG11XG5cdH1cblxufVxuXG5leHBvcnQgZGVmYXVsdCBPU0RcbiIsIi8qKiBAbW9kdWxlIG1haW4gTWFpbiBtb2R1bGUgKi9cblxuaW1wb3J0IE9TRCBmcm9tIFwiLi9vc2Qvb3NkLmpzXCJcblxuLyoqXG4gKiBAcGFyYW0ge1dpbmRvd30gd2luZG93XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBtYWluKHdpbmRvdykge1xuXHRPU0QucmVuZGVyKHdpbmRvdylcbn1cblxuaWYodHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIikge1xuXHRtYWluKHdpbmRvdylcbn1cbiJdLCJuYW1lcyI6WyJzdHJpbmdzLkxBQkVMX1BBVFRFUk5TIiwic3RyaW5ncy5VTlNFTkRfVEVYVF9WQVJJQU5UUyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQUFBO0FBQ0E7Q0FDTyxNQUFNLFlBQVksR0FBRztDQUM1QixDQUFDLFNBQVMsRUFBRSxTQUFTO0NBQ3JCLENBQUMsV0FBVyxFQUFFLFdBQVc7Q0FDekIsRUFBQztBQUNEO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNPLFNBQVMsZ0JBQWdCLENBQUMsYUFBYSxFQUFFLFNBQVMsRUFBRTtDQUMzRCxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsUUFBUSxHQUFHLDZCQUE0QjtDQUM1RCxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsS0FBSyxHQUFHLFFBQU87Q0FDcEMsQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxNQUFLO0NBQ25DLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxZQUFZLEdBQUcsTUFBSztDQUN6QyxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsT0FBTyxHQUFHLE1BQUs7Q0FDcEMsQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLFVBQVUsR0FBRyxPQUFNO0NBQ3hDLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxNQUFNLEdBQUcsVUFBUztDQUN2QyxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsVUFBVSxHQUFHLCtCQUE4QjtDQUNoRSxDQUFDLEdBQUcsU0FBUyxFQUFFO0NBQ2YsRUFBRSxhQUFhLENBQUMsS0FBSyxDQUFDLGVBQWUsR0FBRyxDQUFDLGFBQWEsRUFBRSxTQUFTLENBQUMsU0FBUyxFQUFDO0NBQzVFLEVBQUU7Q0FDRjs7Q0N4QkE7QUFDQTtBQUVBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDTyxTQUFTLHVCQUF1QixDQUFDLFFBQVEsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFO0NBQ25FLENBQUMsTUFBTSxhQUFhLEdBQUcsUUFBUSxDQUFDLGFBQWEsQ0FBQyxRQUFRLEVBQUM7Q0FDdkQsQ0FBQyxhQUFhLENBQUMsV0FBVyxHQUFHLEtBQUk7Q0FDakMsQ0FBQyxnQkFBZ0IsQ0FBQyxhQUFhLEVBQUUsU0FBUyxFQUFDO0NBQzNDLENBQUMsYUFBYSxDQUFDLGdCQUFnQixDQUFDLFdBQVcsRUFBRSxNQUFNO0NBQ25ELEVBQUUsYUFBYSxDQUFDLEtBQUssQ0FBQyxNQUFNLEdBQUcsQ0FBQyxnQkFBZ0IsRUFBQztDQUNqRCxFQUFFLEVBQUM7Q0FDSCxDQUFDLGFBQWEsQ0FBQyxnQkFBZ0IsQ0FBQyxVQUFVLEVBQUUsTUFBTTtDQUNsRCxFQUFFLGFBQWEsQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBQztDQUNqQyxFQUFFLEVBQUM7Q0FDSCxDQUFDLE9BQU8sYUFBYTtDQUNyQjs7Q0N0QkE7QUFDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ08sU0FBUyxpQkFBaUIsQ0FBQyxRQUFRLEVBQUU7Q0FDNUMsQ0FBQyxNQUFNLFdBQVcsR0FBRyxRQUFRLENBQUMsYUFBYSxDQUFDLEtBQUssRUFBQztDQUNsRCxDQUFDLFdBQVcsQ0FBQyxFQUFFLEdBQUcsWUFBVztDQUM3QixDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsR0FBRyxHQUFHLE9BQU07Q0FDL0IsQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLEtBQUssR0FBRyxRQUFPO0NBQ2xDLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxRQUFRLEdBQUcsUUFBTztDQUNyQyxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLElBQUc7Q0FDL0IsQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLE9BQU8sR0FBRyxPQUFNO0NBQ25DLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxHQUFHLEdBQUcsT0FBTTtDQUMvQixDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsVUFBVSxHQUFHLFNBQVE7Q0FDeEMsQ0FBQyxPQUFPLFdBQVc7Q0FDbkI7O0NDakJBO0FBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0FBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ08sU0FBUyxjQUFjLENBQUMsTUFBTSxFQUFFLFVBQVUsRUFBRSxlQUFlLEVBQUU7Q0FDcEUsQ0FBQyxPQUFPLElBQUksT0FBTyxDQUFDLENBQUMsT0FBTyxFQUFFLE1BQU0sS0FBSztDQUN6QyxFQUFFLElBQUksaUJBQWdCO0NBQ3RCLEVBQUUsTUFBTSxZQUFZLEdBQUcsTUFBTTtDQUM3QixHQUFHLEdBQUcsZ0JBQWdCLEVBQUU7Q0FDeEIsSUFBSSxnQkFBZ0IsQ0FBQyxVQUFVLEdBQUU7Q0FDakMsSUFBSTtDQUNKLEdBQUcsTUFBTSxDQUFDLElBQUksS0FBSyxDQUFDLENBQUMsd0JBQXdCLEVBQUUsZUFBZSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUM7Q0FDaEYsSUFBRztDQUNILEVBQUUsZUFBZSxDQUFDLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxPQUFPLEVBQUUsWUFBWSxFQUFDO0NBQ2hFLEVBQUUsSUFBSSxPQUFPLEdBQUcsVUFBVSxHQUFFO0NBQzVCLEVBQUUsR0FBRyxPQUFPLEVBQUU7Q0FDZCxHQUFHLE9BQU8sQ0FBQyxPQUFPLEVBQUM7Q0FDbkIsR0FBRyxlQUFlLENBQUMsTUFBTSxDQUFDLG1CQUFtQixDQUFDLE9BQU8sRUFBRSxZQUFZLEVBQUM7Q0FDcEUsR0FBRyxNQUFNO0NBQ1QsR0FBRyxnQkFBZ0IsR0FBRyxJQUFJLGdCQUFnQixDQUFDLENBQUMsU0FBUyxFQUFFLFFBQVEsS0FBSztDQUNwRSxJQUFJLE9BQU8sR0FBRyxVQUFVLENBQUMsU0FBUyxFQUFDO0NBQ25DLElBQUksR0FBRyxPQUFPLEVBQUU7Q0FDaEIsS0FBSyxRQUFRLENBQUMsVUFBVSxHQUFFO0NBQzFCLEtBQUssT0FBTyxDQUFDLE9BQU8sRUFBQztDQUNyQixLQUFLLGVBQWUsQ0FBQyxNQUFNLENBQUMsbUJBQW1CLENBQUMsT0FBTyxFQUFFLFlBQVksRUFBQztDQUN0RSxLQUFLO0NBQ0wsSUFBSSxFQUFDO0NBQ0wsR0FBRyxnQkFBZ0IsQ0FBQyxPQUFPLENBQUMsTUFBTSxFQUFFLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxTQUFTLEVBQUUsSUFBSSxFQUFFLEVBQUM7Q0FDdkUsR0FBRztDQUNILEVBQUUsQ0FBQztDQUNILENBQUM7QUFDRDtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ08sU0FBUyxzQkFBc0IsQ0FBQyxXQUFXLEVBQUUsTUFBTSxFQUFFLFVBQVUsRUFBRSxlQUFlLEVBQUU7Q0FDekYsQ0FBQyxNQUFNLE9BQU8sR0FBRyxjQUFjLENBQUMsTUFBTSxFQUFFLFVBQVUsRUFBRSxlQUFlLEVBQUM7Q0FDcEUsQ0FBQyxXQUFXLENBQUMsS0FBSyxHQUFFO0NBQ3BCLENBQUMsT0FBTyxVQUFVLEVBQUUsSUFBSSxPQUFPO0NBQy9COztDQ3RFQTtBQUNBO0FBRUE7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLE1BQU0sV0FBVyxDQUFDO0NBQ2xCO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLFdBQVcsQ0FBQyxJQUFJLEVBQUUsVUFBVSxDQUFDLEVBQUUsRUFBRTtDQUNsQyxFQUFFLElBQUksQ0FBQyxJQUFJLEdBQUcsS0FBSTtDQUNsQixFQUFFLElBQUksQ0FBQyxVQUFVLEdBQUcsV0FBVTtDQUM5QixFQUFFO0FBQ0Y7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsY0FBYyxDQUFDLE1BQU0sRUFBRSxVQUFVLEVBQUUsZUFBZSxFQUFFO0NBQ3JELEVBQUUsT0FBTyxVQUFVLEVBQUUsSUFBSSxjQUFjLENBQUMsTUFBTSxFQUFFLFVBQVUsRUFBRSxlQUFlLENBQUM7Q0FDNUUsRUFBRTtBQUNGO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsc0JBQXNCLENBQUMsV0FBVyxFQUFFLE1BQU0sRUFBRSxVQUFVLEVBQUUsZUFBZSxFQUFFO0NBQzFFLEVBQUUsT0FBTyxzQkFBc0IsQ0FBQyxXQUFXLEVBQUUsTUFBTSxFQUFFLFVBQVUsRUFBRSxlQUFlLENBQUM7Q0FDakYsRUFBRTtBQUNGO0NBQ0E7O0NDckNBO0NBQ0EsTUFBTSxvQkFBb0IsR0FBRztDQUM3QixDQUFDLFFBQVE7Q0FDVCxDQUFDLGVBQWU7Q0FDaEIsQ0FBQyxTQUFTO0NBQ1YsQ0FBQyxVQUFVO0NBQ1gsQ0FBQyxTQUFTO0NBQ1YsQ0FBQyxjQUFjO0NBQ2YsRUFBQztBQUNEO0FBQ0E7Q0FDQTtDQUNBLE1BQU0sY0FBYyxHQUFHO0NBQ3ZCLENBQUMsOENBQThDO0NBQy9DLENBQUMsOEJBQThCO0NBQy9CLENBQUMsc0JBQXNCO0NBQ3ZCLENBQUMsK0JBQStCO0NBQ2hDLENBQUMseUJBQXlCO0NBQzFCLENBQUMsMEJBQTBCO0NBQzNCLENBQUMseUJBQXlCO0NBQzFCOztDQ3pCQTtBQUNBO0FBSUE7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxTQUFTLGVBQWUsQ0FBQyxNQUFNLEVBQUU7Q0FDakMsQ0FBQyxNQUFNLElBQUksR0FBRyxNQUFNLENBQUMscUJBQXFCLEdBQUU7Q0FDNUMsQ0FBQyxNQUFNLElBQUksR0FBRztDQUNkLEVBQUUsT0FBTyxFQUFFLElBQUk7Q0FDZixFQUFFLFVBQVUsRUFBRSxJQUFJO0NBQ2xCLEVBQUUsT0FBTyxFQUFFLElBQUksQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLEtBQUssR0FBRyxDQUFDO0NBQ2xDLEVBQUUsT0FBTyxFQUFFLElBQUksQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLE1BQU0sR0FBRyxDQUFDO0NBQ25DLEVBQUUsU0FBUyxFQUFFLENBQUM7Q0FDZCxFQUFFLFdBQVcsRUFBRSxPQUFPO0NBQ3RCLEdBQUU7Q0FDRixDQUFDLE1BQU0sQ0FBQyxhQUFhLENBQUMsSUFBSSxZQUFZLENBQUMsY0FBYyxFQUFFLEVBQUUsR0FBRyxJQUFJLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxDQUFDLEVBQUM7Q0FDcEYsQ0FBQyxNQUFNLENBQUMsYUFBYSxDQUFDLElBQUksWUFBWSxDQUFDLGFBQWEsRUFBRSxJQUFJLENBQUMsRUFBQztDQUM1RCxDQUFDLE1BQU0sQ0FBQyxhQUFhLENBQUMsSUFBSSxZQUFZLENBQUMsYUFBYSxFQUFFLElBQUksQ0FBQyxFQUFDO0NBQzVELENBQUMsTUFBTSxDQUFDLGFBQWEsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxZQUFZLEVBQUUsRUFBRSxHQUFHLElBQUksRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBQztDQUNoRixDQUFDLE1BQU0sQ0FBQyxhQUFhLENBQUMsSUFBSSxVQUFVLENBQUMsV0FBVyxFQUFFLElBQUksQ0FBQyxFQUFDO0NBQ3hELENBQUMsTUFBTSxDQUFDLGFBQWEsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxXQUFXLEVBQUUsSUFBSSxDQUFDLEVBQUM7Q0FDeEQsQ0FBQztBQUNEO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLFNBQVMsZ0JBQWdCLENBQUMsTUFBTSxFQUFFO0NBQ2xDLENBQUMsTUFBTSxJQUFJLEdBQUcsTUFBTSxDQUFDLHFCQUFxQixHQUFFO0NBQzVDLENBQUMsTUFBTSxJQUFJLEdBQUc7Q0FDZCxFQUFFLE9BQU8sRUFBRSxJQUFJO0NBQ2YsRUFBRSxVQUFVLEVBQUUsSUFBSTtDQUNsQixFQUFFLE9BQU8sRUFBRSxJQUFJLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxLQUFLLEdBQUcsQ0FBQztDQUNsQyxFQUFFLE9BQU8sRUFBRSxJQUFJLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxNQUFNLEdBQUcsQ0FBQztDQUNuQyxFQUFFLFNBQVMsRUFBRSxDQUFDO0NBQ2QsRUFBRSxXQUFXLEVBQUUsT0FBTztDQUN0QixHQUFFO0NBQ0YsQ0FBQyxNQUFNLENBQUMsYUFBYSxDQUFDLElBQUksWUFBWSxDQUFDLFlBQVksRUFBRSxJQUFJLENBQUMsRUFBQztDQUMzRCxDQUFDLE1BQU0sQ0FBQyxhQUFhLENBQUMsSUFBSSxZQUFZLENBQUMsY0FBYyxFQUFFLEVBQUUsR0FBRyxJQUFJLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxDQUFDLEVBQUM7Q0FDcEYsQ0FBQyxNQUFNLENBQUMsYUFBYSxDQUFDLElBQUksVUFBVSxDQUFDLFVBQVUsRUFBRSxJQUFJLENBQUMsRUFBQztDQUN2RCxDQUFDLE1BQU0sQ0FBQyxhQUFhLENBQUMsSUFBSSxVQUFVLENBQUMsWUFBWSxFQUFFLEVBQUUsR0FBRyxJQUFJLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxDQUFDLEVBQUM7Q0FDaEYsQ0FBQztBQUNEO0NBQ0EsTUFBTSxTQUFTLFNBQVMsV0FBVyxDQUFDO0FBQ3BDO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsQ0FBQyxxQkFBcUIsR0FBRztDQUN6QixFQUFFLE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsY0FBYTtDQUNyQztDQUNBLEVBQUUsTUFBTSxXQUFXLEdBQUcsR0FBRyxDQUFDLGFBQWEsQ0FBQyxlQUFlLEVBQUM7Q0FDeEQsRUFBRSxJQUFJLFdBQVcsRUFBRTtDQUNuQixHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUMseUJBQXlCLEVBQUM7Q0FDM0MsR0FBRyxNQUFNLFFBQVEsR0FBRyxXQUFXLENBQUMsYUFBYSxDQUFDLFFBQVEsRUFBQztDQUN2RCxHQUFHLElBQUksUUFBUSxFQUFFLFFBQVEsQ0FBQyxLQUFLLEdBQUU7Q0FDakMsR0FBRztDQUNIO0NBQ0EsRUFBRSxNQUFNLFVBQVUsR0FBRyxHQUFHLENBQUMsYUFBYSxDQUFDLDZCQUE2QixFQUFDO0NBQ3JFLEVBQUUsSUFBSSxVQUFVLEVBQUU7Q0FDbEIsR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDLGtDQUFrQyxFQUFDO0NBQ3BELEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxhQUFhLENBQUMsU0FBUyxFQUFFLEVBQUUsR0FBRyxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLENBQUMsRUFBQztDQUN6RixHQUFHO0NBQ0gsRUFBRTtBQUNGO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsaUJBQWlCLENBQUMsS0FBSyxFQUFFO0NBQzFCLEVBQUUsS0FBSyxNQUFNLEdBQUcsSUFBSUEsY0FBc0IsRUFBRTtDQUM1QyxHQUFHLE1BQU0sRUFBRSxHQUFHLEtBQUssQ0FBQyxhQUFhLENBQUMsR0FBRyxFQUFDO0NBQ3RDLEdBQUcsSUFBSSxFQUFFLEVBQUU7Q0FDWDtDQUNBLElBQUksTUFBTSxHQUFHLEdBQUcsRUFBRSxDQUFDLE9BQU8sQ0FBQyxlQUFlLENBQUMsSUFBSSxFQUFFLENBQUMsT0FBTyxDQUFDLFFBQVEsRUFBQztDQUNuRSxJQUFJLElBQUksR0FBRyxJQUFJLEtBQUssQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLEVBQUUsT0FBTyxHQUFHO0NBQzlDO0NBQ0EsSUFBSSxJQUFJLEVBQUUsQ0FBQyxPQUFPLEtBQUssUUFBUSxJQUFJLEVBQUUsQ0FBQyxZQUFZLENBQUMsTUFBTSxDQUFDLEtBQUssUUFBUSxFQUFFLE9BQU8sRUFBRTtDQUNsRixJQUFJO0NBQ0osR0FBRztBQUNIO0NBQ0E7Q0FDQSxFQUFFLE9BQU8sS0FBSyxDQUFDLGFBQWEsQ0FBQyxtQ0FBbUMsQ0FBQztDQUNqRSxFQUFFO0FBQ0Y7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsTUFBTSxxQkFBcUIsQ0FBQyxlQUFlLEVBQUU7Q0FDOUMsRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLHlDQUF5QyxFQUFFLElBQUksQ0FBQyxJQUFJLEVBQUM7Q0FDckUsRUFBRSxJQUFJLENBQUMscUJBQXFCLEdBQUU7QUFDOUI7Q0FDQTtDQUNBO0NBQ0EsRUFBRSxNQUFNLFlBQVksR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUM7Q0FDbEMsRUFBRSxNQUFNLGNBQWMsR0FBRyxDQUFDLEVBQUUsRUFBRSxLQUFLLEtBQUs7Q0FDeEMsR0FBRyxJQUFJLEtBQUssR0FBRyxDQUFDLEVBQUUsTUFBTTtDQUN4QixHQUFHLEtBQUssTUFBTSxLQUFLLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtDQUNwQyxJQUFJLFlBQVksQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFDO0NBQzVCLElBQUksY0FBYyxDQUFDLEtBQUssRUFBRSxLQUFLLEdBQUcsQ0FBQyxFQUFDO0NBQ3BDLElBQUk7Q0FDSixJQUFHO0NBQ0gsRUFBRSxjQUFjLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDLEVBQUM7QUFDOUI7Q0FDQTtDQUNBLEVBQUUsS0FBSyxJQUFJLE9BQU8sR0FBRyxDQUFDLEVBQUUsT0FBTyxHQUFHLENBQUMsRUFBRSxPQUFPLEVBQUUsRUFBRTtDQUNoRCxHQUFHLElBQUksZUFBZSxDQUFDLE1BQU0sQ0FBQyxPQUFPLEVBQUUsT0FBTyxJQUFJO0FBQ2xEO0NBQ0EsR0FBRyxLQUFLLE1BQU0sTUFBTSxJQUFJLFlBQVksRUFBRTtDQUN0QyxJQUFJLGVBQWUsQ0FBQyxNQUFNLEVBQUM7Q0FDM0IsSUFBSTtBQUNKO0NBQ0EsR0FBRyxNQUFNLElBQUksT0FBTyxDQUFDLE9BQU8sSUFBSSxVQUFVLENBQUMsT0FBTyxFQUFFLEdBQUcsQ0FBQyxFQUFDO0FBQ3pEO0NBQ0EsR0FBRyxNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsaUJBQWlCLENBQUMsSUFBSSxDQUFDLElBQUksRUFBQztDQUNoRCxHQUFHLElBQUksR0FBRyxFQUFFO0NBQ1osSUFBSSxPQUFPLENBQUMsS0FBSyxDQUFDLGtEQUFrRCxFQUFFLE9BQU8sRUFBRSxHQUFHLEVBQUM7Q0FDbkYsSUFBSSxPQUFPLEdBQUc7Q0FDZCxJQUFJO0FBQ0o7Q0FDQSxHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUMsMkJBQTJCLEVBQUUsT0FBTyxFQUFFLDhCQUE4QixFQUFDO0NBQ3RGLEdBQUcsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLElBQUksRUFBQztDQUM5QixHQUFHLE1BQU0sSUFBSSxPQUFPLENBQUMsT0FBTyxJQUFJLFVBQVUsQ0FBQyxPQUFPLEVBQUUsRUFBRSxDQUFDLEVBQUM7Q0FDeEQsR0FBRztBQUNIO0NBQ0E7Q0FDQSxFQUFFLE1BQU0sbUJBQW1CLEdBQUcsSUFBSSxlQUFlLEdBQUU7Q0FDbkQsRUFBRSxJQUFJLGVBQWM7Q0FDcEIsRUFBRSxNQUFNLFlBQVksR0FBRyxNQUFNO0NBQzdCLEdBQUcsbUJBQW1CLENBQUMsS0FBSyxDQUFDLDhEQUE4RCxFQUFDO0NBQzVGLEdBQUcsWUFBWSxDQUFDLGNBQWMsRUFBQztDQUMvQixJQUFHO0NBQ0gsRUFBRSxlQUFlLENBQUMsTUFBTSxDQUFDLGdCQUFnQixDQUFDLE9BQU8sRUFBRSxZQUFZLEVBQUM7QUFDaEU7Q0FDQSxFQUFFLEtBQUssTUFBTSxNQUFNLElBQUksWUFBWSxFQUFFO0NBQ3JDLEdBQUcsZUFBZSxDQUFDLE1BQU0sRUFBQztDQUMxQixHQUFHO0FBQ0g7Q0FDQSxFQUFFLElBQUk7Q0FDTixHQUFHLE1BQU0sWUFBWSxHQUFHLE1BQU0sT0FBTyxDQUFDLElBQUksQ0FBQztDQUMzQyxJQUFJLElBQUksQ0FBQyxjQUFjO0NBQ3ZCLEtBQUssSUFBSSxDQUFDLElBQUk7Q0FDZCxLQUFLLE1BQU0sSUFBSSxDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUM7Q0FDNUMsS0FBSyxtQkFBbUI7Q0FDeEIsS0FBSztDQUNMLElBQUksSUFBSSxPQUFPLENBQUMsQ0FBQyxPQUFPLEVBQUUsTUFBTSxLQUFLO0NBQ3JDLEtBQUssY0FBYyxHQUFHLFVBQVUsQ0FBQyxNQUFNLE1BQU0sQ0FBQywrQkFBK0IsQ0FBQyxFQUFFLElBQUksRUFBQztDQUNyRixLQUFLLENBQUM7Q0FDTixJQUFJLEVBQUM7QUFDTDtDQUNBLEdBQUcsSUFBSSxZQUFZLEVBQUU7Q0FDckIsSUFBSSxPQUFPLFlBQVk7Q0FDdkIsSUFBSTtDQUNKLEdBQUcsT0FBTyxZQUFZO0NBQ3RCLEdBQUcsU0FBUztDQUNaLEdBQUcsbUJBQW1CLENBQUMsS0FBSyxHQUFFO0NBQzlCLEdBQUcsWUFBWSxDQUFDLGNBQWMsRUFBQztDQUMvQixHQUFHLGVBQWUsQ0FBQyxNQUFNLENBQUMsbUJBQW1CLENBQUMsT0FBTyxFQUFFLFlBQVksRUFBQztDQUNwRSxHQUFHO0NBQ0gsRUFBRTtBQUNGO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLE1BQU0sb0JBQW9CLENBQUMsZUFBZSxFQUFFO0NBQzdDLEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyxzQkFBc0IsRUFBRSxJQUFJLENBQUMsSUFBSSxFQUFDO0NBQ2xELEVBQUUsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLElBQUksRUFBQztBQUM3QjtDQUNBLEVBQUUsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsYUFBYSxFQUFDO0NBQ3ZELEVBQUUsSUFBSSxNQUFNLEVBQUU7Q0FDZCxHQUFHLGdCQUFnQixDQUFDLE1BQU0sRUFBQztDQUMzQixHQUFHO0FBQ0g7Q0FDQSxFQUFFLE1BQU0sbUJBQW1CLEdBQUcsSUFBSSxlQUFlLEdBQUU7Q0FDbkQsRUFBRSxJQUFJLGVBQWM7Q0FDcEIsRUFBRSxJQUFJLGVBQWM7Q0FDcEIsRUFBRSxNQUFNLFlBQVksR0FBRyxNQUFNO0NBQzdCLEdBQUcsbUJBQW1CLENBQUMsS0FBSyxDQUFDLDZEQUE2RCxFQUFDO0NBQzNGLEdBQUcsWUFBWSxDQUFDLGNBQWMsRUFBQztDQUMvQixHQUFHLElBQUksY0FBYyxFQUFFO0NBQ3ZCLElBQUksY0FBYyxHQUFFO0NBQ3BCLElBQUk7Q0FDSixJQUFHO0NBQ0gsRUFBRSxlQUFlLENBQUMsTUFBTSxDQUFDLGdCQUFnQixDQUFDLE9BQU8sRUFBRSxZQUFZLEVBQUM7QUFDaEU7Q0FDQSxFQUFFLElBQUk7Q0FDTixHQUFHLE1BQU0sTUFBTSxHQUFHLE1BQU0sT0FBTyxDQUFDLElBQUksQ0FBQztDQUNyQyxJQUFJLElBQUksQ0FBQyxjQUFjO0NBQ3ZCLEtBQUssSUFBSSxDQUFDLElBQUk7Q0FDZCxLQUFLLE1BQU0sSUFBSSxDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxJQUFJO0NBQ3JELEtBQUssbUJBQW1CO0NBQ3hCLEtBQUs7Q0FDTCxJQUFJLElBQUksT0FBTyxDQUFDLENBQUMsT0FBTyxFQUFFLE1BQU0sS0FBSztDQUNyQyxLQUFLLGNBQWMsR0FBRyxRQUFPO0NBQzdCLEtBQUssY0FBYyxHQUFHLFVBQVUsQ0FBQyxNQUFNLE1BQU0sQ0FBQyw4QkFBOEIsQ0FBQyxFQUFFLEdBQUcsRUFBQztDQUNuRixLQUFLLENBQUM7Q0FDTixJQUFJLEVBQUM7Q0FDTCxHQUFHLE9BQU8sTUFBTTtDQUNoQixHQUFHLFNBQVM7Q0FDWixHQUFHLG1CQUFtQixDQUFDLEtBQUssR0FBRTtDQUM5QixHQUFHLFlBQVksQ0FBQyxjQUFjLEVBQUM7Q0FDL0IsR0FBRyxlQUFlLENBQUMsTUFBTSxDQUFDLG1CQUFtQixDQUFDLE9BQU8sRUFBRSxZQUFZLEVBQUM7Q0FDcEUsR0FBRztDQUNILEVBQUU7QUFDRjtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsQ0FBQyxNQUFNLGVBQWUsQ0FBQyxZQUFZLEVBQUUsZUFBZSxFQUFFO0NBQ3RELEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyxvRkFBb0YsRUFBRSxZQUFZLEVBQUM7Q0FDbkgsRUFBRSxNQUFNLG1CQUFtQixHQUFHLElBQUksZUFBZSxHQUFFO0NBQ25ELEVBQUUsSUFBSSxlQUFjO0NBRXBCLEVBQUUsTUFBTSxZQUFZLEdBQUcsTUFBTTtDQUM3QixHQUFHLG1CQUFtQixDQUFDLEtBQUssQ0FBQyx3REFBd0QsRUFBQztDQUN0RixHQUFHLFlBQVksQ0FBQyxjQUFjLEVBQUM7Q0FJL0IsSUFBRztDQUNILEVBQUUsZUFBZSxDQUFDLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxPQUFPLEVBQUUsWUFBWSxFQUFDO0FBQ2hFO0NBQ0E7Q0FDQSxFQUFFLE1BQU0sWUFBWSxHQUFHLENBQUMsSUFBSSxLQUFLO0NBQ2pDLEdBQUcsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDLGlCQUFpQixHQUFFO0NBQ3JELEdBQUcsT0FBT0Msb0JBQTRCLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxVQUFVLEtBQUssQ0FBQyxDQUFDO0NBQ2xFLElBQUc7QUFDSDtDQUNBLEVBQUUsSUFBSTtDQUNOLEdBQUcsTUFBTSxZQUFZLEdBQUcsTUFBTSxPQUFPLENBQUMsSUFBSSxDQUFDO0NBQzNDLElBQUksSUFBSSxDQUFDLHNCQUFzQjtDQUMvQixLQUFLLFlBQVk7Q0FDakIsS0FBSyxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJO0NBQ2pDLEtBQUssQ0FBQyxTQUFTLEtBQUs7Q0FDcEIsTUFBTSxJQUFJLFNBQVMsRUFBRTtDQUNyQixPQUFPLE1BQU0sVUFBVSxHQUFHLENBQUMsR0FBRyxTQUFTLENBQUMsR0FBRyxDQUFDLFFBQVEsSUFBSSxDQUFDLEdBQUcsUUFBUSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxNQUFNLENBQUMsSUFBSSxJQUFJLElBQUksQ0FBQyxRQUFRLEtBQUssQ0FBQyxFQUFDO0NBQzdILE9BQU8sS0FBSyxNQUFNLFNBQVMsSUFBSSxVQUFVLEVBQUU7Q0FDM0MsUUFBUSxNQUFNLElBQUksR0FBRyxDQUFDLEdBQUcsU0FBUyxDQUFDLGdCQUFnQixDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksSUFBSSxZQUFZLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLElBQUksQ0FBQyxVQUFVLEVBQUUsUUFBUSxLQUFLLENBQUMsRUFBQztDQUNoSixRQUFRLElBQUksSUFBSSxFQUFFO0NBQ2xCLFNBQVMsT0FBTyxDQUFDLEtBQUssQ0FBQyxrREFBa0QsRUFBRSxJQUFJLEVBQUM7Q0FDaEYsU0FBUyxPQUFPLElBQUk7Q0FDcEIsU0FBUztDQUNULFFBQVE7Q0FDUixPQUFPO0NBQ1A7Q0FDQSxNQUFNLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLGdCQUFnQixDQUFDLDhFQUE4RSxFQUFDO0NBQy9JLE1BQU0sS0FBSyxNQUFNLElBQUksSUFBSSxRQUFRLEVBQUU7Q0FDbkMsT0FBTyxJQUFJLFlBQVksQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksSUFBSSxDQUFDLFVBQVUsRUFBRSxRQUFRLEtBQUssQ0FBQyxFQUFFO0NBQzlFLFFBQVEsT0FBTyxDQUFDLEtBQUssQ0FBQyx1REFBdUQsRUFBRSxJQUFJLEVBQUM7Q0FDcEYsUUFBUSxPQUFPLElBQUk7Q0FDbkIsUUFBUTtDQUNSLE9BQU87Q0FDUCxNQUFNO0NBQ04sS0FBSyxtQkFBbUI7Q0FDeEIsS0FBSztDQUNMLElBQUksSUFBSSxPQUFPLENBQUMsQ0FBQyxPQUFPLEVBQUUsTUFBTSxLQUFLO0NBQ3JDLEtBQUssY0FBYyxHQUFHLFVBQVUsQ0FBQyxNQUFNLE1BQU0sQ0FBQyx5QkFBeUIsQ0FBQyxFQUFFLElBQUksRUFBQztDQUMvRSxLQUFLLENBQUM7Q0FDTixJQUFJLEVBQUM7QUFDTDtDQUNBLEdBQUcsT0FBTyxDQUFDLEtBQUssQ0FBQyxzQ0FBc0MsRUFBRSxZQUFZLEVBQUM7Q0FDdEUsR0FBRyxPQUFPLFlBQVk7Q0FDdEIsR0FBRyxTQUFTO0NBQ1osR0FBRyxtQkFBbUIsQ0FBQyxLQUFLLEdBQUU7Q0FDOUIsR0FBRyxZQUFZLENBQUMsY0FBYyxFQUFDO0NBQy9CLEdBQUcsZUFBZSxDQUFDLE1BQU0sQ0FBQyxtQkFBbUIsQ0FBQyxPQUFPLEVBQUUsWUFBWSxFQUFDO0NBQ3BFLEdBQUc7Q0FDSCxFQUFFO0FBQ0Y7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsQ0FBQyxNQUFNLGdCQUFnQixDQUFDLFlBQVksRUFBRSxrQkFBa0IsRUFBRSxlQUFlLEVBQUU7Q0FDM0UsRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLGtCQUFrQixFQUFDO0NBQ25DLEVBQUUsTUFBTSxtQkFBbUIsR0FBRyxJQUFJLGVBQWUsR0FBRTtDQUNuRCxFQUFFLElBQUksZUFBYztDQUVwQixFQUFFLE1BQU0sWUFBWSxHQUFHLE1BQU07Q0FDN0IsR0FBRyxtQkFBbUIsQ0FBQyxLQUFLLENBQUMseURBQXlELEVBQUM7Q0FDdkYsR0FBRyxZQUFZLENBQUMsY0FBYyxFQUFDO0NBSS9CLElBQUc7Q0FDSCxFQUFFLGVBQWUsQ0FBQyxNQUFNLENBQUMsZ0JBQWdCLENBQUMsT0FBTyxFQUFFLFlBQVksRUFBQztBQUNoRTtDQUNBLEVBQUUsSUFBSTtDQUNOLEdBQUcsTUFBTSxNQUFNLEdBQUcsTUFBTSxPQUFPLENBQUMsSUFBSSxDQUFDO0NBQ3JDLElBQUksSUFBSSxDQUFDLHNCQUFzQjtDQUMvQixLQUFLLFlBQVk7Q0FDakIsS0FBSyxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJO0NBQ2pDLEtBQUssTUFBTSxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLGtCQUFrQixDQUFDLEtBQUssS0FBSztDQUM5RSxLQUFLLGVBQWU7Q0FDcEIsS0FBSztDQUNMLElBQUksSUFBSSxPQUFPLENBQUMsQ0FBQyxPQUFPLEVBQUUsTUFBTSxLQUFLO0NBQ3JDLEtBQUssY0FBYyxHQUFHLFVBQVUsQ0FBQyxNQUFNLE1BQU0sQ0FBQywwQkFBMEIsQ0FBQyxFQUFFLEdBQUcsRUFBQztDQUMvRSxLQUFLLENBQUM7Q0FDTixJQUFJLEVBQUM7Q0FDTCxHQUFHLE9BQU8sTUFBTSxLQUFLLElBQUk7Q0FDekIsR0FBRyxTQUFTO0NBQ1osR0FBRyxtQkFBbUIsQ0FBQyxLQUFLLEdBQUU7Q0FDOUIsR0FBRyxZQUFZLENBQUMsY0FBYyxFQUFDO0NBQy9CLEdBQUcsZUFBZSxDQUFDLE1BQU0sQ0FBQyxtQkFBbUIsQ0FBQyxPQUFPLEVBQUUsWUFBWSxFQUFDO0NBQ3BFLEdBQUc7Q0FDSCxFQUFFO0FBQ0Y7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsc0JBQXNCLENBQUMsWUFBWSxFQUFFLGVBQWUsRUFBRTtDQUN2RCxFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMsNkVBQTZFLEVBQUM7Q0FDOUYsRUFBRSxPQUFPLElBQUksQ0FBQyxzQkFBc0I7Q0FDcEMsR0FBRyxZQUFZO0NBQ2YsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJO0NBQy9CLEdBQUcsTUFBTSxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxhQUFhLENBQUMsc0JBQXNCLENBQUM7Q0FDdEUsR0FBRyxlQUFlO0NBQ2xCLEdBQUc7Q0FDSCxFQUFFO0FBQ0Y7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsTUFBTSxhQUFhLENBQUMsWUFBWSxFQUFFLGVBQWUsRUFBRTtDQUNwRCxFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMscUNBQXFDLEVBQUUsWUFBWSxFQUFDO0NBQ3BFLEVBQUUsTUFBTSxJQUFJLENBQUMsc0JBQXNCO0NBQ25DLEdBQUcsWUFBWTtDQUNmLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSTtDQUMvQixHQUFHLE1BQU0sSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsYUFBYSxDQUFDLHNCQUFzQixDQUFDLEtBQUssSUFBSTtDQUMvRSxHQUFHLGVBQWU7Q0FDbEIsSUFBRztDQUNILEVBQUU7QUFDRjtDQUNBOztDQzNXQTtBQUNBO0FBR0E7Q0FDQSxNQUFNLHVCQUF1QixTQUFTLEtBQUssQ0FBQyxFQUFFO0FBQzlDO0NBQ0EsTUFBTSxXQUFXLENBQUM7QUFDbEI7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLFdBQVcsQ0FBQyxTQUFTLEVBQUU7Q0FDeEIsRUFBRSxJQUFJLENBQUMsVUFBVSxHQUFHLFVBQVM7Q0FDN0IsRUFBRTtBQUNGO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLE1BQU0sTUFBTSxDQUFDLGVBQWUsRUFBRTtDQUMvQixFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMsb0JBQW9CLEVBQUM7Q0FDckMsRUFBRSxJQUFJLGFBQVk7Q0FDbEIsRUFBRSxJQUFJLGFBQVk7Q0FDbEIsRUFBRSxJQUFJO0NBQ04sR0FBRyxZQUFZLEdBQUcsTUFBTSxJQUFJLENBQUMsU0FBUyxDQUFDLHFCQUFxQixDQUFDLGVBQWUsRUFBQztDQUM3RSxHQUFHLFlBQVksR0FBRyxNQUFNLElBQUksQ0FBQyxTQUFTLENBQUMsZUFBZSxDQUFDLFlBQVksRUFBRSxlQUFlLEVBQUM7Q0FDckYsR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDLGNBQWMsRUFBRSxZQUFZLEVBQUM7Q0FDOUMsR0FBRyxNQUFNLFlBQVksR0FBRyxNQUFNLElBQUksQ0FBQyxTQUFTLENBQUMsc0JBQXNCLENBQUMsWUFBWSxFQUFFLGVBQWUsRUFBQztDQUNsRyxHQUFHLE1BQU0sSUFBSSxDQUFDLFNBQVMsQ0FBQyxhQUFhLENBQUMsWUFBWSxFQUFFLGVBQWUsRUFBQztDQUNwRSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxrQkFBa0IsRUFBRSxFQUFFLEVBQUM7Q0FDM0QsR0FBRyxPQUFPLElBQUk7Q0FDZCxHQUFHLENBQUMsTUFBTSxFQUFFLEVBQUU7Q0FDZCxHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUMsRUFBRSxFQUFDO0NBQ3BCLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLGtCQUFrQixFQUFFLEVBQUUsRUFBQztDQUMzRDtDQUNBLEdBQUcsSUFBSTtDQUNQLElBQUksTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsY0FBYTtDQUNqRCxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksYUFBYSxDQUFDLFNBQVMsRUFBRSxFQUFFLEdBQUcsRUFBRSxRQUFRLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxDQUFDLEVBQUM7Q0FDMUYsSUFBSSxNQUFNLElBQUksT0FBTyxDQUFDLE9BQU8sSUFBSSxVQUFVLENBQUMsT0FBTyxFQUFFLEdBQUcsQ0FBQyxFQUFDO0NBQzFEO0NBQ0EsSUFBSSxJQUFJLEdBQUcsQ0FBQyxhQUFhLENBQUMsZUFBZSxDQUFDLEVBQUU7Q0FDNUMsS0FBSyxHQUFHLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLGFBQWEsQ0FBQyxTQUFTLEVBQUUsRUFBRSxHQUFHLEVBQUUsUUFBUSxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsQ0FBQyxFQUFDO0NBQzNGLEtBQUssTUFBTSxJQUFJLE9BQU8sQ0FBQyxPQUFPLElBQUksVUFBVSxDQUFDLE9BQU8sRUFBRSxHQUFHLENBQUMsRUFBQztDQUMzRCxLQUFLO0NBQ0wsSUFBSSxDQUFDLE9BQU8sS0FBSyxFQUFFO0NBQ25CLElBQUksT0FBTyxDQUFDLEtBQUssQ0FBQyxLQUFLLEVBQUM7Q0FDeEIsSUFBSTtDQUNKLEdBQUcsTUFBTSxJQUFJLHVCQUF1QixDQUFDLDZDQUE2QyxFQUFFLEVBQUUsQ0FBQztDQUN2RixHQUFHO0NBQ0gsRUFBRTtBQUNGO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsQ0FBQyxJQUFJLFNBQVMsR0FBRztDQUNqQixFQUFFLE9BQU8sSUFBSSxDQUFDLFVBQVU7Q0FDeEIsRUFBRTtBQUNGO0NBQ0E7O0NDdERBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsTUFBTSxFQUFFLFNBQVMsV0FBVyxDQUFDO0FBQzdCO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsT0FBTyxNQUFNLEdBQUc7Q0FDakIsRUFBRTtBQUNGO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLE1BQU0sbUNBQW1DLENBQUMsZUFBZSxFQUFFO0NBQzVELEVBQUU7QUFDRjtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLE1BQU0sa0JBQWtCLEdBQUc7Q0FDNUIsRUFBRTtBQUNGO0NBQ0E7O0NDckNBO0FBQ0E7QUFFQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDTyxTQUFTLG1CQUFtQixDQUFDLE1BQU0sRUFBRTtDQUM1QyxDQUFDLE1BQU0sWUFBWSxHQUFHLE1BQU0sQ0FBQyxRQUFRLENBQUMsYUFBYSxDQUFDLDhCQUE4QixFQUFDO0NBQ25GLENBQUMsSUFBSSxDQUFDLFlBQVksRUFBRTtDQUNwQixFQUFFLE9BQU8sSUFBSTtDQUNiLEVBQUU7Q0FDRixDQUFDLE1BQU0sVUFBVSxHQUFHLG1CQUFtQixDQUFDLFlBQVksRUFBRSxNQUFNLEVBQUM7Q0FDN0QsQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFO0NBQ2xCLEVBQUUsT0FBTyxJQUFJO0NBQ2IsRUFBRTtDQUNGLENBQUMsT0FBTyxVQUFVO0NBQ2xCLENBQUM7QUFDRDtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ08sU0FBUyxtQkFBbUIsQ0FBQyxNQUFNLEVBQUUsTUFBTSxFQUFFO0NBQ3BELENBQUMsS0FBSyxNQUFNLEtBQUssSUFBSSxNQUFNLENBQUMsUUFBUSxFQUFFO0NBQ3RDLEVBQUUsTUFBTSxLQUFLLEdBQUcsTUFBTSxDQUFDLGdCQUFnQixDQUFDLEtBQUssRUFBQztDQUM5QyxFQUFFO0NBQ0YsR0FBRyxDQUFDLEtBQUssQ0FBQyxTQUFTLEtBQUssTUFBTSxJQUFJLEtBQUssQ0FBQyxTQUFTLEtBQUssUUFBUTtDQUM5RCxHQUFHLEtBQUssQ0FBQyxZQUFZLEdBQUcsS0FBSyxDQUFDLFlBQVk7Q0FDMUMsSUFBSTtDQUNKLEdBQUcsT0FBTyxLQUFLO0NBQ2YsR0FBRztDQUNILEVBQUUsTUFBTSxLQUFLLEdBQUcsbUJBQW1CLENBQUMsS0FBSyxFQUFFLE1BQU0sRUFBQztDQUNsRCxFQUFFLElBQUksS0FBSyxFQUFFO0NBQ2IsR0FBRyxPQUFPLEtBQUs7Q0FDZixHQUFHO0NBQ0gsRUFBRTtDQUNGLENBQUMsT0FBTyxJQUFJO0NBQ1osQ0FBQztBQUNEO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDTyxTQUFTLHlCQUF5QixDQUFDLFVBQVUsRUFBRTtDQUN0RDtDQUNBO0NBQ0E7Q0FDQSxDQUFDLElBQUksSUFBSSxHQUFHLFdBQVU7Q0FDdEIsQ0FBQyxJQUFJLFNBQVMsR0FBRyxVQUFVLENBQUMsUUFBUSxDQUFDLE9BQU07QUFDM0M7Q0FDQSxDQUFDLFNBQVMsTUFBTSxDQUFDLEVBQUUsRUFBRSxLQUFLLEVBQUU7Q0FDNUIsRUFBRSxJQUFJLEtBQUssR0FBRyxDQUFDLEVBQUUsTUFBTTtDQUN2QixFQUFFLEtBQUssTUFBTSxLQUFLLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtDQUNuQyxHQUFHLElBQUksS0FBSyxDQUFDLFFBQVEsQ0FBQyxNQUFNLEdBQUcsU0FBUyxFQUFFO0NBQzFDLElBQUksSUFBSSxHQUFHLE1BQUs7Q0FDaEIsSUFBSSxTQUFTLEdBQUcsS0FBSyxDQUFDLFFBQVEsQ0FBQyxPQUFNO0NBQ3JDLElBQUk7Q0FDSixHQUFHLE1BQU0sQ0FBQyxLQUFLLEVBQUUsS0FBSyxHQUFHLENBQUMsRUFBQztDQUMzQixHQUFHO0NBQ0gsRUFBRTtBQUNGO0NBQ0EsQ0FBQyxNQUFNLENBQUMsVUFBVSxFQUFFLENBQUMsRUFBQztDQUN0QixDQUFDLE9BQU8sSUFBSTtDQUNaLENBQUM7QUFDRDtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDTyxTQUFTLG1CQUFtQixDQUFDLE9BQU8sRUFBRSxNQUFNLEVBQUU7Q0FDckQ7Q0FDQTtDQUNBO0NBQ0EsQ0FBQyxNQUFNLEtBQUssR0FBRyxDQUFDLEVBQUUsRUFBRSxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsQ0FBQyxFQUFFLEVBQUM7Q0FDMUMsQ0FBQyxPQUFPLEtBQUssQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO0NBQzFCLEVBQUUsTUFBTSxFQUFFLEVBQUUsRUFBRSxLQUFLLEVBQUUsR0FBRyxLQUFLLENBQUMsS0FBSyxHQUFFO0NBQ3JDLEVBQUUsTUFBTSxDQUFDLEdBQUcsTUFBTSxDQUFDLGdCQUFnQixDQUFDLEVBQUUsRUFBQztDQUN2QyxFQUFFLElBQUksQ0FBQyxDQUFDLGNBQWMsS0FBSyxVQUFVLEVBQUU7Q0FDdkMsR0FBRyxPQUFPLElBQUk7Q0FDZCxHQUFHO0NBQ0gsRUFBRSxJQUFJLEtBQUssR0FBRyxDQUFDLEVBQUU7Q0FDakIsR0FBRyxLQUFLLE1BQU0sS0FBSyxJQUFJLEVBQUUsQ0FBQyxRQUFRLEVBQUU7Q0FDcEMsSUFBSSxLQUFLLENBQUMsSUFBSSxDQUFDLEVBQUUsRUFBRSxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsS0FBSyxHQUFHLENBQUMsRUFBRSxFQUFDO0NBQy9DLElBQUk7Q0FDSixHQUFHO0NBQ0gsRUFBRTtDQUNGLENBQUMsT0FBTyxLQUFLO0NBQ2IsQ0FBQztBQUNEO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNPLFNBQVMsc0JBQXNCLENBQUMsSUFBSSxFQUFFLGVBQWUsRUFBRSxNQUFNLEVBQUU7Q0FDdEUsQ0FBQyxNQUFNLGNBQWMsR0FBRyx5QkFBeUIsQ0FBQyxJQUFJLEVBQUM7Q0FDdkQsQ0FBQyxJQUFJLENBQUMsY0FBYyxFQUFFO0NBQ3RCLEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyxrREFBa0QsRUFBQztDQUNuRSxFQUFFLE1BQU07Q0FDUixFQUFFO0FBQ0Y7Q0FDQSxDQUFDLE1BQU0sUUFBUSxHQUFHLENBQUMsR0FBRyxjQUFjLENBQUMsUUFBUSxDQUFDO0NBQzlDLEdBQUcsTUFBTSxDQUFDLENBQUMsSUFBSTtDQUNmLEdBQUcsSUFBSSxDQUFDLENBQUMsWUFBWSxDQUFDLGtCQUFrQixDQUFDLEVBQUUsT0FBTyxLQUFLO0NBQ3ZELEdBQUcsSUFBSSxDQUFDLENBQUMsWUFBWSxDQUFDLGtCQUFrQixDQUFDLEVBQUUsT0FBTyxLQUFLO0NBQ3ZEO0NBQ0EsR0FBRyxNQUFNLGlCQUFpQixHQUFHLENBQUMsQ0FBQyxhQUFhLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFDLGFBQWEsQ0FBQyxxQkFBcUIsRUFBQztDQUNyRyxHQUFHLElBQUksQ0FBQyxpQkFBaUIsRUFBRSxPQUFPLEtBQUs7Q0FDdkMsR0FBRyxPQUFPLG1CQUFtQixDQUFDLENBQUMsRUFBRSxNQUFNLENBQUM7Q0FDeEMsR0FBRyxFQUFDO0FBQ0o7Q0FDQSxDQUFDLFFBQVEsQ0FBQyxPQUFPLEdBQUU7Q0FDbkIsQ0FBQyxHQUFHLFFBQVEsQ0FBQyxNQUFNLElBQUksQ0FBQyxFQUFFO0NBQzFCLEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyx3QkFBd0IsRUFBRSxRQUFRLENBQUMsTUFBTSxFQUFFLG9CQUFvQixFQUFDO0NBQ2hGLEVBQUUsTUFBTTtDQUNSLEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyxxREFBcUQsRUFBQztDQUN0RSxFQUFFO0FBQ0Y7Q0FDQSxDQUFDLEtBQUssTUFBTSxPQUFPLElBQUksUUFBUSxFQUFFO0NBQ2pDLEVBQUUsSUFBSSxlQUFlLENBQUMsTUFBTSxDQUFDLE9BQU8sRUFBRTtDQUN0QyxHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUMsdUVBQXVFLEVBQUM7Q0FDekYsR0FBRyxLQUFLO0NBQ1IsR0FBRztDQUNILEVBQUUsTUFBTSxlQUFlLEdBQUcsT0FBTyxDQUFDLGVBQWUsQ0FBQztDQUNsRCxHQUFHLGtCQUFrQixFQUFFLElBQUk7Q0FDM0IsR0FBRyxxQkFBcUIsRUFBRSxJQUFJO0NBQzlCLEdBQUcsZUFBZSxFQUFFLElBQUk7Q0FDeEIsR0FBRyxFQUFDO0NBQ0osRUFBRSxJQUFJLGVBQWUsS0FBSyxLQUFLLEVBQUU7Q0FDakMsR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDLGlCQUFpQixFQUFFLGVBQWUsRUFBQztDQUNwRCxHQUFHLFFBQVE7Q0FDWCxHQUFHO0NBQ0gsRUFBRSxNQUFNLElBQUksR0FBRyxPQUFPLENBQUMscUJBQXFCLEdBQUU7Q0FDOUM7Q0FDQTtDQUNBO0NBQ0EsRUFBRSxJQUFJLElBQUksQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLE1BQU0sR0FBRyxDQUFDLElBQUksSUFBSSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7Q0FDckQsR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDLGlCQUFpQixFQUFFLElBQUksQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLE1BQU0sRUFBQztDQUN4RCxHQUFHLFFBQVE7Q0FDWCxHQUFHO0NBQ0gsRUFBRSxPQUFPLENBQUMsWUFBWSxDQUFDLGtCQUFrQixFQUFFLEVBQUUsRUFBQztDQUM5QyxFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMsc0NBQXNDLEVBQUUsT0FBTyxFQUFDO0NBQ2hFLEVBQUUsT0FBTyxPQUFPO0NBQ2hCLEVBQUU7Q0FDRixDQUFDO0FBQ0Q7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDTyxlQUFlLGdCQUFnQixDQUFDLElBQUksRUFBRSxlQUFlLEVBQUU7Q0FDOUQsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLHlDQUF5QyxFQUFDO0NBQ3pELENBQUMsTUFBTSxxQkFBcUIsR0FBRyxJQUFJLGVBQWUsR0FBRTtDQUNwRCxDQUFDLElBQUksa0JBQWlCO0NBQ3RCLENBQUMsSUFBSSxlQUFjO0NBQ25CLENBQUMsTUFBTSxZQUFZLEdBQUcsTUFBTTtDQUM1QixFQUFFLHFCQUFxQixDQUFDLEtBQUssQ0FBQywwQkFBMEIsRUFBQztDQUN6RCxFQUFFLFlBQVksQ0FBQyxpQkFBaUIsRUFBQztDQUNqQyxFQUFFLElBQUksY0FBYyxFQUFFO0NBQ3RCLEdBQUcsY0FBYyxHQUFFO0NBQ25CLEdBQUc7Q0FDSCxHQUFFO0NBQ0YsQ0FBQyxlQUFlLENBQUMsTUFBTSxDQUFDLGdCQUFnQixDQUFDLE9BQU8sRUFBRSxZQUFZLEVBQUM7QUFDL0Q7Q0FDQTtDQUNBLENBQUMsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQyxXQUFXLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxFQUFDO0NBQ3BFLENBQUMsTUFBTSxVQUFVLEdBQUcsS0FBSyxDQUFDLGFBQWEsS0FBSyxpQkFBZ0I7Q0FDNUQ7Q0FDQSxDQUFDLE1BQU0sZ0JBQWdCLEdBQUcsVUFBVTtDQUNwQyxJQUFJLEVBQUUsSUFBSSxDQUFDLFlBQVksR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDO0NBQzVDLElBQUksRUFBQztDQUNMO0NBQ0EsQ0FBQyxNQUFNLE9BQU8sR0FBRyxNQUFNLFVBQVU7Q0FDakMsSUFBSSxJQUFJLENBQUMsU0FBUyxJQUFJLGdCQUFnQixHQUFHLENBQUM7Q0FDMUMsSUFBSSxJQUFJLENBQUMsU0FBUyxLQUFLLEVBQUM7QUFDeEI7Q0FDQSxDQUFDLE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxVQUFTO0NBQ3BDLENBQUMsTUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLGFBQVk7Q0FDdkMsQ0FBQyxJQUFJLENBQUMsU0FBUyxHQUFHLGlCQUFnQjtBQUNsQztDQUNBO0NBQ0EsQ0FBQyxNQUFNLGlCQUFpQixHQUFHLE1BQU07Q0FDakMsRUFBRSxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsb0JBQW9CLEVBQUM7Q0FDMUQsRUFBRSxLQUFLLE1BQU0sR0FBRyxJQUFJLElBQUksRUFBRTtDQUMxQixHQUFHLE1BQU0sSUFBSSxHQUFHLEdBQUcsQ0FBQyxxQkFBcUIsR0FBRTtDQUMzQyxHQUFHLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxxQkFBcUIsR0FBRTtDQUNoRDtDQUNBLEdBQUcsSUFBSSxJQUFJLENBQUMsTUFBTSxHQUFHLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxJQUFJLFFBQVEsQ0FBQyxDQUFDLEdBQUcsR0FBRyxJQUFJLElBQUksQ0FBQyxDQUFDLElBQUksUUFBUSxDQUFDLENBQUMsR0FBRyxRQUFRLENBQUMsTUFBTSxHQUFHLEdBQUcsRUFBRTtDQUN0RyxJQUFJLE9BQU8sR0FBRztDQUNkLElBQUk7Q0FDSixHQUFHO0NBQ0gsRUFBRSxPQUFPLElBQUk7Q0FDYixHQUFFO0FBQ0Y7Q0FDQTtDQUNBLENBQUMsTUFBTSxjQUFjLEdBQUcsVUFBVTtDQUNsQyxJQUFJLFlBQVksS0FBSyxDQUFDLElBQUksSUFBSSxDQUFDLFlBQVksSUFBSSxJQUFJLENBQUMsWUFBWSxHQUFHLEVBQUU7Q0FDckUsSUFBSSxZQUFZLEtBQUssQ0FBQyxJQUFJLElBQUksQ0FBQyxZQUFZLElBQUksSUFBSSxDQUFDLFlBQVksR0FBRyxHQUFFO0NBQ3JFLENBQUMsSUFBSSxjQUFjLEVBQUU7Q0FDckIsRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLDBEQUEwRCxFQUFDO0NBQzNFLEVBQUUsZUFBZSxDQUFDLE1BQU0sQ0FBQyxtQkFBbUIsQ0FBQyxPQUFPLEVBQUUsWUFBWSxFQUFDO0NBQ25FLEVBQUUsT0FBTyxJQUFJO0NBQ2IsRUFBRTtBQUNGO0NBQ0E7Q0FDQSxDQUFDLElBQUksT0FBTyxFQUFFLEVBQUU7Q0FDaEI7Q0FDQSxFQUFFLE1BQU0sSUFBSSxPQUFPLENBQUMsT0FBTyxJQUFJLFVBQVUsQ0FBQyxPQUFPLEVBQUUsR0FBRyxDQUFDLEVBQUM7QUFDeEQ7Q0FDQTtDQUNBLEVBQUUsTUFBTSxNQUFNLEdBQUcsaUJBQWlCLEdBQUU7Q0FDcEMsRUFBRSxJQUFJLE1BQU0sRUFBRTtDQUNkLEdBQUcsT0FBTyxDQUFDLEtBQUssQ0FBQyxtRkFBbUYsRUFBQztDQUNyRyxHQUFHLE1BQU0sT0FBTyxDQUFDLElBQUksQ0FBQztDQUN0QixJQUFJLGNBQWMsQ0FBQyxJQUFJLEVBQUUsTUFBTSxpQkFBaUIsRUFBRSxLQUFLLElBQUksRUFBRSxlQUFlLENBQUM7Q0FDN0UsSUFBSSxJQUFJLE9BQU8sQ0FBQyxPQUFPLElBQUksVUFBVSxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsQ0FBQztDQUNyRCxJQUFJLEVBQUM7Q0FDTCxHQUFHLGVBQWUsQ0FBQyxNQUFNLENBQUMsbUJBQW1CLENBQUMsT0FBTyxFQUFFLFlBQVksRUFBQztDQUNwRSxHQUFHLE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxZQUFZLEdBQUcsYUFBWTtDQUNoRCxHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyw2Q0FBNkMsRUFBRSxJQUFJLEdBQUcsTUFBTSxHQUFHLGNBQWMsQ0FBQyxDQUFDLEVBQUM7Q0FDbEcsR0FBRyxPQUFPLENBQUMsSUFBSTtDQUNmLEdBQUc7QUFDSDtDQUNBO0NBQ0EsRUFBRSxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsWUFBWSxHQUFHLGFBQVk7Q0FDL0MsRUFBRSxJQUFJLENBQUMsSUFBSSxFQUFFO0NBQ2IsR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDLHlFQUF5RSxFQUFDO0NBQzNGLEdBQUcsZUFBZSxDQUFDLE1BQU0sQ0FBQyxtQkFBbUIsQ0FBQyxPQUFPLEVBQUUsWUFBWSxFQUFDO0NBQ3BFLEdBQUcsT0FBTyxJQUFJO0NBQ2QsR0FBRztDQUNILEVBQUU7QUFDRjtDQUNBO0NBQ0EsQ0FBQyxJQUFJLGVBQWM7Q0FDbkIsQ0FBQyxJQUFJO0NBQ0wsRUFBRSxjQUFjLEdBQUcsTUFBTSxPQUFPLENBQUMsSUFBSSxDQUFDO0NBQ3RDLEdBQUcsY0FBYyxDQUFDLElBQUksRUFBRSxNQUFNO0NBQzlCLElBQUksSUFBSSxpQkFBaUIsRUFBRSxLQUFLLElBQUksRUFBRTtDQUN0QyxLQUFLLElBQUksQ0FBQyxTQUFTLEdBQUcsaUJBQWdCO0NBQ3RDLEtBQUs7Q0FDTCxJQUFJLE9BQU8saUJBQWlCLEVBQUU7Q0FDOUIsSUFBSSxFQUFFLHFCQUFxQixDQUFDO0NBQzVCLEdBQUcsSUFBSSxPQUFPLENBQUMsT0FBTyxJQUFJO0NBQzFCLElBQUksY0FBYyxHQUFHLFFBQU87Q0FDNUIsSUFBSSxpQkFBaUIsR0FBRyxVQUFVLENBQUMsTUFBTTtDQUN6QyxLQUFLLE9BQU8sR0FBRTtDQUNkLEtBQUssRUFBRSxJQUFJLEVBQUM7Q0FDWixJQUFJLENBQUM7Q0FDTCxHQUFHLEVBQUM7Q0FDSixFQUFFLENBQUMsT0FBTyxFQUFFLEVBQUU7Q0FDZCxFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMsRUFBRSxFQUFDO0NBQ25CLEVBQUU7Q0FDRixDQUFDLHFCQUFxQixDQUFDLEtBQUssQ0FBQyxpREFBaUQsRUFBQztDQUMvRSxDQUFDLGVBQWUsQ0FBQyxNQUFNLENBQUMsbUJBQW1CLENBQUMsT0FBTyxFQUFFLFlBQVksRUFBQztDQUNsRSxDQUFDLFlBQVksQ0FBQyxpQkFBaUIsRUFBQztDQUNoQyxDQUFDLElBQUksY0FBYyxJQUFJLGNBQWMsS0FBSyxJQUFJLEVBQUU7Q0FDaEQsRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLHVFQUF1RSxFQUFDO0NBQ3hGLEVBQUUsTUFBTSxPQUFPLENBQUMsSUFBSSxDQUFDO0NBQ3JCLEdBQUcsY0FBYyxDQUFDLElBQUksRUFBRSxNQUFNLGlCQUFpQixFQUFFLEtBQUssSUFBSSxFQUFFLGVBQWUsQ0FBQztDQUM1RSxHQUFHLElBQUksT0FBTyxDQUFDLE9BQU8sSUFBSSxVQUFVLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxDQUFDO0NBQ3BELEdBQUcsRUFBQztDQUNKLEVBQUU7Q0FDRixDQUFDLE1BQU0sS0FBSyxHQUFHLE9BQU8sR0FBRTtDQUN4QixDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQywrQkFBK0IsRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsRUFBRSxLQUFLLEdBQUcsbUJBQW1CLEdBQUcsZUFBZSxDQUFDLENBQUMsRUFBQztDQUNySCxDQUFDLE9BQU8sS0FBSztDQUNiOztDQ3BTQTtBQUNBO0FBR0E7Q0FDQSxNQUFNLGlCQUFpQixTQUFTLFdBQVcsQ0FBQztBQUM1QztDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsQ0FBQyxtQ0FBbUMsQ0FBQyxlQUFlLEVBQUU7Q0FDdEQsRUFBRSxPQUFPLGdCQUFnQixDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsZUFBZSxDQUFDO0NBQ3JELEVBQUU7QUFDRjtDQUNBOztDQ2ZBO0FBQ0E7QUFNQTtDQUNBLE1BQU0sU0FBUyxTQUFTLEVBQUUsQ0FBQztBQUMzQjtDQUNBLENBQUMsV0FBVyxDQUFDLElBQUksRUFBRSxVQUFVLEdBQUcsRUFBRSxFQUFFO0NBQ3BDLEVBQUUsS0FBSyxDQUFDLElBQUksRUFBRSxVQUFVLEVBQUM7Q0FDekIsRUFBRSxJQUFJLENBQUMsYUFBYSxHQUFHLEtBQUk7Q0FDM0IsRUFBRTtBQUNGO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLE9BQU8sTUFBTSxDQUFDLE1BQU0sRUFBRTtDQUN2QixFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMsK0NBQStDLEVBQUM7Q0FDaEUsRUFBRSxNQUFNLHNCQUFzQixHQUFHLG1CQUFtQixDQUFDLE1BQU0sRUFBQztDQUM1RCxFQUFFLElBQUksc0JBQXNCLEtBQUssSUFBSSxFQUFFO0NBQ3ZDLEdBQUcsT0FBTyxDQUFDLEtBQUssQ0FBQyw4QkFBOEIsRUFBRSxzQkFBc0IsRUFBQztDQUN4RSxHQUFHLE1BQU0saUJBQWlCLEdBQUcsSUFBSSxpQkFBaUIsQ0FBQyxzQkFBc0IsRUFBQztDQUMxRSxHQUFHLE9BQU8sSUFBSSxTQUFTLENBQUMsTUFBTSxFQUFFLEVBQUUsaUJBQWlCLEVBQUUsQ0FBQztDQUN0RCxHQUFHLE1BQU07Q0FDVCxHQUFHLE1BQU0sSUFBSSxLQUFLLENBQUMsaUZBQWlGLENBQUM7Q0FDckcsR0FBRztDQUNILEVBQUU7QUFDRjtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsQ0FBQyxNQUFNLG1DQUFtQyxDQUFDLGVBQWUsRUFBRTtDQUM1RCxFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMsd0NBQXdDLEVBQUM7Q0FDekQsRUFBRSxPQUFPLE1BQU0sSUFBSSxDQUFDLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyxtQ0FBbUMsQ0FBQyxlQUFlLENBQUM7Q0FDckcsRUFBRTtBQUNGO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLE1BQU0sa0JBQWtCLENBQUMsZUFBZSxFQUFFO0NBQzNDLEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyx1QkFBdUIsRUFBRSxJQUFJLENBQUMsYUFBYSxFQUFDO0NBQzVELEVBQUUsTUFBTSxxQkFBcUIsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLGlCQUFpQixDQUFDLEtBQUk7QUFDdEU7Q0FDQTtDQUNBLEVBQUUsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxnQkFBZ0I7Q0FDMUMsS0FBSyxJQUFJLENBQUMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLHFCQUFxQixDQUFDO0NBQ3RELEtBQUsscUJBQXFCLENBQUMsYUFBYSxDQUFDLFdBQVcsQ0FBQyxnQkFBZ0IsQ0FBQyxxQkFBcUIsRUFBQztDQUM1RixFQUFFLE1BQU0sVUFBVSxHQUFHLEtBQUssQ0FBQyxhQUFhLEtBQUssaUJBQWdCO0FBQzdEO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsRUFBRSxJQUFJO0NBQ04sR0FBRyxNQUFNLGNBQWMsR0FBRyxzQkFBc0IsQ0FBQyxxQkFBcUIsRUFBRSxlQUFlLEVBQUUsSUFBSSxDQUFDLElBQUksRUFBQztDQUNuRyxHQUFHLElBQUksY0FBYyxFQUFFO0NBQ3ZCLElBQUksT0FBTyxDQUFDLEtBQUssQ0FBQyxxREFBcUQsRUFBQztDQUN4RSxJQUFJLE1BQU0sU0FBUyxHQUFHLElBQUksU0FBUyxDQUFDLGNBQWMsRUFBQztDQUNuRCxJQUFJLE9BQU8sSUFBSSxXQUFXLENBQUMsU0FBUyxDQUFDO0NBQ3JDLElBQUk7Q0FDSixHQUFHLENBQUMsT0FBTyxFQUFFLEVBQUU7Q0FDZixHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUMsRUFBRSxFQUFDO0NBQ3BCLEdBQUc7QUFDSDtDQUNBO0NBQ0EsRUFBRSxLQUFLLElBQUksSUFBSSxHQUFHLENBQUMsRUFBRSxJQUFJLEdBQUcsQ0FBQyxFQUFFLElBQUksRUFBRSxFQUFFO0NBQ3ZDLEdBQUcsSUFBSSxlQUFlLENBQUMsTUFBTSxDQUFDLE9BQU8sRUFBRTtDQUN2QyxJQUFJLE9BQU8sQ0FBQyxLQUFLLENBQUMsdURBQXVELEVBQUM7Q0FDMUUsSUFBSSxPQUFPLEtBQUs7Q0FDaEIsSUFBSTtBQUNKO0NBQ0EsR0FBRyxJQUFJLFVBQVUsRUFBRTtDQUNuQjtDQUNBLElBQUksTUFBTSxTQUFTLEdBQUcsRUFBRSxxQkFBcUIsQ0FBQyxZQUFZLEdBQUcscUJBQXFCLENBQUMsWUFBWSxFQUFDO0NBQ2hHLElBQUksTUFBTSxRQUFRLEdBQUcsQ0FBQyxJQUFJLEtBQUssQ0FBQyxJQUFJLElBQUksQ0FBQyxhQUFhLEtBQUssSUFBSTtDQUMvRCxPQUFPLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLGFBQWEsRUFBRSxTQUFTLENBQUM7Q0FDOUMsT0FBTyxFQUFDO0FBQ1I7Q0FDQTtDQUNBLElBQUksTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUM7Q0FDMUMsSUFBSSxNQUFNLElBQUksR0FBRyxVQUFVLEdBQUcsR0FBRyxHQUFHLEVBQUUsR0FBRyxJQUFHO0FBQzVDO0NBQ0EsSUFBSSxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsbUNBQW1DLEVBQUUsSUFBSSxDQUFDLFdBQVcsRUFBRSxRQUFRLENBQUMsWUFBWSxFQUFFLFNBQVMsQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLENBQUMsRUFBQztBQUMzSDtDQUNBLElBQUksS0FBSyxJQUFJLENBQUMsR0FBRyxRQUFRLEVBQUUsQ0FBQyxJQUFJLFNBQVMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtDQUN6RCxLQUFLLElBQUksZUFBZSxDQUFDLE1BQU0sQ0FBQyxPQUFPLEVBQUU7Q0FDekMsTUFBTSxPQUFPLENBQUMsS0FBSyxDQUFDLHVEQUF1RCxFQUFDO0NBQzVFLE1BQU0sT0FBTyxLQUFLO0NBQ2xCLE1BQU07Q0FDTixLQUFLLElBQUksQ0FBQyxhQUFhLEdBQUcsRUFBQztDQUMzQixLQUFLLHFCQUFxQixDQUFDLFNBQVMsR0FBRyxFQUFDO0NBQ3hDLEtBQUsscUJBQXFCLENBQUMsYUFBYSxDQUFDLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLEVBQUM7Q0FDdkUsS0FBSyxNQUFNLElBQUksT0FBTyxDQUFDLE9BQU8sSUFBSSxVQUFVLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQyxFQUFDO0NBQ3pELEtBQUssSUFBSTtDQUNULE1BQU0sTUFBTSxjQUFjLEdBQUcsc0JBQXNCLENBQUMscUJBQXFCLEVBQUUsZUFBZSxFQUFFLElBQUksQ0FBQyxJQUFJLEVBQUM7Q0FDdEcsTUFBTSxJQUFJLGNBQWMsRUFBRTtDQUMxQixPQUFPLE1BQU0sU0FBUyxHQUFHLElBQUksU0FBUyxDQUFDLGNBQWMsRUFBQztDQUN0RCxPQUFPLE9BQU8sSUFBSSxXQUFXLENBQUMsU0FBUyxDQUFDO0NBQ3hDLE9BQU87Q0FDUCxNQUFNLENBQUMsT0FBTyxFQUFFLEVBQUU7Q0FDbEIsTUFBTSxPQUFPLENBQUMsS0FBSyxDQUFDLEVBQUUsRUFBQztDQUN2QixNQUFNO0NBQ04sS0FBSztDQUNMLElBQUksTUFBTTtDQUNWO0NBQ0EsSUFBSSxNQUFNLFNBQVMsR0FBRyxxQkFBcUIsQ0FBQyxZQUFZLEdBQUcscUJBQXFCLENBQUMsYUFBWTtDQUM3RixJQUFJLE1BQU0sY0FBYyxHQUFHLENBQUMsSUFBSSxLQUFLLENBQUMsSUFBSSxJQUFJLENBQUMsYUFBYSxLQUFLLElBQUk7Q0FDckUsT0FBTyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUUsU0FBUyxDQUFDO0NBQzlDLE9BQU8sVUFBUztBQUNoQjtDQUNBO0NBQ0EsSUFBSSxNQUFNLElBQUksR0FBRyxTQUFTLEdBQUcsR0FBRyxHQUFHLEVBQUUsR0FBRyxJQUFHO0FBQzNDO0NBQ0EsSUFBSSxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsd0JBQXdCLEVBQUUsSUFBSSxDQUFDLGlCQUFpQixFQUFFLGNBQWMsQ0FBQyxZQUFZLEVBQUUsU0FBUyxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsQ0FBQyxFQUFDO0FBQzVIO0NBQ0EsSUFBSSxLQUFLLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLGNBQWMsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7Q0FDbkUsS0FBSyxJQUFJLGVBQWUsQ0FBQyxNQUFNLENBQUMsT0FBTyxFQUFFO0NBQ3pDLE1BQU0sT0FBTyxDQUFDLEtBQUssQ0FBQyx1REFBdUQsRUFBQztDQUM1RSxNQUFNLE9BQU8sS0FBSztDQUNsQixNQUFNO0NBQ04sS0FBSyxJQUFJLENBQUMsYUFBYSxHQUFHLEVBQUM7Q0FDM0IsS0FBSyxxQkFBcUIsQ0FBQyxTQUFTLEdBQUcsRUFBQztDQUN4QyxLQUFLLHFCQUFxQixDQUFDLGFBQWEsQ0FBQyxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxFQUFDO0NBQ3ZFLEtBQUssTUFBTSxJQUFJLE9BQU8sQ0FBQyxPQUFPLElBQUksVUFBVSxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUMsRUFBQztDQUN6RCxLQUFLLElBQUk7Q0FDVCxNQUFNLE1BQU0sY0FBYyxHQUFHLHNCQUFzQixDQUFDLHFCQUFxQixFQUFFLGVBQWUsRUFBRSxJQUFJLENBQUMsSUFBSSxFQUFDO0NBQ3RHLE1BQU0sSUFBSSxjQUFjLEVBQUU7Q0FDMUIsT0FBTyxNQUFNLFNBQVMsR0FBRyxJQUFJLFNBQVMsQ0FBQyxjQUFjLEVBQUM7Q0FDdEQsT0FBTyxPQUFPLElBQUksV0FBVyxDQUFDLFNBQVMsQ0FBQztDQUN4QyxPQUFPO0NBQ1AsTUFBTSxDQUFDLE9BQU8sRUFBRSxFQUFFO0NBQ2xCLE1BQU0sT0FBTyxDQUFDLEtBQUssQ0FBQyxFQUFFLEVBQUM7Q0FDdkIsTUFBTTtDQUNOLEtBQUs7Q0FDTCxJQUFJO0FBQ0o7Q0FDQTtDQUNBO0NBQ0EsR0FBRyxJQUFJLENBQUMsYUFBYSxHQUFHLEtBQUk7Q0FDNUIsR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMseUJBQXlCLEVBQUUsSUFBSSxDQUFDLHdCQUF3QixDQUFDLEVBQUM7Q0FDNUUsR0FBRztBQUNIO0NBQ0EsRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLDREQUE0RCxFQUFDO0NBQzdFLEVBQUUsT0FBTyxLQUFLO0NBQ2QsRUFBRTtBQUNGO0NBQ0E7O0NDL0pBO0NBQ0E7Q0FDQTtDQUNBO0FBQ0E7QUFJQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ2UsU0FBUyxLQUFLLEdBQUc7Q0FDaEMsQ0FBQyxPQUFPLFNBQVM7Q0FDakI7O0NDZkE7QUFDQTtBQU9BO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsTUFBTSxJQUFJLENBQUM7QUFDWDtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsQ0FBQyxXQUFXLENBQUMsRUFBRSxFQUFFO0NBQ2pCLEVBQUUsSUFBSSxDQUFDLEdBQUcsR0FBRyxHQUFFO0NBQ2YsRUFBRTtBQUNGO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsT0FBTyxNQUFNLENBQUMsTUFBTSxFQUFFO0NBQ3ZCLEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyxhQUFhLEVBQUM7Q0FDOUIsRUFBRSxNQUFNLEVBQUUsR0FBRyxLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFDO0NBQ25DLEVBQUUsT0FBTyxJQUFJLElBQUksQ0FBQyxFQUFFLENBQUM7Q0FDckIsRUFBRTtBQUNGO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLG1DQUFtQyxDQUFDLGVBQWUsRUFBRTtDQUN0RCxFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMsMENBQTBDLEVBQUM7Q0FDM0QsRUFBRSxPQUFPLElBQUksQ0FBQyxFQUFFLENBQUMsbUNBQW1DLENBQUMsZUFBZSxDQUFDO0NBQ3JFLEVBQUU7QUFDRjtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsQ0FBQyxrQkFBa0IsQ0FBQyxlQUFlLEVBQUU7Q0FDckMsRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLHlCQUF5QixFQUFDO0NBQzFDLEVBQUUsT0FBTyxJQUFJLENBQUMsRUFBRSxDQUFDLGtCQUFrQixDQUFDLGVBQWUsQ0FBQztDQUNwRCxFQUFFO0FBQ0Y7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsSUFBSSxFQUFFLEdBQUc7Q0FDVixFQUFFLE9BQU8sSUFBSSxDQUFDLEdBQUc7Q0FDakIsRUFBRTtBQUNGO0NBQ0E7O0NDM0RBO0FBQ0E7QUFJQTtDQUNBLE1BQU0sSUFBSSxDQUFDO0FBQ1g7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsQ0FBQyxXQUFXLENBQUMsTUFBTSxFQUFFLFlBQVksRUFBRTtDQUNuQyxFQUFFLElBQUksQ0FBQyxNQUFNLEdBQUcsT0FBTTtDQUN0QixFQUFFLElBQUksQ0FBQyxJQUFJLEdBQUcsS0FBSTtDQUNsQixFQUFFLElBQUksQ0FBQyxZQUFZLEdBQUcsYUFBWTtDQUNsQyxFQUFFO0FBQ0Y7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsa0JBQWtCLENBQUMsZUFBZSxFQUFFO0NBQ3JDLEVBQUUsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLGtCQUFrQixDQUFDLGVBQWUsQ0FBQztDQUN0RCxFQUFFO0FBQ0Y7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsYUFBYSxDQUFDLElBQUksRUFBRTtDQUNyQixFQUFFLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxFQUFDO0NBQ3pCLEVBQUU7QUFDRjtBQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsbUNBQW1DLENBQUMsZUFBZSxFQUFFO0NBQ3RELEVBQUUsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLG1DQUFtQyxDQUFDLGVBQWUsQ0FBQztDQUN2RSxFQUFFO0FBQ0Y7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLFFBQVEsR0FBRztDQUNaLEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyxVQUFVLEVBQUM7Q0FDM0IsRUFBRSxJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBQztDQUN0QyxFQUFFO0FBQ0Y7QUFDQTtDQUNBOztDQ3REQTtBQUNBO0FBR0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLE1BQU0sY0FBYyxDQUFDO0FBQ3JCO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLFdBQVcsQ0FBQyxJQUFJLEVBQUU7Q0FDbkIsRUFBRSxJQUFJLENBQUMsS0FBSyxHQUFHLEtBQUk7Q0FDbkIsRUFBRTtBQUNGO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsU0FBUyxHQUFHO0NBQ2IsRUFBRTtBQUNGO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLElBQUksR0FBRztDQUNSLEVBQUU7QUFDRjtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsQ0FBQyxLQUFLLEdBQUc7Q0FDVCxFQUFFO0FBQ0Y7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsTUFBTSxHQUFHLEdBQUc7Q0FDYixFQUFFO0FBQ0Y7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsSUFBSSxJQUFJLEdBQUc7Q0FDWixFQUFFLE9BQU8sSUFBSSxDQUFDLEtBQUs7Q0FDbkIsRUFBRTtBQUNGO0NBQ0E7O0NDeERBO0FBQ0E7QUFJQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsTUFBTSxlQUFlLFNBQVMsY0FBYyxDQUFDO0FBQzdDO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsQ0FBQyxXQUFXLENBQUMsSUFBSSxFQUFFO0NBQ25CLEVBQUUsS0FBSyxDQUFDLElBQUksRUFBQztDQUNiLEVBQUUsSUFBSSxDQUFDLGVBQWUsR0FBRyxNQUFLO0NBQzlCLEVBQUUsSUFBSSxDQUFDLFlBQVksR0FBRyxFQUFDO0NBQ3ZCLEVBQUUsSUFBSSxDQUFDLGlCQUFpQixHQUFHLEVBQUM7Q0FDNUIsRUFBRSxJQUFJLENBQUMsUUFBUSxHQUFHLE1BQUs7Q0FDdkIsRUFBRSxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsS0FBSTtDQUM5QixFQUFFLElBQUksQ0FBQyxlQUFlLEdBQUcsS0FBSTtDQUM3QixFQUFFLElBQUksQ0FBQyxvQkFBb0IsR0FBRyxFQUFDO0NBQy9CLEVBQUU7QUFDRjtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsU0FBUyxHQUFHO0NBQ2IsRUFBRSxPQUFPLElBQUksQ0FBQyxRQUFRLElBQUksSUFBSSxDQUFDLGdCQUFnQixJQUFJLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxNQUFNLENBQUMsT0FBTyxLQUFLLEtBQUs7Q0FDakcsRUFBRTtBQUNGO0NBQ0EsQ0FBQyxJQUFJLEdBQUc7Q0FDUixFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMsc0JBQXNCLEVBQUM7Q0FDdkMsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxhQUFhLEVBQUM7Q0FDeEMsRUFBRSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLHlCQUF5QixFQUFDO0NBQ3hELEVBQUU7QUFDRjtDQUNBLENBQUMsS0FBSyxHQUFHO0NBQ1QsRUFBRSxJQUFJLENBQUMsZUFBZSxHQUFHLE1BQUs7Q0FDOUIsRUFBRSxJQUFJLENBQUMsWUFBWSxHQUFHLEVBQUM7Q0FDdkIsRUFBRSxJQUFJLENBQUMsZUFBZSxHQUFHLEtBQUk7Q0FDN0IsRUFBRSxJQUFJLENBQUMsaUJBQWlCLEdBQUcsRUFBQztDQUM1QixFQUFFLElBQUksQ0FBQyxvQkFBb0IsR0FBRyxFQUFDO0NBQy9CLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsT0FBTyxFQUFDO0NBQ2xDLEVBQUU7QUFDRjtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsTUFBTSxHQUFHLEdBQUc7Q0FDYixFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMsdUJBQXVCLEVBQUM7Q0FDeEMsRUFBRSxJQUFJLENBQUMsWUFBWSxHQUFHLEVBQUM7Q0FDdkIsRUFBRSxJQUFJLENBQUMsaUJBQWlCLEdBQUcsRUFBQztDQUM1QixFQUFFLElBQUksQ0FBQyxvQkFBb0IsR0FBRyxFQUFDO0NBQy9CLEVBQUUsSUFBSSxDQUFDLFFBQVEsR0FBRyxLQUFJO0NBQ3RCLEVBQUUsSUFBSSxDQUFDLGdCQUFnQixHQUFHLElBQUksZUFBZSxHQUFFO0NBQy9DO0NBQ0EsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsZ0JBQWdCLENBQUMsb0JBQW9CLENBQUMsQ0FBQyxPQUFPLENBQUMsRUFBRSxJQUFJO0NBQ2pGLEdBQUcsRUFBRSxDQUFDLGVBQWUsQ0FBQyxrQkFBa0IsRUFBQztDQUN6QyxHQUFHLEVBQUM7Q0FDSixFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxHQUFFO0NBQ3RCLEVBQUUsSUFBSTtDQUNOLEdBQUcsSUFBSSxJQUFJLENBQUMsZUFBZSxFQUFFO0NBQzdCLElBQUksTUFBTSxJQUFJLENBQUMsa0JBQWtCLEdBQUU7Q0FDbkMsSUFBSSxNQUFNO0NBQ1YsSUFBSSxNQUFNLElBQUksQ0FBQyxhQUFhLEdBQUU7Q0FDOUIsSUFBSTtBQUNKO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsR0FBRyxJQUFJLElBQUksQ0FBQyxZQUFZLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLE1BQU0sQ0FBQyxPQUFPLEVBQUU7Q0FDekUsSUFBSSxLQUFLLElBQUksS0FBSyxHQUFHLENBQUMsRUFBRSxLQUFLLElBQUksQ0FBQyxFQUFFLEtBQUssRUFBRSxFQUFFO0NBQzdDLEtBQUssSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxnQ0FBZ0MsRUFBRSxLQUFLLENBQUMsTUFBTSxDQUFDLEVBQUM7Q0FDOUUsS0FBSyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMseUNBQXlDLEVBQUUsS0FBSyxDQUFDLEVBQUUsQ0FBQyxFQUFDO0NBQ3pFLEtBQUssTUFBTSxJQUFJLE9BQU8sQ0FBQyxPQUFPLElBQUksVUFBVSxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsRUFBQztDQUM1RCxLQUFLLElBQUksSUFBSSxDQUFDLGdCQUFnQixDQUFDLE1BQU0sQ0FBQyxPQUFPLEVBQUUsS0FBSztDQUNwRDtDQUNBLEtBQUssSUFBSSxDQUFDLGVBQWUsR0FBRyxNQUFLO0NBQ2pDLEtBQUssSUFBSSxDQUFDLG9CQUFvQixHQUFHLEVBQUM7Q0FDbEMsS0FBSyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsZ0JBQWdCLENBQUMsb0JBQW9CLENBQUMsQ0FBQyxPQUFPLENBQUMsRUFBRSxJQUFJO0NBQ3BGLE1BQU0sRUFBRSxDQUFDLGVBQWUsQ0FBQyxrQkFBa0IsRUFBQztDQUM1QyxNQUFNLEVBQUM7Q0FDUCxLQUFLLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxHQUFFO0NBQ3pCLEtBQUssTUFBTSxJQUFJLENBQUMsYUFBYSxHQUFFO0NBQy9CLEtBQUssSUFBSSxJQUFJLENBQUMsWUFBWSxHQUFHLENBQUMsSUFBSSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsTUFBTSxDQUFDLE9BQU8sRUFBRSxLQUFLO0NBQzdFLEtBQUs7Q0FDTCxJQUFJO0FBQ0o7Q0FDQSxHQUFHLElBQUksSUFBSSxDQUFDLGdCQUFnQixDQUFDLE1BQU0sQ0FBQyxPQUFPLEVBQUU7Q0FDN0MsSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsWUFBWSxDQUFDLG1CQUFtQixDQUFDLEVBQUM7Q0FDL0UsSUFBSSxPQUFPLENBQUMsS0FBSyxDQUFDLHlCQUF5QixFQUFDO0NBQzVDLElBQUksTUFBTTtDQUNWLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLFlBQVksQ0FBQyxtQkFBbUIsQ0FBQyxFQUFDO0NBQzVFLElBQUksT0FBTyxDQUFDLEtBQUssQ0FBQyxzQkFBc0IsRUFBQztDQUN6QyxJQUFJO0NBQ0osR0FBRyxDQUFDLE9BQU8sRUFBRSxFQUFFO0NBQ2YsR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDLEVBQUUsRUFBQztDQUNwQixHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxZQUFZLENBQUMsbUJBQW1CLENBQUMsRUFBQztDQUM5RSxHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUMseUJBQXlCLEVBQUM7Q0FDM0MsR0FBRztDQUNILEVBQUUsSUFBSSxDQUFDLFFBQVEsR0FBRyxNQUFLO0NBQ3ZCLEVBQUU7QUFDRjtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsQ0FBQyxNQUFNLGFBQWEsR0FBRztDQUN2QixFQUFFLElBQUksSUFBSSxDQUFDLGdCQUFnQixDQUFDLE1BQU0sQ0FBQyxPQUFPLEVBQUU7Q0FDNUMsR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDLGtFQUFrRSxFQUFDO0NBQ3BGLEdBQUcsTUFBTTtDQUNULEdBQUc7Q0FDSCxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLHNCQUFzQixFQUFDO0NBQ2pELEVBQUUsSUFBSTtDQUNOLEdBQUcsTUFBTSxJQUFJLEdBQUcsTUFBTSxJQUFJLENBQUMsSUFBSSxDQUFDLG1DQUFtQyxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsRUFBQztDQUMxRixHQUFHLElBQUksSUFBSSxDQUFDLGdCQUFnQixDQUFDLE1BQU0sQ0FBQyxPQUFPLEtBQUssS0FBSyxFQUFFO0NBQ3ZELElBQUksSUFBSSxJQUFJLEVBQUU7Q0FDZCxLQUFLLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsa0JBQWtCLEVBQUUsSUFBSSxDQUFDLGlCQUFpQixDQUFDLHdCQUF3QixDQUFDLEVBQUM7Q0FDbkcsS0FBSyxJQUFJLENBQUMsZUFBZSxHQUFHLEtBQUk7Q0FDaEMsS0FBSyxNQUFNLElBQUksQ0FBQyxrQkFBa0IsR0FBRTtDQUNwQyxLQUFLLE1BQU07Q0FDWCxLQUFLLElBQUksQ0FBQyxpQkFBaUIsR0FBRTtDQUM3QixLQUFLLE1BQU0sSUFBSSxDQUFDLGFBQWEsR0FBRTtDQUMvQixLQUFLO0NBQ0wsSUFBSSxNQUFNO0NBQ1YsSUFBSSxPQUFPLENBQUMsS0FBSyxDQUFDLGtFQUFrRSxFQUFDO0NBQ3JGLElBQUk7Q0FDSixHQUFHLENBQUMsT0FBTyxFQUFFLEVBQUU7Q0FDZixHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUMsRUFBRSxFQUFDO0NBQ3BCLEdBQUc7Q0FDSCxFQUFFO0FBQ0Y7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsTUFBTSxrQkFBa0IsR0FBRztDQUM1QixFQUFFLElBQUksSUFBSSxDQUFDLGdCQUFnQixDQUFDLE1BQU0sQ0FBQyxPQUFPLEVBQUU7Q0FDNUMsR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDLHVFQUF1RSxFQUFDO0NBQ3pGLEdBQUcsTUFBTTtDQUNULEdBQUc7Q0FDSCxFQUFFLElBQUksSUFBSSxDQUFDLG9CQUFvQixJQUFJLENBQUMsRUFBRTtDQUN0QyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyx1QkFBdUIsRUFBRSxJQUFJLENBQUMsWUFBWSxDQUFDLG1CQUFtQixDQUFDLEVBQUM7Q0FDakksR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDLHNEQUFzRCxFQUFDO0NBQ3hFLEdBQUcsTUFBTTtDQUNULEdBQUc7Q0FDSCxFQUFFLElBQUksU0FBUyxHQUFHLEtBQUk7Q0FDdEIsRUFBRSxJQUFJLFVBQVUsR0FBRyxLQUFJO0NBQ3ZCLEVBQUUsSUFBSTtDQUNOLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyw0QkFBNEIsRUFBRSxJQUFJLENBQUMsWUFBWSxDQUFDLGVBQWUsQ0FBQyxFQUFDO0NBQzdGLEdBQUcsTUFBTSxXQUFXLEdBQUcsTUFBTSxJQUFJLENBQUMsSUFBSSxDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FBQyxnQkFBZ0IsRUFBQztDQUNoRixHQUFHLFNBQVMsR0FBRyxXQUFXLEtBQUssTUFBSztDQUNwQyxHQUFHLElBQUksV0FBVyxFQUFFO0NBQ3BCLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxzQkFBc0IsRUFBRSxJQUFJLENBQUMsWUFBWSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBQztBQUM5RTtDQUNBO0NBQ0EsSUFBSSxJQUFJLElBQUksQ0FBQyxlQUFlLEtBQUssSUFBSSxFQUFFO0NBQ3ZDLEtBQUssTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLEdBQUcsRUFBRSxHQUFHLElBQUksQ0FBQyxlQUFlLENBQUMsT0FBTyxHQUFFO0NBQ2hFLEtBQUssTUFBTSxRQUFRLEdBQUcsSUFBSSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxHQUFHLElBQUksRUFBQztDQUM3RCxLQUFLLElBQUksT0FBTyxHQUFHLFFBQVEsRUFBRTtDQUM3QixNQUFNLE1BQU0sTUFBTSxHQUFHLFFBQVEsR0FBRyxRQUFPO0NBQ3ZDLE1BQU0sSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxNQUFNLEdBQUcsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLFlBQVksQ0FBQyxlQUFlLENBQUMsRUFBQztDQUMvRyxNQUFNLE1BQU0sSUFBSSxPQUFPLENBQUMsT0FBTyxJQUFJLFVBQVUsQ0FBQyxPQUFPLEVBQUUsTUFBTSxDQUFDLEVBQUM7Q0FDL0QsTUFBTTtDQUNOLEtBQUs7QUFDTDtDQUNBLElBQUksSUFBSSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsTUFBTSxDQUFDLE9BQU8sRUFBRSxNQUFNO0FBQ3BEO0NBQ0EsSUFBSSxVQUFVLEdBQUcsV0FBVyxDQUFDLFNBQVMsQ0FBQyxLQUFJO0NBQzNDLElBQUksTUFBTSxNQUFNLEdBQUcsTUFBTSxXQUFXLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsRUFBQztBQUNsRTtDQUNBLElBQUksSUFBSSxNQUFNLEVBQUU7Q0FDaEI7Q0FDQSxLQUFLLE1BQU0sSUFBSSxPQUFPLENBQUMsT0FBTyxJQUFJLFVBQVUsQ0FBQyxPQUFPLEVBQUUsR0FBRyxDQUFDLEVBQUM7Q0FDM0QsS0FBSyxNQUFNLFVBQVUsR0FBRyxVQUFVLENBQUMsV0FBVyxJQUFJLENBQUMsVUFBVSxDQUFDLFlBQVksQ0FBQyxrQkFBa0IsRUFBQztDQUM5RixLQUFLLElBQUksVUFBVSxFQUFFO0NBQ3JCO0NBQ0EsTUFBTSxPQUFPLENBQUMsS0FBSyxDQUFDLHlFQUF5RSxFQUFDO0NBQzlGLE1BQU0sVUFBVSxDQUFDLGVBQWUsQ0FBQyxrQkFBa0IsRUFBQztDQUNwRCxNQUFNLElBQUksQ0FBQyxvQkFBb0IsR0FBRTtDQUNqQyxNQUFNLE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxFQUFFLElBQUksR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsb0JBQW9CLEdBQUcsQ0FBQyxDQUFDLEVBQUM7Q0FDMUYsTUFBTSxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDLGlDQUFpQyxFQUFFLENBQUMsU0FBUyxHQUFHLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxZQUFZLENBQUMsUUFBUSxDQUFDLEVBQUM7Q0FDcEksTUFBTSxNQUFNLElBQUksT0FBTyxDQUFDLE9BQU8sSUFBSSxVQUFVLENBQUMsT0FBTyxFQUFFLFNBQVMsQ0FBQyxFQUFDO0NBQ2xFLE1BQU0sTUFBTTtDQUNaLE1BQU0sSUFBSSxDQUFDLGVBQWUsR0FBRyxJQUFJLElBQUksR0FBRTtDQUN2QyxNQUFNLElBQUksQ0FBQyxZQUFZLEdBQUU7Q0FDekIsTUFBTSxJQUFJLENBQUMsb0JBQW9CLEdBQUcsRUFBQztDQUNuQztDQUNBLE1BQU0sSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLEVBQUU7Q0FDL0MsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsYUFBYSxHQUFHLEtBQUk7Q0FDN0MsT0FBTztDQUNQLE1BQU07Q0FDTixLQUFLLE1BQU07Q0FDWDtDQUNBLEtBQUssT0FBTyxDQUFDLEtBQUssQ0FBQywwRUFBMEUsRUFBQztDQUM5RixLQUFLLFVBQVUsQ0FBQyxlQUFlLENBQUMsa0JBQWtCLEVBQUM7Q0FDbkQsS0FBSyxJQUFJLENBQUMsb0JBQW9CLEdBQUU7Q0FDaEMsS0FBSztDQUNMLElBQUk7Q0FDSixHQUFHLENBQUMsT0FBTyxFQUFFLEVBQUU7Q0FDZixHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUMsRUFBRSxFQUFDO0NBQ3BCO0NBQ0EsR0FBRyxJQUFJLFVBQVUsRUFBRTtDQUNuQixJQUFJLFVBQVUsQ0FBQyxlQUFlLENBQUMsa0JBQWtCLEVBQUM7Q0FDbEQsSUFBSTtDQUNKLEdBQUcsSUFBSSxDQUFDLG9CQUFvQixHQUFFO0NBQzlCLEdBQUcsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUUsSUFBSSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxvQkFBb0IsR0FBRyxDQUFDLENBQUMsRUFBQztDQUN2RixHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsaUJBQWlCLEVBQUUsSUFBSSxDQUFDLG9CQUFvQixDQUFDLGlCQUFpQixFQUFFLENBQUMsU0FBUyxHQUFHLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxZQUFZLENBQUMsUUFBUSxDQUFDLEVBQUM7Q0FDOUosR0FBRyxNQUFNLElBQUksT0FBTyxDQUFDLE9BQU8sSUFBSSxVQUFVLENBQUMsT0FBTyxFQUFFLFNBQVMsQ0FBQyxFQUFDO0NBQy9ELEdBQUcsU0FBUztDQUNaLEdBQUcsSUFBSSxTQUFTLElBQUksSUFBSSxDQUFDLGdCQUFnQixJQUFJLENBQUMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLE1BQU0sQ0FBQyxPQUFPLEVBQUU7Q0FDcEYsSUFBSSxNQUFNLElBQUksQ0FBQyxrQkFBa0IsR0FBRTtDQUNuQyxJQUFJO0NBQ0osR0FBRztDQUNILEVBQUU7QUFDRjtDQUNBOztDQzNOQTtBQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNPLFNBQVMsMEJBQTBCLENBQUMsUUFBUSxFQUFFO0NBQ3JELENBQUMsTUFBTSxvQkFBb0IsR0FBRyxRQUFRLENBQUMsYUFBYSxDQUFDLEtBQUssRUFBQztDQUMzRCxDQUFDLG9CQUFvQixDQUFDLEVBQUUsR0FBRyxjQUFhO0NBQ3hDLENBQUMsb0JBQW9CLENBQUMsS0FBSyxDQUFDLFFBQVEsR0FBRyxRQUFPO0NBQzlDLENBQUMsb0JBQW9CLENBQUMsS0FBSyxDQUFDLEdBQUcsR0FBRyxPQUFNO0NBQ3hDLENBQUMsb0JBQW9CLENBQUMsS0FBSyxDQUFDLEtBQUssR0FBRyxPQUFNO0NBQzFDLENBQUMsb0JBQW9CLENBQUMsS0FBSyxDQUFDLE9BQU8sR0FBRyxPQUFNO0NBQzVDLENBQUMsT0FBTyxvQkFBb0I7Q0FDNUI7O0NDZkE7QUFDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ08sU0FBUyxvQkFBb0IsQ0FBQyxRQUFRLEVBQUU7Q0FDL0MsQ0FBQyxNQUFNLGNBQWMsR0FBRyxRQUFRLENBQUMsYUFBYSxDQUFDLEtBQUssRUFBQztDQUNyRCxDQUFDLGNBQWMsQ0FBQyxFQUFFLEdBQUcsZUFBYztDQUNuQyxDQUFDLGNBQWMsQ0FBQyxRQUFRLEdBQUcsRUFBQztDQUM1QixDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsR0FBRyxHQUFHLElBQUc7Q0FDL0IsQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLEtBQUssR0FBRyxJQUFHO0NBQ2pDLENBQUMsY0FBYyxDQUFDLEtBQUssQ0FBQyxRQUFRLEdBQUcsUUFBTztDQUN4QyxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsS0FBSyxHQUFHLFFBQU87Q0FDckMsQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxRQUFPO0NBQ3RDLENBQUMsY0FBYyxDQUFDLEtBQUssQ0FBQyxNQUFNLEdBQUcsTUFBSztDQUNwQyxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsZUFBZSxHQUFHLFlBQVc7Q0FDbkQsQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLE9BQU8sR0FBRyxPQUFNO0NBQ3RDLENBQUMsT0FBTyxjQUFjO0NBQ3RCOztDQ25CQTtDQUNBO0NBQ0E7QUFDQTtBQVVBO0NBQ0EsTUFBTSxHQUFHLENBQUM7Q0FDVjtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLFdBQVcsQ0FBQyxRQUFRLEVBQUUsSUFBSSxFQUFFLGNBQWMsRUFBRSxXQUFXLEVBQUUsMEJBQTBCLEVBQUUsYUFBYSxFQUFFO0NBQ3JHLEVBQUUsSUFBSSxDQUFDLFNBQVMsR0FBRyxTQUFRO0NBQzNCLEVBQUUsSUFBSSxDQUFDLEtBQUssR0FBRyxLQUFJO0NBQ25CLEVBQUUsSUFBSSxDQUFDLGVBQWUsR0FBRyxlQUFjO0NBQ3ZDLEVBQUUsSUFBSSxDQUFDLFlBQVksR0FBRyxZQUFXO0NBQ2pDLEVBQUUsSUFBSSxDQUFDLGNBQWMsR0FBRyxjQUFhO0NBQ3JDLEVBQUUsSUFBSSxDQUFDLDJCQUEyQixHQUFHLDJCQUEwQjtDQUMvRCxFQUFFLElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBQztDQUNsRSxFQUFFLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxlQUFlLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBQztDQUNsRCxFQUFFO0FBQ0Y7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsQ0FBQyxPQUFPLE1BQU0sQ0FBQyxNQUFNLEVBQUU7Q0FDdkIsRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLFFBQVEsRUFBQztDQUN6QixFQUFFLE1BQU0sRUFBRSxHQUFHLEdBQUcsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLFFBQVEsRUFBQztDQUN4QyxFQUFFLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxFQUFFLENBQUMsSUFBSSxFQUFDO0NBQzNDLEVBQUUsT0FBTyxFQUFFO0NBQ1gsRUFBRTtBQUNGO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsT0FBTyxNQUFNLENBQUMsUUFBUSxFQUFFO0NBQ3pCLEVBQUUsTUFBTSxJQUFJLEdBQUcsUUFBUSxDQUFDLGFBQWEsQ0FBQyxLQUFLLEVBQUM7Q0FDNUMsRUFBRSxJQUFJLENBQUMsRUFBRSxHQUFHLFlBQVc7Q0FDdkIsRUFBRSxNQUFNLFdBQVcsR0FBRyxpQkFBaUIsQ0FBQyxRQUFRLEVBQUM7Q0FDakQsRUFBRSxNQUFNLGNBQWMsR0FBRyxvQkFBb0IsQ0FBQyxRQUFRLEVBQUM7Q0FDdkQsRUFBRSxNQUFNLG9CQUFvQixHQUFHLDBCQUEwQixDQUFDLFFBQVEsRUFBQztDQUNuRSxFQUFFLE1BQU0sMEJBQTBCLEdBQUcsdUJBQXVCLENBQUMsUUFBUSxFQUFFLGdCQUFnQixFQUFFLFlBQVksQ0FBQyxPQUFPLEVBQUM7Q0FDOUcsRUFBRSxNQUFNLGFBQWEsR0FBRyxRQUFRLENBQUMsYUFBYSxDQUFDLEtBQUssRUFBQztDQUNyRCxFQUFFLGFBQWEsQ0FBQyxXQUFXLEdBQUcsUUFBTztDQUNyQyxFQUFFLGFBQWEsQ0FBQyxFQUFFLEdBQUcsY0FBYTtDQUNsQyxFQUFFLGFBQWEsQ0FBQyxLQUFLLEdBQUcsZUFBYztDQUN0QyxFQUFFLFFBQVEsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLGNBQWMsRUFBQztDQUMzQyxFQUFFLFFBQVEsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLG9CQUFvQixFQUFDO0NBQ2pELEVBQUUsV0FBVyxDQUFDLFdBQVcsQ0FBQywwQkFBMEIsRUFBQztDQUNyRCxFQUFFLFdBQVcsQ0FBQyxXQUFXLENBQUMsYUFBYSxFQUFDO0NBQ3hDLEVBQUUsSUFBSSxDQUFDLFdBQVcsQ0FBQyxXQUFXLEVBQUM7Q0FDL0IsRUFBRSxNQUFNLEVBQUUsR0FBRyxJQUFJLEdBQUcsQ0FBQyxRQUFRLEVBQUUsSUFBSSxFQUFFLGNBQWMsRUFBRSxXQUFXLEVBQUUsMEJBQTBCLEVBQUUsYUFBYSxFQUFDO0NBQzVHLEVBQUUsUUFBUSxDQUFDLGdCQUFnQixDQUFDLFNBQVMsRUFBRSxDQUFDLEtBQUssS0FBSyxFQUFFLENBQUMsaUJBQWlCLENBQUMsS0FBSyxDQUFDLEVBQUM7Q0FDOUUsRUFBRSxRQUFRLENBQUMsZ0JBQWdCLENBQUMsT0FBTyxFQUFFLENBQUMsS0FBSyxLQUFLLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxLQUFLLENBQUMsRUFBQztDQUM1RSxFQUFFLDBCQUEwQixDQUFDLGdCQUFnQixDQUFDLE9BQU8sRUFBRSxDQUFDLEtBQUssS0FBSyxFQUFFLENBQUMsa0NBQWtDLENBQUMsS0FBSyxDQUFDLEVBQUM7Q0FDL0csRUFBRSxFQUFFLENBQUMsaUJBQWlCLEdBQUcsSUFBSSxnQkFBZ0IsQ0FBQyxDQUFDLFNBQVMsS0FBSyxFQUFFLENBQUMsWUFBWSxDQUFDLEVBQUUsRUFBRSxTQUFTLENBQUMsRUFBQztDQUM1RixFQUFFLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsRUFBQztDQUNsRSxFQUFFLDBCQUEwQixDQUFDLGVBQWUsR0FBRywwQkFBMEIsQ0FBQyxZQUFXO0NBQ3JGLEVBQUUsMEJBQTBCLENBQUMsbUJBQW1CLEdBQUcsMEJBQTBCLENBQUMsS0FBSyxDQUFDLGdCQUFlO0NBQ25HLEVBQUUsT0FBTyxFQUFFO0NBQ1gsRUFBRTtBQUNGO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLFlBQVksQ0FBQyxJQUFJLEVBQUU7Q0FDcEIsRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLFdBQVcsR0FBRyxLQUFJO0NBQ3ZDLEVBQUU7QUFDRjtDQUNBLENBQUMsTUFBTSxlQUFlLEdBQUc7Q0FDdEIsQ0FBQyxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsZ0JBQWdCLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsTUFBTSxJQUFJLE1BQU0sS0FBSyxJQUFJLENBQUMsMEJBQTBCLENBQUMsQ0FBQyxPQUFPLENBQUMsTUFBTSxJQUFJO0NBQ25JLEdBQUcsTUFBTSxDQUFDLEtBQUssQ0FBQyxVQUFVLEdBQUcsU0FBUTtDQUNyQyxHQUFHLE1BQU0sQ0FBQyxRQUFRLEdBQUcsS0FBSTtDQUN6QixHQUFHLEVBQUM7Q0FDSixFQUFFLElBQUksQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLE9BQU8sR0FBRyxHQUFFO0NBQ3hDLEVBQUUsSUFBSSxDQUFDLGNBQWMsQ0FBQyxLQUFLLEdBQUU7Q0FDN0IsRUFBRSxJQUFJLENBQUMsMEJBQTBCLENBQUMsV0FBVyxHQUFHLGtCQUFpQjtDQUNqRSxFQUFFLElBQUksQ0FBQywwQkFBMEIsQ0FBQyxLQUFLLENBQUMsZUFBZSxHQUFHLFVBQVM7Q0FDbkUsRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxLQUFLLEdBQUcsUUFBTztDQUMxQyxFQUFFLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxVQUFVLEdBQUU7Q0FDckMsRUFBRSxJQUFJO0NBQ04sR0FBRyxNQUFNLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxHQUFFO0NBQzVCLEdBQUcsQ0FBQyxNQUFNLEtBQUssRUFBRTtDQUNqQixHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUMsS0FBSyxFQUFDO0NBQ3ZCLEdBQUcsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLFNBQVMsRUFBRSxFQUFFO0NBQ2pDLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEdBQUU7Q0FDeEIsSUFBSTtDQUNKLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQyxTQUFTLEdBQUcsQ0FBQyxrTEFBa0wsRUFBQztDQUN0TixHQUFHLFNBQVM7Q0FDWixHQUFHLElBQUksQ0FBQyxvQkFBb0IsR0FBRTtDQUM5QixHQUFHO0NBQ0gsRUFBRTtBQUNGO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLFlBQVksQ0FBQyxFQUFFLEVBQUU7Q0FDbEIsRUFBRSxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLGFBQWEsQ0FBQywrQkFBK0IsQ0FBQyxLQUFLLElBQUksSUFBSSxFQUFFLEVBQUU7Q0FDMUYsR0FBRyxHQUFHLElBQUksQ0FBQyxpQkFBaUIsRUFBRTtDQUM5QixJQUFJLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxVQUFVLEdBQUU7Q0FDdkMsSUFBSTtDQUNKLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixHQUFHLElBQUksZ0JBQWdCLENBQUMsRUFBRSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxFQUFDO0NBQ2hGLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxhQUFhLENBQUMsK0JBQStCLENBQUMsRUFBRSxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsVUFBVSxFQUFFLElBQUksRUFBRSxFQUFDO0NBQzlJLEdBQUc7Q0FDSCxFQUFFLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxZQUFZLENBQUMsRUFBRTtDQUM3RCxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLFNBQVMsRUFBRSxFQUFFO0NBQ2xDLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLEdBQUU7Q0FDekIsSUFBSTtDQUNKLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxHQUFHLEdBQUU7Q0FDL0IsR0FBRyxNQUFNO0NBQ1QsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLEdBQUcsT0FBTTtDQUNuQyxHQUFHLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxTQUFTLEVBQUUsRUFBRTtDQUNqQyxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxHQUFFO0NBQ3hCLElBQUk7Q0FDSixHQUFHO0NBQ0gsRUFBRTtBQUNGO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsa0NBQWtDLEdBQUc7Q0FDdEMsRUFBRSxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsU0FBUyxFQUFFLEVBQUU7Q0FDaEMsR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDLDJDQUEyQyxFQUFDO0NBQzdELEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEdBQUU7Q0FDdkIsR0FBRyxJQUFJLENBQUMsb0JBQW9CLEdBQUU7Q0FDOUIsR0FBRyxNQUFNO0NBQ1QsR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDLDZGQUE2RixFQUFDO0NBQy9HLEdBQUcsSUFBSSxDQUFDLGVBQWUsR0FBRTtDQUN6QixHQUFHO0NBQ0gsRUFBRTtBQUNGO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsaUJBQWlCLENBQUMsS0FBSyxFQUFFO0NBQzFCLEVBQUUsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLFNBQVMsRUFBRSxFQUFFO0NBQ2hDLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxrR0FBa0csRUFBQztDQUNsSCxHQUFHLEtBQUssQ0FBQyx3QkFBd0IsR0FBRTtDQUNuQyxHQUFHLEtBQUssQ0FBQyxjQUFjLEdBQUU7Q0FDekIsR0FBRyxLQUFLLENBQUMsZUFBZSxHQUFFO0NBQzFCLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxLQUFLLEdBQUU7Q0FDOUIsR0FBRyxPQUFPLEtBQUs7Q0FDZixHQUFHO0NBQ0gsRUFBRTtBQUNGO0NBQ0EsQ0FBQyxvQkFBb0IsR0FBRztDQUN4QixFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMsNEJBQTRCLENBQUM7Q0FDN0MsR0FBRyxDQUFDLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxnQkFBZ0IsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxNQUFNLElBQUksTUFBTSxLQUFLLElBQUksQ0FBQywwQkFBMEIsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxNQUFNLElBQUk7Q0FDbkksR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDLFVBQVUsR0FBRyxHQUFFO0NBQy9CLEdBQUcsTUFBTSxDQUFDLFFBQVEsR0FBRyxNQUFLO0NBQzFCLEdBQUcsRUFBQztDQUNKLEVBQUUsSUFBSSxDQUFDLDBCQUEwQixDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUMsMEJBQTBCLENBQUMsZ0JBQWU7Q0FDL0YsRUFBRSxJQUFJLENBQUMsMEJBQTBCLENBQUMsS0FBSyxDQUFDLGVBQWUsR0FBRyxJQUFJLENBQUMsMEJBQTBCLENBQUMsb0JBQW1CO0NBQzdHLEVBQUUsSUFBSSxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsT0FBTyxHQUFHLE9BQU07Q0FDNUMsRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxLQUFLLEdBQUcsR0FBRTtDQUNyQyxFQUFFLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsRUFBRSxTQUFTLEVBQUUsSUFBSSxFQUFFLEVBQUM7Q0FDMUUsRUFBRTtBQUNGO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLElBQUksUUFBUSxHQUFHO0NBQ2hCLEVBQUUsT0FBTyxJQUFJLENBQUMsU0FBUztDQUN2QixFQUFFO0FBQ0Y7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsSUFBSSxNQUFNLEdBQUc7Q0FDZCxFQUFFLE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQyxXQUFXO0NBQ25DLEVBQUU7QUFDRjtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsQ0FBQyxJQUFJLElBQUksR0FBRztDQUNaLEVBQUUsT0FBTyxJQUFJLENBQUMsS0FBSztDQUNuQixFQUFFO0FBQ0Y7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsSUFBSSxjQUFjLEdBQUc7Q0FDdEIsRUFBRSxPQUFPLElBQUksQ0FBQyxlQUFlO0NBQzdCLEVBQUU7QUFDRjtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsQ0FBQyxJQUFJLFdBQVcsR0FBRztDQUNuQixFQUFFLE9BQU8sSUFBSSxDQUFDLFlBQVk7Q0FDMUIsRUFBRTtBQUNGO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLElBQUksMEJBQTBCLEdBQUc7Q0FDbEMsRUFBRSxPQUFPLElBQUksQ0FBQywyQkFBMkI7Q0FDekMsRUFBRTtBQUNGO0NBQ0E7Q0FDQTtDQUNBO0NBQ0E7Q0FDQSxDQUFDLElBQUksYUFBYSxHQUFHO0NBQ3JCLEVBQUUsT0FBTyxJQUFJLENBQUMsY0FBYztDQUM1QixFQUFFO0FBQ0Y7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBLENBQUMsSUFBSSxRQUFRLEdBQUc7Q0FDaEIsRUFBRSxPQUFPLElBQUksQ0FBQyxTQUFTO0NBQ3ZCLEVBQUU7QUFDRjtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ0EsQ0FBQyxJQUFJLElBQUksR0FBRztDQUNaLEVBQUUsT0FBTyxJQUFJLENBQUMsS0FBSztDQUNuQixFQUFFO0FBQ0Y7Q0FDQTs7Q0M3UEE7QUFDQTtBQUVBO0NBQ0E7Q0FDQTtDQUNBO0NBQ08sU0FBUyxJQUFJLENBQUMsTUFBTSxFQUFFO0NBQzdCLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUM7Q0FDbkIsQ0FBQztBQUNEO0NBQ0EsR0FBRyxPQUFPLE1BQU0sS0FBSyxXQUFXLEVBQUU7Q0FDbEMsQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFDO0NBQ2I7Ozs7Ozs7Ozs7In0=
