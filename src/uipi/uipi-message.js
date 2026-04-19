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
	async unsend(abortController) {
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
			// Dismiss any open overlay so the next message starts clean
			try {
				const doc = this.uiMessage.root.ownerDocument
				doc.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
				await new Promise(resolve => setTimeout(resolve, 200))
				// If dialog is still open, press Escape again
				if (doc.querySelector("[role=dialog]")) {
					doc.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
					await new Promise(resolve => setTimeout(resolve, 200))
				}
			} catch (error) {
				console.error(error)
			}
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
