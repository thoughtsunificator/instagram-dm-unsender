import UIMessage from "./ui-message.js"
import { waitForElement } from "../../dom/async-events.js"

/**
 *
 * @param {Element} root
 * @returns {Promise<Element[]>}
 */
export async function findMessages(root) {
	const elements = [...root.querySelectorAll("div[role=row]:not([data-idmu-ignore])")]
	console.debug("findMessages elements ", elements)
	const messageElements = []
	for(const element of elements) {
		const isMyOwnMessage = await UIMessage.isMyOwnMessage(element)
		if(isMyOwnMessage) {
			console.debug("findMessages adding ", element)
			messageElements.push(element)
		} else {
			console.debug("findMessages ignoring ", element)
			element.setAttribute("data-idmu-ignore", "")
		}
	}
	console.debug("findMessages hits", messageElements)
	return messageElements
}

/**
 *
 * @param {Window} window
 * @returns {HTMLDivElement}
 */
export function findMessagesWrapper(window) {
	return window.document.querySelector("div[role=grid] > div > div > div > div")
}

/**
 *
 * @param {Element} root
 * @returns {Promise<boolean>}
 */
export async function loadMoreMessages(root) {
	console.debug("loadMoreMessages")
	root.scrollTop = 0
	let findLoaderTimeout
	console.debug("loadMoreMessages looking for loader... ", root.ownerDocument.defaultView.IDMU_SCROLL_DETECTION_TIMEOUT)
	const controller = new AbortController()
	let loadingElement
	try {
		loadingElement = await Promise.race([
			waitForElement(root, () => {
				if(root.querySelector(`[role=progressbar]`) === null) {
					root.scrollTop = 0
				}
				return root.querySelector(`[role=progressbar]`)
			}, controller),
			new Promise(resolve => {
				findLoaderTimeout = setTimeout(() => {
					controller.abort()
					resolve()
				}, root.ownerDocument.defaultView.IDMU_SCROLL_DETECTION_TIMEOUT)
			})
		])
	} catch(ex) {
		console.error(ex)
	}
	clearTimeout(findLoaderTimeout)
	if(loadingElement) {
		console.debug("loadMoreMessages: Found loader; Stand-by until it is removed")
		console.debug("loadMoreMessages: scrollTop", root.scrollTop)
		await waitForElement(root, () => root.querySelector(`[role=progressbar]`) === null)
		console.debug("loadMoreMessages: Loader was removed, older messages loading completed")
		console.debug(`loadMoreMessages: scrollTop is ${root.scrollTop} we ${root.scrollTop === 0 ? "reached last page" : " did not reach last page and will begin loading older messages shortly"}`, )
		return root.scrollTop === 0
	} else {
		console.debug("loadMoreMessages: Could not find loader")
		return true
	}
}
