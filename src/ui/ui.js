import UIComponent from "./ui-component.js"
import findMessagesStrategy from "../ui/strategy/find-messages-strategy.js"
import UPIMessage from "../upi/upi-message.js"
import UIMessage from "./ui-message.js"

export default class UI extends UIComponent {

	async loadMoreMessages() {
		console.debug("loadMoreMessages")
		await this.identifier.uiMessagesWrapper.loadMoreMessages()
	}

	async createUPIMessages() {
		const upiMessages = []
		const messageElements = findMessagesStrategy(this.root)
		for(const messageElement of messageElements) {
			const uiMessage = new UIMessage(messageElement)
			upiMessages.push(new UPIMessage(uiMessage))
		}
		return upiMessages
	}

}
