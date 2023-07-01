import UIPIComponent from "./uipi-component.js"


class FailedWorkflowException extends Error {}

export default class UIPIMessage extends UIPIComponent {

	constructor(uiComponent) {
		super(uiComponent)
	}

	async unsend() {
		this.uiComponent.root.setAttribute("data-idmu-processed", "")
		try {
			await this.uiComponent.showActionsMenuButton()
			await this.uiComponent.openActionsMenu()
			await this.uiComponent.clickUnsend()
			await this.uiComponent.confirmUnsend()
			return true
		} catch(ex) {
			console.error(ex)
			this.uiComponent.hideActionMenuButton()
			this.uiComponent.closeActionMenuButton()
			throw FailedWorkflowException({ error: "Failed to execute workflow for this message" })
		}
	}

}
