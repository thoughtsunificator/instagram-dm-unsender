/** @module idmu Global/Main API for interacting with the UI */

import UIPI from "../uipi/uipi.js"
/* eslint-disable-next-line no-unused-vars */
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
		this.onStatusText(text)
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
		console.debug("loadUIPI")
		this.uipi = UIPI.create(this.window)
	}


}
export default IDMU
