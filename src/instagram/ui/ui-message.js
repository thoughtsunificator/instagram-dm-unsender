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


	showActionsMenuButton() {
		console.debug("showActionsMenuButton")
		;[...this.root.ownerDocument.querySelectorAll("div")].forEach(node => node.dispatchEvent(new MouseEvent("mousemove", { bubbles: true })))
		;[...this.root.ownerDocument.querySelectorAll("div")].forEach(node => node.dispatchEvent(new MouseEvent("mouseover", { bubbles: true })))
		;[...this.root.ownerDocument.querySelectorAll("div")].forEach(node => node.dispatchEvent(new MouseEvent("mousenter", { bubbles: true })))
	}

	hideActionMenuButton() {
		console.debug("hideActionMenuButton")
		;[...this.root.ownerDocument.querySelectorAll("div")].forEach(node => node.dispatchEvent(new MouseEvent("mousemove", { bubbles: true })))
		;[...this.root.ownerDocument.querySelectorAll("div")].forEach(node => node.dispatchEvent(new MouseEvent("mouseout", { bubbles: true })))
		;[...this.root.ownerDocument.querySelectorAll("div")].forEach(node => node.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true })))
	}

	async openActionsMenu() {
		console.debug("openActionsMenu")
		this.identifier.actionButton = await new Promise((resolve, reject) => {
			setTimeout(() => {
				const button = [...this.root.ownerDocument.querySelectorAll("[aria-describedby] [role] [aria-label=Unsend], [aria-label=More]")].pop()
				if(button) {
					resolve(button)
					return
				}
				reject("Unable to find actionButton")
			})
		})
		console.debug(this.identifier.actionButton)
		this.identifier.actionButton.parentNode.click()
	}

	closeActionsMenu() {
		console.debug("hideActionMenuButton")
		if(this.identifier.actionButton) {
			this.identifier.actionButton.parentNode.click()
		}
	}

	async clickUnsend() {
		console.debug("clickUnsend")
		this.identifier.unSendButton = await new Promise((resolve, reject) => {
			setTimeout(() => {
				if(this.root.ownerDocument.querySelector("[style*=translate]")) {
					const button = [...this.root.ownerDocument.querySelectorAll("div[role] [role]")].pop()
					if(button) {
						if(button.textContent.toLocaleLowerCase() === "unsend") {
							resolve(button)
							return
						}
						reject("Unable to find unSendButton")
					}
				}
			})
		})
		console.debug(this.identifier.unSendButton)
		this.identifier.unSendButton.click()
		this.identifier.dialogButton = await waitFor(this.root.ownerDocument.body, () => this.root.ownerDocument.querySelector("[role=dialog] button"))
	}

	async confirmUnsend() {
		console.debug("confirmUnsend", this.identifier.dialogButton)
		this.identifier.dialogButton.click()
	}

}
