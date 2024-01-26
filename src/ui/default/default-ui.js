/** @module default-ui Default UI / English UI */

import UI from "../ui.js"
import { findMessagesWrapper, findMessages } from "./dom-lookup.js"
import UIPIMessage from "../../uipi/uipi-message.js"
import UIMessage from "./ui-message.js"
import UIMessagesWrapper from "./ui-messages-wrapper.js"

class DefaultUI extends UI {

	/**
	 * @param {Window} window
	 * @returns {DefaultUI}
	 */
	static create(window) {
		console.debug("UI create")
		const messagesWrapperElement = findMessagesWrapper(window)
		if(messagesWrapperElement !== null) {
			console.debug("Found messagesWrapperElement", messagesWrapperElement)
			const uiMessagesWrapper = new UIMessagesWrapper(messagesWrapperElement)
			return new DefaultUI(window, { uiMessagesWrapper })
		} else {
			throw new Error("Unable to find messagesWrapperElement")
		}
	}

	/**
	*
	* @returns {Promise}
	*/
	async fetchAndRenderThreadNextMessagePage() {
		console.debug("UI fetchAndRenderThreadNextMessagePage")
		return await this.identifier.uiMessagesWrapper.fetchAndRenderThreadNextMessagePage(this.domMapper)
	}

	/**
	 *
	 * @returns {Promise<UIPIMessage[]>}
	 */
	async createUIPIMessages() {
		console.debug("UI createUIPIMessages")
		const uipiMessages = []
		const messageElements = await findMessages(this.identifier.uiMessagesWrapper.root)
		for(const messageElement of messageElements) {
			const uiMessage = new UIMessage(messageElement)
			uipiMessages.push(new UIPIMessage(uiMessage))
		}
		return uipiMessages
	}

}

export default DefaultUI
