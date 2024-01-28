/** @module uipi-message API for UIMessage */

// eslint-disable-next-line no-unused-vars
import UIMessage from "../ui/default/ui-message.js"

class FailedWorkflowException extends Error {}

class UIPIMessage {

	/**
	 *
	 * @param {UIMessage} uiMessage
	 */
	constructor(uiMessage) {
		this._uiMessage = uiMessage
	}

	/**
	 *
	 * @returns {Promise<boolean>}
	 */
	async unsend() {
		console.debug("UIPIMessage unsend")
		let actionButton
		let actionsMenuElement
		try {
			this.uiMessage.scrollIntoView()
			actionButton = await this.uiMessage.showActionsMenuButton()
			actionsMenuElement = await this.uiMessage.openActionsMenu(actionButton)
			console.debug("actionsMenuElement", actionsMenuElement)
			const dialogButton = await this.uiMessage.openConfirmUnsendModal()
			if(this.uiMessage.root.oldRemove) {
				this.uiMessage.root.remove = this.uiMessage.root.oldRemove
			}
			await this.uiMessage.confirmUnsend(dialogButton)
			this.uiMessage.root.setAttribute("data-idmu-unsent", "")
			return true
		} catch(ex) {
			console.error(ex)
			if(actionButton && actionsMenuElement) {
				await this.uiMessage.closeActionsMenu(actionButton, actionsMenuElement)
			}
			await this.uiMessage.hideActionMenuButton()
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
