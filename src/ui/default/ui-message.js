/** @module ui-message UI element representing a message */

import UIComponent from "../ui-component.js"

class UIMessage extends UIComponent {

	/**
	 * Run a partial workflow on a message in addition to the early filtering process in order to filter out any element that was wrongly picked up early on.
	 * @param {HTMLDivElement} element
	 * @param {AbortController} abortController
	 * @returns {Promise<boolean>}
	 */
	static async isMyOwnMessage(element, abortController) {
		console.debug("isMyOwnMessage", element)
		// close menu in case it was left open
		element.querySelector("[aria-label=More]")?.parentNode?.click()
		element.querySelector(`[aria-label="Close details and actions"]`)?.click()
		element.dispatchEvent(new MouseEvent("mouseout", { bubbles: true }))
		const uiMessage = new UIMessage(element)
		let timeout
		const actionButton = await Promise.race([
			uiMessage.showActionsMenuButton(abortController),
			new Promise(resolve => {
				timeout = setTimeout(resolve, 200) // IDMU_MESSAGE_DETECTION_ACTION_MENU_TIMEOUT
			})
		])
		clearTimeout(timeout)
		if(actionButton) {
			console.debug("isMyOwnMessage: actionButton found looking for unsend action in actionsMenu")
			const actionsMenuElement = await uiMessage.openActionsMenu(actionButton, abortController)
			await uiMessage.closeActionsMenu(actionButton, actionsMenuElement, abortController)
			await uiMessage.hideActionMenuButton(abortController)
			console.debug(`isMyOwnMessage:  ${actionsMenuElement}, ${actionsMenuElement.textContent}`)
			return actionsMenuElement && actionsMenuElement.textContent.toLocaleLowerCase() === "unsend"
		} else {
			console.debug("isMyOwnMessage: Did not find actionButton")
		}
		return false
	}

	/**
	 * @param {AbortController} abortController
	 * @returns {Promise<HTMLButtonElement>}
	 */
	showActionsMenuButton(abortController) {
		console.debug("Workflow step 1 : showActionsMenuButton", this.root)
		this.root.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }))
		this.root.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }))
		this.root.dispatchEvent(new MouseEvent("mousenter", { bubbles: true }))
		// Some rows are empty and we do want the entire run to fail
		return this.waitForElement(this.root, () => this.root.querySelector("[aria-label=More]")?.parentNode, abortController) // TODO i18n
	}

	/**
	 * @param {AbortController} abortController
	 * @returns {Promise<boolean>}
	 */
	hideActionMenuButton(abortController) { // FIXME
		console.debug("hideActionMenuButton", this.root)
		this.root.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }))
		this.root.dispatchEvent(new MouseEvent("mouseout", { bubbles: true }))
		this.root.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true }))
		return this.waitForElement(this.root, () => this.root.querySelector("[aria-label=More]") === null, abortController) // TODO i18n
	}

	/**
	 *
	 * @param {HTMLButtonElement} actionButton
	 * @param {AbortController} abortController
	 * @returns {Promise}
	 */
	async openActionsMenu(actionButton, abortController) {
		console.debug("Workflow step 2 : Clicking actionButton and waiting for unsend menu item to appear", actionButton)
		const actionMenuElement = await this.clickElementAndWaitFor(
			actionButton,
			this.root.ownerDocument.body,
			() => {
				const menuElements = [...this.root.ownerDocument.querySelectorAll("[role=menu] [role=menuitem]")]
				console.debug("Workflow step 2 : ", menuElements.map(menuElement => menuElement.textContent))
				console.debug("Workflow step 2 : ", menuElements.find(node => node.textContent.trim().toLocaleLowerCase() === "unsend"))
				return menuElements.find(node => node.textContent.trim().toLocaleLowerCase() === "unsend") || menuElements.shift() // TODO i18n
			},
			abortController
		)
			;[...actionMenuElement.parentNode.parentNode.querySelectorAll("[role=menuitem]")].forEach(element => {
			if(element !== actionMenuElement) {
				element.remove()
			}
		})
		return actionMenuElement

	}

	/**
	 *
	 * @param {HTMLButtonElement} actionButton
	 * @param {HTMLDivElement} actionsMenuElement
	 * @param {AbortController} abortController
	 * @returns {Promise<boolean>}
	 */
	closeActionsMenu(actionButton, actionsMenuElement, abortController) {
		console.debug("closeActionsMenu")
		return this.clickElementAndWaitFor(
			actionButton,
			this.root.ownerDocument.body,
			() => this.root.ownerDocument.body.contains(actionsMenuElement) === false,
			abortController
		)
	}

	/**
	 * Click unsend button
	 * @param {AbortController} abortController
	 * @returns {Promise<HTMLButtonElement>|Promise<Error>}
	 */
	async openConfirmUnsendModal(abortController) {
		console.debug("Workflow step 3 : openConfirmUnsendModal")
		const unSendButton = await this.waitForElement(
			this.root.ownerDocument.body,
			() => [...this.root.ownerDocument.querySelectorAll("[role=dialog] [role=menu] [role=menuitem]")].filter(node => node.textContent.toLocaleLowerCase() === "unsend").pop(), // TODO i18n
			abortController
		)
		console.debug("Workflow step 3.5 : Found unsendButton; Clicking unsendButton and waiting for dialog to appear...")
		return this.clickElementAndWaitFor(
			unSendButton,
			this.root.ownerDocument.body,
			() => this.root.ownerDocument.querySelector("[role=dialog] button"),
			abortController
		)
	}

	/**
	 * Click unsend confirm button
	 * @param {HTMLButtonElement} dialogButton
	 * @param {AbortController} abortController
	 * @returns {Promise}
	 */
	async confirmUnsend(dialogButton, abortController) {
		console.debug("Workflow final step : confirmUnsend", dialogButton)
		// wait until confirm button is removed
		await this.clickElementAndWaitFor(
			dialogButton,
			this.root.ownerDocument.body,
			() => this.root.ownerDocument.querySelector("[role=dialog] button") === null,
			abortController
		)
	}

}

export default UIMessage
