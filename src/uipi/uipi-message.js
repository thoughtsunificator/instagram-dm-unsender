class FailedWorkflowException extends Error {}

export default class UIPIMessage {

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
			await this.uiMessage.scrollIntoView()
			actionButton = await this.uiMessage.showActionsMenuButton()
			actionsMenuElement = await this.uiMessage.openActionsMenu(actionButton)
			console.debug("actionsMenuElement", actionsMenuElement)
			const dialogButton = await this.uiMessage.openConfirmUnsendModal()
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
