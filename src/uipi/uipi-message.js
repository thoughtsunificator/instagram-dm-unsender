/** @module uipi-message API for UIMessage */

/* eslint-disable-next-line no-unused-vars */
import UIMessage from "../ui/default/ui-message.js"

class FailedWorkflowException extends Error {}

class UIPIMessage {

	/**
	 * @param {UIMessage} uiMessage
	 */
	constructor(uiMessage) {
		this._uiMessage = uiMessage
	}

	/**
	 * @param {AbortController} abortController
	 * @returns {Promise<boolean>}
	 */
	async unsend(abortController) { // TODO abort UIPI / waitForElement etc..
		console.debug("UIPIMessage unsend")
		let actionButton
		let unsendButton
		try {
			actionButton = await this.uiMessage.showActionsMenuButton(abortController)
			unsendButton = await this.uiMessage.openActionsMenu(actionButton, abortController)
			console.debug("unsendButton", unsendButton)
			const dialogButton = await this.uiMessage.openConfirmUnsendModal(unsendButton, abortController)
			await this.uiMessage.confirmUnsend(dialogButton, abortController)
			this.uiMessage.root.setAttribute("data-idmu-unsent", "")
			return true
		} catch(ex) {
			console.error(ex)
			this.uiMessage.root.setAttribute("data-idmu-ignore", "")
			throw new FailedWorkflowException("Failed to execute workflow for this message", ex)
		}
	}

	/**
	 * @type {UIMessage}
	 */
	get uiMessage() {
		return this._uiMessage
	}

}
export { FailedWorkflowException }
export default UIPIMessage
