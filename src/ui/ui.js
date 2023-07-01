import UIComponent from "./ui-component.js"
import findMessagesStrategy from "../ui/strategy/find-messages-strategy.js"
import UIPIMessage from "../uipi/uipi-message.js"
import UIMessage from "./ui-message.js"

export default class UI extends UIComponent {

	/**
	 *
	 * @returns {Promise>}
	 */
	async fetchAndRenderThreadNextMessagePage() {
		console.debug("UI fetchAndRenderThreadNextMessagePage")
		return await this.identifier.uiMessagesWrapper.fetchAndRenderThreadNextMessagePage()
	}

	/**
	 *
	 * @returns {Promise<UIPIMessage[]>}
	 */
	async createUIPIMessages() {
		console.debug("UI createUIPIMessages")
		const uipiMessages = []
		const messageElements = await findMessagesStrategy(this.identifier.uiMessagesWrapper.root)
		console.debug("findMessagesStrategy", messageElements)
		for(const messageElement of messageElements) {
			const uiMessage = new UIMessage(messageElement)
			uipiMessages.push(new UIPIMessage(uiMessage))
		}
		return uipiMessages
	}

	disablePointerEvents() {
		console.debug("UI disablePointerEvents")
		this.identifier.uiMessagesWrapper.disablePointerEvents()
	}

	enablePointerEvents() {
		console.debug("UI enablePointerEvents")
		this.identifier.uiMessagesWrapper.enablePointerEvents()
	}

}
