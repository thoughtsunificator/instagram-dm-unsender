import UIComponent from "./ui-component.js"

export default class UIMessage extends UIComponent {

	showActionsMenuButton() {
		console.debug("Workflow step 1 : showActionsMenuButton")
		this.root.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }))
		this.root.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }))
		this.root.dispatchEvent(new MouseEvent("mousenter", { bubbles: true }))
	}

	hideActionMenuButton() {
		this.root.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }))
		this.root.dispatchEvent(new MouseEvent("mouseout", { bubbles: true }))
		this.root.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true }))
	}


	async openActionsMenu() {
		console.debug("Workflow step 2 : openActionsMenu")
		this.identifier.actionButton = await new Promise((resolve, reject) => {
			setTimeout(() => {
				const button = this.root.querySelector("[aria-label=More]")
				if(button) {
					resolve(button)
					return
				}
				reject("Unable to find actionButton")
			})
		})
		this.identifier.actionButton.click()
	}

	closeActionsMenu() {
		this.root.click()
	}

	async clickUnsend() {
		console.debug("Workflow step 3 : clickUnsend")
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
		this.identifier.unSendButton.click()
		this.identifier.dialogButton =  await Promise.race([
			new Promise((resolve, reject) => setTimeout(() => reject("Unable to find dialogButton"), 2000)),
			await new Promise((resolve) => {
				new MutationObserver((mutations, observer) => {
					const dialogButton = this.root.ownerDocument.querySelector("[role=dialog] button")
					if(dialogButton) {
						observer.disconnect()
						resolve(dialogButton)
					}
				}).observe(this.root.ownerDocument.body, { subtree: true, childList:true })
			})
		])
	}

	async confirmUnsend() {
		console.debug("Workflow final step : confirmUnsend", this.identifier.dialogButton)
		this.identifier.dialogButton.click()
	}

}
