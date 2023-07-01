import UIPIComponent from "./uipi-component.js"
import findMessagesWrapperStrategy from "../ui/strategy/find-messages-wrapper-strategy.js"
import UIMessagesWrapper from "../ui/ui-messages-wrapper.js"
import UI from "../ui/ui.js"

export default class UIPI extends UIPIComponent {


	constructor(uiComponent) {
		super(uiComponent)
		this._uipiMessages = []
	}

	static create(window) {
		console.debug("UIPI.create")
		const messagesWrapperElement = findMessagesWrapperStrategy(window)
		let uipi
		if(messagesWrapperElement !== null) {
			console.debug("Found messagesWrapperElement")
			console.log(messagesWrapperElement)
			const ui = new UI(window)
			ui.identifier.uiMessagesWrapper = new UIMessagesWrapper(messagesWrapperElement)
			uipi = new UIPI(ui)
		} else {
			throw new Error("Unable to find messagesWrapperElement")
		}
		return uipi
	}

	async fetchAndRenderThreadNextMessagePage() {
		return this.uiComponent.fetchAndRenderThreadNextMessagePage()
	}

	disablePointerEvents() {
		this.uiComponent.identifier.uiMessagesWrapper.disablePointerEvents()
	}

	enablePointerEvents() {
		this.uiComponent.identifier.uiMessagesWrapper.enablePointerEvents()
	}

	async createUIPIMessages() {
		console.debug("createUIPIMessages")
		for(const uipiMessage of await this.uiComponent.createUIPIMessages()) {
			this.uipiMessages.push(uipiMessage)
			this.taskId++
		}
	}

	get uipiMessages() {
		return this._uipiMessages
	}

}
