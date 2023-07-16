import { createMenuButtonElement } from "./menu-button.js"
import { createMenuElement } from "./menu.js"
import IDMU from "../../../idmu/idmu.js"
import { BatchUnsendStrategy } from "../unsend-strategy.js"
import { createAlertsWrapperElement } from "./alert.js"
import { createOverlayElement } from "./overlay.js"

export default class UI {
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
		this._document = document
		this._root = root
		this._overlayElement = overlayElement
		this._menuElement = menuElement
		this._unsendThreadMessagesButton = unsendThreadMessagesButton
		this._loadThreadMessagesButton = loadThreadMessagesButton
		this._idmu = new IDMU(this.window)
		this._strategy = new BatchUnsendStrategy(this._idmu, () => this.#onUnsuccessfulWorkflows())
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
	 * @param   {Document}          document
	 * @returns {UI}
	 */
	static create(document) {
		const root = document.createElement("div")
		const menuElement = createMenuElement(document)
		const overlayElement = createOverlayElement(document)
		const alertsWrapperElement = createAlertsWrapperElement(document)
		const unsendThreadMessagesButton = createMenuButtonElement(document, "Unsend all DMs")
		const loadThreadMessagesButton = createMenuButtonElement(document, "Batch size", "secondary")
		document.body.appendChild(overlayElement)
		document.body.appendChild(alertsWrapperElement)
		menuElement.appendChild(unsendThreadMessagesButton)
		menuElement.appendChild(loadThreadMessagesButton)
		root.appendChild(menuElement)
		const ui = new UI(document, root, overlayElement, menuElement, unsendThreadMessagesButton, loadThreadMessagesButton)
		document.addEventListener("keydown", (event) => ui.#onWindowKeyEvent(event)) // TODO test
		document.addEventListener("keyup", (event) => ui.#onWindowKeyEvent(event)) // TODO test
		unsendThreadMessagesButton.addEventListener("click", (event) => ui.#onUnsendThreadMessagesButtonClick(event))
		loadThreadMessagesButton.addEventListener("click", (event) => ui.#onLoadThreadMessagesButtonClick(event)) // TODO test
		new MutationObserver((mutations) => ui.#onMutations(mutations)).observe(document.body, { childList: true }) // TODO test
		new MutationObserver((mutations) => ui.#onMutations(mutations)).observe(document.querySelector("[id^=mount] > div > div > div"), { childList: true, attributes: true }) // TODO test
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
		const batchSize = this.window.localStorage.getItem("IDMU_BATCH_SIZE") || BatchUnsendStrategy.DEFAULT_BATCH_SIZE
		await this.strategy.run(batchSize)
		this.#onUnsendingFinished()
	}

	#setBatchSize(batchSize) {
		console.debug(`setBatchSize ${batchSize}`)
		this.window.localStorage.setItem("IDMU_BATCH_SIZE", parseInt(batchSize))
	}

	#onUnsuccessfulWorkflows(unsuccessfulWorkflows) {
		console.log(unsuccessfulWorkflows)
	}

	/**
	 *
	 * @param {Mutation[]} mutations
	 */
	#onMutations() {
		if(this.window.location.pathname.startsWith("/direct/t/")) {
			this.root.style.display = ""
		} else {
			this.root.style.display = "none"
			this.strategy.stop()
		}
	}

	/**
	 *
	 * @param {UI} ui
	 * @param {Event} event
	 */
	#onLoadThreadMessagesButtonClick() {
		console.debug("loadThreadMessagesButton click")
		try {
			const batchSize = parseInt(
				this.window.prompt("How many pages should we load before each unsending? ",
					this.window.localStorage.getItem("IDMU_BATCH_SIZE")
				|| this.BatchUnsendStrategy.DEFAULT_BATCH_SIZE )
			)
			if(parseInt(batchSize)) {
				this.#setBatchSize(batchSize)
			}
		} catch(ex) {
			console.error(ex)
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
	 */
	#onWindowKeyEvent(event) {
		if(this.strategy.isRunning()) {
			console.info("User interaction is disabled as the unsending is still running; Please stop the execution first.")
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
		if(!this.strategy._stopped) {
			this.window.alert("IDMU: Finished")
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
