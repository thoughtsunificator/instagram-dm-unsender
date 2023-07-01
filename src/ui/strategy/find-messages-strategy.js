/**
 *
 * @param {Element} root
 * @returns {Element[]}
 */
export default async function findMessagesStrategy(root) {
	const elements = [...root.querySelectorAll("div[role=row]:not([data-idmu-processed])")]
	const messageElements = []
	for(const element of elements) {
		element.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }))
		element.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }))
		element.dispatchEvent(new MouseEvent("mousenter", { bubbles: true }))
		const foundUnsendButton = await new Promise((resolve) => {
			setTimeout(async () => {
				const moreButton = element.querySelector("[aria-label=More]")
				if(moreButton) {
					const promise = new Promise(resolve_ => {
						new MutationObserver((mutations, observer) => {
							const dialogElement = [...element.ownerDocument.body.querySelectorAll("[role=dialog]")].pop()
							if(dialogElement) {
								observer.disconnect()
								resolve_(dialogElement)
							}
						}).observe(element.ownerDocument.body, { subtree: true, childList:true })
					})
					moreButton.click()
					const actionMenuElement = await promise
					let unsendButtonFound = false
					if(actionMenuElement) {
						unsendButtonFound = !![...actionMenuElement.querySelectorAll("[role=menu] [role=menuitem]")].find(node => node.textContent.toLocaleLowerCase() === "unsend")
					}
					moreButton.click()
					setTimeout(() => resolve(unsendButtonFound))
				} else {
					resolve(false)
				}
			})
		})
		if(foundUnsendButton === true) {
			messageElements.push(element)
		} else {
			element.setAttribute("data-idmu-processed", "")
		}
	}
	console.debug(messageElements)
	return messageElements
}
