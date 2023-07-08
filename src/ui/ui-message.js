import UIComponent from "./ui-component.js"

export default class UIMessage extends UIComponent {

	/**
	 *
	 * @param {HTMLDivElement} element
	 * @returns {Promise<boolean>}
	 */
	static async isMyOwnMessage(element) {
		element.querySelector("[aria-label=More][aria-expanded=true]")?.click()
		element.querySelector(`[aria-label="Close details and actions"]`)?.click()
		element.dispatchEvent(new MouseEvent("mouseout", { bubbles: true }))
		const uiMessage = new UIMessage(element)
		let timeout
		const actionButton = await Promise.race([
			uiMessage.showActionsMenuButton(),
			new Promise(resolve => {
				timeout = setTimeout(resolve, 20)
			})
		])
		clearTimeout(timeout)
		if(actionButton) {
			const actionsMenuElement = await uiMessage.openActionsMenu(actionButton) // TODO i18n
			await uiMessage.closeActionsMenu(actionButton, actionsMenuElement)
			await uiMessage.hideActionMenuButton()
			return actionsMenuElement && actionsMenuElement.textContent.toLocaleLowerCase() === "unsend"
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
		return this.waitForElement(this.root, () => this.root.querySelector("[aria-label=More]")) // TODO i18n
	}

	/**
	 *
	 * @returns {Promise<boolean>}
	 */
	hideActionMenuButton() {
		console.debug("hideActionMenuButton")
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
		console.debug("Workflow step 2 : openActionsMenu", actionButton)
		const actionMenuElement = await this.clickElementAndWaitFor(
			actionButton,
			this.root.ownerDocument.body,
			() => {
				const menuElements = [...this.root.ownerDocument.querySelectorAll("[role=menu] [role=menuitem]")]
				menuElements.sort(node => node.textContent.toLocaleLowerCase() === "unsend" ? -1 : 0) // TODO i18n
				return menuElements.shift()
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
	 *
	 * @returns {Promise<HTMLButtonElement>|Promise<Error>}
	 */
	async openConfirmUnsendModal() {
		console.debug("Workflow step 3 : openConfirmUnsendModal")
		const unSendButton = await this.waitForElement(
			this.root.ownerDocument.body,
			() => [...this.root.ownerDocument.querySelectorAll("[role=dialog] [role=menu] [role=menuitem]")].filter(node => node.textContent.toLocaleLowerCase() === "unsend").pop(), // TODO i18n
		)
		return this.clickElementAndWaitFor(
			unSendButton,
			this.root.ownerDocument.body,
			() => this.root.ownerDocument.querySelector("[role=dialog] button"),
		)
	}

	/**
	 *
	 * @param {HTMLButtonElement} dialogButton
	 * @returns {Promise}
	 */
	async confirmUnsend(dialogButton) {
		console.debug("Workflow final step : confirmUnsend", dialogButton)
		await this.clickElementAndWaitFor(
			dialogButton,
			this.root.ownerDocument.body,
			() => this.root.ownerDocument.querySelector("[role=dialog] button") === null
		)
	}

}
