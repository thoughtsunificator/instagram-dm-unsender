import { Thread, findMessagesWrapper, isThreadPath } from "../../../instagram/thread.js"
import { MessagesWrapper } from "../../../instagram/messages-wrapper.js"

export { discoverThread }

/**
 * Detects whether the current page is a conversation.
 *
 * @param {Window} window
 * @returns {Thread|null} null when the page is not a conversation
 * @throws {Error} when on a conversation but its messages container cannot be found
 */
function discoverThread(window) {
	if(!isThreadPath(window)) {
		return null
	}
	const scrollable = findMessagesWrapper(window)
	if(scrollable === null) {
		throw new Error("Unable to find messages wrapper, the query selector might be out of date. Please open an issue: https://github.com/thoughtsunificator/instagram-dm-unsender/issues/new?template=bug_report.md")
	}
	return new Thread(new MessagesWrapper(scrollable))
}
