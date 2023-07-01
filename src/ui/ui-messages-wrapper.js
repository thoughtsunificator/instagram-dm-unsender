import UIComponent from "./ui-component.js"
import loadMoreMessageStrategy from "./strategy/load-more-messages-strategy.js"

export default class UIMessagesWrapper extends UIComponent {

	disablePointerEvents() {
		this.root.style.pointerEvents = "none"
	}

	enablePointerEvents() {
		this.root.style.pointerEvents = ""
	}

	async fetchAndRenderThreadNextMessagePage() {
		return loadMoreMessageStrategy(this)
	}

}
