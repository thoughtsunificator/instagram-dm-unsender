import getUI from "../ui/get-ui.js"

export default class UIPI {

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
		const UI = getUI()
		const ui = UI.create(window)
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
	 * @type {UI}
	 */
	get ui() {
		return this._ui
	}

}
