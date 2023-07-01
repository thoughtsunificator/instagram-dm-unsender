import UIComponent from "./ui-component.js"

export default class UIMessage extends UIComponent {

	async scrollIntoView() {
		this.root.scrollIntoView()
	}

	/**
	 *
	 * @returns {Promise<HTMLButtonElement>}
	 */
	async showActionsMenuButton() {
		console.debug("Workflow step 1 : showActionsMenuButton")
		this.root.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }))
		this.root.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }))
		this.root.dispatchEvent(new MouseEvent("mousenter", { bubbles: true }))
		return this.waitForElement(this.root, () => this.root.querySelector("[aria-label=More]"))
	}
	/**
	 *
	 * @returns {Promise}
	 */
	hideActionMenuButton() {
		console.debug("hideActionMenuButton")
		this.root.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }))
		this.root.dispatchEvent(new MouseEvent("mouseout", { bubbles: true }))
		this.root.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true }))
		return this.waitForElement(this.root, () => this.root.querySelector("[aria-label=More]") === null)
	}


	/**
	 *
	 * @param {Element} actionButton
	 * @returns {Promise}
	 */
	async openActionsMenu(actionButton) {
		console.debug("Workflow step 2 : openActionsMenu", actionButton)
		return this.clickElement(
			actionButton,
			this.root.ownerDocument.body,
			() => {
				return [...this.root.ownerDocument.querySelectorAll("[role=dialog] [role=menu] [role=menuitem]")].filter(node => node.textContent.toLocaleLowerCase() === "unsend").pop()
			},
		)
	}
	/**
	 *
	 * @param {Element} actionButton
	 * @param {Element} actionsMenuElement
	 * @returns {Promise}
	 */
	async closeActionsMenu(actionButton, actionsMenuElement) {
		console.debug("closeActionsMenu")
		return this.clickElement(
			actionButton,
			this.root.ownerDocument.body,
			() => this.root.ownerDocument.body.contains(actionsMenuElement) === false,
		)
	}

	/**
	 *
	 * @returns {Promise<HTMLButtonElement>|Promise<Error>}
	 */
	async openConfirmUnsendModal() {
		console.debug("Workflow step 3 : openConfirmUnsendModal")
		const unSendButton = await this.waitForElement(
			this.root.ownerDocument.body,
			() => [...this.root.ownerDocument.querySelectorAll("[role=dialog] [role=menu] [role=menuitem]")].filter(node => node.textContent.toLocaleLowerCase() === "unsend").pop(),
		)
		return this.clickElement(
			unSendButton,
			this.root.ownerDocument.body,
			() => this.root.ownerDocument.querySelector("[role=dialog] button"),
		)
	}
	/**
	 *
	 * @returns {Promise}
	 */
	async confirmUnsend(dialogButton) {
		console.debug("Workflow final step : confirmUnsend", dialogButton)
		await this.clickElement(
			dialogButton,
			this.root.ownerDocument.body,
			() => this.root.ownerDocument.querySelector("[role=dialog] button") === null
		)
	}

}
