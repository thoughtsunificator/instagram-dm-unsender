import UIComponent from "./ui-component.js"
import UIMessage from "./ui-message.js"

export default class UI extends UIComponent {
	/**
	*
	* @param {Node} root
	* @param {UIMessagesWrapper} uiMessagesWrapper
	*/
	constructor(root, uiMessagesWrapper) {
		super(root)
		this._uiMessagesWrapper = uiMessagesWrapper
		this._uiMessages = []
	}
	get uiMessagesWrapper() {
		return this._uiMessagesWrapper
	}

	get uiMessages() {
		return this._uiMessages
	}

	addUIMessage(root) {
		const uiMessage = new UIMessage(root)
		this.uiMessages.push(uiMessage)
		return uiMessage
	}

}
