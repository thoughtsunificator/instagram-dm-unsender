/** @module ui-messages-wrapper UI element representing the messages wrapper */

import { loadMoreMessages } from "./dom-lookup.js"
import UIComponent from "../ui-component.js"

class UIMessagesWrapper extends UIComponent {

	/**
	 *
	 * @returns {Promise}
	 */
	fetchAndRenderThreadNextMessagePage() {
		return loadMoreMessages(this.root)
	}

}

export default UIMessagesWrapper
