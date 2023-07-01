import UIPI from "../uipi/uipi.js"
import Queue from "../runtime/queue.js"

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
		await this.#getUIPI().fetchAndRenderThreadNextMessagePage()
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
