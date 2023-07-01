/**
 *
 * @param {Window} window
 * @returns {Element}
 */
export default function findMessagesWrapperStrategy(window) {
	return window.document.querySelector("div[role=grid] > div > div > div > div")
}
