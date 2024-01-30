/** @module ui-messages-wrapper UI element representing the messages wrapper */

import { loadMoreMessages } from "./dom-lookup.js"
import UIComponent from "../ui-component.js"

class UIMessagesWrapper extends UIComponent {

	/**
	 * @param {AbortController} abortController
	 * @returns {Promise}
	 */
	fetchAndRenderThreadNextMessagePage(abortController) {
		return loadMoreMessages(this.root, abortController)
	}

}

export default UIMessagesWrapper
