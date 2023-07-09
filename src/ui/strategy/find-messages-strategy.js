import UIMessage from "../ui-message.js"

/**
 *
 * @param {Element} root
 * @returns {Promise<Element[]>}
 */
export default async function findMessagesStrategy(root) {
	const elements = [...root.querySelectorAll("div[role=row]:not([data-idmu-ignore])")]
	console.debug("findMessagesStrategy elements ", elements)
	const messageElements = []
	for(const element of elements) {
		const isMyOwnMessage = await UIMessage.isMyOwnMessage(element)
		if(isMyOwnMessage) {
			console.debug("findMessagesStrategy adding ", element)
			messageElements.push(element)
		} else {
			console.debug("findMessagesStrategy ignoring ", element)
			element.setAttribute("data-idmu-ignore", "")
		}
	}
	console.debug("findMessagesStrategy hits", messageElements)
	return messageElements
}
