import UIPIComponent from "./uipi-component.js"


class FailedWorkflowException extends Error {}

export default class UIPIMessage extends UIPIComponent {

	/**
	 *
	 * @param {UIMessage} uiComponent
	 */
	constructor(uiComponent) {
		super(uiComponent)
	}


	/**
	 *
	 * @returns {Promise<boolean>}
	 */
	async unsend() {
		console.debug("UIPIMessage unsend")
		try {
			const actionButton = await this.uiComponent.showActionsMenuButton()
			await this.uiComponent.openActionsMenu(actionButton)
			const dialogButton = await this.uiComponent.openConfirmUnsendModal()
			await this.uiComponent.confirmUnsend(dialogButton)
			this.uiComponent.root.setAttribute("data-idmu-unsent", "")
			return true
		} catch(ex) {
			console.error(ex)
			await this.uiComponent.hideActionMenuButton()
			await this.uiComponent.closeActionsMenu()
			throw new FailedWorkflowException("Failed to execute workflow for this message")
		}
	}

}
