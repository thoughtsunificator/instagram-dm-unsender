import { waitForElement } from "../dom/wait-for-element.js"
import UIComponent from "./ui-component.js"

export default class UIMessage extends UIComponent {

	/**
	 *
	 * @returns {Promise<[HTMLButtonElement]>}
	 */
	async showActionsMenuButton() {
		console.debug("Workflow step 1 : showActionsMenuButton")
		this.root.scrollIntoView()
		const promise = waitForElement(this.root.ownerDocument.body, () => {
			return this.root.querySelector("[aria-label=More]")
		})
		this.root.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }))
		this.root.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }))
		this.root.dispatchEvent(new MouseEvent("mousenter", { bubbles: true }))
		return promise
	}

	hideActionMenuButton() {
		this.root.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }))
		this.root.dispatchEvent(new MouseEvent("mouseout", { bubbles: true }))
		this.root.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true }))
	}


	/**
	 *
	 * @param {HTMLButtonElement} actionButton
	 */
	async openActionsMenu(actionButton) {
		console.debug("Workflow step 2 : openActionsMenu", actionButton)
		this.identifier.actionButton = actionButton
		const promise = waitForElement(this.root.ownerDocument.body, () => {
			const dialog = this.root.ownerDocument.querySelector("[role=dialog]")
			if(dialog) {
				this.identifier.actionsMenu = dialog
			}
			return dialog
		})
		actionButton.click()
		return promise
	}

	closeActionsMenu() {
		const promise = waitForElement(this.root.ownerDocument.body, () => {
			const contains = this.root.ownerDocument.body.contains(this.identifier.actionsMenu)
			if(contains === false) {
				this.identifier.actionsMenu = null
			}
			return contains === false
		})
		this.identifier.actionButton.click()
		return promise
	}

	/**
	 *
	 * @returns {Promise<HTMLButtonElement>|Promise<Error>}
	 */
	async openConfirmUnsendModal() {
		console.debug("Workflow step 3 : openConfirmUnsendModal")
		const unSendButton = await waitForElement(this.root.ownerDocument.body, () => {
			return [...this.root.ownerDocument.querySelectorAll("[role=dialog] [role=menu] [role=menuitem]")].filter(node => node.textContent.toLocaleLowerCase() === "unsend").pop()
		})
		unSendButton.click()
		return await Promise.race([
			waitForElement(this.root.ownerDocument.body, () => this.root.ownerDocument.querySelector("[role=dialog] button")),
			new Promise((resolve, reject) => setTimeout(() => reject(new Error("Unable to find dialogButton")), 2000)),
		])
	}

	async confirmUnsend(dialogButton) {
		console.debug("Workflow final step : confirmUnsend", dialogButton)
		dialogButton.click()
		return Promise.race([
			waitForElement(this.root.ownerDocument.body, () => this.root.ownerDocument.querySelector("[role=dialog]")),
			new Promise((resolve, reject) => setTimeout(() => reject(new Error("Unable to confirm unsend")), 2000)),
		])
	}

}
