/** @module ui IDMU's own ui/overlay
 * Provide a button to unsend messages
*/

import { createMenuButtonElement } from "./menu-button.js"
import { createMenuElement } from "./menu.js"
import IDMU from "../../../idmu/idmu.js"
import { DefaultStrategy } from "../../../ui/default/unsend-strategy.js"
import { createAlertsWrapperElement } from "./alert.js"
import { createOverlayElement } from "./overlay.js"
import { BUTTON_STYLE } from "./style/instagram.js"

// eslint-disable-next-line no-unused-vars
import { UnsendStrategy } from "../../../ui/unsend-strategy.js"

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
		this._document = document
		this._root = root
		this._overlayElement = overlayElement
		this._menuElement = menuElement
		this._statusElement = statusElement
		this._unsendThreadMessagesButton = unsendThreadMessagesButton
		this._idmu = new IDMU(this.window, this.onStatusText.bind(this))
		this._strategy = new DefaultStrategy(this._idmu)
	}

	/**
	 *
	 * @param {window} window
	 * @returns {UI}
	 */
	static render(window) {
		console.debug("render")
		const ui = UI.create(window.document)
		window.document.body.appendChild(ui.root)
		return ui
	}

	/**
	 *
	 * @param   {Document} document
	 * @returns {UI}
	 */
	static create(document) {
		const root = document.createElement("div")
		root.id = "idmu-root"
		const menuElement = createMenuElement(document)
		const overlayElement = createOverlayElement(document)
		const alertsWrapperElement = createAlertsWrapperElement(document)
		const unsendThreadMessagesButton = createMenuButtonElement(document, "Unsend all DMs", BUTTON_STYLE.PRIMARY)
		const statusElement = document.createElement("div")
		statusElement.textContent = "Ready"
		statusElement.id = "idmu-status"
		statusElement.style = "width: 200px"
		document.body.appendChild(overlayElement)
		document.body.appendChild(alertsWrapperElement)
		menuElement.appendChild(unsendThreadMessagesButton)
		menuElement.appendChild(statusElement)
		root.appendChild(menuElement)
		const ui = new UI(document, root, overlayElement, menuElement, unsendThreadMessagesButton, statusElement)
		document.addEventListener("keydown", (event) => ui.#onWindowKeyEvent(event)) // TODO test
		document.addEventListener("keyup", (event) => ui.#onWindowKeyEvent(event)) // TODO test
		unsendThreadMessagesButton.addEventListener("click", (event) => ui.#onUnsendThreadMessagesButtonClick(event))
		this._mutationObserver = new MutationObserver((mutations) => ui.#onMutations(ui, mutations))
		this._mutationObserver.observe(document.body, { childList: true }) // TODO test
		unsendThreadMessagesButton.dataTextContent = unsendThreadMessagesButton.textContent
		unsendThreadMessagesButton.dataBackgroundColor = unsendThreadMessagesButton.style.backgroundColor
		return ui
	}
	async #startUnsending() {
		console.debug("User asked for messages unsending to start; UI interaction will be disabled in the meantime")
		;[...this.menuElement.querySelectorAll("button")].filter(button => button !== this.unsendThreadMessagesButton).forEach(button => {
			button.style.visibility = "hidden"
			button.disabled = true
		})
		this.overlayElement.style.display = ""
		this.overlayElement.focus()
		this.unsendThreadMessagesButton.textContent = "Stop processing"
		this.unsendThreadMessagesButton.style.backgroundColor = "#FA383E"
		await this.strategy.run()
		this.#onUnsendingFinished()
	}

	/**
	 *
	 * @param {UI} ui
	 */
	#onMutations(ui) {
		if(ui.root.ownerDocument.querySelector("[id^=mount] > div > div > div") !== null && ui) {
			if(this._mutationObserver) {
				this._mutationObserver.disconnect()
			}
			this._mutationObserver = new MutationObserver(ui.#onMutations.bind(this, ui))
			this._mutationObserver.observe(ui.root.ownerDocument.querySelector("[id^=mount] > div > div > div"), { childList: true, attributes: true })
		}
		if(this.window.location.pathname.startsWith("/direct/t/")) {
			this.root.style.display = ""
		} else {
			this.root.style.display = "none"
			if(this.strategy.isRunning()) {
				this.strategy.stop()
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
			console.debug("User asked for messages unsending to stop")
			this.strategy.stop()
			this.#onUnsendingFinished()
		} else {
			this.#startUnsending()
		}
	}

	/**
	 *
	 * @param {Event} event
	 * @returns {boolean}
	 */
	#onWindowKeyEvent(event) {
		if(this.strategy.isRunning()) {
			console.log("User interaction is disabled as the unsending is still running; Please stop the execution first.")
			event.stopImmediatePropagation()
			event.preventDefault()
			event.stopPropagation()
			this.overlayElement.focus()
			return false
		}
	}

	#onUnsendingFinished() {
		console.debug("render onUnsendingFinished")
		;[...this.menuElement.querySelectorAll("button")].filter(button => button !== this.unsendThreadMessagesButton).forEach(button => {
			button.style.visibility = ""
			button.disabled = false
		})
		this.unsendThreadMessagesButton.textContent = this.unsendThreadMessagesButton.dataTextContent
		this.unsendThreadMessagesButton.style.backgroundColor = this.unsendThreadMessagesButton.dataBackgroundColor
		this.overlayElement.style.display = "none"
	}

	/**
	 *
	 * @param {string} text
	 */
	onStatusText(text) {
		this.statusElement.textContent = text
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

export default UI
