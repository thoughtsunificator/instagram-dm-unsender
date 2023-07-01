import UIPI from "../uipi/uipi.js"

export default class IDMU {

	/**
	 *
	 * @param {Window} window
	 */
	constructor(window) {
		this.window = window
		this.uipi = null
	}

	async createUIPIMessages() {
		console.debug("User asked for messages unsending")
		await this.#getUIPI().createUIPIMessages()
		return this.#getUIPI().uipiMessages
	}

	async fetchAndRenderThreadNextMessagePage() {
		return this.#getUIPI().fetchAndRenderThreadNextMessagePage()
	}

	disablePointerEvents() {
		this.#getUIPI().disablePointerEvents()
	}

	enablePointerEvents() {
		this.#getUIPI().enablePointerEvents()
	}

	/**
	 *
	 * @returns {UIPI}
	 */
	#getUIPI() {
		if(this.uipi === null) {
			this.uipi = UIPI.create(this.window)
		}
		return this.uipi
	}

}
