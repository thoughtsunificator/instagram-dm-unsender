import UIComponent from "./ui-component.js"

/* eslint-disable-next-line no-unused-vars */
import UIPIMessage from "../uipi/uipi-message.js"

/**
 *
 * @abstract
 */
class UI extends UIComponent {

	/**
	 *
	 * @abstract
	 * @returns {UI}
	 */
	static create() {
	}

	/**
	 *
	 * @abstract
	 * @param {AbortController} abortController
	 * @returns {Promise}
	 */
	/* eslint-disable-next-line no-unused-vars */
	async fetchAndRenderThreadNextMessagePage(abortController) {
	}

	/**
	 *
	 * @abstract
	 * @returns {Promise<UIPIMessage>}
	 */
	async getNextUIPIMessage() {
	}

}

export default UI
