/** @module idmu Global/Main API for interacting with the UI */

import UIPI from "../uipi/uipi.js"

// eslint-disable-next-line no-unused-vars
import UIPIMessage from "../uipi/uipi-message.js"

class IDMU {

	/**
	 *
	 * @param {Window} window
	 * @param {callback} onStatusText
	 */
	constructor(window, onStatusText) {
		this.window = window
		this.uipi = null
		this.onStatusText = onStatusText
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
	 * @param {string} text
	 */
	setStatusText(text) {
		this.onStatusText(text)
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
			this.uipi = UIPI.create(this.window)
		}
		return this.uipi
	}


}
export default IDMU
