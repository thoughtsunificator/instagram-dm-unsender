import UIComponent from "./ui-component.js"

export default class UI extends UIComponent {

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
