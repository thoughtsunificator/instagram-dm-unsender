import UIComponent from "./ui-component.js"
import loadMoreMessageStrategy from "./strategy/load-more-messages-strategy.js"

export default class UIMessagesWrapper extends UIComponent {

	async fetchAndRenderThreadNextMessagePage() {
		console.debug("loadMoreMessages")
		return loadMoreMessageStrategy(this)
	}

}
