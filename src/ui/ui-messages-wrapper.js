import UIComponent from "./ui-component.js"
import loadMoreMessageStrategy from "./strategy/load-more-messages-strategy.js"

export default class UIMessagesWrapper extends UIComponent {

	/**
	 * @param {Window}
	 * @returns {Element}
	 */
	static find(window) {
		return window.document.querySelector("div[role=grid] > div > div > div > div")
	}

	/**
	 *
	 * @returns {Promise>}
	 */
	async fetchAndRenderThreadNextMessagePage() {
		return loadMoreMessageStrategy(this.root)
	}

}
