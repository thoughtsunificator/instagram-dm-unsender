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
	 * @returns {OSD}
	 */
	static render(window) {
		const ui = OSD.create(window.document)
		window.document.body.appendChild(ui.root)
		return ui
	}

	/**
	 *
	 * @param   {Document} document
	 * @returns {OSD}
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
		const ui = new OSD(document, root, overlayElement, menuElement, unsendThreadMessagesButton, statusElement)
		document.addEventListener("keydown", (event) => ui.#onWindowKeyEvent(event))
		document.addEventListener("keyup", (event) => ui.#onWindowKeyEvent(event))
		unsendThreadMessagesButton.addEventListener("click", (event) => ui.#onUnsendThreadMessagesButtonClick(event))
		ui._mutationObserver = new MutationObserver((mutations) => ui.#onMutations(ui, mutations))
		ui._mutationObserver.observe(document.body, { childList: true })
		unsendThreadMessagesButton.dataTextContent = unsendThreadMessagesButton.textContent
		unsendThreadMessagesButton.dataBackgroundColor = unsendThreadMessagesButton.style.backgroundColor
		return ui
	}

	/**
	 *
	 * @param {string} text
	 */
	onStatusText(text) {
		this.statusElement.textContent = text
	}

	async #startUnsending() {
		;[...this.menuElement.querySelectorAll("button")].filter(button => button !== this.unsendThreadMessagesButton).forEach(button => {
			button.style.visibility = "hidden"
			button.disabled = true
		})
		this.overlayElement.style.display = ""
		this.overlayElement.focus()
		this.unsendThreadMessagesButton.textContent = "Stop processing"
		this.unsendThreadMessagesButton.style.backgroundColor = "#FA383E"
		this.statusElement.style.color = "white"
		this._mutationObserver.disconnect()
		try {
			await this._strategy.run()
		} catch(error) {
			console.error(error)
			if(this._strategy.isRunning()) {
				this._strategy.stop()
			}
			this.#renderErrorStatus()
		} finally {
			this.#onUnsendingFinished()
		}
	}

	#renderErrorStatus() {
		const message = this._document.createElement("span")
		const link = this._document.createElement("a")
		message.style.color = "red"
		link.href = "https://github.com/thoughtsunificator/instagram-dm-unsender/issues/new?template=bug_report.md"
		link.textContent = "please open an issue"
		message.append("An error occurred, ", link)
		this.statusElement.replaceChildren(message)
	}

	/**
	 *
	 * @param {OSD} ui
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
			if(!this._strategy.isRunning()) {
				this._strategy.reset()
			}
			this.root.style.display = ""
		} else {
			this.root.style.display = "none"
			if(this._strategy.isRunning()) {
				this._strategy.stop()
			}
		}
	}

	/**
	 *
	 * @param {OSD} ui
	 * @param {Event} event
	 */
	#onUnsendThreadMessagesButtonClick() {
		if(this._strategy.isRunning()) {
			this._strategy.stop()
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
		if(this._strategy.isRunning()) {
			event.stopImmediatePropagation()
			event.preventDefault()
			event.stopPropagation()
			this.overlayElement.focus()
			return false
		}
	}

	#onUnsendingFinished() {
		;[...this.menuElement.querySelectorAll("button")].filter(button => button !== this.unsendThreadMessagesButton).forEach(button => {
			button.style.visibility = ""
			button.disabled = false
		})
		this.unsendThreadMessagesButton.textContent = this.unsendThreadMessagesButton.dataTextContent
		this.unsendThreadMessagesButton.style.backgroundColor = this.unsendThreadMessagesButton.dataBackgroundColor
		this.overlayElement.style.display = "none"
		this.statusElement.style.color = ""
		this._mutationObserver.observe(this._document.body, { childList: true })
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
	 * @type {IDMU}
	 */
	get idmu() {
		return this._idmu
	}

}

export default OSD
