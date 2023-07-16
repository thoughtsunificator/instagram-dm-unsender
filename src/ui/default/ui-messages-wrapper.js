import { loadMoreMessages } from "./dom-lookup.js"
import UIComponent from "../ui-component.js"

export default class UIMessagesWrapper extends UIComponent {

	/**
	 *
	 * @returns {Promise>}
	 */
	fetchAndRenderThreadNextMessagePage() {
		return loadMoreMessages(this.root)
	}

}
