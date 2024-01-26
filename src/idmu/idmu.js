/** @module idmu Global/Main API for interacting with the UI */

import UIPI from "../uipi/uipi.js"

// eslint-disable-next-line no-unused-vars
import UIPIMessage from "../uipi/uipi-message.js"

class IDMU {

	/**
	 *
	 * @param {Window} window
	 */
	constructor(window) {
		this.window = window
		this.uipi = null
	}

	/**
	 *
	 * @returns {Promise<UIPIMessage[]>}
	 */
	createUIPIMessages() {
		return this.#getUIPI().createUIPIMessages()
	}


	/**
	 *
	 * @returns {Promise}
	 */
	fetchAndRenderThreadNextMessagePage() {
		return this.#getUIPI().fetchAndRenderThreadNextMessagePage()
	}

	/**
	 *
	 * @returns {UIPI}
	 */
	#getUIPI() {
		if(this.uipi === null) {
			this.uipi = UIPI.create(this.window, this.UI)
		}
		return this.uipi
	}

}
export default IDMU
