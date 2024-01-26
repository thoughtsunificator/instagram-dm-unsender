/** @module ui-message UI element representing a message */

import UIComponent from "../ui-component.js"

class UIMessage extends UIComponent {

	/**
	 * Run a partial workflow on a message in addition to the early filtering process in order to filter out any element that was wrongly picked up early on.
	 * @param {HTMLDivElement} element
	 * @returns {Promise<boolean>}
	 */
	static async isMyOwnMessage(element) {
		console.debug("isMyOwnMessage", element)
		// close menu in case it was left open
		element.querySelector("[aria-label=More]")?.parentNode?.click()
		element.querySelector(`[aria-label="Close details and actions"]`)?.click()
		element.dispatchEvent(new MouseEvent("mouseout", { bubbles: true }))
		await new Promise(resolve => {
			setTimeout(resolve, 200)
		})
		const uiMessage = new UIMessage(element)
		let timeout
		const actionButton = await Promise.race([
			uiMessage.showActionsMenuButton(),
			new Promise(resolve => {
				timeout = setTimeout(resolve, 200) // IDMU_MESSAGE_DETECTION_ACTION_MENU_TIMEOUT
			})
		])
		clearTimeout(timeout)
		if(actionButton) {
			console.debug("actionButton found looking for unsend action in actionsMenu")
			const actionsMenuElement = await uiMessage.openActionsMenu(actionButton)
			await uiMessage.closeActionsMenu(actionButton, actionsMenuElement)
			await uiMessage.hideActionMenuButton()
			console.debug(actionsMenuElement, actionsMenuElement.textContent)
			return actionsMenuElement && actionsMenuElement.textContent.toLocaleLowerCase() === "unsend"
		} else {
			console.debug("Did not find actionButton")
		}
		return false
	}

	scrollIntoView() {
		this.root.scrollIntoView()
	}

	/**
	 *
	 * @returns {Promise<HTMLButtonElement>}
	 */
	showActionsMenuButton() {
		console.debug("Workflow step 1 : showActionsMenuButton")
		this.root.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }))
		this.root.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }))
		this.root.dispatchEvent(new MouseEvent("mousenter", { bubbles: true }))
		// Some rows are empty and we do want the entire run to fail
		return this.waitForElement(this.root, () => this.root.querySelector("[aria-label=More]")?.parentNode) // TODO i18n
	}

	/**
	 *
	 * @returns {Promise<boolean>}
	 */
	hideActionMenuButton() {
		console.debug("Workflow rolling back hideActionMenuButton (something went wrong)")
		this.root.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }))
		this.root.dispatchEvent(new MouseEvent("mouseout", { bubbles: true }))
		this.root.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true }))
		return this.waitForElement(this.root, () => this.root.querySelector("[aria-label=More]") === null) // TODO i18n
	}

	/**
	 *
	 * @param {HTMLButtonElement} actionButton
	 * @returns {Promise}
	 */
	async openActionsMenu(actionButton) {
		console.debug("Workflow step 2 : Clicking actionButton and waiting for unsend menu item to appear", actionButton)
		const actionMenuElement = await this.clickElementAndWaitFor(
			actionButton,
			this.root.ownerDocument.body,
			() => {
				const menuElements = [...this.root.ownerDocument.querySelectorAll("[role=menu] [role=menuitem]")]
				console.debug("Workflow step 2 : ", menuElements.map(menuElement => menuElement.textContent))
				console.debug("Workflow step 2 : ", menuElements.find(node => node.textContent.trim().toLocaleLowerCase() === "unsend"))
				return menuElements.find(node => node.textContent.trim().toLocaleLowerCase() === "unsend") || menuElements.shift()
			},
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
	 * @returns {Promise<boolean>}
	 */
	closeActionsMenu(actionButton, actionsMenuElement) {
		console.debug("closeActionsMenu")
		return this.clickElementAndWaitFor(
			actionButton,
			this.root.ownerDocument.body,
			() => this.root.ownerDocument.body.contains(actionsMenuElement) === false,
		)
	}

	/**
	 * Click unsend button
	 * @returns {Promise<HTMLButtonElement>|Promise<Error>}
	 */
	async openConfirmUnsendModal() {
		console.debug("Workflow step 3 : openConfirmUnsendModal")
		const unSendButton = await this.waitForElement(
			this.root.ownerDocument.body,
			() => [...this.root.ownerDocument.querySelectorAll("[role=dialog] [role=menu] [role=menuitem]")].filter(node => node.textContent.toLocaleLowerCase() === "unsend").pop(), // TODO i18n
		)
		console.debug("Workflow step 3.5 : Found unsendButton; Clicking unsendButton and waiting for dialog to appear...")
		return this.clickElementAndWaitFor(
			unSendButton,
			this.root.ownerDocument.body,
			() => this.root.ownerDocument.querySelector("[role=dialog] button"),
		)
	}

	/**
	 * Click unsend confirm button
	 * @param {HTMLButtonElement} dialogButton
	 * @returns {Promise}
	 */
	async confirmUnsend(dialogButton) {
		console.debug("Workflow final step : confirmUnsend", dialogButton)
		// wait until confirm button is removed
		await this.clickElementAndWaitFor(
			dialogButton,
			this.root.ownerDocument.body,
			() => this.root.ownerDocument.querySelector("[role=dialog] button") === null
		)
	}

}

export default UIMessage
