import UIMessage from "../ui-message.js"

/**
 *
 * @param {Element} root
 * @returns {Element[]}
 */
export default async function findMessagesStrategy(root) {
	const elements = [...root.querySelectorAll("div[role=row]:not([data-idmu-ignore])")]
	const messageElements = []
	for(const element of elements) {
		const isMyOwnMessage = await UIMessage.isMyOwnMessage(element)
		if(isMyOwnMessage) {
			messageElements.push(element)
		} else {
			element.setAttribute("data-idmu-ignore", "")
		}
	}
	console.debug(messageElements)
	return messageElements
}
