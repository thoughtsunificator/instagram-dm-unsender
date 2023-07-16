import UIComponent from "./ui-component.js"
import loadMoreMessageStrategy from "./strategy/load-more-messages-strategy.js"

export default class UIMessagesWrapper extends UIComponent {

	/**
	 *
	 * @returns {Promise>}
	 */
	fetchAndRenderThreadNextMessagePage() {
		return loadMoreMessageStrategy(this.root)
	}

}
