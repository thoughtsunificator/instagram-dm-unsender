import UIPIComponent from "./uipi-component.js"
import findMessagesWrapperStrategy from "../ui/strategy/find-messages-wrapper-strategy.js"
import UIMessagesWrapper from "../ui/ui-messages-wrapper.js"
import UI from "../ui/ui.js"

export default class UIPI extends UIPIComponent {

	/**
	 *
	 * @param {UI} uiComponent
	 */
	constructor(uiComponent) {
		super(uiComponent)
	}

	/**
	 *
	 * @param {Window} window
	 * @returns {UIPI}
	 */
	static create(window) {
		console.debug("UIPI.create")
		const messagesWrapperElement = findMessagesWrapperStrategy(window)
		let uipi
		if(messagesWrapperElement !== null) {
			console.debug("Found messagesWrapperElement")
			console.debug(messagesWrapperElement)
			const ui = new UI(window)
			ui.identifier.uiMessagesWrapper = new UIMessagesWrapper(messagesWrapperElement)
			uipi = new UIPI(ui)
		} else {
			throw new Error("Unable to find messagesWrapperElement")
		}
		return uipi
	}

	/**
	 *
	 * @returns {Promise}
	 */
	fetchAndRenderThreadNextMessagePage() {
		console.debug("UIPI fetchAndRenderThreadNextMessagePage")
		return this.uiComponent.fetchAndRenderThreadNextMessagePage()
	}

	/**
	 *
	 * @returns {Promise<UIPIMessage[]>}
	 */
	createUIPIMessages() {
		console.debug("UIPI createUIPIMessages")
		return this.uiComponent.createUIPIMessages()
	}

}
