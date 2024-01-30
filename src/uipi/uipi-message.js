/** @module uipi-message API for UIMessage */

// eslint-disable-next-line no-unused-vars
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
		let actionsMenuElement
		try {
			actionButton = await this.uiMessage.showActionsMenuButton(abortController)
			actionsMenuElement = await this.uiMessage.openActionsMenu(actionButton, abortController)
			console.debug("actionsMenuElement", actionsMenuElement)
			const dialogButton = await this.uiMessage.openConfirmUnsendModal(abortController)
			await this.uiMessage.confirmUnsend(dialogButton, abortController)
			this.uiMessage.root.setAttribute("data-idmu-unsent", "")
			return true
		} catch(ex) {
			console.error(ex)
			if(actionButton && actionsMenuElement) {
				await this.uiMessage.closeActionsMenu(actionButton, actionsMenuElement, abortController)
			}
			await this.uiMessage.hideActionMenuButton(abortController)
			throw new FailedWorkflowException("Failed to execute workflow for this message")
		}
	}

	/**
	 * @type {UIMessage}
	 */
	get uiMessage() {
		return this._uiMessage
	}

}

export default UIPIMessage
