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
		let actionButton
		let actionsMenuElement
		try {
			await this.uiComponent.scrollIntoView()
			actionButton = await this.uiComponent.showActionsMenuButton()
			actionsMenuElement = await this.uiComponent.openActionsMenu(actionButton)
			const dialogButton = await this.uiComponent.openConfirmUnsendModal()
			await this.uiComponent.confirmUnsend(dialogButton)
			this.uiComponent.root.setAttribute("data-idmu-unsent", "")
			return true
		} catch(ex) {
			console.error(ex)
			if(actionButton && actionsMenuElement) {
				await this.uiComponent.closeActionsMenu(actionButton, actionsMenuElement)
			}
			await this.uiComponent.hideActionMenuButton()
			throw new FailedWorkflowException("Failed to execute workflow for this message")
		}
	}

}
