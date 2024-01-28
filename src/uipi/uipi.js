/** @module uipi API for UI */

import getUI from "../ui/get-ui.js"

// eslint-disable-next-line no-unused-vars
import UI from "../ui/ui.js"
// eslint-disable-next-line no-unused-vars
import UIPIMessage from "./uipi-message.js"

/**
 * UI Interface API
 */
class UIPI {

	/**
	 *
	 * @param {UI} ui
	 */
	constructor(ui) {
		this._ui = ui
	}

	/**
	 *
	 * @param {Window} window
	 * @returns {UIPI}
	 */
	static create(window) {
		console.debug("UIPI.create")
		const ui = getUI().create(window)
		return new UIPI(ui)
	}

	/**
	 *
	 * @returns {Promise}
	 */
	fetchAndRenderThreadNextMessagePage() {
		console.debug("UIPI fetchAndRenderThreadNextMessagePage")
		return this.ui.fetchAndRenderThreadNextMessagePage()
	}

	/**
	 *
	 * @returns {Promise<UIPIMessage[]>}
	 */
	createUIPIMessages() {
		console.debug("UIPI createUIPIMessages")
		return this.ui.createUIPIMessages()
	}

	/**
	 *
	 * @type {UI}
	 */
	get ui() {
		return this._ui
	}

}

export default UIPI
