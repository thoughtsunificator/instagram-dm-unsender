
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
// @version				0.5.0
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
	window["IDMU_DEBUG"] = false
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
		buttonElement.style.zIndex = 9999;
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
		buttonElement.addEventListener("mouseover", async () => {
			buttonElement.style.filter = `brightness(1.15)`;
		});
		buttonElement.addEventListener("mouseout", async () => {
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
	 * @param {Window} window
	 * @returns {Element}
	 */
	function findMessagesWrapperStrategy(window) {
		return window.document.querySelector("div[role=grid] > div > div > div > div")
	}

	/**
	 *
	 * @param {Element} target
	 * @param {function} getElement
	 * @returns {Promise<Element>}
	 */
	async function waitForElement(target, getElement) {
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

	function clickElement(clickTarget, target, getElement) {
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
		async waitForElement(target, getElement) {
			return getElement() || waitForElement(target, getElement)
		}

		/**
		 *
		 * @param {Element} clickTarget
		 * @param {Element} target
		 * @param {function} getElement
		 * @returns {Promise<Element>}
		 */
		async clickElement(clickTarget, target, getElement) {
			return clickElement(clickTarget, target, getElement)
		}

	}

	/**
	 *
	 * @param {Element} root
	 * @returns {Promise<boolean>}
	 */
	async function loadMoreMessageStrategy(root) {
		let _observer;
		const promise = Promise.race([
			new Promise((resolve) => {
				_observer = new MutationObserver((mutations, observer) => {
					if(root.scrollTop !== 0) {
						observer.disconnect();
						resolve(false);
					}
				}).observe(root, { subtree: true, childList:true });
			}),
			new Promise(resolve => setTimeout(() => {
				if(_observer) {
					_observer.disconnect();
				}
				resolve(true);
			}, root.ownerDocument.defaultView.IDMU_SCROLL_DETECTION_TIMEOUT))
		]);
		root.scrollTop = 0;
		return promise
	}

	class UIMessagesWrapper extends UIComponent {

		/**
		 *
		 * @returns {Promise>}
		 */
		async fetchAndRenderThreadNextMessagePage() {
			return loadMoreMessageStrategy(this.root)
		}

	}

	/**
	 *
	 * @param {Element} root
	 * @returns {Element[]}
	 */
	async function findMessagesStrategy(root) {
		const elements = [...root.querySelectorAll("div[role=row]:not([data-idmu-ignore])")];
		const messageElements = [];
		for(const element of elements) {
			element.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
			element.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
			element.dispatchEvent(new MouseEvent("mousenter", { bubbles: true }));
			const foundUnsendButton = await new Promise((resolve) => {
				setTimeout(async () => {
					const moreButton = element.querySelector("[aria-label=More]");
					if(moreButton) {
						const promise = new Promise(resolve_ => {
							new MutationObserver((mutations, observer) => {
								const dialogElement = [...element.ownerDocument.body.querySelectorAll("[role=dialog]")].pop();
								if(dialogElement) {
									observer.disconnect();
									resolve_(dialogElement);
								}
							}).observe(element.ownerDocument.body, { subtree: true, childList:true });
						});
						moreButton.click();
						const actionMenuElement = await promise;
						let unsendButtonFound = false;
						if(actionMenuElement) {
							unsendButtonFound = !![...actionMenuElement.querySelectorAll("[role=menu] [role=menuitem]")].find(node => node.textContent.toLocaleLowerCase() === "unsend");
						}
						moreButton.click();
						setTimeout(() => resolve(unsendButtonFound));
					} else {
						resolve(false);
					}
				});
			});
			if(foundUnsendButton === true) {
				messageElements.push(element);
			} else {
				element.setAttribute("data-idmu-ignore", "");
			}
		}
		console.debug(messageElements);
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

	class UIMessage extends UIComponent {

		async scrollIntoView() {
			this.root.scrollIntoView();
		}

		/**
		 *
		 * @returns {Promise<HTMLButtonElement>}
		 */
		async showActionsMenuButton() {
			console.debug("Workflow step 1 : showActionsMenuButton");
			this.root.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
			this.root.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
			this.root.dispatchEvent(new MouseEvent("mousenter", { bubbles: true }));
			return this.waitForElement(this.root, () => this.root.querySelector("[aria-label=More]"))
		}
		/**
		 *
		 * @returns {Promise}
		 */
		hideActionMenuButton() {
			console.debug("hideActionMenuButton");
			this.root.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
			this.root.dispatchEvent(new MouseEvent("mouseout", { bubbles: true }));
			this.root.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true }));
			return this.waitForElement(this.root, () => this.root.querySelector("[aria-label=More]") === null)
		}


		/**
		 *
		 * @param {Element} actionButton
		 * @returns {Promise}
		 */
		async openActionsMenu(actionButton) {
			console.debug("Workflow step 2 : openActionsMenu", actionButton);
			return this.clickElement(
				actionButton,
				this.root.ownerDocument.body,
				() => {
					return [...this.root.ownerDocument.querySelectorAll("[role=dialog] [role=menu] [role=menuitem]")].filter(node => node.textContent.toLocaleLowerCase() === "unsend").pop()
				},
			)
		}
		/**
		 *
		 * @param {Element} actionButton
		 * @param {Element} actionsMenuElement
		 * @returns {Promise}
		 */
		async closeActionsMenu(actionButton, actionsMenuElement) {
			console.debug("closeActionsMenu");
			return this.clickElement(
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
				() => [...this.root.ownerDocument.querySelectorAll("[role=dialog] [role=menu] [role=menuitem]")].filter(node => node.textContent.toLocaleLowerCase() === "unsend").pop(),
			);
			return this.clickElement(
				unSendButton,
				this.root.ownerDocument.body,
				() => this.root.ownerDocument.querySelector("[role=dialog] button"),
			)
		}
		/**
		 *
		 * @returns {Promise}
		 */
		async confirmUnsend(dialogButton) {
			console.debug("Workflow final step : confirmUnsend", dialogButton);
			await this.clickElement(
				dialogButton,
				this.root.ownerDocument.body,
				() => this.root.ownerDocument.querySelector("[role=dialog] button") === null
			);
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
			console.debug("findMessagesStrategy", messageElements);
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
		async fetchAndRenderThreadNextMessagePage() {
			console.debug("UIPI fetchAndRenderThreadNextMessagePage");
			return this.uiComponent.fetchAndRenderThreadNextMessagePage()
		}

		/**
		 *
		 * @returns {Promise<UIPIMessage[]>}
		 */
		async createUIPIMessages() {
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
		async createUIPIMessages() {
			return this.#getUIPI().createUIPIMessages()
		}


		/**
		 *
		 * @returns {Promise}
		 */
		async fetchAndRenderThreadNextMessagePage() {
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
		async run(batchSize) {
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
			const unsuccessfulWorkflows = this.#finished_workflows.filter(uiMessage => this.#idmu.window.document.contains(uiMessage.uiComponent.root));
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
	 * @returns {HTMLButtonElement}
	 */
	function createOverlayElement(document) {
		const overlayElement = document.createElement("div");
		overlayElement.id = "idmu-overlay";
		overlayElement.style.top = "0";
		overlayElement.style.right = "0";
		overlayElement.style.position = "fixed";
		overlayElement.style.width = "100vw";
		overlayElement.style.height = "100vh";
		overlayElement.style.zIndex = "998";
		overlayElement.style.backgroundColor = "#000000d6";
		overlayElement.style.pointerEvents = "none";
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
		const idmu = new IDMU(window);
		const strategy = new UnsendThreadMessagesBatchStrategy(idmu, (unsuccessfulWorkflows) => {
			console.log(unsuccessfulWorkflows);
		});
		const { overlayElement, uiElement, unsendThreadMessagesButton, loadThreadMessagesButton } = createUIElement(window.document);
		function onUnsendingFinished() {
			console.debug("onUnsendingFinished");
			unsendThreadMessagesButton.textContent = unsendThreadMessagesButton.dataTextContent;
			unsendThreadMessagesButton.style.backgroundColor = unsendThreadMessagesButton.dataBackgroundColor;
			overlayElement.style.display = "none";
			if(!strategy._stopped) {
				window.alert("IDMU: Finished");
			}
		}
		unsendThreadMessagesButton.dataTextContent = unsendThreadMessagesButton.textContent;
		unsendThreadMessagesButton.dataBackgroundColor = unsendThreadMessagesButton.style.backgroundColor;
		unsendThreadMessagesButton.addEventListener("click", async () => {
			if(strategy.isRunning()) {
				console.debug("User asked to stop messages unsending");
				strategy.stop();
				onUnsendingFinished();
			} else {
				overlayElement.style.display = "";
				console.debug("User asked to start messages unsending");
				unsendThreadMessagesButton.textContent = "Stop processing";
				unsendThreadMessagesButton.style.backgroundColor = "#FA383E";
				const batchSize = window.localStorage.getItem("IDMU_BATCH_SIZE") || UnsendThreadMessagesBatchStrategy.DEFAULT_BATCH_SIZE;
				await strategy.run(batchSize);
				onUnsendingFinished();
			}
		});
		loadThreadMessagesButton.addEventListener("click", async () => {
			console.debug("loadThreadMessagesButton click");
			try {
				const batchSize = parseInt(window.prompt("How many pages should we load ? ", window.localStorage.getItem("IDMU_BATCH_SIZE") || UnsendThreadMessagesBatchStrategy.DEFAULT_BATCH_SIZE ));
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
		return { overlayElement, uiElement, menuElement, unsendThreadMessagesButton, loadThreadMessagesButton }
	}

	if(!window.IDMU_DEBUG) {
		console.debug = () => {};
	}

	render(window);

})();
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaWRtdS51c2VyLmpzIiwic291cmNlcyI6WyIuLi9zcmMvcnVudGltZS91c2Vyc2NyaXB0L3VpL3N0eWxlL2luc3RhZ3JhbS5qcyIsIi4uL3NyYy9ydW50aW1lL3VzZXJzY3JpcHQvdWkvbWVudS1idXR0b24uanMiLCIuLi9zcmMvcnVudGltZS91c2Vyc2NyaXB0L3VpL21lbnUuanMiLCIuLi9zcmMvdWlwaS91aXBpLWNvbXBvbmVudC5qcyIsIi4uL3NyYy91aS9zdHJhdGVneS9maW5kLW1lc3NhZ2VzLXdyYXBwZXItc3RyYXRlZ3kuanMiLCIuLi9zcmMvZG9tL3dhaXQtZm9yLWVsZW1lbnQuanMiLCIuLi9zcmMvZG9tL2NsaWNrLWVsZW1lbnQuanMiLCIuLi9zcmMvdWkvdWktY29tcG9uZW50LmpzIiwiLi4vc3JjL3VpL3N0cmF0ZWd5L2xvYWQtbW9yZS1tZXNzYWdlcy1zdHJhdGVneS5qcyIsIi4uL3NyYy91aS91aS1tZXNzYWdlcy13cmFwcGVyLmpzIiwiLi4vc3JjL3VpL3N0cmF0ZWd5L2ZpbmQtbWVzc2FnZXMtc3RyYXRlZ3kuanMiLCIuLi9zcmMvdWlwaS91aXBpLW1lc3NhZ2UuanMiLCIuLi9zcmMvdWkvdWktbWVzc2FnZS5qcyIsIi4uL3NyYy91aS91aS5qcyIsIi4uL3NyYy91aXBpL3VpcGkuanMiLCIuLi9zcmMvaWRtdS9pZG11LmpzIiwiLi4vc3JjL3J1bnRpbWUvdXNlcnNjcmlwdC9zdHJhdGVneS5qcyIsIi4uL3NyYy9ydW50aW1lL3VzZXJzY3JpcHQvdWkvYWxlcnQuanMiLCIuLi9zcmMvcnVudGltZS91c2Vyc2NyaXB0L3VpL292ZXJsYXkuanMiLCIuLi9zcmMvcnVudGltZS91c2Vyc2NyaXB0L3VpL3VpLmpzIiwiLi4vc3JjL3J1bnRpbWUvdXNlcnNjcmlwdC9tYWluLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImNvbnN0IEJVVFRPTl9TVFlMRSA9IHtcblx0XCJQUklNQVJZXCI6IFwicHJpbWFyeVwiLFxuXHRcIlNFQ09OREFSWVwiOiBcInNlY29uZGFyeVwiLFxufVxuXG4vKipcbiAqXG4gKiBAcGFyYW0ge0hUTUxCdXR0b25FbGVtZW50fSBidXR0b25FbGVtZW50XG4gKiBAcGFyYW0ge3N0cmluZ30gICAgICAgICAgICBzdHlsZU5hbWVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGFwcGx5QnV0dG9uU3R5bGUoYnV0dG9uRWxlbWVudCwgc3R5bGVOYW1lPUJVVFRPTl9TVFlMRS5QUklNQVJZKSB7XG5cdGJ1dHRvbkVsZW1lbnQuc3R5bGUuekluZGV4ID0gOTk5OVxuXHRidXR0b25FbGVtZW50LnN0eWxlLmZvbnRTaXplID0gXCJ2YXIoLS1zeXN0ZW0tMTQtZm9udC1zaXplKVwiXG5cdGJ1dHRvbkVsZW1lbnQuc3R5bGUuY29sb3IgPSBcIndoaXRlXCJcblx0YnV0dG9uRWxlbWVudC5zdHlsZS5ib3JkZXIgPSBcIjBweFwiXG5cdGJ1dHRvbkVsZW1lbnQuc3R5bGUuYm9yZGVyUmFkaXVzID0gXCI4cHhcIlxuXHRidXR0b25FbGVtZW50LnN0eWxlLnBhZGRpbmcgPSBcIjhweFwiXG5cdGJ1dHRvbkVsZW1lbnQuc3R5bGUuZm9udFdlaWdodCA9IFwiYm9sZFwiXG5cdGJ1dHRvbkVsZW1lbnQuc3R5bGUuY3Vyc29yID0gXCJwb2ludGVyXCJcblx0YnV0dG9uRWxlbWVudC5zdHlsZS5saW5lSGVpZ2h0ID0gXCJ2YXIoLS1zeXN0ZW0tMTQtbGluZS1oZWlnaHQpXCJcblx0YnV0dG9uRWxlbWVudC5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSBgcmdiKHZhcigtLWlnLSR7c3R5bGVOYW1lfS1idXR0b24pKWBcbn1cbiIsImltcG9ydCB7IGFwcGx5QnV0dG9uU3R5bGUgfSBmcm9tIFwiLi9zdHlsZS9pbnN0YWdyYW0uanNcIlxuXG4vKipcbiAqXG4gKiBAcGFyYW0ge0RvY3VtZW50fSBkb2N1bWVudFxuICogQHBhcmFtIHtzdHJpbmd9ICAgdGV4dFxuICogQHBhcmFtIHtzdHJpbmd9ICAgc3R5bGVOYW1lXG4gKiBAcmV0dXJucyB7SFRNTEJ1dHRvbkVsZW1lbnR9XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVNZW51QnV0dG9uRWxlbWVudChkb2N1bWVudCwgdGV4dCwgc3R5bGVOYW1lKSB7XG5cdGNvbnN0IGJ1dHRvbkVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiYnV0dG9uXCIpXG5cdGJ1dHRvbkVsZW1lbnQudGV4dENvbnRlbnQgPSB0ZXh0XG5cdGFwcGx5QnV0dG9uU3R5bGUoYnV0dG9uRWxlbWVudCwgc3R5bGVOYW1lKVxuXHRidXR0b25FbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJtb3VzZW92ZXJcIiwgYXN5bmMgKCkgPT4ge1xuXHRcdGJ1dHRvbkVsZW1lbnQuc3R5bGUuZmlsdGVyID0gYGJyaWdodG5lc3MoMS4xNSlgXG5cdH0pXG5cdGJ1dHRvbkVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNlb3V0XCIsIGFzeW5jICgpID0+IHtcblx0XHRidXR0b25FbGVtZW50LnN0eWxlLmZpbHRlciA9IGBgXG5cdH0pXG5cdHJldHVybiBidXR0b25FbGVtZW50XG59XG4iLCIvKipcbiAqIEBwYXJhbSB7RG9jdW1lbnR9IGRvY3VtZW50XG4gKiBAcmV0dXJucyB7SFRNTEJ1dHRvbkVsZW1lbnR9XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVNZW51RWxlbWVudChkb2N1bWVudCkge1xuXHRjb25zdCBtZW51RWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIilcblx0bWVudUVsZW1lbnQuc3R5bGUudG9wID0gXCIyMHB4XCJcblx0bWVudUVsZW1lbnQuc3R5bGUucmlnaHQgPSBcIjQzMHB4XCJcblx0bWVudUVsZW1lbnQuc3R5bGUucG9zaXRpb24gPSBcImZpeGVkXCJcblx0bWVudUVsZW1lbnQuc3R5bGUuekluZGV4ID0gOTk5XG5cdG1lbnVFbGVtZW50LnN0eWxlLmRpc3BsYXkgPSBcImZsZXhcIlxuXHRtZW51RWxlbWVudC5zdHlsZS5nYXAgPSBcIjEwcHhcIlxuXHRyZXR1cm4gbWVudUVsZW1lbnRcbn1cbiIsImV4cG9ydCBkZWZhdWx0IGNsYXNzIFVJUElDb21wb25lbnQge1xuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHtVSUNvbXBvbmVudH0gdWlDb21wb25lbnRcblx0ICovXG5cdGNvbnN0cnVjdG9yKHVpQ29tcG9uZW50KSB7XG5cdFx0dGhpcy5fdWlDb21wb25lbnQgPSB1aUNvbXBvbmVudFxuXHR9XG5cblx0LyoqXG5cdCAqIEByZWFkb25seVxuXHQgKiBAdHlwZSB7VUlDb21wb25lbnR9XG5cdCAqL1xuXHRnZXQgdWlDb21wb25lbnQoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX3VpQ29tcG9uZW50XG5cdH1cbn1cbiIsIi8qKlxuICpcbiAqIEBwYXJhbSB7V2luZG93fSB3aW5kb3dcbiAqIEByZXR1cm5zIHtFbGVtZW50fVxuICovXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBmaW5kTWVzc2FnZXNXcmFwcGVyU3RyYXRlZ3kod2luZG93KSB7XG5cdHJldHVybiB3aW5kb3cuZG9jdW1lbnQucXVlcnlTZWxlY3RvcihcImRpdltyb2xlPWdyaWRdID4gZGl2ID4gZGl2ID4gZGl2ID4gZGl2XCIpXG59XG4iLCIvKipcbiAqXG4gKiBAcGFyYW0ge0VsZW1lbnR9IHRhcmdldFxuICogQHBhcmFtIHtmdW5jdGlvbn0gZ2V0RWxlbWVudFxuICogQHJldHVybnMge1Byb21pc2U8RWxlbWVudD59XG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiB3YWl0Rm9yRWxlbWVudCh0YXJnZXQsIGdldEVsZW1lbnQpIHtcblx0cmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG5cdFx0bGV0IGVsZW1lbnQgPSBnZXRFbGVtZW50KClcblx0XHRpZihlbGVtZW50KSB7XG5cdFx0XHRyZXNvbHZlKGVsZW1lbnQpXG5cdFx0fSBlbHNlIHtcblx0XHRcdG5ldyBNdXRhdGlvbk9ic2VydmVyKChtdXRhdGlvbnMsIG9ic2VydmVyKSA9PiB7XG5cdFx0XHRcdGVsZW1lbnQgPSBnZXRFbGVtZW50KClcblx0XHRcdFx0aWYoZWxlbWVudCkge1xuXHRcdFx0XHRcdG9ic2VydmVyLmRpc2Nvbm5lY3QoKVxuXHRcdFx0XHRcdHJlc29sdmUoZWxlbWVudClcblx0XHRcdFx0fVxuXHRcdFx0fSkub2JzZXJ2ZSh0YXJnZXQsIHsgc3VidHJlZTogdHJ1ZSwgY2hpbGRMaXN0OnRydWUgfSlcblx0XHR9XG5cdH0pXG59XG4iLCJpbXBvcnQgeyB3YWl0Rm9yRWxlbWVudCB9IGZyb20gXCIuL3dhaXQtZm9yLWVsZW1lbnQuanNcIlxuXG5leHBvcnQgZnVuY3Rpb24gY2xpY2tFbGVtZW50KGNsaWNrVGFyZ2V0LCB0YXJnZXQsIGdldEVsZW1lbnQpIHtcblx0Y29uc3QgcHJvbWlzZSA9IHdhaXRGb3JFbGVtZW50KHRhcmdldCwgZ2V0RWxlbWVudClcblx0Y2xpY2tUYXJnZXQuY2xpY2soKVxuXHRyZXR1cm4gZ2V0RWxlbWVudCgpIHx8IHByb21pc2Vcbn1cbiIsImltcG9ydCB7IGNsaWNrRWxlbWVudCB9IGZyb20gXCIuLi9kb20vY2xpY2stZWxlbWVudC5qc1wiXG5pbXBvcnQgeyB3YWl0Rm9yRWxlbWVudCB9IGZyb20gXCIuLi9kb20vd2FpdC1mb3ItZWxlbWVudC5qc1wiXG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFVJQ29tcG9uZW50IHtcblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7RWxlbWVudH0gcm9vdFxuXHQgKiBAcGFyYW0ge29iamVjdH0gaWRlbnRpZmllclxuXHQgKi9cblx0Y29uc3RydWN0b3Iocm9vdCwgaWRlbnRpZmllcj17fSkge1xuXHRcdHRoaXMucm9vdCA9IHJvb3Rcblx0XHR0aGlzLmlkZW50aWZpZXIgPSBpZGVudGlmaWVyXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHtFbGVtZW50fSB0YXJnZXRcblx0ICogQHBhcmFtIHtmdW5jdGlvbn0gZ2V0RWxlbWVudFxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZTxFbGVtZW50Pn1cblx0ICovXG5cdGFzeW5jIHdhaXRGb3JFbGVtZW50KHRhcmdldCwgZ2V0RWxlbWVudCkge1xuXHRcdHJldHVybiBnZXRFbGVtZW50KCkgfHwgd2FpdEZvckVsZW1lbnQodGFyZ2V0LCBnZXRFbGVtZW50KVxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7RWxlbWVudH0gY2xpY2tUYXJnZXRcblx0ICogQHBhcmFtIHtFbGVtZW50fSB0YXJnZXRcblx0ICogQHBhcmFtIHtmdW5jdGlvbn0gZ2V0RWxlbWVudFxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZTxFbGVtZW50Pn1cblx0ICovXG5cdGFzeW5jIGNsaWNrRWxlbWVudChjbGlja1RhcmdldCwgdGFyZ2V0LCBnZXRFbGVtZW50KSB7XG5cdFx0cmV0dXJuIGNsaWNrRWxlbWVudChjbGlja1RhcmdldCwgdGFyZ2V0LCBnZXRFbGVtZW50KVxuXHR9XG5cbn1cbiIsIi8qKlxuICpcbiAqIEBwYXJhbSB7RWxlbWVudH0gcm9vdFxuICogQHJldHVybnMge1Byb21pc2U8Ym9vbGVhbj59XG4gKi9cbmV4cG9ydCBkZWZhdWx0IGFzeW5jIGZ1bmN0aW9uIGxvYWRNb3JlTWVzc2FnZVN0cmF0ZWd5KHJvb3QpIHtcblx0bGV0IF9vYnNlcnZlclxuXHRjb25zdCBwcm9taXNlID0gUHJvbWlzZS5yYWNlKFtcblx0XHRuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuXHRcdFx0X29ic2VydmVyID0gbmV3IE11dGF0aW9uT2JzZXJ2ZXIoKG11dGF0aW9ucywgb2JzZXJ2ZXIpID0+IHtcblx0XHRcdFx0aWYocm9vdC5zY3JvbGxUb3AgIT09IDApIHtcblx0XHRcdFx0XHRvYnNlcnZlci5kaXNjb25uZWN0KClcblx0XHRcdFx0XHRyZXNvbHZlKGZhbHNlKVxuXHRcdFx0XHR9XG5cdFx0XHR9KS5vYnNlcnZlKHJvb3QsIHsgc3VidHJlZTogdHJ1ZSwgY2hpbGRMaXN0OnRydWUgfSlcblx0XHR9KSxcblx0XHRuZXcgUHJvbWlzZShyZXNvbHZlID0+IHNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0aWYoX29ic2VydmVyKSB7XG5cdFx0XHRcdF9vYnNlcnZlci5kaXNjb25uZWN0KClcblx0XHRcdH1cblx0XHRcdHJlc29sdmUodHJ1ZSlcblx0XHR9LCByb290Lm93bmVyRG9jdW1lbnQuZGVmYXVsdFZpZXcuSURNVV9TQ1JPTExfREVURUNUSU9OX1RJTUVPVVQpKVxuXHRdKVxuXHRyb290LnNjcm9sbFRvcCA9IDBcblx0cmV0dXJuIHByb21pc2Vcbn1cbiIsImltcG9ydCBVSUNvbXBvbmVudCBmcm9tIFwiLi91aS1jb21wb25lbnQuanNcIlxuaW1wb3J0IGxvYWRNb3JlTWVzc2FnZVN0cmF0ZWd5IGZyb20gXCIuL3N0cmF0ZWd5L2xvYWQtbW9yZS1tZXNzYWdlcy1zdHJhdGVneS5qc1wiXG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFVJTWVzc2FnZXNXcmFwcGVyIGV4dGVuZHMgVUlDb21wb25lbnQge1xuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZT59XG5cdCAqL1xuXHRhc3luYyBmZXRjaEFuZFJlbmRlclRocmVhZE5leHRNZXNzYWdlUGFnZSgpIHtcblx0XHRyZXR1cm4gbG9hZE1vcmVNZXNzYWdlU3RyYXRlZ3kodGhpcy5yb290KVxuXHR9XG5cbn1cbiIsIi8qKlxuICpcbiAqIEBwYXJhbSB7RWxlbWVudH0gcm9vdFxuICogQHJldHVybnMge0VsZW1lbnRbXX1cbiAqL1xuZXhwb3J0IGRlZmF1bHQgYXN5bmMgZnVuY3Rpb24gZmluZE1lc3NhZ2VzU3RyYXRlZ3kocm9vdCkge1xuXHRjb25zdCBlbGVtZW50cyA9IFsuLi5yb290LnF1ZXJ5U2VsZWN0b3JBbGwoXCJkaXZbcm9sZT1yb3ddOm5vdChbZGF0YS1pZG11LWlnbm9yZV0pXCIpXVxuXHRjb25zdCBtZXNzYWdlRWxlbWVudHMgPSBbXVxuXHRmb3IoY29uc3QgZWxlbWVudCBvZiBlbGVtZW50cykge1xuXHRcdGVsZW1lbnQuZGlzcGF0Y2hFdmVudChuZXcgTW91c2VFdmVudChcIm1vdXNlbW92ZVwiLCB7IGJ1YmJsZXM6IHRydWUgfSkpXG5cdFx0ZWxlbWVudC5kaXNwYXRjaEV2ZW50KG5ldyBNb3VzZUV2ZW50KFwibW91c2VvdmVyXCIsIHsgYnViYmxlczogdHJ1ZSB9KSlcblx0XHRlbGVtZW50LmRpc3BhdGNoRXZlbnQobmV3IE1vdXNlRXZlbnQoXCJtb3VzZW50ZXJcIiwgeyBidWJibGVzOiB0cnVlIH0pKVxuXHRcdGNvbnN0IGZvdW5kVW5zZW5kQnV0dG9uID0gYXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcblx0XHRcdHNldFRpbWVvdXQoYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRjb25zdCBtb3JlQnV0dG9uID0gZWxlbWVudC5xdWVyeVNlbGVjdG9yKFwiW2FyaWEtbGFiZWw9TW9yZV1cIilcblx0XHRcdFx0aWYobW9yZUJ1dHRvbikge1xuXHRcdFx0XHRcdGNvbnN0IHByb21pc2UgPSBuZXcgUHJvbWlzZShyZXNvbHZlXyA9PiB7XG5cdFx0XHRcdFx0XHRuZXcgTXV0YXRpb25PYnNlcnZlcigobXV0YXRpb25zLCBvYnNlcnZlcikgPT4ge1xuXHRcdFx0XHRcdFx0XHRjb25zdCBkaWFsb2dFbGVtZW50ID0gWy4uLmVsZW1lbnQub3duZXJEb2N1bWVudC5ib2R5LnF1ZXJ5U2VsZWN0b3JBbGwoXCJbcm9sZT1kaWFsb2ddXCIpXS5wb3AoKVxuXHRcdFx0XHRcdFx0XHRpZihkaWFsb2dFbGVtZW50KSB7XG5cdFx0XHRcdFx0XHRcdFx0b2JzZXJ2ZXIuZGlzY29ubmVjdCgpXG5cdFx0XHRcdFx0XHRcdFx0cmVzb2x2ZV8oZGlhbG9nRWxlbWVudClcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fSkub2JzZXJ2ZShlbGVtZW50Lm93bmVyRG9jdW1lbnQuYm9keSwgeyBzdWJ0cmVlOiB0cnVlLCBjaGlsZExpc3Q6dHJ1ZSB9KVxuXHRcdFx0XHRcdH0pXG5cdFx0XHRcdFx0bW9yZUJ1dHRvbi5jbGljaygpXG5cdFx0XHRcdFx0Y29uc3QgYWN0aW9uTWVudUVsZW1lbnQgPSBhd2FpdCBwcm9taXNlXG5cdFx0XHRcdFx0bGV0IHVuc2VuZEJ1dHRvbkZvdW5kID0gZmFsc2Vcblx0XHRcdFx0XHRpZihhY3Rpb25NZW51RWxlbWVudCkge1xuXHRcdFx0XHRcdFx0dW5zZW5kQnV0dG9uRm91bmQgPSAhIVsuLi5hY3Rpb25NZW51RWxlbWVudC5xdWVyeVNlbGVjdG9yQWxsKFwiW3JvbGU9bWVudV0gW3JvbGU9bWVudWl0ZW1dXCIpXS5maW5kKG5vZGUgPT4gbm9kZS50ZXh0Q29udGVudC50b0xvY2FsZUxvd2VyQ2FzZSgpID09PSBcInVuc2VuZFwiKVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRtb3JlQnV0dG9uLmNsaWNrKClcblx0XHRcdFx0XHRzZXRUaW1lb3V0KCgpID0+IHJlc29sdmUodW5zZW5kQnV0dG9uRm91bmQpKVxuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHJlc29sdmUoZmFsc2UpXG5cdFx0XHRcdH1cblx0XHRcdH0pXG5cdFx0fSlcblx0XHRpZihmb3VuZFVuc2VuZEJ1dHRvbiA9PT0gdHJ1ZSkge1xuXHRcdFx0bWVzc2FnZUVsZW1lbnRzLnB1c2goZWxlbWVudClcblx0XHR9IGVsc2Uge1xuXHRcdFx0ZWxlbWVudC5zZXRBdHRyaWJ1dGUoXCJkYXRhLWlkbXUtaWdub3JlXCIsIFwiXCIpXG5cdFx0fVxuXHR9XG5cdGNvbnNvbGUuZGVidWcobWVzc2FnZUVsZW1lbnRzKVxuXHRyZXR1cm4gbWVzc2FnZUVsZW1lbnRzXG59XG4iLCJpbXBvcnQgVUlQSUNvbXBvbmVudCBmcm9tIFwiLi91aXBpLWNvbXBvbmVudC5qc1wiXG5cblxuY2xhc3MgRmFpbGVkV29ya2Zsb3dFeGNlcHRpb24gZXh0ZW5kcyBFcnJvciB7fVxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBVSVBJTWVzc2FnZSBleHRlbmRzIFVJUElDb21wb25lbnQge1xuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge1VJTWVzc2FnZX0gdWlDb21wb25lbnRcblx0ICovXG5cdGNvbnN0cnVjdG9yKHVpQ29tcG9uZW50KSB7XG5cdFx0c3VwZXIodWlDb21wb25lbnQpXG5cdH1cblxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZTxib29sZWFuPn1cblx0ICovXG5cdGFzeW5jIHVuc2VuZCgpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwiVUlQSU1lc3NhZ2UgdW5zZW5kXCIpXG5cdFx0bGV0IGFjdGlvbkJ1dHRvblxuXHRcdGxldCBhY3Rpb25zTWVudUVsZW1lbnRcblx0XHR0cnkge1xuXHRcdFx0YXdhaXQgdGhpcy51aUNvbXBvbmVudC5zY3JvbGxJbnRvVmlldygpXG5cdFx0XHRhY3Rpb25CdXR0b24gPSBhd2FpdCB0aGlzLnVpQ29tcG9uZW50LnNob3dBY3Rpb25zTWVudUJ1dHRvbigpXG5cdFx0XHRhY3Rpb25zTWVudUVsZW1lbnQgPSBhd2FpdCB0aGlzLnVpQ29tcG9uZW50Lm9wZW5BY3Rpb25zTWVudShhY3Rpb25CdXR0b24pXG5cdFx0XHRjb25zdCBkaWFsb2dCdXR0b24gPSBhd2FpdCB0aGlzLnVpQ29tcG9uZW50Lm9wZW5Db25maXJtVW5zZW5kTW9kYWwoKVxuXHRcdFx0YXdhaXQgdGhpcy51aUNvbXBvbmVudC5jb25maXJtVW5zZW5kKGRpYWxvZ0J1dHRvbilcblx0XHRcdHRoaXMudWlDb21wb25lbnQucm9vdC5zZXRBdHRyaWJ1dGUoXCJkYXRhLWlkbXUtdW5zZW50XCIsIFwiXCIpXG5cdFx0XHRyZXR1cm4gdHJ1ZVxuXHRcdH0gY2F0Y2goZXgpIHtcblx0XHRcdGNvbnNvbGUuZXJyb3IoZXgpXG5cdFx0XHRpZihhY3Rpb25CdXR0b24gJiYgYWN0aW9uc01lbnVFbGVtZW50KSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMudWlDb21wb25lbnQuY2xvc2VBY3Rpb25zTWVudShhY3Rpb25CdXR0b24sIGFjdGlvbnNNZW51RWxlbWVudClcblx0XHRcdH1cblx0XHRcdGF3YWl0IHRoaXMudWlDb21wb25lbnQuaGlkZUFjdGlvbk1lbnVCdXR0b24oKVxuXHRcdFx0dGhyb3cgbmV3IEZhaWxlZFdvcmtmbG93RXhjZXB0aW9uKFwiRmFpbGVkIHRvIGV4ZWN1dGUgd29ya2Zsb3cgZm9yIHRoaXMgbWVzc2FnZVwiKVxuXHRcdH1cblx0fVxuXG59XG4iLCJpbXBvcnQgVUlDb21wb25lbnQgZnJvbSBcIi4vdWktY29tcG9uZW50LmpzXCJcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgVUlNZXNzYWdlIGV4dGVuZHMgVUlDb21wb25lbnQge1xuXG5cdGFzeW5jIHNjcm9sbEludG9WaWV3KCkge1xuXHRcdHRoaXMucm9vdC5zY3JvbGxJbnRvVmlldygpXG5cdH1cblxuXHQvKipcblx0ICpcblx0ICogQHJldHVybnMge1Byb21pc2U8SFRNTEJ1dHRvbkVsZW1lbnQ+fVxuXHQgKi9cblx0YXN5bmMgc2hvd0FjdGlvbnNNZW51QnV0dG9uKCkge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJXb3JrZmxvdyBzdGVwIDEgOiBzaG93QWN0aW9uc01lbnVCdXR0b25cIilcblx0XHR0aGlzLnJvb3QuZGlzcGF0Y2hFdmVudChuZXcgTW91c2VFdmVudChcIm1vdXNlbW92ZVwiLCB7IGJ1YmJsZXM6IHRydWUgfSkpXG5cdFx0dGhpcy5yb290LmRpc3BhdGNoRXZlbnQobmV3IE1vdXNlRXZlbnQoXCJtb3VzZW92ZXJcIiwgeyBidWJibGVzOiB0cnVlIH0pKVxuXHRcdHRoaXMucm9vdC5kaXNwYXRjaEV2ZW50KG5ldyBNb3VzZUV2ZW50KFwibW91c2VudGVyXCIsIHsgYnViYmxlczogdHJ1ZSB9KSlcblx0XHRyZXR1cm4gdGhpcy53YWl0Rm9yRWxlbWVudCh0aGlzLnJvb3QsICgpID0+IHRoaXMucm9vdC5xdWVyeVNlbGVjdG9yKFwiW2FyaWEtbGFiZWw9TW9yZV1cIikpXG5cdH1cblx0LyoqXG5cdCAqXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlfVxuXHQgKi9cblx0aGlkZUFjdGlvbk1lbnVCdXR0b24oKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcImhpZGVBY3Rpb25NZW51QnV0dG9uXCIpXG5cdFx0dGhpcy5yb290LmRpc3BhdGNoRXZlbnQobmV3IE1vdXNlRXZlbnQoXCJtb3VzZW1vdmVcIiwgeyBidWJibGVzOiB0cnVlIH0pKVxuXHRcdHRoaXMucm9vdC5kaXNwYXRjaEV2ZW50KG5ldyBNb3VzZUV2ZW50KFwibW91c2VvdXRcIiwgeyBidWJibGVzOiB0cnVlIH0pKVxuXHRcdHRoaXMucm9vdC5kaXNwYXRjaEV2ZW50KG5ldyBNb3VzZUV2ZW50KFwibW91c2VsZWF2ZVwiLCB7IGJ1YmJsZXM6IHRydWUgfSkpXG5cdFx0cmV0dXJuIHRoaXMud2FpdEZvckVsZW1lbnQodGhpcy5yb290LCAoKSA9PiB0aGlzLnJvb3QucXVlcnlTZWxlY3RvcihcIlthcmlhLWxhYmVsPU1vcmVdXCIpID09PSBudWxsKVxuXHR9XG5cblxuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHtFbGVtZW50fSBhY3Rpb25CdXR0b25cblx0ICogQHJldHVybnMge1Byb21pc2V9XG5cdCAqL1xuXHRhc3luYyBvcGVuQWN0aW9uc01lbnUoYWN0aW9uQnV0dG9uKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIldvcmtmbG93IHN0ZXAgMiA6IG9wZW5BY3Rpb25zTWVudVwiLCBhY3Rpb25CdXR0b24pXG5cdFx0cmV0dXJuIHRoaXMuY2xpY2tFbGVtZW50KFxuXHRcdFx0YWN0aW9uQnV0dG9uLFxuXHRcdFx0dGhpcy5yb290Lm93bmVyRG9jdW1lbnQuYm9keSxcblx0XHRcdCgpID0+IHtcblx0XHRcdFx0cmV0dXJuIFsuLi50aGlzLnJvb3Qub3duZXJEb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKFwiW3JvbGU9ZGlhbG9nXSBbcm9sZT1tZW51XSBbcm9sZT1tZW51aXRlbV1cIildLmZpbHRlcihub2RlID0+IG5vZGUudGV4dENvbnRlbnQudG9Mb2NhbGVMb3dlckNhc2UoKSA9PT0gXCJ1bnNlbmRcIikucG9wKClcblx0XHRcdH0sXG5cdFx0KVxuXHR9XG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge0VsZW1lbnR9IGFjdGlvbkJ1dHRvblxuXHQgKiBAcGFyYW0ge0VsZW1lbnR9IGFjdGlvbnNNZW51RWxlbWVudFxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZX1cblx0ICovXG5cdGFzeW5jIGNsb3NlQWN0aW9uc01lbnUoYWN0aW9uQnV0dG9uLCBhY3Rpb25zTWVudUVsZW1lbnQpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwiY2xvc2VBY3Rpb25zTWVudVwiKVxuXHRcdHJldHVybiB0aGlzLmNsaWNrRWxlbWVudChcblx0XHRcdGFjdGlvbkJ1dHRvbixcblx0XHRcdHRoaXMucm9vdC5vd25lckRvY3VtZW50LmJvZHksXG5cdFx0XHQoKSA9PiB0aGlzLnJvb3Qub3duZXJEb2N1bWVudC5ib2R5LmNvbnRhaW5zKGFjdGlvbnNNZW51RWxlbWVudCkgPT09IGZhbHNlLFxuXHRcdClcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZTxIVE1MQnV0dG9uRWxlbWVudD58UHJvbWlzZTxFcnJvcj59XG5cdCAqL1xuXHRhc3luYyBvcGVuQ29uZmlybVVuc2VuZE1vZGFsKCkge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJXb3JrZmxvdyBzdGVwIDMgOiBvcGVuQ29uZmlybVVuc2VuZE1vZGFsXCIpXG5cdFx0Y29uc3QgdW5TZW5kQnV0dG9uID0gYXdhaXQgdGhpcy53YWl0Rm9yRWxlbWVudChcblx0XHRcdHRoaXMucm9vdC5vd25lckRvY3VtZW50LmJvZHksXG5cdFx0XHQoKSA9PiBbLi4udGhpcy5yb290Lm93bmVyRG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChcIltyb2xlPWRpYWxvZ10gW3JvbGU9bWVudV0gW3JvbGU9bWVudWl0ZW1dXCIpXS5maWx0ZXIobm9kZSA9PiBub2RlLnRleHRDb250ZW50LnRvTG9jYWxlTG93ZXJDYXNlKCkgPT09IFwidW5zZW5kXCIpLnBvcCgpLFxuXHRcdClcblx0XHRyZXR1cm4gdGhpcy5jbGlja0VsZW1lbnQoXG5cdFx0XHR1blNlbmRCdXR0b24sXG5cdFx0XHR0aGlzLnJvb3Qub3duZXJEb2N1bWVudC5ib2R5LFxuXHRcdFx0KCkgPT4gdGhpcy5yb290Lm93bmVyRG9jdW1lbnQucXVlcnlTZWxlY3RvcihcIltyb2xlPWRpYWxvZ10gYnV0dG9uXCIpLFxuXHRcdClcblx0fVxuXHQvKipcblx0ICpcblx0ICogQHJldHVybnMge1Byb21pc2V9XG5cdCAqL1xuXHRhc3luYyBjb25maXJtVW5zZW5kKGRpYWxvZ0J1dHRvbikge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJXb3JrZmxvdyBmaW5hbCBzdGVwIDogY29uZmlybVVuc2VuZFwiLCBkaWFsb2dCdXR0b24pXG5cdFx0YXdhaXQgdGhpcy5jbGlja0VsZW1lbnQoXG5cdFx0XHRkaWFsb2dCdXR0b24sXG5cdFx0XHR0aGlzLnJvb3Qub3duZXJEb2N1bWVudC5ib2R5LFxuXHRcdFx0KCkgPT4gdGhpcy5yb290Lm93bmVyRG9jdW1lbnQucXVlcnlTZWxlY3RvcihcIltyb2xlPWRpYWxvZ10gYnV0dG9uXCIpID09PSBudWxsXG5cdFx0KVxuXHR9XG5cbn1cbiIsImltcG9ydCBVSUNvbXBvbmVudCBmcm9tIFwiLi91aS1jb21wb25lbnQuanNcIlxuaW1wb3J0IGZpbmRNZXNzYWdlc1N0cmF0ZWd5IGZyb20gXCIuLi91aS9zdHJhdGVneS9maW5kLW1lc3NhZ2VzLXN0cmF0ZWd5LmpzXCJcbmltcG9ydCBVSVBJTWVzc2FnZSBmcm9tIFwiLi4vdWlwaS91aXBpLW1lc3NhZ2UuanNcIlxuaW1wb3J0IFVJTWVzc2FnZSBmcm9tIFwiLi91aS1tZXNzYWdlLmpzXCJcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgVUkgZXh0ZW5kcyBVSUNvbXBvbmVudCB7XG5cblx0LyoqXG5cdCAqXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlPn1cblx0ICovXG5cdGFzeW5jIGZldGNoQW5kUmVuZGVyVGhyZWFkTmV4dE1lc3NhZ2VQYWdlKCkge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJVSSBmZXRjaEFuZFJlbmRlclRocmVhZE5leHRNZXNzYWdlUGFnZVwiKVxuXHRcdHJldHVybiBhd2FpdCB0aGlzLmlkZW50aWZpZXIudWlNZXNzYWdlc1dyYXBwZXIuZmV0Y2hBbmRSZW5kZXJUaHJlYWROZXh0TWVzc2FnZVBhZ2UoKVxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlPFVJUElNZXNzYWdlW10+fVxuXHQgKi9cblx0YXN5bmMgY3JlYXRlVUlQSU1lc3NhZ2VzKCkge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJVSSBjcmVhdGVVSVBJTWVzc2FnZXNcIilcblx0XHRjb25zdCB1aXBpTWVzc2FnZXMgPSBbXVxuXHRcdGNvbnN0IG1lc3NhZ2VFbGVtZW50cyA9IGF3YWl0IGZpbmRNZXNzYWdlc1N0cmF0ZWd5KHRoaXMuaWRlbnRpZmllci51aU1lc3NhZ2VzV3JhcHBlci5yb290KVxuXHRcdGNvbnNvbGUuZGVidWcoXCJmaW5kTWVzc2FnZXNTdHJhdGVneVwiLCBtZXNzYWdlRWxlbWVudHMpXG5cdFx0Zm9yKGNvbnN0IG1lc3NhZ2VFbGVtZW50IG9mIG1lc3NhZ2VFbGVtZW50cykge1xuXHRcdFx0Y29uc3QgdWlNZXNzYWdlID0gbmV3IFVJTWVzc2FnZShtZXNzYWdlRWxlbWVudClcblx0XHRcdHVpcGlNZXNzYWdlcy5wdXNoKG5ldyBVSVBJTWVzc2FnZSh1aU1lc3NhZ2UpKVxuXHRcdH1cblx0XHRyZXR1cm4gdWlwaU1lc3NhZ2VzXG5cdH1cblxufVxuIiwiaW1wb3J0IFVJUElDb21wb25lbnQgZnJvbSBcIi4vdWlwaS1jb21wb25lbnQuanNcIlxuaW1wb3J0IGZpbmRNZXNzYWdlc1dyYXBwZXJTdHJhdGVneSBmcm9tIFwiLi4vdWkvc3RyYXRlZ3kvZmluZC1tZXNzYWdlcy13cmFwcGVyLXN0cmF0ZWd5LmpzXCJcbmltcG9ydCBVSU1lc3NhZ2VzV3JhcHBlciBmcm9tIFwiLi4vdWkvdWktbWVzc2FnZXMtd3JhcHBlci5qc1wiXG5pbXBvcnQgVUkgZnJvbSBcIi4uL3VpL3VpLmpzXCJcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgVUlQSSBleHRlbmRzIFVJUElDb21wb25lbnQge1xuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge1VJfSB1aUNvbXBvbmVudFxuXHQgKi9cblx0Y29uc3RydWN0b3IodWlDb21wb25lbnQpIHtcblx0XHRzdXBlcih1aUNvbXBvbmVudClcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge1dpbmRvd30gd2luZG93XG5cdCAqIEByZXR1cm5zIHtVSVBJfVxuXHQgKi9cblx0c3RhdGljIGNyZWF0ZSh3aW5kb3cpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwiVUlQSS5jcmVhdGVcIilcblx0XHRjb25zdCBtZXNzYWdlc1dyYXBwZXJFbGVtZW50ID0gZmluZE1lc3NhZ2VzV3JhcHBlclN0cmF0ZWd5KHdpbmRvdylcblx0XHRsZXQgdWlwaVxuXHRcdGlmKG1lc3NhZ2VzV3JhcHBlckVsZW1lbnQgIT09IG51bGwpIHtcblx0XHRcdGNvbnNvbGUuZGVidWcoXCJGb3VuZCBtZXNzYWdlc1dyYXBwZXJFbGVtZW50XCIpXG5cdFx0XHRjb25zb2xlLmRlYnVnKG1lc3NhZ2VzV3JhcHBlckVsZW1lbnQpXG5cdFx0XHRjb25zdCB1aSA9IG5ldyBVSSh3aW5kb3cpXG5cdFx0XHR1aS5pZGVudGlmaWVyLnVpTWVzc2FnZXNXcmFwcGVyID0gbmV3IFVJTWVzc2FnZXNXcmFwcGVyKG1lc3NhZ2VzV3JhcHBlckVsZW1lbnQpXG5cdFx0XHR1aXBpID0gbmV3IFVJUEkodWkpXG5cdFx0fSBlbHNlIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihcIlVuYWJsZSB0byBmaW5kIG1lc3NhZ2VzV3JhcHBlckVsZW1lbnRcIilcblx0XHR9XG5cdFx0cmV0dXJuIHVpcGlcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZX1cblx0ICovXG5cdGFzeW5jIGZldGNoQW5kUmVuZGVyVGhyZWFkTmV4dE1lc3NhZ2VQYWdlKCkge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJVSVBJIGZldGNoQW5kUmVuZGVyVGhyZWFkTmV4dE1lc3NhZ2VQYWdlXCIpXG5cdFx0cmV0dXJuIHRoaXMudWlDb21wb25lbnQuZmV0Y2hBbmRSZW5kZXJUaHJlYWROZXh0TWVzc2FnZVBhZ2UoKVxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEByZXR1cm5zIHtQcm9taXNlPFVJUElNZXNzYWdlW10+fVxuXHQgKi9cblx0YXN5bmMgY3JlYXRlVUlQSU1lc3NhZ2VzKCkge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJVSVBJIGNyZWF0ZVVJUElNZXNzYWdlc1wiKVxuXHRcdHJldHVybiB0aGlzLnVpQ29tcG9uZW50LmNyZWF0ZVVJUElNZXNzYWdlcygpXG5cdH1cblxufVxuIiwiaW1wb3J0IFVJUEkgZnJvbSBcIi4uL3VpcGkvdWlwaS5qc1wiXG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIElETVUge1xuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcGFyYW0ge1dpbmRvd30gd2luZG93XG5cdCAqL1xuXHRjb25zdHJ1Y3Rvcih3aW5kb3cpIHtcblx0XHR0aGlzLndpbmRvdyA9IHdpbmRvd1xuXHRcdHRoaXMudWlwaSA9IG51bGxcblx0fVxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZTxVSVBJTWVzc2FnZVtdPn1cblx0ICovXG5cdGFzeW5jIGNyZWF0ZVVJUElNZXNzYWdlcygpIHtcblx0XHRyZXR1cm4gdGhpcy4jZ2V0VUlQSSgpLmNyZWF0ZVVJUElNZXNzYWdlcygpXG5cdH1cblxuXG5cdC8qKlxuXHQgKlxuXHQgKiBAcmV0dXJucyB7UHJvbWlzZX1cblx0ICovXG5cdGFzeW5jIGZldGNoQW5kUmVuZGVyVGhyZWFkTmV4dE1lc3NhZ2VQYWdlKCkge1xuXHRcdHJldHVybiB0aGlzLiNnZXRVSVBJKCkuZmV0Y2hBbmRSZW5kZXJUaHJlYWROZXh0TWVzc2FnZVBhZ2UoKVxuXHR9XG5cblx0LyoqXG5cdCAqXG5cdCAqIEByZXR1cm5zIHtVSVBJfVxuXHQgKi9cblx0I2dldFVJUEkoKSB7XG5cdFx0aWYodGhpcy51aXBpID09PSBudWxsKSB7XG5cdFx0XHR0aGlzLnVpcGkgPSBVSVBJLmNyZWF0ZSh0aGlzLndpbmRvdylcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMudWlwaVxuXHR9XG5cbn1cbiIsIlxuZXhwb3J0IGNsYXNzIFVuc2VuZFRocmVhZE1lc3NhZ2VzQmF0Y2hTdHJhdGVneSB7XG5cblx0c3RhdGljIERFRkFVTFRfQkFUQ0hfU0laRSA9IDVcblxuXHQjaWRtdVxuXHQjb25VbnN1Y2Nlc3NmdWxXb3JrZmxvd3Ncblx0I2ZpbmlzaGVkX3dvcmtmbG93c1xuXHQvKipcblx0ICpcblx0ICogQHBhcmFtIHtJRE1VfSBpZG11XG5cdCAqL1xuXHRjb25zdHJ1Y3RvcihpZG11LCBvblVuc3VjY2Vzc2Z1bFdvcmtmbG93cz1udWxsKSB7XG5cdFx0dGhpcy5fcnVubmluZyA9IGZhbHNlXG5cdFx0dGhpcy5fc3RvcHBlZCA9IGZhbHNlXG5cdFx0dGhpcy4jZmluaXNoZWRfd29ya2Zsb3dzID0gW11cblx0XHR0aGlzLiNpZG11ID0gaWRtdVxuXHRcdHRoaXMuI29uVW5zdWNjZXNzZnVsV29ya2Zsb3dzID0gb25VbnN1Y2Nlc3NmdWxXb3JrZmxvd3Ncblx0fVxuXHQvKipcblx0ICpcblx0ICogQHJldHVybnMge2Jvb2xlYW59XG5cdCAqL1xuXHRpc1J1bm5pbmcoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX3J1bm5pbmcgJiYgIXRoaXMuX3N0b3BwZWRcblx0fVxuXHRzdG9wKCkge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJVbnNlbmRUaHJlYWRNZXNzYWdlc0JhdGNoU3RyYXRlZ3kgc3RvcFwiKVxuXHRcdHRoaXMuX3N0b3BwZWQgPSB0cnVlXG5cdH1cblx0LyoqXG5cdCAqXG5cdCAqIEBwYXJhbSB7bnVtYmVyfSBiYXRjaFNpemVcblx0ICogQHJldHVybnMge1Byb21pc2V9XG5cdCAqL1xuXHRhc3luYyBydW4oYmF0Y2hTaXplKSB7XG5cdFx0Y29uc29sZS5kZWJ1ZyhcIlVuc2VuZFRocmVhZE1lc3NhZ2VzQmF0Y2hTdHJhdGVneS5ydW4oKVwiLCBiYXRjaFNpemUpXG5cdFx0dGhpcy5fcnVubmluZyA9IHRydWVcblx0XHR0aGlzLl9zdG9wcGVkID0gZmFsc2Vcblx0XHRyZXR1cm4gdGhpcy4jcHJvY2Vzc0JhdGNoZXMoYmF0Y2hTaXplKVxuXHR9XG5cblx0I2RvbmUoKSB7XG5cdFx0dGhpcy5fcnVubmluZyA9IGZhbHNlXG5cdFx0Y29uc29sZS5kZWJ1ZyhcIlVuc2VuZFRocmVhZE1lc3NhZ2VzQmF0Y2hTdHJhdGVneSBkb25lXCIpXG5cdH1cblxuXHQjdW5zdWNjZXNzZnVsV29ya2Zsb3dBbGVydCgpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwiVW5zZW5kVGhyZWFkTWVzc2FnZXNCYXRjaFN0cmF0ZWd5IHVuc3VjY2Vzc2Z1bFdvcmtmbG93QWxlcnRcIilcblx0XHRpZighdGhpcy5fcnVubmluZykge1xuXHRcdFx0Y2xlYXJJbnRlcnZhbCh0aGlzLmludGVydmFsKVxuXHRcdH1cblx0XHRjb25zdCB1bnN1Y2Nlc3NmdWxXb3JrZmxvd3MgPSB0aGlzLiNmaW5pc2hlZF93b3JrZmxvd3MuZmlsdGVyKHVpTWVzc2FnZSA9PiB0aGlzLiNpZG11LndpbmRvdy5kb2N1bWVudC5jb250YWlucyh1aU1lc3NhZ2UudWlDb21wb25lbnQucm9vdCkpXG5cdFx0aWYodW5zdWNjZXNzZnVsV29ya2Zsb3dzLmxlbmd0aCA+PSAxKSB7XG5cdFx0XHR1bnN1Y2Nlc3NmdWxXb3JrZmxvd3MuZm9yRWFjaChmYWlsZWRXb3JrZmxvdyA9PiB0aGlzLiNmaW5pc2hlZF93b3JrZmxvd3Muc3BsaWNlKHRoaXMuI2ZpbmlzaGVkX3dvcmtmbG93cy5pbmRleE9mKGZhaWxlZFdvcmtmbG93KSwgMSkpXG5cdFx0XHR0aGlzLiNvblVuc3VjY2Vzc2Z1bFdvcmtmbG93cyh1bnN1Y2Nlc3NmdWxXb3JrZmxvd3MpXG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgI3Byb2Nlc3NCYXRjaGVzKGJhdGNoU2l6ZSkge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJVbnNlbmRUaHJlYWRNZXNzYWdlc0JhdGNoU3RyYXRlZ3kgcHJvY2Vzc0JhdGNoZXNcIilcblx0XHRsZXQgZG9uZSA9IGZhbHNlXG5cdFx0Zm9yKGxldCBpID0gMDsgaSA8IGJhdGNoU2l6ZTtpKyspIHtcblx0XHRcdGlmKHRoaXMuX3N0b3BwZWQpIHtcblx0XHRcdFx0YnJlYWtcblx0XHRcdH1cblx0XHRcdGRvbmUgPSBhd2FpdCB0aGlzLiNpZG11LmZldGNoQW5kUmVuZGVyVGhyZWFkTmV4dE1lc3NhZ2VQYWdlKClcblx0XHRcdGlmKGRvbmUpIHtcblx0XHRcdFx0YnJlYWtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGF3YWl0IG5ldyBQcm9taXNlKHJlc29sdmUgPT4gc2V0VGltZW91dChyZXNvbHZlLCB0aGlzLiNpZG11LndpbmRvdy5JRE1VX05FWFRfTUVTU0FHRV9QQUdFX0RFTEFZKSlcblx0XHRcdH1cblx0XHR9XG5cdFx0dHJ5IHtcblx0XHRcdGZvcihjb25zdCB1aXBpTWVzc2FnZSBvZiBhd2FpdCB0aGlzLiNpZG11LmNyZWF0ZVVJUElNZXNzYWdlcygpKSB7XG5cdFx0XHRcdGlmKHRoaXMuX3N0b3BwZWQpIHtcblx0XHRcdFx0XHRicmVha1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0YXdhaXQgdWlwaU1lc3NhZ2UudW5zZW5kKClcblx0XHRcdFx0XHR0aGlzLiNmaW5pc2hlZF93b3JrZmxvd3MucHVzaCh1aXBpTWVzc2FnZSlcblx0XHRcdFx0XHRhd2FpdCBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgdGhpcy4jaWRtdS53aW5kb3cuSURNVV9NRVNTQUdFX1FVRVVFX0RFTEFZKSlcblx0XHRcdFx0fSBjYXRjaChyZXN1bHQpIHtcblx0XHRcdFx0XHRjb25zb2xlLmVycm9yKHJlc3VsdClcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0gY2F0Y2goZXgpIHtcblx0XHRcdGNvbnNvbGUuZXJyb3IoZXgpXG5cdFx0fVxuXHRcdGlmKCF0aGlzLmludGVydmFsICYmIHRoaXMuI29uVW5zdWNjZXNzZnVsV29ya2Zsb3dzKSB7XG5cdFx0XHR0aGlzLmludGVydmFsID0gc2V0SW50ZXJ2YWwoKCkgPT4gdGhpcy4jdW5zdWNjZXNzZnVsV29ya2Zsb3dBbGVydCgpLCB0aGlzLiNpZG11LndpbmRvdy5JRE1VX1VOU1VDRVNTRlVMX1dPUktGTE9XX0FMRVJUX0lOVEVSVkFMKVxuXHRcdH1cblx0XHRpZihkb25lKSB7XG5cdFx0XHR0aGlzLiNkb25lKClcblx0XHR9IGVsc2UgaWYoIXRoaXMuX3N0b3BwZWQpIHtcblx0XHRcdHJldHVybiB0aGlzLiNwcm9jZXNzQmF0Y2hlcyhiYXRjaFNpemUpXG5cdFx0fVxuXHR9XG59XG4iLCIvKipcbiAqXG4gKiBAcGFyYW0ge0RvY3VtZW50fSBkb2N1bWVudFxuICogQHJldHVybnMge0hUTUxCdXR0b25FbGVtZW50fVxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQWxlcnRzV3JhcHBlckVsZW1lbnQoZG9jdW1lbnQpIHtcblx0Y29uc3QgYWxlcnRzV3JhcHBlckVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpXG5cdGFsZXJ0c1dyYXBwZXJFbGVtZW50LmlkID0gXCJpZG11LWFsZXJ0c1wiXG5cdGFsZXJ0c1dyYXBwZXJFbGVtZW50LnN0eWxlLnBvc2l0aW9uID0gXCJmaXhlZFwiXG5cdGFsZXJ0c1dyYXBwZXJFbGVtZW50LnN0eWxlLnRvcCA9IFwiMjBweFwiXG5cdGFsZXJ0c1dyYXBwZXJFbGVtZW50LnN0eWxlLnJpZ2h0ID0gXCIyMHB4XCJcblx0YWxlcnRzV3JhcHBlckVsZW1lbnQuc3R5bGUuZGlzcGxheSA9IFwiZ3JpZFwiXG5cdHJldHVybiBhbGVydHNXcmFwcGVyRWxlbWVudFxufVxuXG4vKipcbiAqXG4gKiBAcGFyYW0ge0RvY3VtZW50fSBkb2N1bWVudFxuICogQHBhcmFtIHtzdHJpbmd9ICAgdGV4dFxuICogQHJldHVybnMge0hUTUxCdXR0b25FbGVtZW50fVxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQWxlcnRFbGVtZW50KGRvY3VtZW50LCB0ZXh0KSB7XG5cdGNvbnN0IGFsZXJ0RWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIilcblx0YWxlcnRFbGVtZW50LnRleHRDb250ZW50ID0gdGV4dFxuXHRyZXR1cm4gYWxlcnRFbGVtZW50XG59XG4iLCIvKipcbiAqIEBwYXJhbSB7RG9jdW1lbnR9IGRvY3VtZW50XG4gKiBAcmV0dXJucyB7SFRNTEJ1dHRvbkVsZW1lbnR9XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVPdmVybGF5RWxlbWVudChkb2N1bWVudCkge1xuXHRjb25zdCBvdmVybGF5RWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIilcblx0b3ZlcmxheUVsZW1lbnQuaWQgPSBcImlkbXUtb3ZlcmxheVwiXG5cdG92ZXJsYXlFbGVtZW50LnN0eWxlLnRvcCA9IFwiMFwiXG5cdG92ZXJsYXlFbGVtZW50LnN0eWxlLnJpZ2h0ID0gXCIwXCJcblx0b3ZlcmxheUVsZW1lbnQuc3R5bGUucG9zaXRpb24gPSBcImZpeGVkXCJcblx0b3ZlcmxheUVsZW1lbnQuc3R5bGUud2lkdGggPSBcIjEwMHZ3XCJcblx0b3ZlcmxheUVsZW1lbnQuc3R5bGUuaGVpZ2h0ID0gXCIxMDB2aFwiXG5cdG92ZXJsYXlFbGVtZW50LnN0eWxlLnpJbmRleCA9IFwiOTk4XCJcblx0b3ZlcmxheUVsZW1lbnQuc3R5bGUuYmFja2dyb3VuZENvbG9yID0gXCIjMDAwMDAwZDZcIlxuXHRvdmVybGF5RWxlbWVudC5zdHlsZS5wb2ludGVyRXZlbnRzID0gXCJub25lXCJcblx0b3ZlcmxheUVsZW1lbnQuc3R5bGUuZGlzcGxheSA9IFwibm9uZVwiXG5cdHJldHVybiBvdmVybGF5RWxlbWVudFxufVxuIiwiaW1wb3J0IHsgY3JlYXRlTWVudUJ1dHRvbkVsZW1lbnQgfSBmcm9tIFwiLi9tZW51LWJ1dHRvbi5qc1wiXG5pbXBvcnQgeyBjcmVhdGVNZW51RWxlbWVudCB9IGZyb20gXCIuL21lbnUuanNcIlxuaW1wb3J0IElETVUgZnJvbSBcIi4uLy4uLy4uL2lkbXUvaWRtdS5qc1wiXG5pbXBvcnQgeyBVbnNlbmRUaHJlYWRNZXNzYWdlc0JhdGNoU3RyYXRlZ3kgfSBmcm9tIFwiLi4vc3RyYXRlZ3kuanNcIlxuaW1wb3J0IHsgY3JlYXRlQWxlcnRzV3JhcHBlckVsZW1lbnQgfSBmcm9tIFwiLi9hbGVydC5qc1wiXG5pbXBvcnQgeyBjcmVhdGVPdmVybGF5RWxlbWVudCB9IGZyb20gXCIuL292ZXJsYXkuanNcIlxuXG4vKipcbiAqXG4gKiBAcGFyYW0ge3dpbmRvd30gd2luZG93XG4gKiBAcmV0dXJucyB7SFRNTERpdkVsZW1lbnR9ICAgIG9iamVjdC51aUVsZW1lbnRcbiAqIEByZXR1cm5zIHtIVE1MQnV0dG9uRWxlbWVudH0gb2JqZWN0LnVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uXG4gKiBAcmV0dXJucyB7SFRNTEJ1dHRvbkVsZW1lbnR9IG9iamVjdC5sb2FkVGhyZWFkTWVzc2FnZXNCdXR0b25cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlbmRlcih3aW5kb3cpIHtcblx0Y29uc3QgaWRtdSA9IG5ldyBJRE1VKHdpbmRvdylcblx0Y29uc3Qgc3RyYXRlZ3kgPSBuZXcgVW5zZW5kVGhyZWFkTWVzc2FnZXNCYXRjaFN0cmF0ZWd5KGlkbXUsICh1bnN1Y2Nlc3NmdWxXb3JrZmxvd3MpID0+IHtcblx0XHRjb25zb2xlLmxvZyh1bnN1Y2Nlc3NmdWxXb3JrZmxvd3MpXG5cdH0pXG5cdGNvbnN0IHsgb3ZlcmxheUVsZW1lbnQsIHVpRWxlbWVudCwgdW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24sIGxvYWRUaHJlYWRNZXNzYWdlc0J1dHRvbiB9ID0gY3JlYXRlVUlFbGVtZW50KHdpbmRvdy5kb2N1bWVudClcblx0ZnVuY3Rpb24gb25VbnNlbmRpbmdGaW5pc2hlZCgpIHtcblx0XHRjb25zb2xlLmRlYnVnKFwib25VbnNlbmRpbmdGaW5pc2hlZFwiKVxuXHRcdHVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uLnRleHRDb250ZW50ID0gdW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24uZGF0YVRleHRDb250ZW50XG5cdFx0dW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24uc3R5bGUuYmFja2dyb3VuZENvbG9yID0gdW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24uZGF0YUJhY2tncm91bmRDb2xvclxuXHRcdG92ZXJsYXlFbGVtZW50LnN0eWxlLmRpc3BsYXkgPSBcIm5vbmVcIlxuXHRcdGlmKCFzdHJhdGVneS5fc3RvcHBlZCkge1xuXHRcdFx0d2luZG93LmFsZXJ0KFwiSURNVTogRmluaXNoZWRcIilcblx0XHR9XG5cdH1cblx0dW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24uZGF0YVRleHRDb250ZW50ID0gdW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24udGV4dENvbnRlbnRcblx0dW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24uZGF0YUJhY2tncm91bmRDb2xvciA9IHVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uLnN0eWxlLmJhY2tncm91bmRDb2xvclxuXHR1bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgYXN5bmMgKCkgPT4ge1xuXHRcdGlmKHN0cmF0ZWd5LmlzUnVubmluZygpKSB7XG5cdFx0XHRjb25zb2xlLmRlYnVnKFwiVXNlciBhc2tlZCB0byBzdG9wIG1lc3NhZ2VzIHVuc2VuZGluZ1wiKVxuXHRcdFx0c3RyYXRlZ3kuc3RvcCgpXG5cdFx0XHRvblVuc2VuZGluZ0ZpbmlzaGVkKClcblx0XHR9IGVsc2Uge1xuXHRcdFx0b3ZlcmxheUVsZW1lbnQuc3R5bGUuZGlzcGxheSA9IFwiXCJcblx0XHRcdGNvbnNvbGUuZGVidWcoXCJVc2VyIGFza2VkIHRvIHN0YXJ0IG1lc3NhZ2VzIHVuc2VuZGluZ1wiKVxuXHRcdFx0dW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24udGV4dENvbnRlbnQgPSBcIlN0b3AgcHJvY2Vzc2luZ1wiXG5cdFx0XHR1bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbi5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSBcIiNGQTM4M0VcIlxuXHRcdFx0Y29uc3QgYmF0Y2hTaXplID0gd2luZG93LmxvY2FsU3RvcmFnZS5nZXRJdGVtKFwiSURNVV9CQVRDSF9TSVpFXCIpIHx8IFVuc2VuZFRocmVhZE1lc3NhZ2VzQmF0Y2hTdHJhdGVneS5ERUZBVUxUX0JBVENIX1NJWkVcblx0XHRcdGF3YWl0IHN0cmF0ZWd5LnJ1bihiYXRjaFNpemUpXG5cdFx0XHRvblVuc2VuZGluZ0ZpbmlzaGVkKClcblx0XHR9XG5cdH0pXG5cdGxvYWRUaHJlYWRNZXNzYWdlc0J1dHRvbi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnNvbGUuZGVidWcoXCJsb2FkVGhyZWFkTWVzc2FnZXNCdXR0b24gY2xpY2tcIilcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgYmF0Y2hTaXplID0gcGFyc2VJbnQod2luZG93LnByb21wdChcIkhvdyBtYW55IHBhZ2VzIHNob3VsZCB3ZSBsb2FkID8gXCIsIHdpbmRvdy5sb2NhbFN0b3JhZ2UuZ2V0SXRlbShcIklETVVfQkFUQ0hfU0laRVwiKSB8fCBVbnNlbmRUaHJlYWRNZXNzYWdlc0JhdGNoU3RyYXRlZ3kuREVGQVVMVF9CQVRDSF9TSVpFICkpXG5cdFx0XHRpZihwYXJzZUludChiYXRjaFNpemUpKSB7XG5cdFx0XHRcdHdpbmRvdy5sb2NhbFN0b3JhZ2Uuc2V0SXRlbShcIklETVVfQkFUQ0hfU0laRVwiLCBwYXJzZUludChiYXRjaFNpemUpKVxuXHRcdFx0fVxuXHRcdFx0Y29uc29sZS5kZWJ1ZyhgU2V0dGluZyBJRE1VX0JBVENIX1NJWkUgdG8gJHtiYXRjaFNpemV9YClcblx0XHR9IGNhdGNoKGV4KSB7XG5cdFx0XHRjb25zb2xlLmVycm9yKGV4KVxuXHRcdH1cblx0fSlcblx0d2luZG93LmRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQodWlFbGVtZW50KVxuXHRyZXR1cm4geyB1aUVsZW1lbnQsIHVuc2VuZFRocmVhZE1lc3NhZ2VzQnV0dG9uLCBsb2FkVGhyZWFkTWVzc2FnZXNCdXR0b24gfVxufVxuXG4vKipcbiAqXG4gKiBAcGFyYW0gICB7RG9jdW1lbnR9ICAgICAgICAgIGRvY3VtZW50XG4gKiBAcmV0dXJucyB7b2JqZWN0fVxuICogQHJldHVybnMge0hUTUxEaXZFbGVtZW50fSAgICBvYmplY3QudWlFbGVtZW50XG4gKiBAcmV0dXJucyB7SFRNTERpdkVsZW1lbnR9ICAgIG9iamVjdC5tZW51RWxlbWVudFxuICogQHJldHVybnMge0hUTUxCdXR0b25FbGVtZW50fSBvYmplY3QudW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b25cbiAqIEByZXR1cm5zIHtIVE1MQnV0dG9uRWxlbWVudH0gb2JqZWN0LmxvYWRUaHJlYWRNZXNzYWdlc0J1dHRvblxuICovXG5mdW5jdGlvbiBjcmVhdGVVSUVsZW1lbnQoZG9jdW1lbnQpIHtcblx0Y29uc3QgdWlFbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKVxuXHRjb25zdCBtZW51RWxlbWVudCA9IGNyZWF0ZU1lbnVFbGVtZW50KGRvY3VtZW50KVxuXHRjb25zdCBvdmVybGF5RWxlbWVudCA9IGNyZWF0ZU92ZXJsYXlFbGVtZW50KGRvY3VtZW50KVxuXHRjb25zdCBhbGVydHNXcmFwcGVyRWxlbWVudCA9IGNyZWF0ZUFsZXJ0c1dyYXBwZXJFbGVtZW50KGRvY3VtZW50KVxuXHRjb25zdCB1bnNlbmRUaHJlYWRNZXNzYWdlc0J1dHRvbiA9IGNyZWF0ZU1lbnVCdXR0b25FbGVtZW50KGRvY3VtZW50LCBcIlVuc2VuZCBhbGwgRE1zXCIpXG5cdGNvbnN0IGxvYWRUaHJlYWRNZXNzYWdlc0J1dHRvbiA9IGNyZWF0ZU1lbnVCdXR0b25FbGVtZW50KGRvY3VtZW50LCBcIkJhdGNoIHNpemVcIiwgXCJzZWNvbmRhcnlcIilcblx0ZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChvdmVybGF5RWxlbWVudClcblx0ZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChhbGVydHNXcmFwcGVyRWxlbWVudClcblx0bWVudUVsZW1lbnQuYXBwZW5kQ2hpbGQodW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24pXG5cdG1lbnVFbGVtZW50LmFwcGVuZENoaWxkKGxvYWRUaHJlYWRNZXNzYWdlc0J1dHRvbilcblx0dWlFbGVtZW50LmFwcGVuZENoaWxkKG1lbnVFbGVtZW50KVxuXHRyZXR1cm4geyBvdmVybGF5RWxlbWVudCwgdWlFbGVtZW50LCBtZW51RWxlbWVudCwgdW5zZW5kVGhyZWFkTWVzc2FnZXNCdXR0b24sIGxvYWRUaHJlYWRNZXNzYWdlc0J1dHRvbiB9XG59XG4iLCJpbXBvcnQgeyByZW5kZXIgfSBmcm9tIFwiLi91aS91aS5qc1wiXG5cbmlmKCF3aW5kb3cuSURNVV9ERUJVRykge1xuXHRjb25zb2xlLmRlYnVnID0gKCkgPT4ge31cbn1cblxucmVuZGVyKHdpbmRvdylcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQUFBLE1BQU0sWUFBWSxHQUFHO0NBQ3JCLENBQUMsU0FBUyxFQUFFLFNBQVM7Q0FDckIsQ0FBQyxXQUFXLEVBQUUsV0FBVztDQUN6QixFQUFDO0FBQ0Q7Q0FDQTtDQUNBO0NBQ0E7Q0FDQTtDQUNBO0NBQ08sU0FBUyxnQkFBZ0IsQ0FBQyxhQUFhLEVBQUUsU0FBUyxDQUFDLFlBQVksQ0FBQyxPQUFPLEVBQUU7Q0FDaEYsQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxLQUFJO0NBQ2xDLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxRQUFRLEdBQUcsNkJBQTRCO0NBQzVELENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxLQUFLLEdBQUcsUUFBTztDQUNwQyxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLE1BQUs7Q0FDbkMsQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLFlBQVksR0FBRyxNQUFLO0NBQ3pDLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxPQUFPLEdBQUcsTUFBSztDQUNwQyxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsVUFBVSxHQUFHLE9B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
