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


	async showActionsMenu() {
		console.debug("showActionsMenu")
		this.root?.firstChild.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }))
		this.root?.firstChild.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }))
		this.root?.firstChild.dispatchEvent(new MouseEvent("mousenter", { bubbles: true }))
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
	}

	async openActionsMenu() {
		console.debug("openActionsMenu", this.identifier.actionButton)
		this.identifier.actionButton.parentNode.click()
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
	}

	async clickUnsend() {
		console.debug("clickUnsend", this.identifier.unSendButton)
		this.identifier.unSendButton.click()
		this.identifier.dialogButton = await waitFor(this.root.ownerDocument.body, () => this.root.ownerDocument.querySelector("[role=dialog] button"))
	}

	async confirmUnsend() {
		console.debug("confirmUnsend", this.identifier.dialogButton)
		this.identifier.dialogButton.click()
		await waitFor(this.root.ownerDocument.body, node => node.nodeType === Node.ELEMENT_NODE && node.contains(this.root) || node === this.root, true)
	}

}
