import waitFor from "../../dom/wait-for.js"
import UIComponent from "./ui-component.js"

export default class UIMessage extends UIComponent {

	/**
	*
	* @param {Node} root
	*/
	constructor(root) {
		super(root)
	}

	#isActionMenuButton(node) {
		if(node.nodeType === Node.ELEMENT_NODE) {
			const svgNode = node.querySelector("[aria-describedby] [role] [aria-label=Unsend], [aria-label=More]")
			if(svgNode) {
				return svgNode.parentNode
			}
		}
	}

	#isUnsendButton(node) {
		if(node.nodeType === Node.ELEMENT_NODE && node.querySelector("[style*=translate]")) {
			const button = [...node.ownerDocument.querySelectorAll("div[role] [role]")].pop() // TODO SELECTOR_ACTIONS_MENU_UNSEND_SELECTOR
			if(button) {
				if(button.textContent.toLocaleLowerCase() === "unsend") {
					return button
				}
			}
		}
	}

	#isDialogButton(node) {
		if(node.nodeType === Node.ELEMENT_NODE) {
			return node.querySelector("[role=dialog] button")
		}
	}

	async showActionsMenu() {
		console.debug("showActionsMenu")
		this.root.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }))
		const actionButton = await waitFor(this.root.ownerDocument.body, (node) => this.#isActionMenuButton(node))
		this.identifier.actionButton = actionButton
	}

	async openActionsMenu() {
		console.debug("openActionsMenu", this.identifier.actionButton)
		if(this.identifier.actionButton.click) {
			this.identifier.actionButton.click()
		} else{
			this.identifier.actionButton.parentNode.click()
		}
		const unSendButton = await waitFor(this.root.ownerDocument.body, (node) => this.#isUnsendButton(node)) // TODO i18n
		this.identifier.unSendButton = unSendButton
	}

	async clickUnsend() {
		console.debug("clickUnsend", this.identifier.unSendButton)
		this.identifier.unSendButton.click()
		this.identifier.dialogButton = await waitFor(this.root.ownerDocument.body, (node) => this.#isDialogButton(node))
	}

	async confirmUnsend() {
		console.debug("confirmUnsend", this.identifier.dialogButton)
		this.identifier.dialogButton.click()
		await waitFor(this.root.ownerDocument.body, node => node.nodeType === Node.ELEMENT_NODE && node.contains(this.root) || node === this.root, true)
	}

}
