import UIMessagesWrapper from "../ui-messages-wrapper.js"

/**
 *
 * @param {Window} window
 * @returns {HTMLDivElement}
 */
export default function findMessagesWrapperStrategy(window) {
	return UIMessagesWrapper.find(window)
}
