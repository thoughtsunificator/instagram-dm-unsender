import { WorkflowElement } from "../workflow/workflow-element.js"
import { dismissStaleOverlays } from "./overlays.js"

export { Thread, findMessagesWrapper, findScrollableChild, isThreadPath }

const THREAD_PATH_PREFIX = "/direct/t/"

/**
 * A conversation of Instagram's direct messages.
 *
 * @param {MessagesWrapper} messagesWrapper
 */
function Thread(messagesWrapper) {
	WorkflowElement.call(this, messagesWrapper.root)
	this.messagesWrapper = messagesWrapper
}
Thread.prototype = Object.create(WorkflowElement.prototype)
Thread.prototype.constructor = Thread

/**
 * @param {Window} window
 * @returns {boolean} whether the browser is on a conversation
 */
function isThreadPath(window) {
	return window.location.pathname.startsWith(THREAD_PATH_PREFIX)
}

/**
 * Closes stale dialogs and menus left behind by a previous failed action
 */
Thread.prototype.dismissStaleOverlays = function() {
	dismissStaleOverlays(this.root.ownerDocument)
}

/**
 * Finds the scrollable element holding the conversation messages.
 *
 * @param {Window} window
 * @returns {Element|null}
 */
function findMessagesWrapper(window) {
	const conversation = window.document.querySelector("[data-pagelet='IGDMessagesList']")
	if(!conversation) {
		return null
	}
	return findScrollableChild(conversation, window)
}

/**
 * Depth first search of the first element that scrolls vertically
 *
 * @param {Element} parent
 * @param {Window}  window
 * @returns {Element|null}
 */
function findScrollableChild(parent, window) {
	for(const child of parent.children) {
		const style = window.getComputedStyle(child)
		if((style.overflowY === "auto" || style.overflowY === "scroll") && child.scrollHeight > child.clientHeight) {
			return child
		}
		const found = findScrollableChild(child, window)
		if(found) {
			return found
		}
	}
	return null
}
