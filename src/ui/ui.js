import UIComponent from "./ui-component.js"
import findMessagesStrategy from "../ui/strategy/find-messages-strategy.js"
import UIPIMessage from "../uipi/uipi-message.js"
import UIMessage from "./ui-message.js"

export default class UI extends UIComponent {

	async fetchAndRenderThreadNextMessagePage() {
		return await this.identifier.uiMessagesWrapper.fetchAndRenderThreadNextMessagePage()
	}

	createUIPIMessages() {
		const uipiMessages = []
		const messageElements = findMessagesStrategy(this.identifier.uiMessagesWrapper)
		console.debug("findMessagesStrategy", messageElements)
		for(const messageElement of messageElements) {
			const uiMessage = new UIMessage(messageElement)
			uipiMessages.push(new UIPIMessage(uiMessage))
		}
		return uipiMessages
	}

}
