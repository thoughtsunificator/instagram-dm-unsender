import UIComponent from "./ui-component.js"

// eslint-disable-next-line no-unused-vars
import UIPIMessage from "../uipi/uipi-message.js"

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
	 * @returns {Promise}
	 */
	async fetchAndRenderThreadNextMessagePage() {
	}

	/**
	 *
	 * @abstract
	 * @returns {Promise<UIPIMessage[]>}
	 */
	async createUIPIMessages() {
	}

}

export default UI
